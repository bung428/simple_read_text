/// <reference lib="webworker" />
import { createWorker, type Worker as TWorker } from "tesseract.js";
import { OCR_CHAR_WHITELIST } from "../config";
import type { OcrWorkerRequest, OcrWorkerResponse } from "../types";

let tWorker: TWorker | null = null;
let initializing: Promise<void> | null = null;

function post(msg: OcrWorkerResponse) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

async function ensureWorker(lang: string): Promise<TWorker> {
  if (tWorker) return tWorker;
  if (!initializing) {
    initializing = (async () => {
      const w = await createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          post({ type: "progress", status: m.status, progress: m.progress });
        },
      });
      // 숫자/하이픈 위주 인식 + 단일 라인/블록 최적화
      await w.setParameters({
        tessedit_char_whitelist: OCR_CHAR_WHITELIST,
        // PSM 6: 균일한 텍스트 블록으로 간주
        tessedit_pageseg_mode: "6" as unknown as never,
      });
      tWorker = w;
    })();
  }
  await initializing;
  return tWorker!;
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
      const w = await ensureWorker("eng");

      // ImageBitmap -> OffscreenCanvas -> tesseract 입력
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("OffscreenCanvas 2d context 없음");
      ctx.drawImage(bitmap, 0, 0);
      // 사용 후 즉시 해제 (메모리 관리)
      bitmap.close();

      const blob = await canvas.convertToBlob({ type: "image/png" });

      const { data } = await w.recognize(blob);
      post({
        type: "result",
        id,
        text: data.text ?? "",
        confidence: data.confidence ?? 0,
      });
    } catch (err) {
      // 실패해도 bitmap 누수 방지
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
