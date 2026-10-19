import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// Hậu kỳ tiết chế: bloom nhẹ cho điểm sáng, vignette, hạt phim rất mịn.
// Bông hoa vẫn phải đẹp khi tắt hậu kỳ (xem ?post=0).
export default function PostProcessing({ resolution }: { resolution: number }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={0.42} luminanceThreshold={0.86} luminanceSmoothing={0.25} mipmapBlur resolutionScale={resolution} radius={0.72} />
      <Vignette offset={0.3} darkness={0.85} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
