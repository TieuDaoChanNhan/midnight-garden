import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import RoseScene, { type SceneHandles } from '../scene/RoseScene'
import IntroText from '../ui/IntroText'
import Greeting from '../ui/Greeting'
import LoadingBar from '../ui/LoadingBar'
import ExperienceControls from '../ui/ExperienceControls'
import { content } from '../config/content'
import { createSceneState, readDebugFlags, type Phase } from './ExperienceState'
import { detectInitialTier, lowerTier, type Tier } from '../utils/qualityManager'
import { renderPostcard, savePostcard } from '../utils/exportPostcard'
import { useReducedMotion } from '../rose/useReducedMotion'

export default function Experience() {
  const state = useRef(createSceneState()).current
  const debug = useMemo(readDebugFlags, [])
  const reduced = useReducedMotion()
  const speed = reduced ? 0.45 : 1

  const [phase, setPhase] = useState<Phase>(debug.bloom !== null ? 'reveal' : 'emerge')
  const [tier, setTier] = useState<Tier>(() => debug.tier ?? detectInitialTier())
  const [saveState, setSaveState] = useState<'idle' | 'working' | 'done'>('idle')
  const [booted, setBooted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [manualImg, setManualImg] = useState<string | null>(null)
  const handles = useRef<SceneHandles | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const tl = useRef<gsap.core.Timeline | null>(null)

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  // ---- Phase A: hoa hiện ra từ bóng tối ----
  // Cảnh đã được biên dịch + khởi động nóng xong: chờ thanh tiến trình chạy đủ 100% rồi mới bắt đầu.
  const onReady = useCallback((h: SceneHandles) => {
    handles.current = h
    setProgress(1)
    if (import.meta.env.DEV) (window as unknown as { __handles: SceneHandles }).__handles = h
  }, [])

  const start = useCallback(
    () => {
      setBooted(true)
      if (debug.bloom !== null) {
        Object.assign(state, { reveal: 1, light: 0.3, warm: 0.5, bloom: debug.bloom, camMix: debug.bloom, textShift: 1 })
        return
      }
      gsap.to(state, { reveal: 1, duration: 3.6 * speed, ease: 'power2.out' })
      gsap.to(state, { light: 0.16, duration: 3.6 * speed, ease: 'sine.inOut' })
      gsap.delayedCall(3.1 * speed, () => {
        if (phaseRef.current === 'emerge') {
          setPhaseBoth('invite')
          gsap.to(state, { textShift: 1, duration: 1.8, ease: 'power2.inOut' })
        }
      })
    },
    [debug.bloom, speed, state],
  )

  // ---- Phase C: nở ----
  const playBloom = useCallback(
    (delay = 0) => {
      const dur = 6.2 * speed
      tl.current?.kill()
      const t = gsap.timeline({ delay })
      t.call(() => (state.sparkAt = Date.now()), [], 0.4)
        .to(state, { light: 1, duration: 0.9, ease: 'sine.out' }, 0)
        .to(state, { bloom: 1, duration: dur, ease: 'sine.inOut' }, 0.35)
        .to(state, { camMix: 1, duration: dur * 0.95, ease: 'power2.inOut' }, 0.6)
        .to(state, { textShift: 1, duration: 1.6, ease: 'power2.inOut' }, 0.6)
        .to(state, { light: 0.42, duration: 2.2, ease: 'sine.inOut' }, dur * 0.72)
        .to(state, { warm: 1, duration: 2.6, ease: 'sine.inOut' }, dur * 0.8)
        .call(() => setPhaseBoth('reveal'), [], dur * 0.9 + 0.35) // Phase D
      tl.current = t
    },
    [speed, state],
  )

  const bloom = useCallback(() => {
    if (phaseRef.current === 'bloom' || phaseRef.current === 'reveal') return
    gsap.killTweensOf(state, 'reveal,light,textShift')
    gsap.to(state, { reveal: 1, duration: 0.8 })
    setPhaseBoth('bloom')
    playBloom()
  }, [playBloom, state])

  const replay = useCallback(() => {
    if (phaseRef.current !== 'reveal') return
    setPhaseBoth('bloom')
    tl.current?.kill()
    const t = gsap.timeline()
    t.to(state, { warm: 0, light: 0.2, duration: 1.4 * speed, ease: 'sine.inOut' }, 0)
      .to(state, { bloom: 0, duration: 2.8 * speed, ease: 'sine.inOut' }, 0)
      .to(state, { camMix: 0, duration: 2.8 * speed, ease: 'sine.inOut' }, 0)
      .call(() => playBloom(0.5), [], 3.1 * speed)
    tl.current = t
  }, [playBloom, speed, state])

  useEffect(() => () => void tl.current?.kill(), [])

  // ---- lưu bưu thiếp ----
  const save = useCallback(async () => {
    const h = handles.current
    if (!h || saveState === 'working') return
    setSaveState('working')
    try {
      const blob = await renderPostcard(h)
      try {
        await savePostcard(blob)
      } catch {
        setManualImg(URL.createObjectURL(blob))
      }
      setSaveState('done')
      window.setTimeout(() => setSaveState('idle'), 2600)
    } catch {
      setSaveState('idle')
    }
  }, [saveState])

  const onDecline = useCallback(() => setTier((t) => (debug.tier ? t : lowerTier(t))), [debug.tier])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#080B18]">
      <RoseScene state={state} tier={tier} debug={debug} onReady={onReady} onTap={bloom} onDecline={onDecline} ready={booted} onProgress={setProgress} />

      <LoadingBar progress={progress} done={booted} onFilled={start} />

      {/* nút ẩn cho bàn phím / trình đọc màn hình */}
      <button type="button" onClick={bloom} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:text-[#F2B7D5]">
        {content.controls.bloomLabel}
      </button>

      {/* chữ ở nửa dưới, không che bông hoa */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-[34%] flex-col items-center justify-end gap-6 px-6 pb-[max(1.4rem,env(safe-area-inset-bottom))] md:min-h-[30%]">
        <div className="relative flex w-full flex-col items-center">
          <div className={`${phase === 'invite' ? '' : 'absolute inset-x-0 bottom-0'}`}>
            <IntroText show={phase === 'invite'} onBloom={bloom} />
          </div>
          <div className={`${phase === 'reveal' ? '' : 'absolute inset-x-0 bottom-0'}`}>
            <Greeting show={phase === 'reveal'} />
          </div>
        </div>
        <ExperienceControls show={phase === 'reveal'} saveState={saveState} onSave={save} onReplay={replay} />
      </div>

      {manualImg && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#080B18]/90 p-6 text-center">
          <img src={manualImg} alt="Bưu thiếp bông hoa cho apn" className="max-h-[70vh] max-w-full rounded-md shadow-2xl" />
          <p className="max-w-xs text-[0.85rem] font-light text-[#FFF1E5]/80">{content.postcard.manual}</p>
          <button type="button" className="cursor-pointer border-b border-[#F2B7D5]/50 bg-transparent px-1 py-2 text-[0.8rem] tracking-[0.16em] text-[#F2B7D5]" onClick={() => setManualImg(null)}>
            đóng
          </button>
        </div>
      )}
    </div>
  )
}
