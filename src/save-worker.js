import { parseSaveJSON } from './save-code.js';
import { encodePortableSave, decodePortableSave } from './save-brotli.js';
import { loadBrotli } from './save-brotli-runtime.js';
self.onmessage = async ({ data }) => {
  try {
    if (data.action === 'image-encode') {
      const { encodeImageData } = await import('./save-image-worker.js');
      const result = await encodeImageData(data.code, data.theme);
      self.postMessage({ result }, [result.pixels.buffer]); return;
    }
    if (data.action === 'image-decode') {
      const { decodeImageFile } = await import('./save-image-worker.js');
      const code = await decodeImageFile(data.file);
      const result = await decodePortableSave(code, loadBrotli);
      self.postMessage({ result: { ...result, code } }); return;
    }
    const result = data.action === 'encode' ? await encodePortableSave(data.raw, data.release, Date.now(), loadBrotli)
      : data.action === 'json' ? { save: parseSaveJSON(data.text) } : await decodePortableSave(data.text, loadBrotli);
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error.message || '无法处理这份存档。' }); }
};
