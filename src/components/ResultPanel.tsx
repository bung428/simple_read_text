import { useState } from "react";
import { useAppStore } from "../store";
import { copyText } from "../utils/clipboard";
import { KIND_LABEL } from "../utils/parser";
import type { OcrCandidate } from "../types";

export function ResultPanel() {
  const candidates = useAppStore((s) => s.candidates);
  const selected = useAppStore((s) => s.selected);
  const selectCandidate = useAppStore((s) => s.selectCandidate);
  const setCopied = useAppStore((s) => s.setCopied);
  const reset = useAppStore((s) => s.reset);

  const [toast, setToast] = useState<string | null>(null);

  const handleCopy = async (c: OcrCandidate) => {
    const ok = await copyText(c.normalized);
    if (ok) {
      setCopied(c.normalized);
      setToast("복사되었습니다");
    } else {
      setToast("복사 실패 · 길게 눌러 복사해주세요");
    }
    window.setTimeout(() => setToast(null), 1600);
  };

  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-800/70 p-4 text-center text-sm text-slate-400 backdrop-blur">
        박스 안에 번호를 비추면 자동으로 인식됩니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-slate-400">
          인식 결과 ({candidates.length})
        </span>
        <button
          onClick={reset}
          className="rounded-full px-3 py-1 text-xs text-slate-300 active:bg-slate-700"
        >
          지우기
        </button>
      </div>

      {/* 대표(선택) 후보 강조 */}
      {selected && (
        <div className="rounded-2xl bg-slate-800 p-4 shadow-lg ring-1 ring-slate-700">
          <div className="mb-1 text-xs font-medium text-sky-400">
            {KIND_LABEL[selected.kind]}
          </div>
          <div className="selectable break-all font-mono text-2xl font-bold tracking-wide text-white">
            {selected.normalized}
          </div>
          <button
            onClick={() => handleCopy(selected)}
            className="mt-3 w-full rounded-xl bg-sky-500 py-3 text-base font-semibold text-white shadow active:bg-sky-600"
          >
            복사하기
          </button>
        </div>
      )}

      {/* 다른 후보들 */}
      {candidates.length > 1 && (
        <div className="flex flex-col gap-2">
          {candidates
            .filter((c) => c.normalized !== selected?.normalized)
            .map((c) => (
              <button
                key={c.normalized}
                onClick={() => selectCandidate(c)}
                className="flex items-center justify-between rounded-xl bg-slate-800/70 px-4 py-2.5 text-left active:bg-slate-700"
              >
                <span className="selectable break-all font-mono text-base text-slate-200">
                  {c.normalized}
                </span>
                <span className="ml-2 shrink-0 text-[10px] text-slate-500">
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
