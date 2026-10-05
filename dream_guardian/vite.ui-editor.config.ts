import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: ".",
  server: {
    host: "0.0.0.0",
    port: 3010,
    open: false,
  },
  build: {
    outDir: "dist-ui-editor",
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        editor: resolve(__dirname, "ui-editor.html"),
        preview: resolve(__dirname, "ui-preview.html"),
      },
    },
  },
});
