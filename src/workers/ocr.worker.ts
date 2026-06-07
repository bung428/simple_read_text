/// <reference lib="webworker" />
import { createWorker, type Worker as TWorker } from "tesseract.js";
import type { OcrWorkerRequest, OcrWorkerResponse } from "../types";
import { TESS_LANG_PATH } from "../config";

let tWorker: TWorker | null = null;
let initializing: Promise<void> | null = null;
let currentLang = "kor+eng";

function post(msg: OcrWorkerResponse) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

async function ensureWorker(lang: string): Promise<TWorker> {
  if (tWorker) return tWorker;
  currentLang = lang;
  if (!initializing) {
    initializing = (async () => {
      // OEM 1 = LSTM 전용 엔진 (best traineddata와 함께 한글 정확도 최상)
      const w = await createWorker(lang, 1, {
        langPath: TESS_LANG_PATH,
        logger: (m: { status: string; progress: number }) => {
          post({ type: "progress", status: m.status, progress: m.progress });
        },
      });
      await w.setParameters({
        // PSM 3: 자동 페이지 분할 (여러 줄/문단 문서·화면 인식에 적합)
        tessedit_pageseg_mode: "3" as unknown as never,
        // 단어 사이 공백 보존 (한글 띄어쓰기 유지)
        preserve_interword_spaces: "1" as unknown as never,
      });
      tWorker = w;
    })();
  }
  await initializing;
  return tWorker!;
}

/**
 * OCR 전 이미지 전처리.
 * 그레이스케일 변환 후 2~98 퍼센타일 기준 대비 스트레칭으로
 * 조명/저대비로 흐려진 글자의 윤곽을 또렷하게 만든다.
 */
function preprocess(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const g = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) | 0;
    gray[i] = g;
    hist[g]++;
  }

  // 퍼센타일 클리핑 (밝기 outlier 무시)
  const loTarget = n * 0.02;
  const hiTarget = n * 0.98;
  let acc = 0;
  let lo = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= loTarget) {
      lo = v;
      break;
    }
  }
  acc = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= hiTarget) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let v = ((gray[i] - lo) / range) * 255;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[p] = d[p + 1] = d[p + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

self.onmessage = async (e: MessageEvent<OcrWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "init") {
    try {
      await ensureWorker(msg.lang);
      post({ type: "ready" });
    } catch (err) {
      post({
        type: "error",
        id: -1,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "recognize") {
    const { id, bitmap } = msg;
    try {
      const w = await ensureWorker(currentLang);

      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("OffscreenCanvas 2d context 없음");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      // 인식률 향상을 위한 전처리
      preprocess(ctx, canvas.width, canvas.height);

      const blob = await canvas.convertToBlob({ type: "image/png" });

      const { data } = await w.recognize(blob);
      post({
        type: "result",
        id,
        text: data.text ?? "",
        confidence: data.confidence ?? 0,
      });
    } catch (err) {
      try {
        bitmap.close();
      } catch {
        /* noop */
      }
      post({
        type: "error",
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
