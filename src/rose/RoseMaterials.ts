import { AdditiveBlending, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { palette } from '../config/theme'

// Vật liệu "thủy tinh ngọc trai": không dùng transmission thật (cho cảm giác xếp lớp rõ,
// rẻ hơn nhiều trên di động) mà kết hợp:
//   - độ trong suốt theo đỉnh (vertex alpha) + Fresnel: mép đậm, lòng cánh trong
//   - iridescence (màng mỏng) + clearcoat + phản chiếu môi trường
//   - một chút ánh sáng ấm phát ra ở rìa theo góc nhìn

export interface GlassUniforms {
  uReveal: { value: number }
  uGlow: { value: number }
}

export function createGlassMaterial(): { material: MeshPhysicalMaterial; uniforms: GlassUniforms } {
  const uniforms: GlassUniforms = { uReveal: { value: 0 }, uGlow: { value: 0 } }
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
    forceSinglePass: true, // vật liệu trong suốt hai mặt mặc định vẽ 2 lượt; ép 1 lượt để giảm một nửa chi phí
    roughness: 0.1,
    metalness: 0,
    ior: 1.45,
    specularIntensity: 1.25,
    iridescence: 0.8,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [200, 620],
    envMapIntensity: 1.8,
  })
  material.customProgramCacheKey = () => 'rose-glass'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = uniforms.uReveal
    shader.uniforms.uGlow = uniforms.uGlow
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReveal;\nuniform float uGlow;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float petalFres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
        diffuseColor.a = clamp(diffuseColor.a * (0.86 + 0.6 * petalFres), 0.0, 1.0) * uReveal;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += vec3(1.0, 0.72, 0.8) * petalFres * uGlow * 0.1;
        outgoingLight = min(outgoingLight, vec3(1.35));
        #include <opaque_fragment>`,
      )
  }
  return { material, uniforms }
}

// Vật liệu đất sét để kiểm tra silhouette (?clay=1)
export function createClayMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#d9cfc8', roughness: 0.85, metalness: 0, side: DoubleSide })
}

export function createCoreGlowMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: palette.pearlWhite,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
}
