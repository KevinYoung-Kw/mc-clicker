import * as T from "three";
import { box, group } from "./models.js";
// Animations read settled carrier state. They do not create trips or move inventory.
export function createFreightView(object, id, state) {
  if (!["N6", "E3", "E9"].includes(id)) return null;
  object.updateWorldMatrix(true, true);
  const bounds = new T.Box3().setFromObject(object),
    lo = object.worldToLocal(bounds.min.clone()),
    hi = object.worldToLocal(bounds.max.clone()),
    size = hi.clone().sub(lo);
  const cargoParts = [];
  object.traverse((part) => {
    if (
      ["freight-box", "cargo", "cargo-bay"].includes(part.userData.facilityPart)
    )
      cargoParts.push(part);
  });
  if (!cargoParts.length) {
    const hold = group(object);
    hold.userData.facilityPart = "real-cargo";
    const width = size.x * (id === "E9" ? 0.14 : 0.34),
      depth = size.z * (id === "E9" ? 0.16 : 0.3);
    const crate = box(
      hold,
      "#b49765",
      0,
      lo.y + size.y * (id === "E9" ? 0.72 : id === "N6" ? 0.2 : 0.52),
      id === "E3" ? lo.z + depth / 2 : (lo.z + hi.z) / 2,
      width,
      size.y * 0.16,
      depth,
    );
    box(
      hold,
      id === "N6" ? "#7b9760" : "#aa91b8",
      crate.position.x,
      crate.position.y + size.y * 0.04,
      crate.position.z,
      width * 1.025,
      size.y * 0.035,
      depth * 1.025,
    );
    cargoParts.push(hold);
  }
  return {
    update(t, anchor, home, roof) {
      const trip = state.dimensions?.trips[id];
      for (const part of cargoParts) part.visible = !!trip?.cargo;
      if (id === "E3") return;
      anchor.position.y = roof + (id === "E9" ? 0.65 : 0);
      object.position.y = Math.sin(t * 0.7) * 0.09;
      if (!trip) {
        anchor.position.x = home.x;
        anchor.position.z = home.z;
        object.rotation.y = Math.sin(t * 0.2) * 0.1;
        return;
      }
      const progress = 1 - trip.remaining / (trip.duration || trip.flight),
        u = Math.max(0, Math.min(1, progress));
      const gateway = state.placements[id === "N6" ? "N1" : "E2"] || {
        x: 0,
        z: 0,
      };
      const dx = gateway.x - home.x,
        dz = gateway.z - home.z,
        arc = id === "E9" ? 3 : 1.2;
      const point = (f) => ({
        x:
          home.x + dx * Math.sin(Math.PI * f) + Math.sin(2 * Math.PI * f) * arc,
        z: home.z + dz * Math.sin(Math.PI * f) + Math.sin(Math.PI * f) * arc,
      });
      const p = point(u),
        next = point(Math.min(1, u + 0.015));
      anchor.position.x = p.x;
      anchor.position.z = p.z;
      object.rotation.y = Math.atan2(next.x - p.x, next.z - p.z);
      object.position.y += Math.sin(Math.PI * u) * (id === "E9" ? 0.7 : 0.35);
    },
  };
}
