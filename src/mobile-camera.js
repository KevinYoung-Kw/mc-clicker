// Temporary panel/placement views never overwrite the player's free camera.
// Stored per world/room for this session, independently of the game economy.
export function createMobileCamera({ camera, enabled, overviewOnOpen = () => false }) {
  const contexts = new Map();
  let lastContext=null;
  function current() {
    const world = camera();
    return world && contexts.get(world.cameraContext);
  }
  return {
    reset() { contexts.clear(); lastContext=null; },
    sync(open) {
      const world = camera();
      if (!world) return;
      let entry = current();
      if(lastContext!==world.cameraContext&&entry?.open)world.restoreCamera(entry.free);
      lastContext=world.cameraContext;
      if (!enabled()) {
        if (entry?.open) world.restoreCamera(entry.free);
        contexts.clear();
        return;
      }
      if (!entry) {
        entry = { open: false, inspecting: false };
        contexts.set(world.cameraContext, entry);
      }
      if (entry.open === open) return;
      if (open) {
        entry.free = world.captureCamera();
        entry.overview = {
          ...entry.free,
          pan: { x: 0, y: 0, z: 0 },
          zoom: 1,
          focusId: null,
          focusPoint: null,
        };
        if (overviewOnOpen()) world.restoreCamera(entry.overview);
      } else if (entry.inspecting || overviewOnOpen()) {
        world.restoreCamera(entry.free);
      }
      entry.open = open;
      entry.inspecting = false;
    },
    preview(point, size) {
      const world = camera();
      let entry = current();
      if (!enabled() || !world) return;
      if (!entry) {
        entry = { open: false, inspecting: false };
        contexts.set(world.cameraContext, entry);
      }
      if (!entry.inspecting) entry.overview = world.captureCamera();
      world.inspectPoint(point, size);
      entry.inspecting = true;
    },
    overview() {
      const entry = current();
      if (!enabled() || !entry?.inspecting) return false;
      camera().restoreCamera(entry.overview);
      entry.inspecting = false;
      return true;
    },
    restore(saved) {
      if (!enabled() || !saved) return;
      camera()?.restoreCamera(saved);
      if (current()) current().inspecting = false;
    },
    get inspecting() {
      return enabled() && !!current()?.inspecting;
    },
    get free() {
      return current()?.open ? current().free : camera()?.captureCamera();
    },
  };
}
