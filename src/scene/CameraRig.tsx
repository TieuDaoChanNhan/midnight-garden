import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import type { SceneState } from '../experience/ExperienceState'
import { useReducedMotion } from '../rose/useReducedMotion'

// Máy quay quỹ đạo tự viết: quán tính mượt, giới hạn góc nhìn đẹp, luôn giữ hoa ở giữa.
// Khung hình tự co giãn theo tỉ lệ màn hình (điện thoại dọc / máy tính ngang).

const FOV = 30
const TAN = Math.tan((FOV * Math.PI) / 360)
const PHI_MIN = 0.55
const PHI_MAX = 1.38

const fit = (aspect: number, halfW: number, halfH: number) => Math.max(halfH / TAN, halfW / (TAN * aspect)) * 1.08
const ease = (t: number) => t * t * (3 - 2 * t)

export default function CameraRig({ state, initialView, initialPhi }: { state: SceneState; initialView: number | null; initialPhi: number | null }) {
  const { camera, gl, size } = useThree()
  const reducedMotion = useReducedMotion()
  const rig = useRef({ theta: 0.45, phi: 1.08, vTheta: 0, vPhi: 0, dragging: false, x: 0, y: 0, lastTouch: 0 })

  useEffect(() => {
    if (initialView !== null) rig.current.theta = (initialView * Math.PI) / 180
    if (initialPhi !== null) rig.current.phi = initialPhi
  }, [initialView, initialPhi])

  useEffect(() => {
    const el = gl.domElement
    const r = rig.current
    const down = (e: PointerEvent) => {
      r.dragging = true
      r.lastTouch = performance.now()
      r.x = e.clientX
      r.y = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!r.dragging) return
      const dx = e.clientX - r.x
      const dy = e.clientY - r.y
      r.x = e.clientX
      r.y = e.clientY
      if (state.bloom < 0.85) return // chỉ cho xoay sau khi hoa đã nở
      r.vTheta = -dx * 0.0042
      r.vPhi = -dy * 0.0036
    }
    const up = (e: PointerEvent) => {
      r.dragging = false
      r.lastTouch = performance.now()
      el.releasePointerCapture?.(e.pointerId)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [gl, state])

  useFrame((_, dt) => {
    const r = rig.current
    const cam = camera as PerspectiveCamera
    if (cam.fov !== FOV) {
      cam.fov = FOV
      cam.updateProjectionMatrix()
    }
    const aspect = size.width / size.height

    // Sau khi nở xong và khi không ai chạm, máy quay tự trôi nhẹ quanh hoa để cảnh không bao giờ đứng yên
    if (!reducedMotion && !r.dragging && state.bloom > 0.95 && initialView === null) {
      const idle = Math.min(1, Math.max(0, (performance.now() - r.lastTouch - 2500) / 2500))
      r.theta += dt * 0.085 * idle
      r.phi = Math.min(PHI_MAX, Math.max(PHI_MIN, r.phi + Math.sin(performance.now() / 4200) * dt * 0.02 * idle))
    }

    // quán tính + giảm dần
    r.theta += r.vTheta
    r.phi = Math.min(PHI_MAX, Math.max(PHI_MIN, r.phi + r.vPhi))
    const damp = Math.pow(0.0008, dt)
    r.vTheta *= damp
    r.vPhi *= damp

    const m = ease(state.camMix)
    const dBud = fit(aspect, 1.55, 1.55)
    const dOpen = aspect < 0.9 ? fit(aspect, 1.85, 1.75) : fit(aspect, 2.5, 1.7)
    const dist = dBud + (dOpen - dBud) * m
    const ty = 0.62 + (0.4 - 0.62) * m

    // nhường chỗ cho chữ: đẩy hoa lên cao hơn khi chữ hiện
    const viewH = 2 * dist * TAN
    const shift = viewH * (aspect < 0.9 ? 0.2 : 0.16) * state.textShift

    const sp = Math.sin(r.phi)
    cam.position.set(dist * sp * Math.sin(r.theta), ty - shift + dist * Math.cos(r.phi), dist * sp * Math.cos(r.theta))
    cam.lookAt(0, ty - shift, 0)
  })

  return null
}
