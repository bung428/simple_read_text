/// <reference lib="webworker" />
import * as ort from "onnxruntime-web";
import { PaddleOcrService } from "ppu-paddle-ocr/web";
import type { OcrWorkerRequest, OcrWorkerResponse } from "../types";
import {
  ORT_WASM_PATH,
  PADDLE_DET_URL,
  PADDLE_DICT_URL,
  PADDLE_REC_URL,
} from "../config";

// ppu-paddle-ocr/web의 WebPlatformProvider는 중간 캔버스를 만들 때
// document.createElement("canvas")를 호출한다. Web Worker에는 document가
// 없으므로 OffscreenCanvas를 돌려주는 최소 shim을 주입한다.
{
  const g = self as unknown as { document?: unknown };
  if (typeof g.document === "undefined") {
    g.document = {
      createElement: (tag: string) => {
        if (tag === "canvas") return new OffscreenCanvas(1, 1);
        throw new Error(`document shim: unsupported <${tag}>`);
      },
    };
  }
}

let service: PaddleOcrService | null = null;
let initializing: Promise<void> | null = null;

function post(msg: OcrWorkerResponse) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

async function ensureService(): Promise<PaddleOcrService> {
  if (service) return service;
  if (!initializing) {
    initializing = (async () => {
      // wasm 바이너리는 CDN에서 로드 (WebGPU 미지원 시 폴백 경로)
      ort.env.wasm.wasmPaths = ORT_WASM_PATH;

      post({ type: "progress", status: "loading model", progress: 0.3 });

      const s = new PaddleOcrService({
        model: {
          detection: PADDLE_DET_URL,
          recognition: PADDLE_REC_URL,
          charactersDictionary: PADDLE_DICT_URL,
        },
      });
      await s.initialize();
      service = s;
    })();
  }
  await initializing;
  return service!;
}

self.onmessage = async (e: MessageEvent<OcrWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "init") {
    try {
      await ensureService();
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
      const w = await ensureService();

      // ImageBitmap → OffscreenCanvas (PaddleOcrService에 캔버스를 직접 입력)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("OffscreenCanvas 2d context 없음");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const result = await w.recognize(
        canvas as unknown as HTMLCanvasElement
      );

      // 줄별 신뢰도 평균 → 0~100 환산 (없으면 0)
      const lines = "lines" in result ? result.lines.flat() : [];
      const avgConf =
        lines.length > 0
          ? (lines.reduce((acc, r) => acc + (r.confidence ?? 0), 0) /
              lines.length) *
            100
          : 0;

      post({
        type: "result",
        id,
        text: result.text ?? "",
        confidence: avgConf,
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
