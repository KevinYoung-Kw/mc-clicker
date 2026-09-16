export function icon(name, size = 24) {
  const paths = {
    bowl: '<path d="M3 11h18v4h-3v4H6v-4H3ZM7 6V3m5 4V2m5 4V3M7 22h10"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    person: '<path d="M8 2h8v8H8ZM5 13h14v9H5ZM9 13v9m6-9v9"/>',
    box: '<path d="M3 4h18v5H3ZM5 9v12h14V9M9 13h6"/>',
    save: '<path d="M3 3h15v3h3v15H3ZM7 3v7h10V3M7 21v-7h10v7M13 5v3"/>',
    next: '<path fill="currentColor" stroke="none" d="M4 4h3v2h3v2h3v2h3v4h-3v2h-3v2H7v2H4ZM18 4h3v16h-3Z"/>',
    rotate: '<path d="M5 8V4h13v3h3v11h-3v3H7v-3H4v-4h3v3h10V8H9v3H6V8Z"/>',
    repeat: '<path d="M3 10V5h15V2l4 4-4 4V7H5v3M21 14v5H6v3l-4-4 4-4v3h13v-3"/>',
    undo: '<path d="M9 3L3 9l6 6V11h8v8H8v3h12V8H9Z"/>',
    home: '<path d="M2 11h3V8h3V5h3V2h2v3h3v3h3v3h3M5 11v11h14V11M10 22v-8h4v8"/>',
    play: '<path fill="currentColor" stroke="none" d="M6 3h3v2h3v2h3v2h3v2h3v2h-3v2h-3v2h-3v2H9v2H6Z"/>',
    pause: '<path fill="currentColor" stroke="none" d="M5 4h5v16H5ZM14 4h5v16h-5Z"/>',
    gear: '<path d="M9 2h6v3h3v3h3v8h-3v3h-3v3H9v-3H6v-3H3V8h3V5h3Z"/><path d="M9 9h6v6H9Z"/>',
    wrench: '<path d="M14 2h7v3h-5v4h4V6h3v8h-6L8 23H2v-6l9-9V2ZM5 18h2v2H5"/>',
    circuit: '<path d="M2 3h6v6H2ZM16 15h6v6h-6ZM8 6h4v12h4M16 3h6v6h-6ZM12 6h4"/>',
    brush: '<path d="M14 2h5v7h-3v3h-3v3H9v-4h3V8h2ZM9 14H5v4H2v4h7v-3h3v-5Z"/>',
    lock: '<path d="M5 10h14v11H5ZM8 10V4h8v6M12 14v3"/>',
    locate: '<path d="M8 2h8v2h3v3h2v6h-2v3h-3v3h-3v3h-2v-3H8v-3H5v-3H3V7h2V4h3Z"/><path d="M9 7h6v6H9Z"/>',
    chevron: '<path d="M5 8v3h3v3h3v3h2v-3h3v-3h3V8"/>',
    cube: '<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
    sound:
      '<path d="m11 4-6 5H2v6h3l6 5Z"/><path d="M15 8h2v8h-2m4-11h3v14h-3"/>',
    mute: '<path d="m11 4-6 5H2v6h3l6 5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><rect x="5" y="4" width="6" height="6"/><rect x="13" y="14" width="6" height="6"/>',
    album:
      '<rect x="3" y="3" width="18" height="18" rx="0"/><path d="M7 3v18m4-7 3-3 4 5"/><rect x="15" y="7" width="2" height="2"/>',
    bag: '<path d="M4 8h16v13H4ZM8 8V3h8v5M8 11v2m8-2v2"/><path d="M9 17h6"/>',
    help: '<path d="M4 3h16v16H9l-5 3Z"/><path d="M9 8V6h6v5h-3v2"/><rect x="11" y="15" width="2" height="2" fill="currentColor" stroke="none"/>',
    book: '<path d="M3 4h7v2h4V4h7v16h-7v2h-4v-2H3ZM12 6v16M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
    camera:
      '<path d="M2 7h12v12H2ZM14 11h3V9h4v8h-4v-2h-3"/><rect x="4" y="2" width="4" height="5"/><rect x="10" y="2" width="4" height="5"/><path d="M5 11h6m-6 4h4"/>',
    goal: '<path d="M5 22V3h13l-3 4 3 4H5M2 22h6"/>',
    info: '<path d="M5 3h14v3h3v12h-3v3H5v-3H2V6h3Z"/><path d="M12 11v6m-2 0h4"/><rect x="11" y="6" width="2" height="2"/>',
    mail: '<path d="M2 6h20v14H2ZM3 7h3v3h3v3h6v-3h3V7h3M3 19l6-6m12 6-6-6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    share: '<path d="M12 16V3m-5 5 5-5 5 5M5 12H3v9h18v-9h-2"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="0"/><path d="M16 8V3H3v13h5"/>',
    leaf: '<path d="M4 20V10h4V6h6V3h7v7h-3v6h-4v4H4m0 0 5-5v-4h4V7"/>',
    spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
    hand: '<path d="M3 7V4h3V2h12v2h3v6h-3V7h-6v3H9v3H6v3H3v3H1v-4h3v-3h3V9h3V6H6v1Z"/>',
    clock: '<path d="M6 3h12v3h3v12h-3v3H6v-3H3V6h3Z"/><path d="M12 6v6l4 2"/>',
    wheat:
      '<path d="M12 22V3M12 8H7V4h3v3m2 6H5V9h4v3m3 6H4v-4h5v3m3-9h5V4h-3v3m-2 6h7V9h-4v3m-3 6h8v-4h-5v3"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name] || paths.cube}</svg>`;
}

export function iconButton(symbol, label, attributes = '') {
  const safe = String(label).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return `<button type="button" class="facility-icon" ${attributes} aria-label="${safe}" title="${safe}">${icon(symbol, 18)}</button>`;
}
