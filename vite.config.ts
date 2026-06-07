import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages 프로젝트 페이지 경로: https://bung428.github.io/simple_read_text/
const REPO_BASE = "/simple_read_text/";

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // dev 서버는 루트(/)에서, 빌드(배포)는 저장소 하위 경로에서 서빙
  const base = command === "build" ? REPO_BASE : "/";

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "robots.txt"],
        // scope/start_url 은 base 기준으로 자동 설정됨
        manifest: {
          name: "Simple Read Text - OCR 스캐너",
          short_name: "ReadText",
          description:
            "카메라로 계좌번호·송장번호 등 텍스트를 읽어 바로 복사하는 OCR 앱",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "portrait",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // tesseract 관련 대용량 wasm/언어 파일까지 캐싱
          maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
          // index.html 은 precache 하지 않고 항상 네트워크 우선으로 받음
          // (배포 후 옛 HTML→옛 JS 로 묶이는 문제 방지)
          globPatterns: ["**/*.{js,css,svg,png,ico,wasm}"],
          globIgnores: ["**/index.html"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // 페이지(HTML) 이동 요청: 온라인이면 항상 최신, 오프라인이면 캐시
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 4 },
              },
            },
            {
              // tesseract 코어/언어 traineddata CDN 캐싱
              urlPattern: /^https:\/\/.*\.(wasm|traineddata\.gz|traineddata)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "tesseract-assets",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    worker: {
      format: "es",
    },
  };
});
