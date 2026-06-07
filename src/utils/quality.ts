import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  QUALITY_WEIGHTS,
} from "../config";
import type { QualityResult } from "../types";

/**
 * 프레임 품질 분석기.
 * 작은 그레이스케일 샘플(다운스케일)에서 밝기/선명도를 계산한다.
 * OCR 자체는 절대 수행하지 않으며, "OCR을 해도 되는 상태인지"만 판단한다.
 */
export class QualityAnalyzer {
  reset() {
    // 상태 없음 (밝기/선명도는 단일 프레임으로 계산)
  }

  /**
   * @param data ROI 영역의 RGBA 픽셀 (다운스케일된 ImageData.data)
   * @param w 다운스케일 폭
   * @param h 다운스케일 높이
   */
  analyze(data: Uint8ClampedArray, w: number, h: number): QualityResult {
    const len = w * h;
    const gray = new Float32Array(len);

    let sum = 0;
    for (let i = 0, p = 0; i < len; i++, p += 4) {
      // 표준 휘도 가중치
      const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      gray[i] = g;
      sum += g;
    }
    const brightness = sum / len;

    // 1) 밝기 점수: 권장 범위 안이면 100, 벗어날수록 감점
    const brightnessScore = scoreBrightness(brightness);

    // 2) 선명도 점수: Laplacian variance (가장자리 강도)
    const blurScore = scoreSharpness(gray, w, h);

    const qualityScore =
      brightnessScore * QUALITY_WEIGHTS.brightness +
      blurScore * QUALITY_WEIGHTS.blur;

    return {
      brightness,
      brightnessScore,
      blurScore,
      qualityScore,
      ok: qualityScore >= 0, // 실제 임계값 판단은 호출부에서
    };
  }
}

function scoreBrightness(b: number): number {
  if (b >= BRIGHTNESS_MIN && b <= BRIGHTNESS_MAX) return 100;
  if (b < BRIGHTNESS_MIN) {
    // 0 => 0점, BRIGHTNESS_MIN => 100점
    return clamp((b / BRIGHTNESS_MIN) * 100, 0, 100);
  }
  // BRIGHTNESS_MAX 초과: 255 => 0점
  const over = (b - BRIGHTNESS_MAX) / (255 - BRIGHTNESS_MAX);
  return clamp(100 - over * 100, 0, 100);
}

/**
 * Laplacian variance 기반 선명도.
 * 흐릿한 이미지는 가장자리 강도의 분산이 작다.
 */
function scoreSharpness(gray: Float32Array, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      // 4-이웃 Laplacian 커널
      const lap =
        gray[i - 1] +
        gray[i + 1] +
        gray[i - w] +
        gray[i + w] -
        4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // 경험적 정규화: variance 300 이상이면 매우 선명(100점)
  return clamp((variance / 300) * 100, 0, 100);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
