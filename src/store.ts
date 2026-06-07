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
  togglePause: () => set((s) => ({ paused: !s.paused })),
  reset: () =>
    set({
      recognizedText: "",
      candidates: [],
      lastCopied: null,
      feedback: "idle",
      quality: null,
    }),
}));
