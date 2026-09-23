import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, createReadStream } from 'node:fs'
import { mkdtemp, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parseVideoUrl, isTikTokUrl } from '../src/utils/videoUrl.ts'

const exec = promisify(execFile)
export const MAX_BYTES = 256 * 1024 * 1024
const blocked = new BlockList()
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(ip, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
blocked.addSubnet('2001:db8::', 32, 'ipv6')

export function isPublicAddress(address: string) {
  const family = isIP(address)
  return family === 4 ? !blocked.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}
export function validateRemoteUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80','443'].includes(url.port))) throw new Error('Chỉ hỗ trợ URL HTTP/HTTPS công khai.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || (isIP(host) && !isPublicAddress(host))) {
    throw new Error('Không hỗ trợ địa chỉ nội bộ hoặc địa chỉ máy tính.')
  }
}

async function publicRequest(url: URL, signal: AbortSignal, headers: Record<string, string> = {}, redirects = 0): Promise<IncomingMessage> {
  validateRemoteUrl(url)
  if (redirects > 5) throw new Error('Liên kết chuyển hướng quá nhiều lần.')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error('Liên kết không trỏ tới máy chủ công khai.')
  const address = addresses[0]
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      signal, headers: { 'User-Agent': 'Mozilla/5.0', ...headers },
      // Pin the validated address to avoid a second DNS lookup changing the destination.
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [address])
        else callback(null, address.address, address.family)
      },
    }, resolve)
    request.setTimeout(30000, () => request.destroy(new Error('Máy chủ video không phản hồi.')))
    request.on('error', reject)
    request.end()
  })
  if ([301,302,303,307,308].includes(response.statusCode ?? 0)) {
    const location = response.headers.location
    response.destroy()
    if (!location) throw new Error('Chuyển hướng video không hợp lệ.')
    return publicRequest(new URL(location, url), signal, headers, redirects + 1)
  }
  if ((response.statusCode ?? 500) >= 400) {
    response.destroy()
    throw new Error('Máy chủ từ chối tải video. Link có thể hết hạn, riêng tư hoặc yêu cầu đăng nhập.')
  }
  return response
}

export function tikTokDownloadError(error: unknown) {
  const failure = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean }
  const detail = failure.stderr ?? ''
  if (failure.code === 'ENOENT') return 'Chưa cài bộ tải TikTok. Chạy npm run setup:downloader rồi thử lại.'
  if (/IP address is blocked|ip.*blocked/i.test(detail)) return 'TikTok đang chặn địa chỉ IP này. Ứng dụng chưa thể tải video từ mạng hiện tại. Bạn có thể tải video bằng ứng dụng TikTok rồi chọn Browse files để nhập.'
  if (/login|log in|sign in|private|friends.only/i.test(detail)) return 'Video TikTok yêu cầu đăng nhập hoặc không công khai. Hãy chọn video công khai hoặc nhập tệp video đã tải bằng Browse files.'
  if (/not available|unavailable|removed|deleted|not found|404/i.test(detail)) return 'Video TikTok đã bị xóa, không khả dụng hoặc liên kết không còn đúng.'
  if (/filesize|file.*size|larger than|too large/i.test(detail)) return 'Video vượt giới hạn 256 MB.'
  if (failure.killed || /timed out|timeout/i.test(detail)) return 'TikTok phản hồi quá lâu. Hãy thử lại sau.'
  if (/403|forbidden|429|too many requests/i.test(detail)) return 'TikTok từ chối tải video (giới hạn truy cập). Hãy thử lại sau hoặc nhập tệp video bằng Browse files.'
  return 'Không tải được video TikTok. Kiểm tra link của một video công khai hoặc cập nhật bộ tải bằng npm run setup:downloader.'
}

export function tikTokDownloadArgs(url: URL, directory: string) {
  return [
    '--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-cache-dir', '--proxy', '',
    '--socket-timeout', '20', '--retries', '1', '--max-filesize', String(MAX_BYTES),
    '--no-part', '--no-continue', '--no-mtime', '--no-write-info-json', '--no-write-thumbnail',
    // One playable stream avoids a separate FFmpeg installation for merging.
    '-f', 'best[ext=mp4]/best[ext=webm]',
    '-o', join(directory, 'video.%(ext)s'), '--', url.href,
  ]
}

