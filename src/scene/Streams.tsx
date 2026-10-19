import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, MeshBasicMaterial, PlaneGeometry } from 'three'
import type { SceneState } from '../experience/ExperienceState'
import { POOL_Y } from '../rose/Rose'
import { createSparkMaterial, SPARK_COLORS, useSparkUniforms } from './sparkMaterial'
import { useReducedMotion } from '../rose/useReducedMotion'
import { palette } from '../config/theme'
import { mulberry32 } from '../utils/seededRandom'

// Ba lớp trang trí "sống", đều rất rẻ:
//   SpiralStreams: ba dòng hạt sáng xoắn quanh bông hoa rồi bay lên, xòe rộng dần
//   BokehField: những quầng sáng mờ nhiều màu, trôi chậm ở xa phía sau (chiều sâu)
//   GodRays: các chùm sáng giả (hình nón cộng sáng) chiếu từ trên xuống

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

function usePoints(count: number, init: (i: number, pos: Float32Array, size: Float32Array, color: Float32Array) => void) {
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const alpha = new Float32Array(count)
    const color = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) init(i, pos, size, color)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new BufferAttribute(size, 1))
    geo.setAttribute('aAlpha', new BufferAttribute(alpha, 1))
    geo.setAttribute('aColor', new BufferAttribute(color, 3))
    return { geo, pos, size, alpha }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])
  useEffect(() => () => data.geo.dispose(), [data])
  return data
}

export function SpiralStreams({ state, perStrand }: { state: SceneState; perStrand: number }) {
  const reduced = useReducedMotion()
  const STRANDS = 3
  const count = STRANDS * perStrand
  const material = useMemo(() => createSparkMaterial(), [])
  useSparkUniforms(material, state)
  useEffect(() => () => material.dispose(), [material])
  const { geo, pos, size, alpha } = usePoints(count, (i, _p, sz, col) => {
    const k = Math.floor(i / perStrand)
    sz[i] = 0.028 + 0.03 * ((i * 7) % 5) / 4
    col.set(SPARK_COLORS[(k * 2 + (i % 2)) % SPARK_COLORS.length], i * 3)
  })

  useFrame((s) => {
    const t = s.clock.elapsedTime * (reduced ? 0.15 : 1)
    const show = smooth((state.bloom - 0.2) / 0.6) * state.reveal
    for (let k = 0; k < STRANDS; k++) {
      for (let j = 0; j < perStrand; j++) {
        const i = k * perStrand + j
        const u = (j / perStrand + t * 0.07 + k * 0.31) % 1
        const ang = k * 2.094 + u * 6.2 + t * 0.5
        const r = 0.6 + 1.55 * Math.pow(u, 0.8)
        pos[i * 3] = Math.cos(ang) * r
        pos[i * 3 + 1] = POOL_Y + 0.25 + u * 3.9
        pos[i * 3 + 2] = Math.sin(ang) * r
        alpha[i] = Math.pow(Math.sin(Math.PI * u), 1.3) * show * 0.95
      }
    }
    ;(geo.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('aAlpha') as BufferAttribute).needsUpdate = true
    void size
  })

  return <points geometry={geo} material={material} frustumCulled={false} renderOrder={1700} />
}

export function BokehField({ state, count }: { state: SceneState; count: number }) {
  const reduced = useReducedMotion()
  const material = useMemo(() => createSparkMaterial(), [])
  useSparkUniforms(material, state)
  useEffect(() => () => material.dispose(), [material])
  const meta = useMemo(() => {
    const r = mulberry32(5)
    return Array.from({ length: count }, () => ({ rad: 5 + r() * 3.5, ang: r() * 6.28, y: -2 + r() * 5.2, sp: (r() - 0.5) * 0.06, ph: r() * 6.28 }))
  }, [count])
  const { geo, pos, alpha } = usePoints(count, (i, _p, sz, col) => {
    const r = mulberry32(100 + i)
    sz[i] = 0.55 + r() * 0.7
    col.set(SPARK_COLORS[i % SPARK_COLORS.length], i * 3)
  })

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const calm = reduced ? 0 : 1
    for (let i = 0; i < count; i++) {
      const m = meta[i]
      const a = m.ang + t * m.sp * calm
      pos[i * 3] = Math.cos(a) * m.rad
      pos[i * 3 + 1] = m.y + Math.sin(t * 0.25 + m.ph) * 0.25 * calm
      pos[i * 3 + 2] = Math.sin(a) * m.rad
      alpha[i] = (0.05 + 0.05 * Math.sin(t * 0.5 + m.ph)) * (0.35 + 0.65 * Math.min(1, state.bloom * 1.5 + 0.3))
    }
    ;(geo.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('aAlpha') as BufferAttribute).needsUpdate = true
  })

  return <points geometry={geo} material={material} frustumCulled={false} renderOrder={-6} />
}

const BEAMS = [
  { x: -2.3, z: -1.8, lean: 0.34, spin: 0.9, color: palette.lavender, o: 0.08 },
  { x: 2.5, z: -1.2, lean: -0.38, spin: -0.7, color: palette.pearlPink, o: 0.07 },
  { x: 0.4, z: -3.0, lean: 0.06, spin: 0.5, color: palette.iceBlue, o: 0.06 },
]

export function GodRays({ state }: { state: SceneState }) {
  const reduced = useReducedMotion()
  const group = useRef<Group>(null)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 128
    const g = c.getContext('2d')!
    const img = g.createImageData(64, 128)
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 64; x++) {
        const hx = Math.sin((x / 63) * Math.PI) ** 2 // mờ dần ở hai mép
        const vy = (1 - y / 127) ** 1.4 // sáng ở đỉnh, tắt dần xuống dưới
        const o = (y * 64 + x) * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
        img.data[o + 3] = Math.round(255 * hx * vy)
      }
    }
    g.putImageData(img, 0, 0)
    return new CanvasTexture(c)
  }, [])
  const geo = useMemo(() => new PlaneGeometry(2.2, 7.5), [])
  const mats = useMemo(
    () => BEAMS.map((b) => new MeshBasicMaterial({ color: b.color, map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })),
    [tex],
  )
  useEffect(
    () => () => {
      tex.dispose()
      geo.dispose()
      mats.forEach((m) => m.dispose())
    },
    [tex, geo, mats],
  )

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const k = state.reveal * (0.25 + 0.75 * state.warm) * (0.4 + 0.6 * Math.min(1, state.bloom * 1.4))
    mats.forEach((m, i) => (m.opacity = BEAMS[i].o * k * (reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 0.4 + i * 2))))
    if (group.current && !reduced) group.current.rotation.y = Math.sin(t * 0.07) * 0.25
  })

  return (
    <group ref={group}>
      {BEAMS.map((b, i) => (
        <group key={i} position={[b.x, 3.1, b.z]} rotation={[0, 0, b.lean]}>
          <mesh geometry={geo} material={mats[i]} frustumCulled={false} renderOrder={-5} />
          <mesh geometry={geo} material={mats[i]} rotation={[0, Math.PI / 2, 0]} frustumCulled={false} renderOrder={-5} />
        </group>
      ))}
    </group>
  )
}
