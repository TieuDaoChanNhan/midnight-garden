import { content } from '../config/content'

// Dùng khi thiết bị không có WebGL: vẫn gửi được lời chúc, dưới dạng chữ thuần.
export default function LoadingFallback() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center"
      style={{ background: 'radial-gradient(70% 55% at 50% 40%, #1b2040, #080B18)' }}
    >
      <p className="font-serif text-[clamp(2.2rem,9vw,3.6rem)] italic leading-tight text-[#FFF1E5]">{content.greeting.main}</p>
      <p className="mt-5 max-w-[26rem] text-[0.98rem] font-light leading-[1.9] text-[#FFF1E5]/80">{content.greeting.body}</p>
      <p className="mt-4 font-serif text-[1.1rem] italic text-[#B8A4EE]">{content.greeting.closing}</p>
      <p className="mt-10 max-w-[22rem] text-[0.75rem] font-light tracking-wide text-[#FFF1E5]/40">{content.fallback.note}</p>
    </div>
  )
}
