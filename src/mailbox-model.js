import { blockBox, cube, group } from "./models.js";

const C = {
  wood: "#977054",
  darkWood: "#665c48",
  green: "#527455",
  lid: "#64875e",
  brass: "#d5a54e",
  ink: "#334941",
  paper: "#f8edcf",
  flag: "#c66c4d",
  reward: "#a8c582",
};

function block(parent, part, surface, color, x, y, z, w, h, d) {
  const mesh = blockBox(parent, surface, color, x, y, z, w, h, d);
  mesh.userData.facilityPart = part;
  return mesh;
}

// A compact outdoor post, with all five upgrade appearances already present in
// the graph. State changes remain compatible with the world's instance batches.
export function makeMailbox(parent, level = 1, unread = 0) {
  const root = group(parent);
  root.userData.facility = "mailbox";
  block(
    root,
    "mailbox-foot",
    "stone",
    "#9da5a0",
    0,
    0.025,
    0,
    0.24,
    0.05,
    0.22,
  );
  block(root, "mailbox-post", "log", C.wood, 0, 0.255, 0, 0.09, 0.41, 0.09);
  block(
    root,
    "mailbox-support",
    "wood",
    C.darkWood,
    0,
    0.415,
    0,
    0.29,
    0.04,
    0.19,
  );
  block(root, "mailbox-body", "iron", C.green, 0, 0.575, 0, 0.33, 0.28, 0.3);
  block(root, "mailbox-lid", "iron", C.lid, 0, 0.735, 0, 0.37, 0.04, 0.35);
  block(
    root,
    "mailbox-door",
    "iron",
    C.green,
    0,
    0.556,
    0.157,
    0.285,
    0.226,
    0.024,
  );
  block(
    root,
    "mailbox-slot",
    "iron",
    C.ink,
    0,
    0.649,
    0.174,
    0.22,
    0.027,
    0.012,
  );
  block(
    root,
    "mailbox-slot-lip",
    "iron",
    C.brass,
    0,
    0.63,
    0.185,
    0.24,
    0.013,
    0.033,
  );
  block(
    root,
    "mailbox-latch",
    "iron",
    C.brass,
    0,
    0.475,
    0.18,
    0.038,
    0.029,
    0.024,
  );

  // Raised, stepped envelope emblem: the fold reads as pixels even in the shop.
  block(
    root,
    "mailbox-envelope",
    "cloth",
    C.paper,
    0,
    0.558,
    0.176,
    0.16,
    0.091,
    0.012,
  );
  for (const [x, y, w] of [
    [-0.06, 0.582, 0.023],
    [0.06, 0.582, 0.023],
    [-0.038, 0.568, 0.023],
    [0.038, 0.568, 0.023],
    [0, 0.554, 0.054],
  ]) {
    const pixel = cube(root, C.darkWood, x, y, 0.185, w, 0.014, 0.008);
    pixel.userData.facilityPart = "envelope-fold";
  }

  block(
    root,
    "mailbox-flag-hinge",
    "iron",
    C.brass,
    0.18,
    0.56,
    -0.015,
    0.037,
    0.045,
    0.045,
  );
  const flag = group(root, 0.2, 0.56, -0.015);
  block(
    flag,
    "mailbox-flag-arm",
    "iron",
    C.brass,
    0,
    0.061,
    0,
    0.022,
    0.151,
    0.022,
  );
  block(
    flag,
    "mailbox-flag-cloth",
    "cloth",
    C.flag,
    0,
    0.135,
    0.039,
    0.027,
    0.075,
    0.1,
  );
  root.userData.mailboxFlag = flag;

  const letters = [];
  for (let i = 0; i < 3; i++) {
    const letter = group(
      root,
      (i - 1) * 0.047,
      0.651 + i * 0.005,
      0.194 + i * 0.014,
    );
    block(
      letter,
      "mailbox-letter",
      "cloth",
      C.paper,
      0,
      0.006,
      0,
      0.088,
      0.057,
      0.011,
    );
    block(
      letter,
      "mailbox-letter-stamp",
      "cloth",
      i % 2 ? C.flag : C.green,
      0.026,
      0.018,
      0.008,
      0.017,
      0.014,
      0.006,
    );
    letters.push(letter);
  }
  root.userData.mailboxLetters = letters;

  const bands = [];
  for (let i = 0; i < 4; i++) {
    const band = block(
      root,
      "mailbox-postal-band",
      "iron",
      C.brass,
      0,
      0.09 + i * 0.065,
      0.054,
      0.107,
      0.024,
      0.019,
    );
    bands.push(band);
  }
  root.userData.mailboxLevelBands = bands;
  const seal = block(
    root,
    "mailbox-reward-seal",
    "iron",
    C.reward,
    0.11,
    0.47,
    0.181,
    0.035,
    0.035,
    0.02,
  );
  root.userData.mailboxRewardSeal = seal;
  updateMailbox(root, { level, unread, ready: false });
  return root;
}

const finiteInt = (value, fallback) =>
  Number.isFinite(value) ? Math.floor(value) : fallback;

export function updateMailbox(root, { level, unread, ready } = {}) {
  if (root?.userData.facility !== "mailbox") return root;
  const data = root.userData,
    previous = data.mailboxState || { level: 1, unread: 0, ready: false },
    next = {
      level: Math.max(1, Math.min(5, finiteInt(level, previous.level))),
      unread: Math.max(0, finiteInt(unread, previous.unread)),
      ready: ready === undefined ? previous.ready : Boolean(ready),
    };
  data.mailboxFlag.rotation.x = next.unread > 0 ? 0 : Math.PI / 2;
  data.mailboxLetters.forEach((letter, i) => {
    letter.visible = i < Math.min(3, next.unread);
  });
  data.mailboxLevelBands.forEach((band, i) => {
    band.visible = i < next.level - 1;
  });
  data.mailboxRewardSeal.visible = next.ready;
  data.mailboxState = next;
  return root;
}
