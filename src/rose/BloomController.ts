import type { Camera, Mesh, Object3D } from 'three'
import { Vector3 } from 'three'
import { PetalSurface, smootherstep } from './RoseGeometry'
import type { RoseParams } from './RoseParameters'

// Giữ danh sách cánh hoa. Lúc khởi động, mỗi cánh được "nướng" sẵn thành các tư thế nở (morph target)
// trên GPU; khi nở, chỉ cần đặt trọng số pha trộn theo tiến độ so le của từng cánh.
// Thứ tự vẽ được sắp xếp từ xa đến gần để lớp thủy tinh chồng lên nhau đúng.

export interface SortItem {
  group: Object3D // đối tượng cha để đổi centroid sang toạ độ thế giới
  centroid: Vector3
  dist: number
  apply: (rank: number) => void
}

/** Tiến độ tính sẵn các tư thế nở toàn cục: để thanh tải biết khi nào xong. */
export const bakery = { total: 0, done: 0 }

export class BloomController {
  readonly surfaces: PetalSurface[]
  private meshes: (Mesh | null)[] = []
  private lastBloom = -1
  ready = false

  constructor(params: RoseParams, nu: number, nv: number) {
    this.surfaces = params.petals.map((p) => new PetalSurface(p, nu, nv))
    bakery.total += this.surfaces.length
  }

  /** Tính sẵn K tư thế cho mọi cánh, nhường main thread định kỳ để màn hình chờ vẫn mượt. */
  async bake(K: number) {
    for (let i = 0; i < this.surfaces.length; i++) {
      this.surfaces[i].bake(K)
      bakery.done++
      if (i % 5 === 4) await new Promise<void>((r) => setTimeout(r, 0))
    }
  }

  /** Gắn các mesh (sau khi đã bake) và khởi tạo morphTargetInfluences. */
  bind(meshes: (Mesh | null)[]) {
    this.meshes = meshes
    meshes.forEach((m) => m?.updateMorphTargets())
    this.ready = true
    this.lastBloom = -1
  }

  /** Trả về true nếu mức nở thực sự thay đổi. */
  setBloom(b: number): boolean {
    if (!this.ready || Math.abs(b - this.lastBloom) < 1e-5) return false
    this.lastBloom = b
    for (let i = 0; i < this.surfaces.length; i++) {
      const s = this.surfaces[i]
      const m = this.meshes[i]
      if (m) s.setMorph(smootherstep((b - s.spec.delay) / s.spec.span), m)
    }
    return true
  }

  dispose() {
    this.surfaces.forEach((s) => s.dispose())
  }
}

const tmp = new Vector3()
/** Gán renderOrder theo khoảng cách tới camera (xa vẽ trước). */
export function sortByDistance(items: SortItem[], camera: Camera) {
  for (const it of items) {
    tmp.copy(it.centroid)
    it.group.localToWorld(tmp)
    it.dist = tmp.distanceToSquared(camera.position)
  }
  items.sort((a, b) => b.dist - a.dist)
  for (let i = 0; i < items.length; i++) items[i].apply(i + 1)
}
