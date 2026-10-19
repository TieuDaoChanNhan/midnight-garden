import { content } from '../config/content'

export default function IntroText({ show, onBloom }: { show: boolean; onBloom: () => void }) {
  return (
    <div
      className={`pointer-events-none flex flex-col items-center text-center transition-all duration-[700ms] ease-out ${show ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      aria-hidden={!show}
    >
      <p className="font-serif text-[clamp(2.2rem,8vw,3.4rem)] italic leading-none tracking-wide text-[#FFF1E5]">{content.intro.line1}</p>
      <p className="mt-3 max-w-[22rem] text-[clamp(0.92rem,3.6vw,1.05rem)] font-light leading-relaxed tracking-wide text-[#FFF1E5]/75">
        {content.intro.line2}
      </p>
      <button
        type="button"
        onClick={onBloom}
        tabIndex={show ? 0 : -1}
        className="pointer-events-auto mt-7 cursor-pointer border-0 bg-transparent px-4 py-3 text-[0.86rem] font-light tracking-[0.18em] text-[#F2B7D5] animate-[breathe_3.4s_ease-in-out_infinite]"
      >
        {content.intro.cta}
      </button>
    </div>
  )
}
