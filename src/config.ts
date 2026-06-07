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

// 품질 점수 가중치 (선명도 + 밝기만 사용)
export const QUALITY_WEIGHTS = {
  brightness: 0.4,
  blur: 0.6,
} as const;

// ROI: 화면 중앙 가로 비율 (신분증 스캔 앱처럼 큰 영역)
export const ROI_WIDTH_RATIO = 0.9;
// ROI 높이 비율 (여러 줄 문서/화면을 담도록 세로로 넉넉한 카드형)
export const ROI_ASPECT = 0.64;

// 기본 성능 프로파일 (일반 기기)
// roiMaxWidth ↑: 한글은 획이 복잡해 고해상도(≈300DPI 상당)가 인식률에 결정적
export const DEFAULT_PROFILE: PerfProfile = {
  sampleIntervalMs: 350,
  ocrCooldownMs: 1200,
  qualityThreshold: 62,
  roiMaxWidth: 1500,
};

// 저사양 기기 fallback 프로파일
export const LOW_END_PROFILE: PerfProfile = {
  sampleIntervalMs: 550,
  ocrCooldownMs: 2000,
  qualityThreshold: 58,
  roiMaxWidth: 1100,
};

// 일반 텍스트 인식: 한글 + 영어 (+ 숫자/기호). whitelist 미사용.
export const OCR_LANG = "kor+eng";

// 한국어 정확도가 월등한 LSTM "best" traineddata 사용 (fast 대비 인식률 ↑)
export const TESS_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0_best";

// 한 프레임이라도 화면에 표시(피드백)할 최소 신뢰도
export const MIN_OCR_CONFIDENCE = 35;

// 자동으로 결과화면으로 "확정 이동"할 최소 신뢰도 / 최소 의미 문자 수
export const CAPTURE_MIN_CONFIDENCE = 55;
export const CAPTURE_MIN_CHARS = 3;

// 저사양 기기 추정: 논리 코어 수 / 메모리 기반
export function detectLowEnd(): boolean {
  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory는 일부 브라우저만 지원
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem <= 3) return true;
  return cores <= 4;
}
