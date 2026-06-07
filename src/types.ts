// 프레임 품질 분석 결과 (밝기 + 선명도만 사용)
export interface QualityResult {
  brightness: number; // 0~255 평균 밝기
  brightnessScore: number; // 0~100
  blurScore: number; // 0~100 (높을수록 선명)
  qualityScore: number; // 종합 점수 0~100
  ok: boolean; // OCR 실행 권장 여부
}

// 사용자에게 보여줄 안내 메시지 종류
export type FeedbackKind =
  | "idle"
  | "too-dark"
  | "too-bright"
  | "blur"
  | "ready"
  | "scanning"
  | "found"
  | "fail";

// OCR 후보 결과 (빠른 복사용으로 자동 감지된 항목)
export interface OcrCandidate {
  raw: string; // 원본 문자열
  normalized: string; // 복사용 정규화 문자열
  kind: CandidateKind;
  confidence: number; // tesseract 신뢰도 평균
}

export type CandidateKind =
  | "account" // 계좌번호
  | "invoice" // 송장/운송장번호
  | "card" // 카드번호
  | "business" // 사업자번호
  | "phone" // 전화번호
  | "number" // 일반 숫자열
  | "email" // 이메일
  | "url"; // 링크

// Worker -> Main 메시지
export type OcrWorkerResponse =
  | { type: "ready" }
  | { type: "progress"; status: string; progress: number }
  | {
      type: "result";
      id: number;
      text: string;
      confidence: number;
    }
  | { type: "error"; id: number; message: string }
  | { type: "log"; message: string };

// Main -> Worker 메시지
export type OcrWorkerRequest =
  | { type: "init"; lang: string }
  | {
      type: "recognize";
      id: number;
      bitmap: ImageBitmap;
    };

// 성능 프로파일 (저사양 기기 fallback)
export interface PerfProfile {
  sampleIntervalMs: number; // 품질 체크 주기
  ocrCooldownMs: number; // OCR 최소 간격
  qualityThreshold: number; // OCR 실행 품질 기준
  roiMaxWidth: number; // ROI 리사이즈 최대 폭(px)
}
