import { create } from "zustand";
import type {
  FeedbackKind,
  OcrCandidate,
  PerfProfile,
  QualityResult,
} from "./types";
import { DEFAULT_PROFILE, LOW_END_PROFILE, detectLowEnd } from "./config";

export type AppPhase =
  | "init" // 시작 전
  | "requesting" // 카메라 권한 요청 중
  | "denied" // 권한 거부
  | "error" // 카메라/기타 오류
  | "scanning" // 카메라 동작 중
  | "result"; // 인식 완료 → 결과화면

interface AppState {
  phase: AppPhase;
  errorMessage: string | null;

  ocrReady: boolean;
  ocrLoadingProgress: number; // 0~1
  isProcessing: boolean; // OCR 진행 중

  quality: QualityResult | null;
  feedback: FeedbackKind;

  recognizedText: string; // 읽어낸 전체 텍스트
  candidates: OcrCandidate[]; // 빠른 복사용 자동 감지 항목
  lastCopied: string | null;
  capturedImageUrl: string | null; // 촬영한 이미지 미리보기 (ObjectURL)
  ocrError: string | null; // OCR 실패 시 진단 메시지

  profile: PerfProfile;
  paused: boolean;

  // actions
  setPhase: (p: AppPhase) => void;
  setError: (msg: string) => void;
  setOcrReady: (ready: boolean) => void;
  setOcrProgress: (p: number) => void;
  setProcessing: (v: boolean) => void;
  setQuality: (q: QualityResult, feedback: FeedbackKind) => void;
  setFeedback: (f: FeedbackKind) => void;
  setResult: (text: string, candidates: OcrCandidate[]) => void;
  setCopied: (s: string) => void;
  setCapturedImage: (url: string | null) => void;
  setOcrError: (msg: string | null) => void;
  togglePause: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  phase: "init",
  errorMessage: null,

  ocrReady: false,
  ocrLoadingProgress: 0,
  isProcessing: false,

  quality: null,
  feedback: "idle",

  recognizedText: "",
  candidates: [],
  lastCopied: null,
  capturedImageUrl: null,
  ocrError: null,

  profile: detectLowEnd() ? LOW_END_PROFILE : DEFAULT_PROFILE,
  paused: false,

  setPhase: (phase) => set({ phase }),
  setError: (errorMessage) => set({ phase: "error", errorMessage }),
  setOcrReady: (ocrReady) => set({ ocrReady }),
  setOcrProgress: (ocrLoadingProgress) => set({ ocrLoadingProgress }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setQuality: (quality, feedback) => set({ quality, feedback }),
  setFeedback: (feedback) => set({ feedback }),
  setResult: (recognizedText, candidates) =>
    set({ recognizedText, candidates }),
  setCopied: (lastCopied) => set({ lastCopied }),
  setCapturedImage: (url) =>
    set((s) => {
      // 이전 이미지 URL은 메모리 해제
      if (s.capturedImageUrl && s.capturedImageUrl !== url) {
        URL.revokeObjectURL(s.capturedImageUrl);
      }
      return { capturedImageUrl: url };
    }),
  setOcrError: (ocrError) => set({ ocrError }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  reset: () =>
    set((s) => {
      // 화면을 떠날 때 촬영 이미지 해제 (메모리 회수)
      if (s.capturedImageUrl) URL.revokeObjectURL(s.capturedImageUrl);
      return {
        recognizedText: "",
        candidates: [],
        lastCopied: null,
        feedback: "idle",
        quality: null,
        capturedImageUrl: null,
        ocrError: null,
      };
    }),
}));
