import { content } from '../config/content'

// Màn hình chờ: thanh tiến trình thật (đếm theo từng bước biên dịch shader).
// Chỉ mờ đi khi đạt 100%, để lúc vào xem không bị khựng.
export default function LoadingBar({ progress, done }: { progress: number; done: boolean }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={content.loading.label}
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#080B18] transition-opacity duration-[1400ms] ease-out ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ background: 'radial-gradient(60% 50% at 50% 45%, #111629, #080B18)' }}
    >
      <p className="font-serif text-[1.35rem] italic tracking-wide text-[#FFF1E5]/85">{content.loading.label}</p>
      <div className="h-[2px] w-[min(62vw,260px)] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#B8A4EE] via-[#F2B7D5] to-[#FFF1E5] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[0.72rem] font-light tracking-[0.25em] text-[#FFF1E5]/45 tabular-nums">{pct}%</p>
    </div>
  )
}
