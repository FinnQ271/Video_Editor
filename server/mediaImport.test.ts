import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parseVideoUrl, isTikTokUrl } from '../src/utils/videoUrl.ts'
import { isPublicAddress, validateRemoteUrl, mediaImportHandler, tikTokDownloadArgs, tikTokDownloadError, MAX_BYTES } from './mediaImport.ts'

test('TikTok copied share text and direct video URLs', () => {
  assert.equal(parseVideoUrl('Xem video này https://vt.tiktok.com/abc123/ sao chép liên kết').hostname, 'vt.tiktok.com')
  assert.equal(parseVideoUrl('https://example.com/video.mp4?token=abc&x=1').search, '?token=abc&x=1')
  assert.equal(isTikTokUrl(new URL('https://www.tiktok.com/@creator/video/123')), true)
  assert.equal(isTikTokUrl(new URL('https://tiktok.com.evil.example/video/123')), false)
  assert.throws(() => parseVideoUrl('không có liên kết'))
  assert.throws(() => parseVideoUrl('https://user:password@example.com/video.mp4'))
})
test('block local networks, credentials and non-web protocols', () => {
  for (const ip of ['127.0.0.1','10.1.1.1','172.16.0.1','192.168.0.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1']) {
    assert.equal(isPublicAddress(ip),false,ip)
  }
  assert.equal(isPublicAddress('8.8.8.8'),true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'),true)
  for (const url of ['file:///etc/passwd','https://127.0.0.1/video.mp4','http://[::1]/video','https://localhost/','https://example.com:444/video']) {
    assert.throws(()=>validateRemoteUrl(new URL(url)),url)
  }
})
test('local endpoint rejects malformed requests and internal URLs', async () => {
  const server=createServer((req,res)=>{void mediaImportHandler(req,res)})
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  try {
    const url='http://127.0.0.1:'+(server.address() as AddressInfo).port
    assert.equal((await fetch(url)).status,405)
    assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'})).status,403)
    for (const link of ['http://127.0.0.1/video.mp4','https://www.tiktok.com/@someone']) {
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:link})})
      assert.equal(response.status,400)
      assert.ok((await response.json()).error)
    }
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())) }
})

test('TikTok resolves and downloads in one invocation with bounded output', () => {
  const args = tikTokDownloadArgs(new URL('https://www.tiktok.com/@example/video/123'), 'temporary-folder')
  assert.ok(!args.includes('--skip-download'))
  assert.ok(!args.includes('--dump-single-json'))
  assert.ok(args.includes('--ignore-config'))
  assert.equal(args[args.indexOf('--max-filesize') + 1], String(MAX_BYTES))
  assert.equal(args[args.indexOf('-o') + 1], join('temporary-folder', 'video.%(ext)s'))
  assert.equal(args.at(-2), '--')
  assert.equal(args.at(-1), 'https://www.tiktok.com/@example/video/123')
})
test('TikTok errors distinguish blocked IP, login, expired video and rate limiting', () => {
  assert.match(tikTokDownloadError({stderr:'Your IP address is blocked from accessing this post'}), /chặn địa chỉ IP/)
  assert.match(tikTokDownloadError({stderr:'Login required'}), /đăng nhập/)
  assert.match(tikTokDownloadError({stderr:'Video unavailable'}), /không khả dụng/)
  assert.match(tikTokDownloadError({stderr:'HTTP Error 403: Forbidden'}), /giới hạn truy cập/)
  assert.match(tikTokDownloadError({code:'ENOENT'}), /Chưa cài/)
  assert.match(tikTokDownloadError({killed:true}), /quá lâu/)
})
