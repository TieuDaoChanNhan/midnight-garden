import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import type { DirectionalLight, PointLight } from 'three'
import type { SceneState } from '../experience/ExperienceState'

// Studio điện ảnh: key ấm vàng hồng, rim lạnh tím xanh, fill trắng mềm.
// Môi trường phản chiếu tạo bằng Lightformer (không tải file ngoài) để thủy tinh có
// những vệt sáng dài chạy theo độ cong của cánh.

export default function LightingRig({ state }: { state: SceneState }) {
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const core = useRef<PointLight>(null)

  useFrame(() => {
    const r = state.reveal
    if (key.current) key.current.intensity = (1.6 + state.warm * 0.8) * r
    if (rim.current) rim.current.intensity = (1.9 - state.warm * 0.5) * r
    if (core.current) core.current.intensity = state.light * 1.4 * (1 - state.bloom * 0.5)
  })

  return (
    <>
      <ambientLight intensity={0.05} color="#b8a4ee" />
      <directionalLight ref={key} position={[3.2, 4.2, 4]} color="#ffc4a0" intensity={0} />
      <directionalLight ref={rim} position={[-4, 2.4, -3.5]} color="#9fb4ff" intensity={0} />
      <directionalLight position={[0, 1, 5]} color="#ffffff" intensity={0.35} />
      <pointLight ref={core} position={[0, 0.4, 0]} color="#ffd9c2" intensity={0} distance={3} decay={2} />

      <Environment resolution={256} frames={1} environmentIntensity={1.1}>
        <color attach="background" args={['#04050c']} />
        {/* key ấm */}
        <Lightformer form="rect" intensity={3.4} color="#ffbf9a" position={[3.5, 3, 4]} scale={[4, 3, 1]} target={[0, 0, 0]} />
        {/* rim lạnh */}
        <Lightformer form="rect" intensity={3} color="#8fa6ff" position={[-5, 2, -3]} scale={[3, 5, 1]} target={[0, 0, 0]} />
        {/* vệt dài để lộ độ cong */}
        <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[-2.5, 1, 4]} scale={[0.35, 7, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.6} color="#ffe3f0" position={[4.5, -1, -1]} scale={[0.35, 7, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={9} color="#fff6ee" position={[1.6, 2.2, 4.2]} scale={[0.18, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={7} color="#cdd8ff" position={[-3.4, 0.5, -2.6]} scale={[0.16, 5, 1]} target={[0, 0, 0]} />
        {/* mũ sáng phía trên */}
        <Lightformer form="ring" intensity={2.2} color="#fff1e5" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={4} />
        {/* ánh lavender dưới */}
        <Lightformer form="circle" intensity={1.6} color="#b8a4ee" position={[0, -4, 2]} rotation-x={-Math.PI / 2} scale={5} />
      </Environment>
    </>
  )
}
