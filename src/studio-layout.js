// The indoor room has its own grid; the outdoor entrance always uses 2 × 2 land.
export const STUDIO = Object.freeze({
  width: 6,
  depth: 5,
  grid: 0.25,
  floorY: 0.2,
  wallHeight: 2.28,
  interiorScale: 1,
  // Leave one small standing area at the entrance even in a fully furnished
  // room, so its musician never has to overlap equipment.
  staffLanding: { x: 0, z: 1.75, w: 0.85, d: 0.8 },
  // Includes the room diagonal and wall trim, so portrait home view never clips.
  view: { center: { x: 0, y: 0.72, z: 0 }, span: 8.6 },
});

export const STUDIO_ANCHORS = Object.freeze({
  desk: { x: 0, z: -1.78, w: 1.52, d: 0.64 },
  host: { x: 0, z: -0.84 },
  cameras: [
    { x: -1.25, z: 0.75 },
    { x: -0.75, z: 1 },
    { x: -1.25, z: 0 },
  ],
  chat: { x: 1.25, z: -2.25 },
  gifts: { x: 1.5, z: 0.5 },
  emotes: { x: -0.75, z: 0.5 },
  programs: { x: -1.25, z: -2.25 },
  community: { x: 0, z: -2.25 },
  director: { x: -1.25, z: -1.75 },
  dimensions: { x: -1.25, z: -2.25 },
  goals: { x: 1.25, z: -0.5 },
  festival: { x: 1.25, z: 1.5 },
  shelf: { x: 2.5, z: 1 },
  sign: { x: 0, z: -2.25 },
});

export const STUDIO_DEVICE_IDS = Object.freeze(
  Array.from({ length: 12 }, (_, i) => `L${i + 3}`),
);

export const STUDIO_ZONES = Object.freeze({
  broadcast: { name: "主持与导播", x: 0, z: -1.5, w: 1.7, d: 1.6 },
  filming: { name: "拍摄区", x: -1.2, z: 0.6, w: 1.5, d: 1.6 },
  audience: { name: "观众与礼物", x: 1.4, z: 0.5, w: 1.3, d: 2.8 },
  control: { name: "频道控制", x: -1.3, z: -1.8, w: 0.8, d: 0.9 },
});
