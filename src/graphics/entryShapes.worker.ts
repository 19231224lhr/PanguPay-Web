import { buildShape, type EntryShape } from './entryShapeGeometry'

self.onmessage = (event: MessageEvent<EntryShape>) => {
  const shape = event.data
  self.postMessage({ shape, points: buildShape(shape) })
}
