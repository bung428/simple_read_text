# Simple Read Text — 모바일 OCR 스캐너 (PWA)

카메라 프리뷰로 **계좌번호·송장번호 등 숫자 텍스트를 읽어 바로 복사**하는 서버리스 모바일 웹앱(PWA)입니다.
앱스토어 없이 iPhone / Android 브라우저에서 동작하며, 모든 처리는 기기 안에서만 이루어집니다.

## 핵심 설계: "항상 OCR하지 않는다"

OCR은 비싼 작업이므로, 좋은 프레임에서만 실행합니다.

```text
카메라 프리뷰 유지
→ 200~500ms 간격 프레임 샘플링
→ 프레임 품질 분석 (밝기 / 움직임 / 선명도)
→ 좋은 상태 + 쿨다운 통과일 때만 OCR
→ ROI(중앙 박스)만 OCR
→ OCR 결과만 메모리에 유지
```

## 기술 스택

- **React + Vite + TypeScript**
- **TailwindCSS v4** (모바일 UI)
- **Tesseract.js** (브라우저 OCR, 숫자 whitelist)
- **WebWorker** (OCR은 메인스레드 밖에서 수행)
- **Zustand** (상태 관리)
- **vite-plugin-pwa** (manifest / service worker / 오프라인 캐싱)

## 주요 동작

| 영역 | 구현 |
| --- | --- |
| 카메라 | `getUserMedia` 후면 720p, 탭 전환 시 `track.stop()` 정리 |
| 프레임 품질 | 밝기(70~200) · 움직임(프레임 차) · 선명도(Laplacian variance) → 가중 종합 점수 |
| OCR 실행 조건 | `qualityScore ≥ 임계값 AND 쿨다운(1.5~2.5초) AND 처리중 아님` |
| ROI | 화면 중앙 박스만 잘라 OCR (object-cover 좌표 보정 포함) |
| OCR 최적화 | `eng` 단일 언어, `0123456789-` whitelist, 640~720px 리사이즈 |
| 메모리 | OCR 후 `ImageBitmap.close()`, 캔버스 정리, 워커 종료 |
| 저사양 fallback | 코어/메모리 감지 → 샘플 주기↑·해상도↓·임계값↓ |
| 클립보드 | 버튼 클릭 기반 복사 (iOS 제스처 제약 대응) + execCommand fallback |
| 개인정보 | 서버 전송/저장 없음, 결과는 메모리에만 |

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 타입체크 + 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

> 카메라 API는 **HTTPS** 또는 `localhost` 에서만 동작합니다.
> 실기기 테스트 시 `npm run dev -- --host` 후 HTTPS 터널(예: ngrok)을 사용하거나, 배포본(HTTPS)에서 확인하세요.

## 배포

- **Vercel** 또는 **Cloudflare Pages** 권장 (정적 호스팅, 자동 HTTPS)
- 빌드 명령 `npm run build`, 출력 디렉터리 `dist`

## 폴더 구조

```text
src/
  components/      UI 컴포넌트 (카메라뷰 / ROI / 결과 / 피드백 / 품질미터)
  hooks/           useCamera (스트림), useScanner (샘플링+OCR 스케줄링)
  utils/           quality (품질분석), parser (후보탐지), roi (좌표보정), clipboard
  workers/         ocr.worker.ts (Tesseract.js)
  store.ts         Zustand 전역 상태
  config.ts        카메라/품질/성능 프로파일 상수
  types.ts         공용 타입
```

## 한계 / 향후 확장

- iOS Safari는 PWA·백그라운드·클립보드 제약이 있어 버튼 기반 UX로 대응했습니다.
- 현재는 숫자 위주(`0123456789-`)이며, 카드번호·사업자번호 분류를 제공합니다.
- 확장 여지: QR/바코드, 문서 OCR, 한글 인식, 실시간 하이라이트.
