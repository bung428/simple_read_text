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
  | "scanning"; // 카메라 동작 중

interface AppState {
  phase: AppPhase;
  errorMessage: string | null;

  ocrReady: boolean;
  ocrLoadingProgress: number; // 0~1
  isProcessing: boolean; // OCR 진행 중

  quality: QualityResult | null;
  feedback: FeedbackKind;

  candidates: OcrCandidate[];
  selected: OcrCandidate | null;
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
  setCandidates: (c: OcrCandidate[]) => void;
  selectCandidate: (c: OcrCandidate | null) => void;
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

  candidates: [],
  selected: null,
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
  setCandidates: (candidates) =>
    set((s) => ({
      candidates,
      // 새 후보가 들어오면 기존 선택이 목록에 없을 때만 첫 항목 자동 선택
      selected:
        candidates.length > 0 &&
        (!s.selected ||
          !candidates.some((c) => c.normalized === s.selected?.normalized))
          ? candidates[0]
          : s.selected,
    })),
  selectCandidate: (selected) => set({ selected }),
  setCopied: (lastCopied) => set({ lastCopied }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  reset: () =>
    set({
      candidates: [],
      selected: null,
      lastCopied: null,
      feedback: "idle",
      quality: null,
    }),
}));
