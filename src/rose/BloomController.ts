import type { Camera } from 'three'
import { Vector3 } from 'three'
import { PetalSurface, smootherstep } from './RoseGeometry'
import type { RoseParams } from './RoseParameters'

// Giữ danh sách cánh hoa, áp dụng tiến độ nở (có so le theo từng cánh) và
// sắp xếp thứ tự vẽ từ xa đến gần để lớp thủy tinh chồng lên nhau đúng.

export interface SortItem {
  centroid: Vector3
  dist: number
  apply: (rank: number) => void
}

export class BloomController {
  readonly surfaces: PetalSurface[]
  private lastBloom = -1

  constructor(params: RoseParams, nu: number, nv: number) {
    this.surfaces = params.petals.map((p) => new PetalSurface(p, nu, nv))
  }

  /** Trả về true nếu hình học thực sự thay đổi. */
  setBloom(b: number): boolean {
    if (Math.abs(b - this.lastBloom) < 1e-5) return false
    this.lastBloom = b
    for (const s of this.surfaces) {
      const t = (b - s.spec.delay) / s.spec.span
      s.update(smootherstep(t))
    }
    return true
  }

  dispose() {
    this.surfaces.forEach((s) => s.dispose())
  }
}

const tmp = new Vector3()
/** Gán renderOrder theo khoảng cách tới camera (xa vẽ trước). */
export function sortByDistance(items: SortItem[], camera: Camera, toWorld: (v: Vector3) => Vector3) {
  for (const it of items) {
    tmp.copy(it.centroid)
    toWorld(tmp)
    it.dist = tmp.distanceToSquared(camera.position)
  }
  items.sort((a, b) => b.dist - a.dist)
  for (let i = 0; i < items.length; i++) items[i].apply(i + 1)
}
