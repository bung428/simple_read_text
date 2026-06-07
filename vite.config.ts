import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages 프로젝트 페이지 경로: https://bung428.github.io/simple_read_text/
const REPO_BASE = "/simple_read_text/";

// dev 전용: 브라우저(devLog)에서 보낸 OCR 로그를 받아 터미널에 출력한다.
function ocrDevLogPlugin(): Plugin {
  return {
    name: "ocr-dev-log",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__ocr_log", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const { message } = JSON.parse(body || "{}");
            // 터미널에 또렷하게 보이도록 prefix
            console.log(`\n\u001b[36m[OCR]\u001b[0m ${message}`);
          } catch {
            console.log("[OCR] (로그 파싱 실패)");
          }
          res.statusCode = 204;
          res.end();
        });
      });

      // 브라우저가 보낸 실제 캡처 이미지를 파일로 저장한다(진단용).
      server.middlewares.use("/__ocr_image", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => {
          chunks.push(chunk as Buffer);
        });
        req.on("end", () => {
          try {
            const buf = Buffer.concat(chunks);
            const dir = resolve(process.cwd(), ".ocr-debug");
            mkdirSync(dir, { recursive: true });
            const file = resolve(dir, "last-capture.png");
            writeFileSync(file, buf);
            console.log(
              `\n\u001b[36m[OCR]\u001b[0m capture saved → ${file} (${buf.length} bytes)`
            );
          } catch (err) {
            console.log("[OCR] 이미지 저장 실패", err);
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // dev 서버는 루트(/)에서, 빌드(배포)는 저장소 하위 경로에서 서빙
  const base = command === "build" ? REPO_BASE : "/";

  return {
    base,
    plugins: [
      ocrDevLogPlugin(),
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
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // index.html 은 precache 하지 않고 항상 네트워크 우선으로 받음
          // (배포 후 옛 HTML→옛 JS 로 묶이는 문제 방지)
          globPatterns: ["**/*.{js,css,svg,png,ico}"],
          globIgnores: ["**/index.html", "**/*.wasm"],
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
              // Tesseract.js core/wasm CDN 리소스 캐싱
              urlPattern: ({ url }) =>
                url.hostname === "cdn.jsdelivr.net" &&
                url.pathname.includes("tesseract"),
              handler: "CacheFirst",
              options: {
                cacheName: "tesseract-runtime",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              // 한국어/영어 traineddata 캐싱 (첫 실행 이후 재사용)
              urlPattern: ({ url }) =>
                url.hostname === "tessdata.projectnaptha.com" &&
                url.pathname.endsWith(".traineddata.gz"),
              handler: "CacheFirst",
              options: {
                cacheName: "tesseract-traineddata",
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
                rangeRequests: true,
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
