import { content } from '../config/content'

interface Props {
  show: boolean
  saveState: 'idle' | 'working' | 'done'
  onSave: () => void
  onReplay: () => void
}

const btn =
  'pointer-events-auto cursor-pointer border-0 border-b border-[#F2B7D5]/40 bg-transparent whitespace-nowrap px-1 py-2 text-[0.76rem] font-light tracking-[0.12em] text-[#F2B7D5] transition-colors hover:text-[#FFF1E5] focus-visible:text-[#FFF1E5] disabled:opacity-60'

export default function ExperienceControls({ show, saveState, onSave, onReplay }: Props) {
  return (
    <div
      className={`flex flex-col items-center gap-3 transition-opacity duration-[1600ms] ${show ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      style={{ transitionDelay: show ? '3600ms' : '0ms' }}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-6">
        <button type="button" className={btn} onClick={onSave} disabled={saveState === 'working'} tabIndex={show ? 0 : -1}>
          {saveState === 'working' ? content.controls.saving : saveState === 'done' ? content.controls.saved : content.controls.save}
        </button>
        <button type="button" className={btn} onClick={onReplay} tabIndex={show ? 0 : -1}>
          {content.controls.replay}
        </button>
      </div>
      <p className="animate-[hint_9s_ease-out_forwards] text-[0.7rem] font-light tracking-[0.2em] text-[#FFF1E5]/40">{content.controls.hint}</p>
    </div>
  )
}
