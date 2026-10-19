import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Vector3, ACESFilmicToneMapping, AdditiveBlending, CanvasTexture, Group, Scene, SRGBColorSpace, Sprite, WebGLRenderer, type Camera } from 'three'
import Rose from '../rose/Rose'
import LightingRig from './LightingRig'
import CameraRig from './CameraRig'
import ParticleField from './ParticleField'
import Ornaments from './Ornaments'
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
  { x: -2.3, y: 1.2, s: 6, c: palette.lavender, o: 0.2 },
  { x: 2.6, y: -0.3, s: 6.5, c: palette.iceBlue, o: 0.15 },
  { x: 0.8, y: 2.4, s: 4.5, c: palette.gold, o: 0.12 },
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
}

export default function RoseScene({ state, tier, debug, onReady, onTap, onDecline }: Props) {
  const settings = TIERS[tier]
  // độ phân giải điều chỉnh liên tục theo FPS thực tế (0.5 … trần của bậc chất lượng)
  const [dpr, setDpr] = useState(settings.dpr)
  useEffect(() => setDpr(settings.dpr), [settings.dpr])
  const group = useRef<Group>(null)

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.8, 6], fov: 30, near: 0.1, far: 60 }}
      style={{ touchAction: 'none' }}
      onCreated={({ gl, scene, camera }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
        // đợi group gắn xong
        requestAnimationFrame(() => {
          if (group.current) onReady({ gl, scene, camera, group: group.current })
        })
      }}
    >
      <PerformanceMonitor
        onChange={({ factor }) => setDpr(Math.max(0.6, Math.round(settings.dpr * (0.55 + 0.45 * factor) * 20) / 20))}
        onDecline={onDecline}
        flipflops={3}
        onFallback={onDecline}
      >
        <Backdrop state={state} />
        <LightingRig state={state} />
        <CameraRig state={state} initialView={debug.view} initialPhi={debug.phi} />
        <Rose state={state} tier={settings} clay={debug.clay} debugBloom={debug.bloom} groupRef={group} onTap={onTap} />
        <ParticleField state={state} count={settings.particles} />
        <Ornaments state={state} count={settings.petals} />
        {settings.post && debug.post && <PostProcessing resolution={settings.bloomRes} />}
      </PerformanceMonitor>
    </Canvas>
  )
}
