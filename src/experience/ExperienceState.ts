// Trạng thái dùng chung giữa phần UI (React DOM) và cảnh 3D (R3F).
// Các giá trị liên tục (bloom, ánh sáng...) nằm trong một object mutable để GSAP animate
// trực tiếp, không gây re-render mỗi frame.

export type Phase = 'emerge' | 'invite' | 'bloom' | 'reveal'

export interface SceneState {
  bloom: number // 0 = búp, 1 = nở hoàn toàn
  reveal: number // 0..1: hoa hiện ra từ bóng tối
  light: number // 0..1: ánh sáng phát ra từ tâm
  warm: number // 0..1: ánh sáng ấm hơn sau khi nở
  camMix: number // 0 = khung cho búp, 1 = khung cho hoa nở
  textShift: number // 0..1: đẩy hoa lên cao để nhường chỗ cho chữ
  sparkAt: number // thời điểm (ms) yêu cầu bắn hạt sáng, 0 = chưa
  idle: number // 0..1: cường độ chuyển động nhẹ
}

export const createSceneState = (): SceneState => ({
  bloom: 0,
  reveal: 0,
  light: 0,
  warm: 0,
  camMix: 0,
  textShift: 0,
  sparkAt: 0,
  idle: 1,
})

export interface DebugFlags {
  bloom: number | null // ?b=0.5 giữ cố định mức nở
  clay: boolean // ?clay=1 vật liệu đất sét để kiểm tra hình khối
  post: boolean // ?post=0 tắt hậu kỳ
  tier: 'high' | 'medium' | 'low' | null
  view: number | null // ?view=<độ> xoay máy quay
  phi: number | null // ?phi=<rad> góc nhìn từ trên xuống
}

export function readDebugFlags(): DebugFlags {
  const q = new URLSearchParams(window.location.search)
  const b = q.get('b')
  const t = q.get('tier')
  const v = q.get('view')
  const ph = q.get('phi')
  return {
    bloom: b === null ? null : Math.min(1, Math.max(0, parseFloat(b))),
    clay: q.get('clay') === '1',
    post: q.get('post') !== '0',
    tier: t === 'high' || t === 'medium' || t === 'low' ? t : null,
    view: v === null ? null : parseFloat(v),
    phi: ph === null ? null : parseFloat(ph),
  }
}
