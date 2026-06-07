import { useAppStore } from "../store";

interface Props {
  onStart: () => void;
}

/**
 * 시작/권한거부/오류 상태를 다루는 대체 UI.
 * 카메라 시작은 반드시 사용자 제스처(버튼 클릭) 이후여야 iOS Safari에서 안정적.
 */
export function StartScreen({ onStart }: Props) {
  const phase = useAppStore((s) => s.phase);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const ocrProgress = useAppStore((s) => s.ocrLoadingProgress);
  const ocrReady = useAppStore((s) => s.ocrReady);

  const denied = phase === "denied";
  const error = phase === "error";
  const requesting = phase === "requesting";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/20 text-3xl">
          🔍
        </div>
        <h1 className="text-xl font-bold text-white">번호 스캐너</h1>
        <p className="max-w-xs text-sm leading-relaxed text-slate-400">
          카메라로 계좌번호·송장번호를 비추면
          <br />
          자동으로 인식해 복사할 수 있어요.
        </p>
      </div>

      {denied && (
        <div className="rounded-xl bg-amber-600/20 px-4 py-3 text-sm text-amber-200">
          카메라 권한이 거부되었습니다.
          <br />
          브라우저 설정에서 카메라 접근을 허용한 뒤 다시 시도해주세요.
        </div>
      )}

      {error && errorMessage && (
        <div className="rounded-xl bg-rose-600/20 px-4 py-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={requesting}
        className="w-full max-w-xs rounded-2xl bg-sky-500 py-4 text-base font-semibold text-white shadow-lg active:bg-sky-600 disabled:opacity-60"
      >
        {requesting
          ? "카메라 시작 중..."
          : denied || error
          ? "다시 시도"
          : "카메라 시작"}
      </button>

      <div className="h-5 text-xs text-slate-500">
        {!ocrReady &&
          ocrProgress > 0 &&
          `OCR 엔진 준비 중... ${Math.round(ocrProgress * 100)}%`}
        {ocrReady && "OCR 엔진 준비 완료"}
      </div>

      <p className="max-w-xs text-[11px] leading-relaxed text-slate-600">
        모든 처리는 기기 안에서만 이루어지며, 이미지나 인식 결과는
        서버로 전송·저장되지 않습니다.
      </p>
    </div>
  );
}
