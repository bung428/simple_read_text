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
// roiMaxWidth: 한글 인식엔 고해상도가 유리하나, 너무 크면 best 모델이 느려져
// "인식 중"이 길어진다 → 정확도/속도 균형점으로 1200px.
export const DEFAULT_PROFILE: PerfProfile = {
  sampleIntervalMs: 300,
  ocrCooldownMs: 600,
  qualityThreshold: 62,
  roiMaxWidth: 1200,
};

// 저사양 기기 fallback 프로파일
export const LOW_END_PROFILE: PerfProfile = {
  sampleIntervalMs: 500,
  ocrCooldownMs: 1200,
  qualityThreshold: 58,
  roiMaxWidth: 900,
};

// 일반 텍스트 인식: 한글 + 영어 (+ 숫자/기호).
export const OCR_LANG = "kor+eng";

// --- PaddleOCR (PP-OCRv5) 모델 / 런타임 설정 ---
// Tesseract 대비 한글·영어 인식률이 높고, 검출(DB)+인식(SVTR) 2단계라
// 카메라 사진(기울어짐/저대비)에 강하다. onnxruntime-web으로 온디바이스 실행.
const PADDLE_MODEL_BASE =
  "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/refs/heads/main";
const PADDLE_DICT_BASE =
  "https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/refs/heads/main";

export const PADDLE_DET_URL = `${PADDLE_MODEL_BASE}/detection/PP-OCRv5_mobile_det_infer.onnx`;
export const PADDLE_REC_URL = `${PADDLE_MODEL_BASE}/recognition/multi/korean/v5/korean_PP-OCRv5_mobile_rec_infer.onnx`;
export const PADDLE_DICT_URL = `${PADDLE_DICT_BASE}/recognition/multi/korean/v5/ppocrv5_korean_dict.txt`;

// onnxruntime-web의 wasm 바이너리 경로 (자체 호스팅 대신 CDN 사용 → 번들 단순화)
export const ORT_WASM_PATH =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";

// 촬영 후 결과를 채택할 최소 의미 문자 수 (이보다 적으면 인식 실패로 간주)
export const CAPTURE_MIN_CHARS = 2;

// 저사양 기기 추정: 논리 코어 수 / 메모리 기반
export function detectLowEnd(): boolean {
  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory는 일부 브라우저만 지원
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem <= 3) return true;
  return cores <= 4;
}
