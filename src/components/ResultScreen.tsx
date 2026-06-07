import { ResultPanel } from "./ResultPanel";

interface Props {
  onBack: () => void; // 다시 스캔 (카메라로 복귀)
  onClose: () => void; // 카메라 끄기 (시작화면)
}

/**
 * 인식 완료 후 표시되는 풀스크린 결과화면.
 * 상단 앱바의 뒤로가기는 카메라(스캔)로 복귀한다.
 */
export function ResultScreen({ onBack, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-slate-900">
      {/* 앱바 */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-2 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          onClick={onBack}
          aria-label="다시 스캔"
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

      {/* 결과 본문 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <ResultPanel />
      </div>

      {/* 하단 다시 스캔 버튼 */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
        <button
          onClick={onBack}
          className="w-full rounded-2xl bg-sky-500 py-4 text-base font-semibold text-white shadow-lg active:bg-sky-600"
        >
          다시 스캔
        </button>
      </div>
    </div>
  );
}
