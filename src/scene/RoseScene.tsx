import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Vector3, ACESFilmicToneMapping, type Material, type Mesh, type Object3D, AdditiveBlending, CanvasTexture, Group, Scene, SRGBColorSpace, Sprite, WebGLRenderer, type Camera } from 'three'
import Rose from '../rose/Rose'
import LightingRig from './LightingRig'
import CameraRig from './CameraRig'
import ParticleField from './ParticleField'
import Ornaments from './Ornaments'
import Base from './Base'
import { BokehField, GodRays, SpiralStreams } from './Streams'
import PostProcessing from './PostProcessing'
import type { DebugFlags, SceneState } from '../experience/ExperienceState'
import { TIERS, type Tier } from '../utils/qualityManager'
import { palette } from '../config/theme'

export interface SceneHandles {
  gl: WebGLRenderer
  scene: Scene
  camera: Camera
  group: Group
}

const offset = new Vector3()
const GLOWS = [
  { x: -2.3, y: 1.2, s: 6, c: palette.lavender, o: 0.12 },
  { x: 2.6, y: -0.3, s: 6.5, c: palette.iceBlue, o: 0.09 },
  { x: 0.8, y: 2.4, s: 4.5, c: palette.gold, o: 0.08 },
]

// Nền tối có gradient nhẹ + quầng sáng ấm phía sau bông hoa (luôn nằm sau hoa theo hướng nhìn).
function Backdrop({ state }: { state: SceneState }) {
  const { scene, camera } = useThree()
  const halo = useRef<Sprite>(null)
  const glows = useRef<(Sprite | null)[]>([])

  const bg = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(256, 230, 20, 256, 256, 420)
    grad.addColorStop(0, '#0d1124')
    grad.addColorStop(0.5, '#080b18')
    grad.addColorStop(1, '#04050c')
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 512)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])

  const haloTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255,200,215,1)')
    grad.addColorStop(0.35, 'rgba(210,160,230,0.35)')
    grad.addColorStop(1, 'rgba(120,120,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])

  useEffect(() => {
    scene.background = bg
    return () => {
      scene.background = null
      bg.dispose()
      haloTex.dispose()
    }
  }, [scene, bg, haloTex])

  useFrame(() => {
    const h = halo.current
    if (!h) return
    h.position.copy(camera.position).normalize().multiplyScalar(-3.2)
    h.position.y += 0.55
    ;(h.material as { opacity: number }).opacity = 0.03 * state.reveal + 0.1 * state.light + 0.12 * state.warm
    // các quầng màu phụ (lavender / xanh băng / vàng) lệch quanh hoa theo hướng nhìn
    const k = Math.min(1, state.bloom * 1.2) * state.reveal
    GLOWS.forEach((gl, i) => {
      const sp = glows.current[i]
      if (!sp) return
      sp.position.copy(h.position).add(offset.set(gl.x, gl.y, 0).applyQuaternion(camera.quaternion))
      ;(sp.material as { opacity: number }).opacity = gl.o * k
    })
  })

  return (
    <>
      <sprite ref={halo} scale={[11, 11, 1]} renderOrder={-10}>
        <spriteMaterial map={haloTex} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
      </sprite>
      {GLOWS.map((g, i) => (
        <sprite key={i} ref={(s) => (glows.current[i] = s)} scale={[g.s, g.s, 1]} renderOrder={-9}>
          <spriteMaterial map={haloTex} color={g.c} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
        </sprite>
      ))}
    </>
  )
}

interface Props {
  state: SceneState
  tier: Tier
  debug: DebugFlags
  onReady: (h: SceneHandles) => void
  onTap: () => void
  onDecline: () => void
  ready: boolean
  onProgress: (p: number) => void
  onDowngrade: (ms: number) => void
}

