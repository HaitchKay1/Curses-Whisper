import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import * as path from "path";
import * as http from "http";
import { VitePWA } from "vite-plugin-pwa";

function whisperPreviewProxy() {
  return {
    name: "whisper-preview-proxy",
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use("/api/whisper", (req: http.IncomingMessage, res: http.ServerResponse) => {
        const target = http.request(
          {
            hostname: "127.0.0.1",
            port: 8177,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: "127.0.0.1:8177" },
          },
          (proxied) => {
            res.writeHead(proxied.statusCode || 502, proxied.headers);
            proxied.pipe(res);
          }
        );
        target.on("error", () => {
          if (!res.headersSent) res.statusCode = 503;
          res.end("Whisper is still starting");
        });
        req.pipe(target);
      });
    },
  };
}
export default defineConfig({
  plugins: [
    whisperPreviewProxy(),
    // visualizer({
    //   gzipSize: true,
    //   template: 'treemap',
    //   filename: 'stats/rollup-stats.html',
    // }),
    react({
      // jsxImportSource: '@welldone-software/why-did-you-render'
    }),
    VitePWA({
      workbox: {
        skipWaiting: true
      },
      injectRegister: null,
      devOptions: {
        enabled: false
      },
    }),
  ],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Rust locks files in src-tauri/target while compiling. Watching them
    // makes Vite crash on Windows with EBUSY.
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_", "CURSES_"],
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
  },
  build: {
    // Tauri supports es2021
    target: ["es2021", "chrome100", "safari13"],
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
