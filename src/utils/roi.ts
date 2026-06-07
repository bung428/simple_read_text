/**
 * `object-fit: cover` 로 표시된 video 요소에서, 화면상의 오버레이 박스(roi)에
 * 대응하는 "원본 비디오 픽셀 좌표 사각형"을 계산한다.
 * 화면에 보이는 영역과 실제 OCR 샘플 영역을 정확히 일치시키기 위함.
 */
export interface SourceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function mapRoiToVideo(
  video: HTMLVideoElement,
  roiEl: HTMLElement
): SourceRect | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const clientW = video.clientWidth;
  const clientH = video.clientHeight;
  if (!clientW || !clientH) return null;

  const vRect = video.getBoundingClientRect();
  const rRect = roiEl.getBoundingClientRect();

  // video 요소 내부 CSS 좌표로 변환
  const ex0 = rRect.left - vRect.left;
  const ey0 = rRect.top - vRect.top;

  // object-cover 스케일/오프셋
  const scale = Math.max(clientW / vw, clientH / vh);
  const displayedW = vw * scale;
  const displayedH = vh * scale;
  const offsetX = (clientW - displayedW) / 2;
  const offsetY = (clientH - displayedH) / 2;

  const toVideo = (ex: number, ey: number) => ({
    vx: (ex - offsetX) / scale,
    vy: (ey - offsetY) / scale,
  });

  const tl = toVideo(ex0, ey0);
  const br = toVideo(ex0 + rRect.width, ey0 + rRect.height);

  const x = clamp(Math.round(tl.vx), 0, vw - 1);
  const y = clamp(Math.round(tl.vy), 0, vh - 1);
  const w = clamp(Math.round(br.vx - tl.vx), 1, vw - x);
  const h = clamp(Math.round(br.vy - tl.vy), 1, vh - y);

  return { x, y, w, h };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
