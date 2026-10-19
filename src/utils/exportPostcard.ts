import { PerspectiveCamera, Vector2, Vector3 } from 'three'
import type { SceneHandles } from '../scene/RoseScene'
import { content } from '../config/content'
import { palette } from '../config/theme'
import { mulberry32 } from './seededRandom'

// Bưu thiếp PNG 1080 x 1350, dựng riêng (không chụp màn hình giao diện):
//   1) vẽ nền điện ảnh bằng Canvas 2D
//   2) render lại chính bông hoa với camera riêng, nền trong suốt, kích thước riêng
//   3) ghép chữ tiếng Việt
// Mọi thứ diễn ra đồng bộ trong một tick nên người dùng không thấy canvas bị đổi kích thước.

const W = 1080
const H = 1350
const TAN = Math.tan((30 * Math.PI) / 360)

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${a})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // canvas "letterSpacing" chưa có ở mọi trình duyệt, tự căn giữa từng ký tự
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let cx = x - total / 2
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y)
    cx += widths[i] + spacing
  })
  ctx.textAlign = 'center'
}

export async function renderPostcard(h: SceneHandles): Promise<Blob> {
  await Promise.all([
    document.fonts.load('italic 500 80px "Cormorant Garamond"', 'ăâđêôơư ếềểễệ ởờỡợ ữửứự 20/10 apn'),
    document.fonts.load('300 28px "Be Vietnam Pro"', 'ăâđêôơư ếềểễệ ởờỡợ ữửứự'),
    document.fonts.load('400 28px "Be Vietnam Pro"', 'ăâđêôơư'),
  ])

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')!
  const rnd = mulberry32(2010)

  // ---- nền ----
  const bg = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 700, 980)
  bg.addColorStop(0, '#171c33')
  bg.addColorStop(0.55, '#0d1122')
  bg.addColorStop(1, palette.bg)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W / 2, 640, 520, '242,183,213', 0.13)
  glow(ctx, W / 2 + 80, 520, 380, '184,164,238', 0.09)
  for (let i = 0; i < 110; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const r = 0.6 + rnd() * 1.8
    ctx.globalAlpha = 0.2 + rnd() * 0.55
    ctx.fillStyle = '#FFF1E5'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 6.283)
    ctx.fill()
    if (rnd() < 0.12) glow(ctx, x, y, 22, '255,225,235', 0.35)
  }
  ctx.globalAlpha = 1

  // ---- render bông hoa ----
  const { gl, scene, camera, group } = h
  const prevSize = gl.getSize(new Vector2())
  const prevDpr = gl.getPixelRatio()
  const prevBg = scene.background
  const live = camera as PerspectiveCamera

  const cam = new PerspectiveCamera(30, W / H, 0.1, 60)
  const dir = live.position.clone().sub(new Vector3(0, live.position.y, 0).multiplyScalar(0)).normalize()
  // giữ hướng nhìn hiện tại nhưng không cho quá thấp/cao để hoa luôn đẹp
  dir.y = Math.min(0.9, Math.max(0.25, dir.y))
  dir.normalize()
  const dist = Math.max(1.5 / TAN, 1.72 / (TAN * cam.aspect)) * 1.04
  const viewH = 2 * dist * TAN
  // hoa nằm hơi cao hơn tâm khung để nhường chỗ cho dòng chữ phía dưới
  const target = new Vector3(0, 0.45 - viewH * 0.1, 0)
  cam.position.copy(dir.multiplyScalar(dist)).add(target)
  cam.lookAt(target)
  cam.updateMatrixWorld()
  void group

  try {
    scene.background = null
    gl.setPixelRatio(1)
    gl.setSize(W, H, false)
    gl.render(scene, cam)
    ctx.drawImage(gl.domElement, 0, 0, W, H)
  } finally {
    scene.background = prevBg
    gl.setPixelRatio(prevDpr)
    gl.setSize(prevSize.x, prevSize.y, false)
  }

  // ---- chữ ----
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = 'rgba(255,241,229,0.55)'
  ctx.font = '300 24px "Be Vietnam Pro"'
  spaced(ctx, '20 · 10 · 2026', W / 2, 108, 10)

  ctx.shadowColor = 'rgba(242,183,213,0.45)'
  ctx.shadowBlur = 30
  ctx.fillStyle = palette.pearlWhite
  let size = 84
  ctx.font = `italic 500 ${size}px "Cormorant Garamond"`
  while (ctx.measureText(content.postcard.main).width > W - 160 && size > 40) {
    size -= 2
    ctx.font = `italic 500 ${size}px "Cormorant Garamond"`
  }
  ctx.fillText(content.postcard.main, W / 2, 1218)
  ctx.shadowBlur = 0

  ctx.strokeStyle = 'rgba(242,183,213,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 40, 1254)
  ctx.lineTo(W / 2 + 40, 1254)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,241,229,0.7)'
  ctx.font = '300 28px "Be Vietnam Pro"'
  ctx.fillText(content.postcard.caption, W / 2, 1298)

  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('toBlob thất bại'))), 'image/png'))
}

/** Điện thoại: mở bảng chia sẻ (có "Lưu hình ảnh"). Máy tính: tải thẳng về. */
export async function savePostcard(blob: Blob): Promise<void> {
  const file = new File([blob], content.postcard.filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (window.matchMedia('(pointer: coarse)').matches && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: content.postcard.caption })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = content.postcard.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
