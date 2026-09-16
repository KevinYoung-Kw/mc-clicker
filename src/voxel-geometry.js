import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
// A contiguous, stair-stepped silhouette, shared by selection and model ornaments.
export function pixelRingGeometry(
  radius = 1,
  thickness = 0.18,
  step = 0.1,
  depth = 0.04,
) {
  const pieces = [];
  for (let x = -radius; x <= radius; x += step)
    for (let y = -radius; y <= radius; y += step) {
      const d = Math.hypot(x, y);
      if (d <= radius && d >= radius - thickness)
        pieces.push(new T.BoxGeometry(step, step, depth).translate(x, y, 0));
    }
  const merged = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  return merged;
}
