import { content } from '../config/content'

// Lời chúc hiện dần từng dòng, tiết chế để không che bông hoa.
export default function Greeting({ show }: { show: boolean }) {
  const t = (delay: number) => ({ transitionDelay: show ? `${delay}ms` : '0ms' })
  const cls = `transition-all duration-[1600ms] ease-out ${show ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`
  return (
    <div className="pointer-events-none flex flex-col items-center text-center" aria-hidden={!show}>
      <h1
        className={`font-serif text-[clamp(2rem,7.4vw,3.2rem)] italic leading-[1.05] tracking-wide text-[#FFF1E5] [text-shadow:0_0_32px_rgba(242,183,213,0.35)] ${cls}`}
        style={t(0)}
      >
        {content.greeting.main}
      </h1>
      <p className={`mt-4 max-w-[27rem] text-[clamp(0.88rem,3.4vw,1rem)] font-light leading-[1.85] tracking-wide text-[#FFF1E5]/80 ${cls}`} style={t(900)}>
        {content.greeting.body}
      </p>
      <p className={`mt-3 max-w-[24rem] font-serif text-[clamp(0.95rem,3.6vw,1.1rem)] italic leading-snug text-[#B8A4EE] ${cls}`} style={t(2200)}>
        {content.greeting.closing}
      </p>
    </div>
  )
}
