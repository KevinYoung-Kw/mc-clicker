// CSS pixels, including the viewport offset of a resized/docked scene.
export function projectWorldPoint(point, camera, viewport) {
  camera.updateMatrixWorld();
  const p = point.clone().project(camera);
  if (![p.x, p.y, p.z].every(Number.isFinite) || p.z < -1 || p.z > 1)
    return null;
  return {
    x: viewport.left + ((p.x + 1) / 2) * viewport.width,
    y: viewport.top + ((1 - p.y) / 2) * viewport.height,
  };
}
