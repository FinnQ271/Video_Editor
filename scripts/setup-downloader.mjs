import { mkdir, writeFile, chmod } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// Download the official release and verify its published SHA-256 before writing the executable.
const release = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {headers:{'User-Agent':'VideoEditorStudio'}})
if (!release.ok) throw new Error('Could not fetch the official yt-dlp release.')
const { assets } = await release.json()
const name = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
const binary = assets.find(asset => asset.name === name)
const sums = assets.find(asset => asset.name === 'SHA2-256SUMS')
if (!binary || !sums) throw new Error('Release files are unavailable.')
const [binaryResponse,sumsResponse] = await Promise.all([fetch(binary.browser_download_url),fetch(sums.browser_download_url)])
if (!binaryResponse.ok || !sumsResponse.ok) throw new Error('Could not download yt-dlp.')
const bytes = Buffer.from(await binaryResponse.arrayBuffer())
const checksums = await sumsResponse.text()
const expected = checksums.split('\n').find(line => line.trim().split(/\s+/).at(-1)?.replace(/^\*/, '') === name)?.split(/\s+/)[0]
if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('yt-dlp checksum mismatch.')
await mkdir('tools',{recursive:true})
const destination = join('tools',process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
await writeFile(destination,bytes)
if (process.platform !== 'win32') await chmod(destination,0o755)
console.log('TikTok downloader installed and SHA-256 verified:', destination)
