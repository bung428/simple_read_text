/// <reference lib="webworker" />
import { createWorker, type Worker as TWorker } from "tesseract.js";
import type { OcrWorkerRequest, OcrWorkerResponse } from "../types";
import { TESS_LANG_PATH } from "../config";

let tWorker: TWorker | null = null;
let initializing: Promise<void> | null = null;
let currentLang = "kor+eng";

interface OcrAttempt {
  text: string;
  confidence: number;
}

function post(msg: OcrWorkerResponse) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

function logDebug(message: string) {
  post({ type: "log", message });
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
        // PSM 11 = "sparse text": 레이아웃을 가정하지 않고 화면 어디에 있든
        // 글자를 최대한 찾는다. 카메라로 임의의 장면/기울어진 카드/화면을 찍는
        // 이 앱에는 단일 블록 가정인 PSM 3/6보다 훨씬 안정적이다.
        tessedit_pageseg_mode: "11" as unknown as never,
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
function preprocess(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number,
  h: number
) {
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

/** 의미있는 글자(한글/영문/숫자) 개수 */
function meaningfulCharCount(text: string): number {
  return (text.match(/[0-9A-Za-z가-힣]/g) ?? []).length;
}

/**
 * 결과 품질 점수.
 * 글자수×신뢰도만 쓰면 한 글자씩 쪼개진 "분절 쓰레기"가 높게 나온다.
 * 그래서 "2글자 이상 토큰에 들어간 의미글자 수"만 세서, 단어로 묶인 정도를
 * 보상한다. (예: "고딕체 명조체" > "고 제 너 스체")
 */
function scoreAttempt(attempt: OcrAttempt): number {
  let grouped = 0;
  for (const token of attempt.text.split(/\s+/)) {
    const m = (token.match(/[0-9A-Za-z가-힣]/g) ?? []).length;
    if (m >= 2) grouped += m;
  }
  // 묶인 글자가 하나도 없으면(전부 단발) 최소한의 정보량만 인정
  if (grouped === 0) grouped = meaningfulCharCount(attempt.text) > 0 ? 1 : 0;
  return grouped * Math.max(1, attempt.confidence);
}

/** 비트맵을 지정한 폭으로 리스케일한 캔버스를 만든다(고품질 보간). */
function rescale(
  bitmap: ImageBitmap,
  targetW: number
): OffscreenCanvas {
  const scale = targetW / bitmap.width;
  const targetH = Math.max(1, Math.round(bitmap.height * scale));
  const c = new OffscreenCanvas(targetW, targetH);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d context 없음");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  return c;
}

// 시도할 OCR 입력 폭(px).
// 글자 크기를 미리 알 수 없어, 큰 글자에 맞는 작은 폭과 작은 글자에 맞는 큰 폭을
// 모두 시도한 뒤 가장 분절이 적은 결과를 채택한다. (cap-height ~30~50px가 최적)
const OCR_WIDTHS = [560, 960];

/**
 * 여러 배율로 인식해 가장 깨끗한(분절이 적은) 결과를 채택한다.
 */
async function recognizeBest(worker: TWorker, bitmap: ImageBitmap) {
  logDebug(`source bitmap = ${bitmap.width}x${bitmap.height}px`);

  const attempts: OcrAttempt[] = [];
  for (const width of OCR_WIDTHS) {
    const canvas = rescale(bitmap, width);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const { data } = await worker.recognize(blob);
    const attempt: OcrAttempt = {
      text: data.text ?? "",
      confidence: data.confidence ?? 0,
    };
    attempts.push(attempt);
    logDebug(
      `w=${width} conf=${attempt.confidence.toFixed(
        0
      )} score=${scoreAttempt(attempt).toFixed(0)} text=${JSON.stringify(
        attempt.text
      )}`
    );
  }

  const best = attempts.reduce(
    (b, c) => (scoreAttempt(c) > scoreAttempt(b) ? c : b),
    { text: "", confidence: 0 } as OcrAttempt
  );

  // 모든 배율이 글자를 못 찾았을 때만 대비 보정 후 마지막으로 한 번 더 시도.
  if (meaningfulCharCount(best.text) === 0) {
    logDebug("모든 배율 실패 → 대비 보정 후 재시도");
    const canvas = rescale(bitmap, OCR_WIDTHS[OCR_WIDTHS.length - 1]);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      preprocess(ctx, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const { data } = await worker.recognize(blob);
      const fallback: OcrAttempt = {
        text: data.text ?? "",
        confidence: data.confidence ?? 0,
      };
      logDebug(
        `preprocessed conf=${fallback.confidence.toFixed(
          0
        )} text=${JSON.stringify(fallback.text)}`
      );
      if (meaningfulCharCount(fallback.text) > 0) return fallback;
    }
  }

  return best;
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

      const result = await recognizeBest(w, bitmap);
      bitmap.close();
      post({
        type: "result",
        id,
        text: result.text,
        confidence: result.confidence,
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
