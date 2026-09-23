export function parseVideoUrl(text: string): URL {
  const match = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!match) throw new Error('Dán URL video hoặc liên kết được sao chép từ TikTok.')
  const url = new URL(match[0].replace(/[)\]，。]+$/, ''))
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Chỉ hỗ trợ liên kết HTTP/HTTPS không chứa thông tin đăng nhập.')
  }
  if (url.href.length > 4096) throw new Error('Liên kết quá dài.')
  return url
}

export function isTikTokUrl(url: URL) {
  const host = url.hostname.toLowerCase()
  return host === 'tiktok.com' || host.endsWith('.tiktok.com')
}
