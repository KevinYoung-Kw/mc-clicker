import { cube, group } from "./models.js";
export function endPortal(parent, state, animations) {
  const root = group(parent),
    eyes = [];
  root.userData.portal = { frameCount: 12, outer: 5, inner: 3 };
  for (let side = 0; side < 4; side++)
    for (let j = -1; j <= 1; j++) {
      const x = [j, 2, -j, -2][side],
        z = [-2, j, 2, -j][side];
      const frame = group(root, x, 0, z);
      frame.rotation.y = (-side * Math.PI) / 2;
      cube(frame, "#c2c39a", 0, 0.24, 0, 0.98, 0.48, 0.98);
      cube(frame, "#41685d", 0, 0.54, 0, 0.98, 0.12, 0.98);
      for (const dx of [-0.38, 0.38])
        cube(frame, "#809b78", dx, 0.62, 0, 0.13, 0.08, 0.88);
      cube(frame, "#24483f", 0, 0.6, 0, 0.53, 0.035, 0.53);
      cube(frame, "#95ab83", 0, 0.62, 0.37, 0.18, 0.04, 0.1);
      const eye = group(frame, 0, 0.67, 0);
      cube(eye, "#b2c692", 0, 0, 0, 0.48, 0.12, 0.41);
      cube(eye, "#477f65", 0, 0.078, 0.015, 0.34, 0.05, 0.29);
      cube(eye, "#192f2f", 0, 0.107, 0.015, 0.095, 0.025, 0.23);
      cube(eye, "#e0dfaa", -0.11, 0.109, -0.06, 0.07, 0.025, 0.06);
      eyes.push(eye);
    }
  const surface = group(root);
  const sky = cube(surface, "#102729", 0, 0.57, 0, 3, 0.025, 3);
  sky.userData.nonSolid = true;
  for (let i = 0; i < 34; i++) {
    const x = Math.sin(i * 18.39) * 1.4,
      z = Math.sin(i * 9.71 + 3) * 1.4;
    const star = cube(
      surface,
      i % 3 ? "#61958c" : "#ccdfb5",
      x,
      0.589,
      z,
      0.02 + (i % 3) * 0.009,
      0.01,
      0.02 + (i % 3) * 0.009,
    );
    star.userData.nonSolid = true;
  }
  const update = (t) => {
    eyes.forEach((eye, i) => (eye.visible = i < (state.endEyes || 0)));
    surface.visible = state.endEyes === 12;
    sky.material.emissiveIntensity = 0.18 + Math.sin(t * 0.8) * 0.04;
  };
  animations.push(update);
  update(0);
  return root;
}
