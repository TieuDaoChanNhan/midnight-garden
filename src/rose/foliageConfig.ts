import { CatmullRomCurve3, Quaternion, Vector3 } from 'three'

// Hai nhánh phụ mọc từ thân, mỗi nhánh mang một bông hồng nhỏ (cả ba bông nở cùng nhau thành một bó).

export interface BranchConfig {
  az: number // hướng ra ngoài (rad)
  y0: number // độ cao điểm mọc từ thân chính
  reach: number // tầm với ngang
  rise: number // độ cao so với điểm mọc
  scale: number // kích thước bông so với bông chính
  petals: number // số cánh
  salt: string // seed riêng để bông không giống hệt bông chính
  bloomFrom: number // bắt đầu nở khi bông chính đã nở được bấy nhiêu (so le)
}

export const BRANCHES: BranchConfig[] = [
  { az: 2.45, y0: -1.15, reach: 1.32, rise: 0.62, scale: 0.5, petals: 34, salt: 'b', bloomFrom: 0.1 },
  { az: 5.55, y0: -1.55, reach: 1.15, rise: 0.55, scale: 0.43, petals: 30, salt: 'c', bloomFrom: 0.2 },
]

export function branchPoints(b: BranchConfig): Vector3[] {
  const cx = Math.cos(b.az)
  const cz = Math.sin(b.az)
  return [
    new Vector3(0, 0, 0),
    new Vector3(0.22 * b.reach * cx, 0.6 * b.rise, 0.22 * b.reach * cz),
    new Vector3(0.65 * b.reach * cx, 0.95 * b.rise, 0.65 * b.reach * cz),
    new Vector3(b.reach * cx, b.rise, b.reach * cz),
  ]
}

/** Vị trí gốc bông (trong hệ toạ độ của cả bó) và hướng của nó (chếch ra ngoài, hướng lên). */
export function branchFlowerPose(b: BranchConfig): { position: Vector3; quaternion: Quaternion } {
  const pts = branchPoints(b)
  const curve = new CatmullRomCurve3(pts)
  const tangent = curve.getTangent(1).normalize()
  const dir = tangent.multiplyScalar(0.25).add(new Vector3(0, 0.75, 0)).normalize()
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir)
  return { position: new Vector3(pts[3].x, b.y0 + pts[3].y, pts[3].z), quaternion }
}
