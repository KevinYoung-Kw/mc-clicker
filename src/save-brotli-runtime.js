// Loaded only by the temporary save worker, never by the game or its renderer.
let ready;
export const loadBrotli = () => ready ||= import('brotli-wasm').then(module => module.default);
