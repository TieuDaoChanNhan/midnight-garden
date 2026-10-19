import { BufferAttribute, type BufferGeometry, type Color } from 'three'

// Thêm thuộc tính màu RGBA cho hình phụ (đài hoa, cuống, lá) theo hàm màu.
export function paint(geo: BufferGeometry, fn: (x: number, y: number, z: number) => [Color, number]): BufferGeometry {
  const p = geo.getAttribute('position')
  const out = new Float32Array(p.count * 4)
  for (let i = 0; i < p.count; i++) {
    const [c, a] = fn(p.getX(i), p.getY(i), p.getZ(i))
    out.set([c.r, c.g, c.b, a], i * 4)
  }
  geo.setAttribute('color', new BufferAttribute(out, 4))
  return geo
}
