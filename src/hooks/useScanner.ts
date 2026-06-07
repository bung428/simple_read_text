import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { QualityAnalyzer } from "../utils/quality";
import { parseResult } from "../utils/parser";
import { mapRoiToVideo } from "../utils/roi";
import { OCR_LANG } from "../config";
import { devLog, devLogImage } from "../utils/devLog";
import type { FeedbackKind, OcrWorkerResponse, QualityResult } from "../types";

// 품질 체크용 다운스케일 폭 (작게 -> 빠르고 저전력)
const QUALITY_SAMPLE_W = 160;

/**
 * 카메라 프레임을 주기적으로 분석해 "촬영해도 좋은 상태"(밝기/선명도)를 판단한다.
 * 실시간 OCR은 하지 않으며, 사용자가 촬영 버튼을 눌렀을 때만(capture) OCR을 수행한다.
 *
 * @returns capture - 현재 프레임의 ROI를 메모리로 캡처해 OCR을 실행하는 함수
 */
export function useScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  roiRef: React.RefObject<HTMLElement | null>
) {
  const analyzerRef = useRef(new QualityAnalyzer());
  const workerRef = useRef<Worker | null>(null);
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reqIdRef = useRef(0);
  // 실제 캡처 구현체를 담아 안정적인 콜백으로 노출
  const captureImplRef = useRef<() => void>(() => {});

  useEffect(() => {
    qualityCanvasRef.current = document.createElement("canvas");
    roiCanvasRef.current = document.createElement("canvas");

    // --- OCR Worker 초기화 ---
    const worker = new Worker(
      new URL("../workers/ocr.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<OcrWorkerResponse>) => {
      const msg = e.data;
      const s = useAppStore.getState();
      switch (msg.type) {
        case "ready":
          s.setOcrReady(true);
          s.setOcrProgress(1);
          break;
        case "progress":
          if (msg.status === "recognizing text") {
            s.setOcrProgress(Math.max(0.5, msg.progress));
          } else {
            s.setOcrProgress(msg.progress);
          }
          break;
        case "result": {
          // 이미 result 화면으로 이동한 상태. 인식 결과를 그 화면에 채운다.
          // (빈 결과여도 라이브로 되돌리지 않고 리뷰 화면에서 안내)
          const { text, candidates } = parseResult(msg.text, msg.confidence);
          devLog(
            `parsed text=${JSON.stringify(text)} candidates=${candidates
              .map((c) => c.normalized)
              .join("|")}`
          );
          s.setResult(text, candidates);
          s.setOcrError(null);
          s.setProcessing(false);
          break;
        }
        case "log":
          devLog(msg.message);
          break;
        case "error":
          // 인식 중 예외 → 리뷰 화면에 실제 메시지를 노출(진단용)
          s.setResult("", []);
          s.setOcrError(msg.message);
          s.setProcessing(false);
          devLog(`error: ${msg.message}`);
          break;
      }
    };

    worker.postMessage({ type: "init", lang: OCR_LANG });

    // --- 품질 분석 루프 (border 색상용. OCR은 절대 자동 실행하지 않음) ---
    let timer: number | undefined;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const s = useAppStore.getState();
      const interval = s.profile.sampleIntervalMs;
      try {
        sampleQuality();
      } catch (err) {
        console.warn("[scanner] sample error", err);
      }
      timer = window.setTimeout(tick, interval);
    };

    const sampleQuality = () => {
      const video = videoRef.current;
      const roiEl = roiRef.current;
      const s = useAppStore.getState();
      if (
        !video ||
        !roiEl ||
        s.phase !== "scanning" ||
        s.isProcessing ||
        video.readyState < 2 ||
        video.videoWidth === 0
      ) {
        return;
      }

      const rect = mapRoiToVideo(video, roiEl);
      if (!rect) return;
      const { x: roiX, y: roiY, w: roiW, h: roiH } = rect;

      const qCanvas = qualityCanvasRef.current!;
      const qW = QUALITY_SAMPLE_W;
      const qH = Math.max(1, Math.round(qW * (roiH / roiW)));
      qCanvas.width = qW;
      qCanvas.height = qH;
      const qCtx = qCanvas.getContext("2d", { willReadFrequently: true });
      if (!qCtx) return;
      qCtx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, qW, qH);
      const imgData = qCtx.getImageData(0, 0, qW, qH);

      const quality = analyzerRef.current.analyze(imgData.data, qW, qH);
      const feedback = decideFeedback(quality, s.profile.qualityThreshold);
      s.setQuality(quality, feedback);
    };

    // --- 촬영(수동 캡처) ---
    const doCapture = () => {
      const video = videoRef.current;
      const roiEl = roiRef.current;
      const s = useAppStore.getState();
      if (
        !video ||
        !roiEl ||
        !s.ocrReady ||
        s.isProcessing ||
        s.phase !== "scanning" ||
        video.readyState < 2 ||
        video.videoWidth === 0
      ) {
        return;
      }

      const rect = mapRoiToVideo(video, roiEl);
      if (!rect) return;
      const { x: roiX, y: roiY, w: roiW, h: roiH } = rect;

      // 원본 ROI 해상도 그대로 캡처한다(상한만 둠). 강제로 키우지 않는 이유:
      // 글자가 큰 경우 업스케일하면 Tesseract가 한 글자를 쪼갠다. 최적 배율은
      // 글자 크기에 따라 다르므로, 워커가 여러 배율로 시도해 가장 좋은 걸 고른다.
      const targetW = Math.min(s.profile.roiMaxWidth, Math.round(roiW));
      const scale = targetW / roiW;
      const targetH = Math.max(1, Math.round(roiH * scale));

      const rCanvas = roiCanvasRef.current!;
      rCanvas.width = targetW;
      rCanvas.height = targetH;
      const rCtx = rCanvas.getContext("2d");
      if (!rCtx) return;
      rCtx.imageSmoothingEnabled = true;
      rCtx.imageSmoothingQuality = "high";
      rCtx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, targetW, targetH);

      devLog(
        `capture: video=${video.videoWidth}x${video.videoHeight} ` +
          `roi=${Math.round(roiW)}x${Math.round(roiH)} → out=${targetW}x${targetH} ` +
          `quality=${Math.round(s.quality?.qualityScore ?? -1)} ` +
          `blur=${Math.round(s.quality?.blurScore ?? -1)} ` +
          `brightness=${Math.round(s.quality?.brightness ?? -1)}`
      );

      const id = ++reqIdRef.current;

      // 1) 촬영 미리보기(blob) 생성 → 즉시 결과화면으로 이동(사진이 사라지지 않게)
      rCanvas.toBlob(
        (blob) => {
          if (blob) devLogImage(blob);
          const st = useAppStore.getState();
          st.setCapturedImage(blob ? URL.createObjectURL(blob) : null);
          st.setResult("", []); // 이전 결과 비우고 인식 대기 상태로
          st.setOcrError(null);
          st.setProcessing(true);
          st.setPhase("result");

          // 2) OCR용 비트맵 생성 → worker로 transfer (worker가 close로 해제)
          createImageBitmap(rCanvas)
            .then((bitmap) => {
              worker.postMessage({ type: "recognize", id, bitmap }, [bitmap]);
            })
            .catch((err) => {
              console.warn("[scanner] bitmap error", err);
              const st2 = useAppStore.getState();
              st2.setResult("", []);
              st2.setProcessing(false);
            });
        },
        "image/jpeg",
        0.85
      );
    };
    captureImplRef.current = doCapture;

    tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      worker.terminate();
      workerRef.current = null;
      analyzerRef.current.reset();
      [qualityCanvasRef.current, roiCanvasRef.current].forEach((c) => {
        if (c) {
          c.width = 0;
          c.height = 0;
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = useCallback(() => {
    captureImplRef.current();
  }, []);

  return { capture };
}

function decideFeedback(
  q: QualityResult,
  threshold: number
): FeedbackKind {
  if (q.brightnessScore < 50) {
    return q.brightness < 70 ? "too-dark" : "too-bright";
  }
  if (q.blurScore < 45) return "blur";
  if (q.qualityScore >= threshold) return "ready";
  // 종합 점수가 낮으면 대부분 선명도 문제
  return "blur";
}
