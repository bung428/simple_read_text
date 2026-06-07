import { useAppStore } from "../store";
import { ResultPanel } from "./ResultPanel";

interface Props {
  onBack: () => void; // 다시 촬영 (카메라로 복귀)
  onClose: () => void; // 카메라 끄기 (시작화면)
}

/**
 * 촬영 직후 표시되는 풀스크린 리뷰/결과화면.
 * - 항상 촬영한 이미지를 보여준다 (사진이 사라지지 않음)
 * - 인식 중: 스피너
 * - 인식 완료: 텍스트 결과 / 텍스트가 없으면 안내 + 다시 촬영 유도
 */
export function ResultScreen({ onBack, onClose }: Props) {
  const isProcessing = useAppStore((s) => s.isProcessing);
  const recognizedText = useAppStore((s) => s.recognizedText);
  const candidates = useAppStore((s) => s.candidates);
  const capturedImageUrl = useAppStore((s) => s.capturedImageUrl);

  const hasResult = recognizedText.length > 0 || candidates.length > 0;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-slate-900">
      {/* 앱바 */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-2 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          onClick={onBack}
          aria-label="다시 촬영"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-medium text-white/90">인식 결과</span>
        <button
          onClick={onClose}
          className="ml-auto rounded-full px-3 py-1.5 text-xs text-slate-300 active:bg-slate-700"
        >
          카메라 끄기
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        {/* 촬영 이미지 미리보기 */}
        {capturedImageUrl && (
          <div className="relative mb-4 overflow-hidden rounded-2xl ring-1 ring-slate-700">
            <img
              src={capturedImageUrl}
              alt="촬영한 이미지"
              className="w-full object-contain"
            />
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55">
                <span className="h-9 w-9 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                <span className="text-sm font-medium text-white">
                  인식 중...
                </span>
              </div>
            )}
          </div>
        )}

        {/* 결과 / 인식 중 / 텍스트 없음 */}
        {isProcessing ? (
          !capturedImageUrl && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-800/70 p-8 text-slate-300">
              <span className="h-9 w-9 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              <span className="text-sm">인식 중...</span>
            </div>
          )
        ) : hasResult ? (
          <ResultPanel />
        ) : (
          <div className="rounded-2xl bg-slate-800/70 p-6 text-center">
            <div className="mb-1 text-base font-semibold text-rose-300">
              텍스트를 찾지 못했어요
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              글자가 박스에 가득 차도록 더 가까이 가거나,
              <br />
              초점·밝기를 맞춘 뒤 다시 촬영해주세요.
            </p>
          </div>
        )}
      </div>

      {/* 하단 다시 촬영 버튼 */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="w-full rounded-2xl bg-sky-500 py-4 text-base font-semibold text-white shadow-lg active:bg-sky-600 disabled:opacity-50"
        >
          다시 촬영
        </button>
      </div>
    </div>
  );
}