export default function RoseScene({ state, tier, debug, onReady, onTap, onDecline, ready, onProgress, onDowngrade }: Props) {
  const settings = TIERS[tier]
  // chỉ chạy vòng lặp render sau khi khởi động xong (trong lúc tải, thanh tiến trình được mượt)
  const [running, setRunning] = useState(false)
  // độ phân giải điều chỉnh liên tục theo FPS thực tế (0.5 … trần của bậc chất lượng)
  const [dpr, setDpr] = useState(settings.dpr)
  useEffect(() => setDpr(settings.dpr), [settings.dpr])
  const group = useRef<Group>(null)
  // bỏ qua đo FPS trong lúc khởi động (jank do biên dịch shader không phải do máy yếu)
  const readyAt = useRef(0)
  useEffect(() => {
    if (ready) readyAt.current = performance.now()
  }, [ready])
  // trần độ phân giải theo ngân sách điểm ảnh, không bao giờ thấp hơn độ phân giải thật của màn hình
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const budget = Math.sqrt(4.4e6 / (vp.w * vp.h))
  const cappedDpr = Math.max(1, Math.min(dpr, budget))
  useEffect(() => {
    if (ready) setRunning(true)
  }, [ready])
  const settled = () => readyAt.current > 0 && performance.now() - readyAt.current > 4000

  return (
    <Canvas
      dpr={[1, cappedDpr]}
      frameloop={running ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.8, 6], fov: 30, near: 0.1, far: 60 }}
      style={{ touchAction: 'none' }}
      onCreated={(rs) => {
        const { gl, scene, camera } = rs
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
        // Khởi động êm: đợi cảnh + môi trường phản chiếu sẵn sàng, biên dịch trước mọi shader
        // (không đơ main thread), rồi mới báo sẵn sàng. Trong lúc đó màn hình còn tối.
        const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
        void (async () => {
          onProgress(0.05)
          for (let i = 0; i < 180 && !group.current; i++) await nextFrame()
          onProgress(0.15)
          for (let i = 0; i < 100 && !scene.environment; i++) await new Promise((r) => setTimeout(r, 50))
          onProgress(0.35)
          // biên dịch từng loại vật liệu một để thanh tiến trình phản ánh đúng thực tế
          const seen = new Set<string>()
          const targets: Object3D[] = []
          scene.traverse((o) => {
            const m = (o as Mesh).material as Material | Material[] | undefined
            if (!m || Array.isArray(m) || seen.has(m.uuid)) return
            seen.add(m.uuid)
            targets.push(o)
          })
          for (let i = 0; i < targets.length; i++) {
            try {
              await gl.compileAsync(targets[i], camera, scene)
            } catch {
              /* không sao: shader sẽ biên dịch ở frame đầu tiên */
            }
            onProgress(0.35 + 0.25 * ((i + 1) / targets.length))
          }
          // Khởi động nóng: vẽ thử toàn bộ cảnh ở trạng thái nở hết (cánh bay, hạt, hậu kỳ) rồi trả về như cũ,
          // để mọi shader, buffer, texture đã được tải lên GPU trước khi người xem thấy gì.
          const snap = { ...state }
          Object.assign(state, { reveal: 1, bloom: 1, light: 1, warm: 1, camMix: 1, textShift: 1 })
          for (let i = 0; i < 6; i++) {
            rs.advance(performance.now() / 1000, true)
            await nextFrame()
            onProgress(0.6 + 0.2 * ((i + 1) / 6))
          }

          // Hiệu chỉnh theo máy: đo thời gian thật của một khung hình ở cảnh nặng nhất (hoa nở hết,
          // mọi trang trí hiện). Nếu quá chậm thì giảm độ phân giải từng bước nhỏ (không bao giờ thấp
          // hơn độ phân giải thật của màn hình) TRƯỚC khi người xem thấy cảnh, nên không bị giật lúc vào.
          const ctx = gl.getContext()
          const sample = async (n: number) => {
            let sum = 0
            for (let i = 0; i < n; i++) {
              const t0 = performance.now()
              rs.advance(t0 / 1000, true)
              ctx.finish()
              sum += performance.now() - t0
              await nextFrame()
            }
            return sum / n
          }
          let ms = await sample(6)
          for (let step = 0; step < 6 && ms > 17 && gl.getPixelRatio() > 1.01; step++) {
            setDpr(Math.max(1, gl.getPixelRatio() * 0.88))
            await nextFrame()
            await nextFrame()
            ms = await sample(5)
            onProgress(0.8 + 0.1 * ((step + 1) / 6))
          }
          onProgress(0.9)

          // Vẫn chậm dù đã hạ độ phân giải hết cỡ: hạ độ nặng của cảnh (bậc chất lượng) rồi khởi động lại
          if (ms > 22 && tier !== 'lite' && !debug.tier) {
            Object.assign(state, snap)
            onDowngrade(ms)
            return
          }

          Object.assign(state, snap)
          for (let i = 0; i < 4; i++) {
            rs.advance(performance.now() / 1000, true)
            await nextFrame()
            onProgress(0.9 + 0.1 * ((i + 1) / 4))
          }
          if (group.current) onReady({ gl, scene, camera, group: group.current })
        })()
      }}
    >
      <PerformanceMonitor
        onChange={({ factor }) => settled() && setDpr((prev) => Math.min(prev, Math.max(1.25, Math.round(settings.dpr * (0.8 + 0.2 * factor) * 20) / 20)))}
        onDecline={() => settled() && onDecline()}
        flipflops={3}
        onFallback={() => settled() && onDecline()}
      >
        <Backdrop state={state} />
        <LightingRig state={state} />
        <CameraRig state={state} initialView={debug.view} initialPhi={debug.phi} />
        <Rose state={state} tier={settings} clay={debug.clay} debugBloom={debug.bloom} groupRef={group} onTap={onTap} />
        <ParticleField state={state} count={settings.particles} />
        {settings.petals > 0 && <Ornaments state={state} count={settings.petals} />}
        {settings.sparkles > 0 && <Base state={state} sparkles={settings.sparkles} />}
        {settings.streams > 0 && <SpiralStreams state={state} perStrand={settings.streams} />}
        {settings.bokeh > 0 && <BokehField state={state} count={settings.bokeh} />}
        {settings.rays && <GodRays state={state} />}
        {settings.post && debug.post && <PostProcessing resolution={settings.bloomRes} />}
      </PerformanceMonitor>
    </Canvas>
  )
}
