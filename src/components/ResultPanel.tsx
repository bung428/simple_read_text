import { useState } from "react";
import { useAppStore } from "../store";
import { copyText } from "../utils/clipboard";
import { KIND_LABEL } from "../utils/parser";

export function ResultPanel() {
  const recognizedText = useAppStore((s) => s.recognizedText);
  const candidates = useAppStore((s) => s.candidates);
  const setCopied = useAppStore((s) => s.setCopied);

  const [toast, setToast] = useState<string | null>(null);

  const handleCopy = async (value: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(value);
      setToast("복사되었습니다");
    } else {
      setToast("복사 실패 · 길게 눌러 복사해주세요");
    }
    window.setTimeout(() => setToast(null), 1600);
  };

  const hasResult = recognizedText.length > 0 || candidates.length > 0;

  if (!hasResult) {
    return (
      <div className="rounded-2xl bg-slate-800/70 p-4 text-center text-sm text-slate-400 backdrop-blur">
        박스 안에 글자를 비추면 자동으로 인식됩니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 읽은 전체 텍스트 */}
      {recognizedText && (
        <div className="rounded-2xl bg-slate-800 p-4 shadow-lg ring-1 ring-slate-700">
          <div className="mb-2 text-xs font-medium text-sky-400">읽은 텍스트</div>
          <div className="selectable max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-lg font-semibold leading-relaxed text-white">
            {recognizedText}
          </div>
          <button
            onClick={() => handleCopy(recognizedText)}
            className="mt-3 w-full rounded-xl bg-sky-500 py-3 text-base font-semibold text-white shadow active:bg-sky-600"
          >
            전체 복사
          </button>
        </div>
      )}

      {/* 자동 감지된 빠른 복사 항목 (번호/이메일/링크) */}
      {candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] text-slate-500">빠른 복사</span>
          {candidates.map((c) => (
            <button
              key={`${c.kind}:${c.normalized}`}
              onClick={() => handleCopy(c.normalized)}
              className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/70 px-4 py-2.5 text-left active:bg-slate-700"
            >
              <span className="selectable break-all font-mono text-base text-slate-200">
                {c.normalized}
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">
                {KIND_LABEL[c.kind]}
              </span>
            </button>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
