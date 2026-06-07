/**
 * 개발(dev) 모드 전용 로거.
 * 브라우저 콘솔에 찍는 동시에, vite dev 서버로 POST해서
 * `npm run dev`를 띄운 터미널에도 같은 로그가 보이게 한다.
 * (모바일 브라우저에서 테스트해도 PC 터미널로 로그를 모을 수 있다.)
 *
 * 프로덕션 빌드에서는 아무 일도 하지 않는다.
 */
export function devLog(message: string): void {
  if (!import.meta.env.DEV) return;

  // 브라우저 콘솔
  console.log("[OCR]", message);

  // dev 서버 터미널 (vite 미들웨어가 받아 출력)
  try {
    void fetch("/__ocr_log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      keepalive: true,
    });
  } catch {
    /* 네트워크 실패는 무시 (로그는 콘솔에 이미 찍힘) */
  }
}

/**
 * dev 모드에서 실제 캡처 이미지를 dev 서버로 보내 파일로 저장하게 한다.
 * (OCR이 받는 입력을 눈으로 확인하기 위한 진단용)
 */
export function devLogImage(blob: Blob): void {
  if (!import.meta.env.DEV) return;
  try {
    void fetch("/__ocr_image", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: blob,
      keepalive: true,
    });
  } catch {
    /* 무시 */
  }
}
