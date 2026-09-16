// Each sleeve has a different pixel silhouette; the disc label repeats its motif.
const art = {
  meadow: '<path fill="#809a55" d="M0 33h64v31H0z"/><path fill="#c2cc86" d="M0 42h18v-6h19v10h27v18H0z"/><path fill="#eddca4" d="M20 64V50h7V39h6V27h5v13h-5v11h-6v13z"/><path fill="#f3e8b3" d="M8 9h10v10H8z"/><path fill="#506f43" d="M44 19h12v15H44zM48 34h4v12h-4z"/>',
  cavern: '<path fill="#415969" d="M0 0h64v64H0z"/><path fill="#799092" d="M0 0h64v10H49v9H15v-5H0zM0 52h15v-7h9v11h27v-8h13v16H0z"/><path fill="#263f4c" d="M0 18h12v34H0zM54 14h10v41H54z"/><path fill="#aad3cb" d="M24 29h7v15h-7zM33 23h6v19h-6zM41 34h5v10h-5z"/>',
  copper: '<path fill="#826452" d="M0 0h64v64H0z"/><path fill="none" stroke="#d79d68" stroke-width="4" d="M0 15h22v14h21v20h21M0 47h14V34h18V12h32"/><path fill="#efd5a0" d="M18 11h8v8h-8zM39 25h8v8h-8zM10 43h8v8h-8zM48 8h8v8h-8z"/><path fill="#566c60" d="M28 40h9v17h-9z"/>',
  rain: '<path fill="#42586f" d="M0 0h64v64H0z"/><path fill="#859daa" d="M8 5h3v11H8zM20 20h3v13h-3zM38 4h3v12h-3zM51 21h3v11h-3zM4 39h3v10H4zM40 41h3v12h-3z"/><path fill="#ccb889" d="M14 12h36v4H14zM14 48h36v5H14zM14 16h4v32h-4zM46 16h4v32h-4zM30 16h4v32h-4zM18 31h28v4H18z"/><path fill="#d6d6b8" d="M36 20h7v6h-7z"/>',
  nether: '<path fill="#553b3b" d="M0 0h64v64H0z"/><path fill="#985748" d="M0 26h12V15h12v29h12V25h16v13h12v26H0z"/><path fill="#e59a56" d="M0 57h22V45h9v12h14V42h8v15h11v7H0z"/><path fill="#f2c77d" d="M6 46h5v6H6zM40 11h5v5h-5zM25 7h3v3h-3z"/>',
  end: '<path fill="#484457" d="M0 0h64v64H0z"/><path fill="#c5b4d6" d="M30 10h4v4h4v4h-4v4h-4v-4h-4v-4h4zM7 30h4v4H7zM51 7h3v3h-3zM48 30h4v4h-4z"/><path fill="#c5c4a2" d="M15 43h10v-6h20v6h8v10H15z"/><path fill="#858477" d="M21 53h25v5H21zM28 58h11v6H28z"/><path fill="#a793bf" d="M30 29h5v9h-5zM35 25h6v5h-6z"/>',
};
export function recordArt(id) {
  return `<svg viewBox="0 0 64 64" shape-rendering="crispEdges" aria-hidden="true"><path fill="#b9ce9a" d="M0 0h64v64H0z"/>${art[id] || art.meadow}<path fill="none" stroke="#304d3e" stroke-opacity=".25" stroke-width="2" d="M1 1h62v62H1z"/></svg>`;
}
