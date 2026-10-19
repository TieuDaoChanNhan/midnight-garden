import { useEffect, useRef, useState } from 'react'
import { content } from '../config/content'

// Màn hình chờ: thanh tiến trình thật (đếm theo từng bước biên dịch shader).
// Chỉ mờ đi khi đạt 100%, để lúc vào xem không bị khựng.
export default function LoadingBar({ progress, done, onFilled, optimizing }: { progress: number; done: boolean; onFilled: () => void; optimizing: boolean }) {
  // Số hiển thị đuổi theo tiến độ thật một cách đều đặn (tối thiểu ~2.5s) nên thanh luôn chạy rõ ràng,
  // và chỉ báo "đủ 100%" khi tiến độ thật đã xong.
  const [shown, setShown] = useState(0)
  const target = useRef(0)
  target.current = progress
  const filled = useRef(false)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      setShown((s) => {
        const t = target.current
        const next = Math.min(t, s + dt * 0.42, s + (t - s) * 0.2 + 0.002)
        return next > s ? next : s
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (!filled.current && progress >= 1 && shown >= 0.999) {
      filled.current = true
      const id = window.setTimeout(onFilled, 450)
      return () => clearTimeout(id)
    }
  }, [shown, progress, onFilled])
  const pct = Math.round(Math.min(1, Math.max(0, shown)) * 100)
  const L = content.loading
  const stage = optimizing ? L.optimizing : shown < 0.35 ? L.s1 : shown < 0.6 ? L.s2 : shown < 0.8 ? L.s3 : shown < 0.97 ? L.s4 : L.s5
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={content.loading.label}
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#080B18] transition-opacity duration-[900ms] ease-out ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ background: 'radial-gradient(60% 50% at 50% 45%, #111629, #080B18)' }}
    >
      <p className="font-serif text-[1.35rem] italic tracking-wide text-[#FFF1E5]/85">{content.loading.label}</p>
      <p className="-mt-2 text-[0.78rem] font-light tracking-wide text-[#FFF1E5]/50">{stage}</p>
      <div className="h-[2px] w-[min(62vw,260px)] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#B8A4EE] via-[#F2B7D5] to-[#FFF1E5]"
          style={{ transform: `scaleX(${shown})`, willChange: 'transform' }}
        />
      </div>
      <p className="text-[0.72rem] font-light tracking-[0.25em] text-[#FFF1E5]/45 tabular-nums">{pct}%</p>
    </div>
  )
}
