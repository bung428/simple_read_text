import type { PerfProfile } from "./types";

// 카메라 제약: 720p, 후면 카메라 (4K 금지 - 발열/배터리)
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

// 밝기 권장 범위 (설계 문서 기준)
export const BRIGHTNESS_MIN = 70;
export const BRIGHTNESS_MAX = 200;

// 품질 점수 가중치
export const QUALITY_WEIGHTS = {
  brightness: 0.3,
  motion: 0.4,
  blur: 0.3,
} as const;

// ROI: 화면 중앙 가로 비율 (가로폭의 84%)
export const ROI_WIDTH_RATIO = 0.84;
// ROI 높이는 가로폭 대비 비율 (계좌/송장번호용 가로로 긴 박스)
export const ROI_ASPECT = 0.28;

// 기본 성능 프로파일 (일반 기기)
export const DEFAULT_PROFILE: PerfProfile = {
  sampleIntervalMs: 300,
  ocrCooldownMs: 1500,
  qualityThreshold: 78,
  roiMaxWidth: 720,
};

// 저사양 기기 fallback 프로파일
export const LOW_END_PROFILE: PerfProfile = {
  sampleIntervalMs: 500,
  ocrCooldownMs: 2500,
  qualityThreshold: 72,
  roiMaxWidth: 640,
};

// 숫자 위주 whitelist (계좌/송장)
export const OCR_CHAR_WHITELIST = "0123456789-";
export const OCR_LANG = "eng";

// 저사양 기기 추정: 논리 코어 수 / 메모리 기반
export function detectLowEnd(): boolean {
  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory는 일부 브라우저만 지원
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem <= 3) return true;
  return cores <= 4;
}
