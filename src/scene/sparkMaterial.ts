import { AdditiveBlending, ShaderMaterial } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { SceneState } from '../experience/ExperienceState'

// Vật liệu điểm sáng mềm dùng chung (bụi sáng, dòng sáng xoắn, bokeh, lấp lánh mặt nước).
// Mỗi điểm có kích thước (đơn vị thế giới), độ mờ và màu riêng.

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPx;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, aSize * uPx / -mv.z);
    vAlpha = aAlpha;
    vColor = aColor;
  }
`
const frag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uReveal;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(mix(vec3(1.0), vColor, 0.75), a * vAlpha * uReveal);
  }
`

export function createSparkMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uPx: { value: 800 }, uReveal: { value: 0 } },
  })
}

/** Cập nhật hệ số quy đổi kích thước điểm theo độ phân giải + độ hiện của cảnh. */
export function useSparkUniforms(material: ShaderMaterial, state: SceneState) {
  const { gl, camera } = useThree()
  useFrame(() => {
    const fov = (camera as { fov?: number }).fov ?? 30
    material.uniforms.uPx.value = gl.domElement.height / (2 * Math.tan((fov * Math.PI) / 360))
    material.uniforms.uReveal.value = state.reveal
  })
}

export const SPARK_COLORS: [number, number, number][] = [
  [0.95, 0.72, 0.84], // hồng ngọc trai
  [0.72, 0.64, 0.93], // tím nhạt
  [0.62, 0.85, 0.91], // xanh băng
  [1.0, 0.88, 0.64], // vàng nhạt
  [1.0, 0.95, 0.9], // trắng ngà
]
