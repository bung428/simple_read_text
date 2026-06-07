import { useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { QualityAnalyzer } from "../utils/quality";
import { parseResult } from "../utils/parser";
import { mapRoiToVideo } from "../utils/roi";
import { MIN_OCR_CONFIDENCE, OCR_LANG } from "../config";
import type { FeedbackKind, OcrWorkerResponse, QualityResult } from "../types";

// 품질 체크용 다운스케일 폭 (작게 -> 빠르고 저전력)
const QUALITY_SAMPLE_W = 160;

/**
 * 카메라 프레임을 주기적으로 샘플링하여 품질을 분석하고,
 * 좋은 프레임에서만 ROI를 잘라 OCR Worker로 보낸다.
 */
export function useScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  roiRef: React.RefObject<HTMLElement | null>
) {
  const analyzerRef = useRef(new QualityAnalyzer());
  const workerRef = useRef<Worker | null>(null);
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastOcrRef = useRef(0);
  const reqIdRef = useRef(0);

  useEffect(() => {
    // 오프스크린 작업용 캔버스 준비
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
          s.setProcessing(false);
          const { text, candidates } = parseResult(msg.text, msg.confidence);
          const hasMeaning = /[0-9A-Za-z가-힣]/.test(text);
          // 노이즈 프레임 필터: 최소 신뢰도 + 의미 있는 문자 포함
          if (text && hasMeaning && msg.confidence >= MIN_OCR_CONFIDENCE) {
            s.setResult(text, candidates);
            s.setFeedback("found");
          }
          break;
        }
        case "error":
          s.setProcessing(false);
          // OCR 단건 실패는 치명적이지 않으므로 로그만
          console.warn("[OCR] error:", msg.message);
          break;
      }
    };

    worker.postMessage({ type: "init", lang: OCR_LANG });

    // --- 샘플링 루프 (setTimeout 재귀로 주기 동적 조정) ---
    let timer: number | undefined;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const s = useAppStore.getState();
      const interval = s.profile.sampleIntervalMs;
      try {
        sampleFrame();
      } catch (err) {
        console.warn("[scanner] sample error", err);
      }
      timer = window.setTimeout(tick, interval);
    };

    const sampleFrame = () => {
      const video = videoRef.current;
      const roiEl = roiRef.current;
      const s = useAppStore.getState();
      if (
        !video ||
        !roiEl ||
        s.paused ||
        s.phase !== "scanning" ||
        video.readyState < 2 ||
        video.videoWidth === 0
      ) {
        return;
      }

      // 화면상의 ROI 박스 -> 원본 비디오 픽셀 좌표로 매핑
      const rect = mapRoiToVideo(video, roiEl);
      if (!rect) return;
      const { x: roiX, y: roiY, w: roiW, h: roiH } = rect;

      // 1) 품질 분석용 다운스케일 (작게)
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

      // found 상태는 유지(결과가 있으면), 그 외에는 품질 피드백 갱신
      const hasResult = s.recognizedText.length > 0 || s.candidates.length > 0;
      if (!(hasResult && feedback === "ready")) {
        s.setQuality(quality, feedback);
      } else {
        s.setQuality(quality, s.feedback === "found" ? "found" : feedback);
      }

      // 2) OCR 실행 조건 판단
      const cooldownPassed =
        Date.now() - lastOcrRef.current > s.profile.ocrCooldownMs;
      const shouldOcr =
        s.ocrReady &&
        !s.isProcessing &&
        cooldownPassed &&
        quality.qualityScore >= s.profile.qualityThreshold;

      if (!shouldOcr) return;

      // 3) ROI를 OCR 해상도로 잘라 ImageBitmap 생성
      lastOcrRef.current = Date.now();
      s.setProcessing(true);

      const targetW = Math.min(s.profile.roiMaxWidth, roiW);
      const scale = targetW / roiW;
      const targetH = Math.max(1, Math.round(roiH * scale));

      const rCanvas = roiCanvasRef.current!;
      rCanvas.width = targetW;
      rCanvas.height = targetH;
      const rCtx = rCanvas.getContext("2d");
      if (!rCtx) {
        s.setProcessing(false);
        return;
      }
      rCtx.drawImage(
        video,
        roiX,
        roiY,
        roiW,
        roiH,
        0,
        0,
        targetW,
        targetH
      );

      const id = ++reqIdRef.current;
      createImageBitmap(rCanvas)
        .then((bitmap) => {
          worker.postMessage({ type: "recognize", id, bitmap }, [bitmap]);
        })
        .catch((err) => {
          console.warn("[scanner] bitmap error", err);
          useAppStore.getState().setProcessing(false);
        });
    };

    // 루프는 항상 돌며 내부에서 phase/paused 를 확인한다
    tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      worker.terminate();
      workerRef.current = null;
      analyzerRef.current.reset();
      // 캔버스 메모리 해제
      [qualityCanvasRef.current, roiCanvasRef.current].forEach((c) => {
        if (c) {
          c.width = 0;
          c.height = 0;
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
