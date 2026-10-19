import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Vector3, ACESFilmicToneMapping, type Material, type Mesh, type Object3D, AdditiveBlending, CanvasTexture, Group, Scene, SRGBColorSpace, Sprite, WebGLRenderer, type Camera } from 'three'
import Rose from '../rose/Rose'
import LightingRig from './LightingRig'
import CameraRig from './CameraRig'
import ParticleField from './ParticleField'
import Ornaments from './Ornaments'
import { bakery } from '../rose/BloomController'
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
  ready: boolean
  live: boolean
  onProgress: (p: number) => void
  onDowngrade: (ms: number) => void
}

export default function RoseScene({ state, tier, debug, onReady, onTap, ready, live, onProgress, onDowngrade }: Props) {
  const settings = TIERS[tier]
  useMemo(() => {
    bakery.total = 0
    bakery.done = 0
  }, [])
  // chỉ chạy vòng lặp render sau khi khởi động xong (trong lúc tải, thanh tiến trình được mượt)
  const [running, setRunning] = useState(false)
  // độ phân giải điều chỉnh liên tục theo FPS thực tế (0.5 … trần của bậc chất lượng)
  const [dpr, setDpr] = useState(settings.dpr)
  useEffect(() => setDpr(settings.dpr), [settings.dpr])
  const group = useRef<Group>(null)
  // trần độ phân giải theo ngân sách điểm ảnh, không bao giờ thấp hơn độ phân giải thật của màn hình
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const budget = Math.sqrt(7e6 / (vp.w * vp.h))
  const cappedDpr = Math.max(1, Math.min(dpr, budget))
  useEffect(() => {
    if (live) setRunning(true)
  }, [live])

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
          // nạp sẵn phông chữ tiếng Việt để lúc chữ hiện ra không bị nhảy / đổi kiểu
          try {
            await Promise.all([
              document.fonts.load('italic 500 40px "Cormorant Garamond"', 'ăâđêôơư ếềểễệ ởờỡợ ữửứự apn'),
              document.fonts.load('300 16px "Be Vietnam Pro"', 'ăâđêôơư ếềểễệ ởờỡợ ữửứự'),
              document.fonts.load('400 16px "Be Vietnam Pro"', 'ăâđêôơư'),
            ])
            await document.fonts.ready
          } catch {
            /* không sao */
          }
          for (let i = 0; i < 180 && !group.current; i++) await nextFrame()
          onProgress(0.15)
          // chờ tính xong các tư thế nở của mọi cánh hoa (việc nặng được làm một lần ở đây, không phải lúc nở)
          while (bakery.done < bakery.total) {
            onProgress(0.15 + 0.15 * (bakery.done / Math.max(1, bakery.total)))
            await new Promise((r) => setTimeout(r, 30))
          }
          onProgress(0.3)
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
          // chạy thử đúng quá trình nở (nhiều mức nở khác nhau) để GPU/JS đã quen đường đi trước khi người xem bấm
          const sweep = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1, 0.6, 0.3, 1]
          for (let i = 0; i < sweep.length; i++) {
            state.bloom = sweep[i]
            state.camMix = sweep[i]
            rs.advance(performance.now() / 1000, true)
            await nextFrame()
            onProgress(0.6 + 0.2 * ((i + 1) / sweep.length))
          }
          state.bloom = 1
          state.camMix = 1

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
          let ms = await sample(8)
          // Ưu tiên giữ độ nét: chỉ hạ độ phân giải tới 1.5x
          for (let step = 0; step < 8 && ms > 18 && gl.getPixelRatio() > 1.55; step++) {
            setDpr(Math.max(1.5, gl.getPixelRatio() * 0.9))
            await nextFrame()
            await nextFrame()
            ms = await sample(6)
            onProgress(0.8 + 0.06 * ((step + 1) / 8))
          }
          // Vẫn chậm: hạ độ nặng của cảnh (bậc chất lượng) rồi khởi động lại ở độ nét tối đa của bậc mới
          if (ms > 18 && tier !== 'lite' && !debug.tier) {
            Object.assign(state, snap)
            onDowngrade(ms)
            return
          }
          // Bậc thấp nhất: đành chấp nhận hạ độ phân giải xuống 1x
          for (let step = 0; step < 8 && ms > 18 && gl.getPixelRatio() > 1.01; step++) {
            setDpr(Math.max(1, gl.getPixelRatio() * 0.9))
            await nextFrame()
            await nextFrame()
            ms = await sample(6)
          }
          onProgress(0.9)

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
      <>
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
        {settings.post && debug.post && <PostProcessing resolution={settings.bloomRes} msaa={settings.msaa} />}
      </>
    </Canvas>
  )
}
