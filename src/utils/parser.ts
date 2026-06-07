import type { CandidateKind, OcrCandidate } from "../types";

export interface ParsedResult {
  text: string; // 정리된 전체 인식 텍스트 (줄바꿈 유지)
  candidates: OcrCandidate[]; // 빠른 복사용 자동 감지 항목 (번호/이메일/링크)
}

/**
 * OCR 원본 텍스트를 정리하고, 그 안에서 빠른 복사용 후보를 추출한다.
 * 더 이상 숫자 전용이 아니며, 일반 텍스트를 그대로 읽어낸다.
 */
export function parseResult(rawText: string, confidence: number): ParsedResult {
  const text = cleanText(rawText);
  const candidates = extractCandidates(text, confidence);
  return { text, candidates };
}

/** 줄 단위로 공백 정리 후 빈 줄/노이즈 줄 제거, 줄바꿈은 유지 */
function cleanText(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter((line) => line.length > 0 && !isNoiseLine(line))
    .join("\n")
    .trim();
}

/**
 * OCR이 배경(폰 베젤/손/장식)에서 만들어낸 기호 덩어리 줄을 걸러낸다.
 * 글자(한글/영문/숫자) 비율이 너무 낮으면 의미 없는 줄로 본다.
 */
function isNoiseLine(line: string): boolean {
  const compact = line.replace(/\s+/g, "");
  if (compact.length === 0) return true;
  const meaningful = (compact.match(/[0-9A-Za-z가-힣]/g) ?? []).length;
  if (meaningful === 0) return true;
  // 글자가 한 글자뿐이면서 기호가 더 많은 줄(예: "^ - |", "-» * & i")은 버린다.
  if (meaningful < 2 && meaningful / compact.length < 0.5) return true;
  // 전체적으로 글자 비율이 40% 미만이면 노이즈로 간주
  return meaningful / compact.length < 0.4;
}

/** 텍스트 안에서 이메일/URL/숫자열 같은 구조화된 항목을 감지 */
function extractCandidates(text: string, confidence: number): OcrCandidate[] {
  if (!text) return [];

  const candidates: OcrCandidate[] = [];
  const seen = new Set<string>();

  const push = (raw: string, normalized: string, kind: CandidateKind) => {
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ raw, normalized, kind, confidence });
  };

  // 1) 이메일
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    push(m[0], m[0].trim(), "email");
  }

  // 2) URL
  for (const m of text.matchAll(/https?:\/\/[^\s]+/gi)) {
    push(m[0], m[0].trim(), "url");
  }

  // 3) 숫자열 (계좌/송장/카드/사업자/전화 등)
  for (const line of text.split(/\n/)) {
    const chunks = line.match(/[0-9][0-9\s-]*[0-9]/g);
    if (!chunks) continue;
    for (const chunk of chunks) {
      const normalized = chunk.replace(/\s+/g, ""); // 공백 제거, 하이픈 유지
      const digitsOnly = normalized.replace(/-/g, "");
      if (digitsOnly.length < 6 || digitsOnly.length > 24) continue;
      push(chunk.trim(), normalized, classifyNumber(digitsOnly));
    }
  }

  // 숫자 후보는 자릿수 많은 순으로, 이메일/URL은 앞쪽 유지
  return candidates;
}

function classifyNumber(digitsOnly: string): CandidateKind {
  const len = digitsOnly.length;
  if (len === 10) return "business";
  if (len === 16) return "card";
  if ((len === 10 || len === 11) && digitsOnly.startsWith("0")) return "phone";
  if (len >= 10 && len <= 14) return "account";
  if (len >= 12) return "invoice";
  return "number";
}

export const KIND_LABEL: Record<CandidateKind, string> = {
  account: "계좌번호",
  invoice: "송장번호",
  card: "카드번호",
  business: "사업자번호",
  phone: "전화번호",
  number: "숫자",
  email: "이메일",
  url: "링크",
};
