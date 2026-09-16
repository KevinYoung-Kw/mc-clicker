const rect = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
export function collectionArt(i) {
  const c = i.color,
    k = i.index || 0,
    ink = "#354541",
    paper = "#f3ead1";
  let p = "";
  if (i.slot === "cursor") {
    const pixels = [
      "  HHHHH ",
      " HHLLHH ",
      " H  SW H",
      "    SW  ",
      "   SW   ",
      "  SW    ",
      " SW     ",
      "SW      ",
    ];
    pixels.forEach((row, y) =>
      [...row].forEach((a, x) => {
        if (a !== " ")
          p += rect(
            25 + x * 5,
            8 + y * 5,
            5,
            5,
            { H: c, L: paper, S: "#5f4531", W: "#ac7f49" }[a],
          );
      }),
    );
    if (k === 2)
      for (const [x, y] of [
        [20, 8],
        [74, 31],
        [56, 51],
      ])
        p += rect(x, y, 3, 3, "#d4bbe5");
  } else if (i.slot === "frame" || i.slot === "title") {
    p =
      rect(8, 9, 80, 45, ink) +
      rect(11, 12, 74, 39, c) +
      rect(17, 18, 62, 27, paper);
    for (const [x, y] of [
      [10, 11],
      [80, 11],
      [10, 47],
      [80, 47],
    ])
      p += rect(x, y, 6, 6, k === 1 ? "#83aaa0" : "#d5b679");
    if (k === 0)
      for (let j = 0; j < 2; j++) p += rect(16, 13 + j * 37, 60, 2, "#72523b");
    if (k === 1)
      p += `<path d="M12 26h9v-9h12m50 27H72v-9H60" fill="none" stroke="#e2d69c" stroke-width="2"/>`;
    if (k === 2)
      for (let j = 0; j < 5; j++) p += rect(23 + j * 12, 11, 4, 4, "#b09ec9");
    p += `<text x="48" y="36" fill="${ink}" text-anchor="middle" font-family="monospace" font-size="${i.slot === "title" ? 12 : 9}" font-weight="bold">${i.slot === "title" ? ["MC WORLD", "ON AIR", "THE END"][k] : "YOUR WORLD"}</text>`;
  } else if (i.slot === "icon") {
    const patterns = [
      "   XX   ",
      "  XXXX  ",
      " XXXXXX ",
      " XXXXXX ",
      "  XXXX  ",
      "   XX   ",
    ];
    patterns.forEach((r, y) =>
      [...r].forEach((v, x) => {
        if (v === "X")
          p += rect(20 + x * 7, 9 + y * 7, 7, 7, (x + y) % 4 === 0 ? paper : c);
      }),
    );
    if (k === 1)
      p += `<path d="M49 12v15h-9v8h10v14h6V31h7v-7H53V12Z" fill="#f2cf81"/>`;
    if (k === 2)
      p += rect(35, 23, 28, 14, "#78b7a5") + rect(45, 20, 7, 22, ink);
  } else if (i.slot === "flag") {
    p =
      rect(19, 7, 4, 50, ink) + rect(23, 9, 53, 31, c) + rect(23, 40, 42, 5, c);
    const patterns =
      k === 0
        ? [
            [43, 16, 3, 22],
            [37, 18, 6, 4],
            [46, 23, 6, 4],
            [37, 28, 6, 4],
          ]
        : k === 1
          ? [
              [38, 16, 21, 19],
              [34, 22, 29, 6],
              [44, 12, 8, 27],
            ]
          : [
              [32, 18, 9, 10],
              [41, 23, 15, 7],
              [56, 18, 9, 10],
              [44, 30, 9, 7],
            ];
    for (const r of patterns) p += rect(...r, paper);
    if (k === 1) p += rect(44, 22, 9, 7, c);
  } else if (i.slot === "sky" || i.category === "world") {
    p =
      rect(
        8,
        6,
        80,
        50,
        i.slot === "sky" ? (k === 2 ? "#39445b" : c) : "#c5d8d0",
      ) + rect(8, 45, 80, 11, "#719564");
    const snowy = i.id === "world-snow",
      rain = i.id === "world-rain";
    if (i.id === "stall" || i.id === "garden") {
      p += rect(26, 30, 43, 16, "#a77d50") + rect(24, 16, 47, 12, c);
      for (let j = 0; j < 4; j++) p += rect(25 + j * 12, 16, 6, 12, paper);
    } else if (i.id === "world-meteor") {
      p =
        rect(8, 6, 80, 50, "#3b4763") +
        `<path d="M25 18h7v7h7v7h7" stroke="#d8c7eb" stroke-width="4" fill="none"/>` +
        rect(46, 32, 7, 7, paper);
    } else if (i.id === "world-fireflies") {
      p = rect(8, 6, 80, 50, "#394c47");
      for (let j = 0; j < 9; j++)
        p += rect(18 + ((j * 17) % 61), 14 + ((j * 11) % 32), 3, 3, "#e3e5a3");
    } else if (i.id === "world-day") {
      p +=
        rect(36, 37, 27, 6, "#ac9671") +
        `<path d="M42 36h14V20Z" fill="#79664d"/>` +
        rect(18, 13, 10, 10, "#e9cc84");
    } else {
      p +=
        rect(57, 13, 12, 12, snowy ? "#e8eee9" : "#ecd298") +
        rect(21, 24, 26, 8, paper) +
        rect(29, 19, 12, 8, paper);
      if (rain || snowy || i.id === "world-weather")
        for (let j = 0; j < 6; j++)
          p += rect(
            20 + j * 9,
            35 + (j % 2) * 4,
            snowy ? 3 : 2,
            snowy ? 3 : 7,
            snowy ? paper : "#719fad",
          );
      if (i.slot === "sky" && k === 2)
        for (let j = 0; j < 8; j++)
          p += rect(17 + ((j * 19) % 63), 10 + ((j * 7) % 28), 2, 2, paper);
    }
  } else if (i.category === "studio") {
    p = rect(8, 6, 80, 50, "#273d42") + rect(8, 49, 80, 7, "#987748");
    if (i.slot === "studioDesk") {
      p +=
        rect(17, 38, 63, 5, c) +
        rect(23, 43, 4, 10, c) +
        rect(71, 43, 4, 10, c) +
        rect(31, 13, 32, 21, ink) +
        rect(34, 16, 26, 15, "#7db8a1");
      for (let j = 0; j < 8; j++)
        p += rect(22 + j * 7, 35, 4, 2, k ? "#73b7b5" : paper);
    }
    if (i.slot === "studioWall")
      for (let j = 0; j < 5; j++) {
        p +=
          rect(15 + j * 14, 12, 10, 32, c) +
          rect(17 + j * 14, 17 + (j % 2) * 8, 6, 6, k ? "#c4add7" : "#243c35");
      }
    if (i.slot === "studioSign")
      p +=
        rect(17, 18, 62, 26, c) +
        `<text x="48" y="35" fill="${paper}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold">ON AIR</text>`;
    if (i.slot === "studioShelf")
      for (let j = 0; j < 2; j++) {
        p += rect(18, 28 + j * 19, 60, 4, c);
        for (let h = 0; h < 4; h++)
          p += rect(
            23 + h * 14,
            15 + j * 19,
            9,
            13,
            k ? ["#a68cbf", "#82bcaa"][h % 2] : ["#b39664", "#839b6e"][h % 2],
          );
      }
  } else {
    p = rect(37, 25, 22, 16, ink) + rect(40, 28, 16, 10, c);
    for (let j = 0; j < 12; j++) {
      const x = 15 + ((j * 17) % 68),
        y = 8 + ((j * 13) % 44);
      p += rect(x, y, 3 + (j % 3), 3 + (j % 3), j % 3 ? c : paper);
    }
    if (k === 1)
      p += `<path d="M20 18h10v6m45 21H65v-6" stroke="${c}" stroke-width="3" fill="none"/>`;
  }
  return `<svg viewBox="0 0 96 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${p}</svg>`;
}
