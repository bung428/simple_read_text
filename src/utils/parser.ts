import type { CandidateKind, OcrCandidate } from "../types";

/**
 * OCR 원본 텍스트에서 숫자 위주 후보들을 추출/분류한다.
 * 숫자 whitelist OCR을 사용하므로 입력은 대부분 [0-9-] 와 공백/개행.
 */
export function parseCandidates(
  text: string,
  confidence: number
): OcrCandidate[] {
  if (!text) return [];

  // 줄 단위 + 공백 기준으로 토큰화하되, 하이픈/공백으로 끊긴 번호도 병합 시도
  const lines = text.split(/[\r\n]+/);
  const candidates: OcrCandidate[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // 한 줄에서 숫자/하이픈/공백 덩어리 추출
    const chunks = line.match(/[0-9][0-9\s-]*[0-9]/g);
    if (!chunks) continue;

    for (const chunk of chunks) {
      const normalized = chunk.replace(/\s+/g, ""); // 공백 제거, 하이픈 유지
      const digitsOnly = normalized.replace(/-/g, "");

      // 너무 짧은 숫자는 노이즈로 간주
      if (digitsOnly.length < 6) continue;
      if (digitsOnly.length > 24) continue;

      if (seen.has(normalized)) continue;
      seen.add(normalized);

      candidates.push({
        raw: chunk.trim(),
        normalized,
        kind: classify(digitsOnly),
        confidence,
      });
    }
  }

  // 자릿수 많은(=정보량 큰) 후보 우선 정렬
  candidates.sort(
    (a, b) =>
      b.normalized.replace(/-/g, "").length -
      a.normalized.replace(/-/g, "").length
  );

  return candidates;
}

function classify(digitsOnly: string): CandidateKind {
  const len = digitsOnly.length;

  // 사업자등록번호: 10자리 (3-2-5)
  if (len === 10) return "business";

  // 카드번호: 16자리
  if (len === 16) return "card";

  // 전화번호: 10~11자리이고 0으로 시작
  if ((len === 10 || len === 11) && digitsOnly.startsWith("0")) return "phone";

  // 계좌번호: 보통 10~14자리, 하이픈 포함되는 경우가 많음
  if (len >= 10 && len <= 14) return "account";

  // 송장/운송장: 보통 12~13자리(택배사별 상이) 또는 그 이상
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
};
