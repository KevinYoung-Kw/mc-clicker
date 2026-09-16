import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',worker:{format:'es'},build:{outDir:'/tmp/mcc-save-image-dist',emptyOutDir:true}});
