import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Points } from 'three'
import { createSparkMaterial, useSparkUniforms } from './sparkMaterial'
import type { SceneState } from '../experience/ExperienceState'
import { useReducedMotion } from '../rose/useReducedMotion'
import { mulberry32 } from '../utils/seededRandom'

// Bụi sáng lơ lửng (ambient) + một đợt hạt sáng bay ra khi hoa nở (spark).
// Một draw call, buffer tái sử dụng, không cấp phát mỗi frame.

const SPARK_LIFE = 4.2

export default function ParticleField({ state, count }: { state: SceneState; count: number }) {
  const reduced = useReducedMotion()
  const ref = useRef<Points>(null)
  const nAmbient = Math.round(count * 0.62)
  const nSpark = count - nAmbient

  const data = useMemo(() => {
    const rnd = mulberry32(7)
    const base = new Float32Array(nAmbient * 3)
    const seed = new Float32Array(nAmbient * 3)
    for (let i = 0; i < nAmbient; i++) {
      const r = 1.3 + rnd() * 3.2
      const a = rnd() * Math.PI * 2
      base[i * 3] = Math.cos(a) * r
      base[i * 3 + 1] = (rnd() - 0.35) * 4.2
      base[i * 3 + 2] = Math.sin(a) * r - 0.5
      seed[i * 3] = rnd() * 6.28
      seed[i * 3 + 1] = 0.15 + rnd() * 0.35
      seed[i * 3 + 2] = 0.02 + rnd() * 0.05
    }
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const alpha = new Float32Array(count)
    const vel = new Float32Array(nSpark * 3)
    const birth = new Float32Array(nSpark).fill(-1)
    for (let i = 0; i < nAmbient; i++) size[i] = 0.022 + rnd() * 0.04
    const palette = [[0.95, 0.72, 0.84], [0.72, 0.64, 0.93], [0.62, 0.85, 0.91], [1.0, 0.88, 0.64], [1.0, 0.95, 0.9]]
    const color = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) color.set(palette[Math.floor(rnd() * palette.length)], i * 3)
    return { base, seed, pos, size, alpha, vel, birth, color }
  }, [count, nAmbient, nSpark])

  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(data.pos, 3))
    g.setAttribute('aSize', new BufferAttribute(data.size, 1))
    g.setAttribute('aAlpha', new BufferAttribute(data.alpha, 1))
    g.setAttribute('aColor', new BufferAttribute(data.color, 3))
    return g
  }, [data])

  const material = useMemo(() => createSparkMaterial(), [])
  useSparkUniforms(material, state)
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const lastSpark = useRef(0)

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const { base, seed, pos, size, alpha, vel, birth } = data

    // ambient: trôi nhẹ, lúc đầu "hút" về phía tâm rồi giãn ra
    const pull = 1 + (1 - state.reveal) * 0.9
    const motion = reduced ? 0 : 1
    for (let i = 0; i < nAmbient; i++) {
      const ph = seed[i * 3]
      const sp = seed[i * 3 + 1]
      const amp = seed[i * 3 + 2]
      const rise = ((t * sp * 0.12 * motion + ph) % 4.2) - 1.5
      pos[i * 3] = base[i * 3] / pull + Math.sin(t * sp + ph) * amp * 6 * motion
      pos[i * 3 + 1] = ((base[i * 3 + 1] + 1.5 + rise + 4.2) % 4.2) - 1.5
      pos[i * 3 + 2] = base[i * 3 + 2] / pull + Math.cos(t * sp * 0.8 + ph) * amp * 6 * motion
      alpha[i] = (0.35 + 0.35 * Math.sin(t * sp * 1.6 + ph)) * 0.8
    }

    // spark: bắn ra từ tâm khi bắt đầu nở
    if (state.sparkAt && state.sparkAt !== lastSpark.current) {
      lastSpark.current = state.sparkAt
      for (let k = 0; k < nSpark; k++) {
        const a = Math.random() * Math.PI * 2
        const up = 0.2 + Math.random() * 0.9
        const sp = 0.25 + Math.random() * 0.7
        vel[k * 3] = Math.cos(a) * sp
        vel[k * 3 + 1] = up * sp * 0.9
        vel[k * 3 + 2] = Math.sin(a) * sp
        birth[k] = t + Math.random() * 3.2 // bắn rải rác suốt quá trình nở
        const i = nAmbient + k
        pos[i * 3] = Math.cos(a) * 0.1
        pos[i * 3 + 1] = 0.4
        pos[i * 3 + 2] = Math.sin(a) * 0.1
        size[i] = 0.025 + Math.random() * 0.045
      }
    }
    for (let k = 0; k < nSpark; k++) {
      const i = nAmbient + k
      const b = birth[k]
      if (b < 0 || t < b) {
        alpha[i] = 0
        if (b >= 0) {
          pos[i * 3] = 0
          pos[i * 3 + 1] = 0.4
          pos[i * 3 + 2] = 0
        }
        continue
      }
      const age = t - b
      if (age > SPARK_LIFE) {
        alpha[i] = 0
        birth[k] = -1
        continue
      }
      pos[i * 3] = vel[k * 3] * age * (1 - 0.12 * age)
      pos[i * 3 + 1] = 0.4 + vel[k * 3 + 1] * age * (1 - 0.1 * age)
      pos[i * 3 + 2] = vel[k * 3 + 2] * age * (1 - 0.12 * age)
      const k01 = age / SPARK_LIFE
      alpha[i] = Math.sin(Math.min(1, k01 * 6) * Math.PI * 0.5) * (1 - k01) * 1.1
    }

    ;(geometry.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aAlpha') as BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aSize') as BufferAttribute).needsUpdate = true
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={2000} />
}
