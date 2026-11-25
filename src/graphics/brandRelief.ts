// Silhouette and four counters traced from the alpha channel of brand-mark-mask.png.
const contours = [
  [97,85, 84,98, 70,118, 60,141, 55,166, 55,195, 60,220, 71,247, 79,259, 65,283, 59,300, 55,323, 55,340, 57,355, 62,372, 70,389, 84,409, 104,428, 119,438, 144,449, 170,454, 190,454, 212,450, 236,440, 255,427, 273,439, 299,450, 321,454, 341,454, 356,452, 382,443, 411,425, 428,408, 440,391, 452,363, 456,342, 456,321, 451,296, 442,275, 432,260, 445,236, 452,215, 456,194, 456,167, 452,145, 445,126, 437,111, 427,98, 410,82, 391,70, 370,62, 349,58, 326,58, 293,66, 275,75, 257,89, 254,89, 239,77, 220,67, 206,62, 185,58, 162,58, 134,64, 113,74],
  [146,105, 168,100, 187,101, 203,106, 223,118, 223,120, 199,144, 192,156, 186,173, 184,199, 188,220, 194,233, 191,243, 190,263, 194,279, 200,291, 211,304, 224,313, 243,320, 254,321, 267,320, 284,314, 286,315, 286,328, 282,338, 278,344, 251,370, 140,261, 178,223, 174,193, 176,176, 181,160, 178,161, 112,228, 109,226, 102,211, 97,188, 97,173, 103,148, 114,129, 127,116],
  [255,149, 371,260, 336,295, 339,312, 339,327, 336,344, 328,363, 400,292, 407,301, 413,325, 413,338, 409,357, 396,380, 383,393, 364,405, 344,411, 327,412, 302,406, 287,397, 310,373, 323,352, 329,328, 328,303, 321,281, 318,277, 321,259, 319,239, 312,222, 303,210, 289,199, 268,191, 249,190, 241,191, 229,196, 225,195, 230,175],
  [287,119, 305,107, 330,100, 356,102, 365,105, 384,116, 397,129, 404,139, 411,157, 414,173, 412,200, 402,226, 399,228],
  [107,295, 110,292, 219,400, 197,410, 174,412, 149,406, 136,399, 123,389, 110,373, 99,347, 98,321],
]

// Sample the signed outline once. All ray-marched faces, edges and shadows then
// use the same relief, including the openings between the interlocking loops.
const side = 129
let field: Float32Array | undefined
function makeField() {
  const data = new Float32Array(side * side)
  for (let row = 0; row < side; row++) {
    const y = row * 4
    for (let col = 0; col < side; col++) {
      const x = col * 4
      let nearest = Infinity, inside = false
      for (const loop of contours) {
        for (let i = 0, j = loop.length - 2; i < loop.length; j = i, i += 2) {
          const ax = loop[j]!, ay = loop[j + 1]!, bx = loop[i]!, by = loop[i + 1]!
          const dx = bx - ax, dy = by - ay
          if ((ay > y) !== (by > y) && x < ax + (y - ay) * dx / dy) inside = !inside
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
          nearest = Math.min(nearest, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2)
        }
      }
      data[row * side + col] = Math.sqrt(nearest) * (inside ? -0.56 : 0.56)
    }
  }
  return data
}

export function brandRelief(x: number, y: number, z: number) {
  const bounds = Math.max(Math.abs(x), Math.abs(y)) - 141
  if (bounds > 0) return bounds + 18
  field ??= makeField()
  const u = x / 2.24 + 64, v = y / 2.24 + 64
  const col = Math.floor(u), row = Math.floor(v)
  const i = row * side + col
  const top = field[i]! + (u - col) * (field[i + 1]! - field[i]!)
  const bottom = field[i + side]! + (u - col) * (field[i + side + 1]! - field[i + side]!)
  const edge = top + (v - row) * (bottom - top) + 2.5
  const face = Math.abs(z) - 7
  return Math.hypot(Math.max(edge, 0), Math.max(face, 0)) + Math.min(Math.max(edge, face), 0) - 2.5
}