async function downloadTikTok(url: URL, res: ServerResponse, signal: AbortSignal) {
  const allowed = ['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com']
  if (!allowed.includes(url.hostname) || !(url.pathname.match(/\/video\/\d+/) || url.hostname === 'vm.tiktok.com' || url.hostname === 'vt.tiktok.com' || url.pathname.startsWith('/t/'))) {
    throw new Error('Hãy dán liên kết của một video TikTok, không phải trang hồ sơ.')
  }
  const local = join(process.cwd(), 'tools', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
  const executable = process.env.YTDLP_PATH || (existsSync(local) ? local : 'yt-dlp')
  const directory = await mkdtemp(join(tmpdir(), 'video-editor-tiktok-'))
  try {
    // Resolve AND download in one yt-dlp session, retaining the media headers/cookies.
    try {
      await exec(executable, tikTokDownloadArgs(url, directory), {
        windowsHide: true, signal, timeout: 120000, maxBuffer: 8 * 1024 * 1024,
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new Error(tikTokDownloadError(error))
    }
    const filename = ['video.mp4', 'video.webm'].find(name => existsSync(join(directory, name)))
    if (!filename) throw new Error('Không nhận được tệp video. Video có thể vượt giới hạn 256 MB hoặc không có định dạng phù hợp.')
    const file = join(directory, filename)
    const info = await stat(file)
    if (!info.isFile() || info.size === 0) throw new Error('TikTok trả về tệp video rỗng.')
    if (info.size > MAX_BYTES) throw new Error('Video vượt giới hạn 256 MB.')
    res.setHeader('Content-Type', filename.endsWith('.webm') ? 'video/webm' : 'video/mp4')
    res.setHeader('Content-Length', info.size)
    res.setHeader('X-Video-Name', encodeURIComponent('TikTok-' + filename))
    res.setHeader('Cache-Control', 'no-store')
    await pipeline(createReadStream(file), res, { signal })
  } finally {
    // Only remove the unique temporary directory created by this request.
    if (dirname(directory) === tmpdir() && basename(directory).startsWith('video-editor-tiktok-')) {
      await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  }
}

let activeImports = 0
export async function mediaImportHandler(req: IncomingMessage, res: ServerResponse) {
  // This downloader is for the local editing app, not a public forwarding endpoint.
  const peer = req.socket.remoteAddress
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer ?? '')) { res.writeHead(403).end(); return }
  if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host && req.headers.origin !== 'https://' + req.headers.host) { res.writeHead(403).end(); return }
  const fail = (status: number, error: string) => {
    if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify({error}))
    else res.destroy()
  }
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); fail(405,'Dùng phương thức POST.'); return }
  if (!req.headers['content-type']?.startsWith('application/json')) { fail(415,'Yêu cầu dữ liệu JSON.'); return }
  if (activeImports >= 2) { fail(429,'Đang tải video khác. Vui lòng chờ rồi thử lại.'); return }
  activeImports++
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000)
  const disconnected = () => { if (!res.writableFinished) controller.abort() }
  res.on('close', disconnected)
  req.on('aborted', disconnected)
  try {
    let body = ''
    for await (const chunk of req) {
      body += chunk.toString()
      if (body.length > 8192) throw new Error('Liên kết quá dài.')
    }
    const data = JSON.parse(body) as { url?: unknown }
    if (typeof data.url !== 'string') throw new Error('Thiếu liên kết video.')
    const source = parseVideoUrl(data.url)
    validateRemoteUrl(source)
    if (isTikTokUrl(source)) {
      await downloadTikTok(source, res, controller.signal)
      return
    }
    const media = { url: source, name: decodeURIComponent(source.pathname.split('/').pop() || 'video.mp4'), headers: {} }
    const remote = await publicRequest(media.url, controller.signal, media.headers)
    const contentType = String(remote.headers['content-type'] || '').split(';')[0].toLowerCase()
    const ext = media.name.split('.').pop()?.toLowerCase()
    const inferred = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'
    const allowedTypes = ['video/mp4','video/webm','video/quicktime','video/x-m4v']
    if (!allowedTypes.includes(contentType) && !(contentType === 'application/octet-stream' && ['mp4','webm','mov','m4v'].includes(ext || ''))) {
      remote.destroy()
      throw new Error('Link này không trả về tệp video MP4/WebM/MOV. Hãy dùng link video trực tiếp hoặc link TikTok.')
    }
    const length = Number(remote.headers['content-length'])
    if (Number.isFinite(length) && length > MAX_BYTES) { remote.destroy(); throw new Error('Video vượt giới hạn 256 MB.') }
    const type = allowedTypes.includes(contentType) ? contentType : inferred
    // Sanitize untrusted filenames before returning them to the browser.
    // eslint-disable-next-line no-control-regex
    let name = media.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,160) || 'video'
    if (!/\.(mp4|webm|mov|m4v)$/i.test(name)) name += type === 'video/webm' ? '.webm' : type === 'video/quicktime' ? '.mov' : '.mp4'
    res.setHeader('Content-Type', type)
    res.setHeader('X-Video-Name', encodeURIComponent(name))
    res.setHeader('Cache-Control','no-store')
    if (Number.isFinite(length) && length > 0) res.setHeader('Content-Length', length)
    let received = 0
    const limiter = new Transform({ transform(chunk, _encoding, callback) {
      received += chunk.length
      callback(received > MAX_BYTES ? new Error('Video vượt giới hạn 256 MB.') : null, chunk)
    } })
    await pipeline(remote, limiter, res, { signal: controller.signal })
  } catch (error) {
    fail(400, controller.signal.aborted ? 'Đã hủy hoặc quá thời gian tải video.' : error instanceof Error ? error.message : 'Không tải được video.')
  } finally {
    clearTimeout(timeout)
    res.off('close', disconnected)
    req.off('aborted', disconnected)
    activeImports--
  }
}
