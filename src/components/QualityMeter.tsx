import type { QualityResult } from "../types";

function Bar({ label, value }: { label: string; value: number }) {
  const v = Math.round(value);
  const color =
    v >= 75 ? "bg-emerald-500" : v >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[10px] text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-200 ${color}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function QualityMeter({ quality }: { quality: QualityResult | null }) {
  if (!quality) return null;
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl bg-slate-800/70 p-3 backdrop-blur">
      <Bar label="밝기" value={quality.brightnessScore} />
      <Bar label="안정" value={quality.motionScore} />
      <Bar label="선명" value={quality.blurScore} />
    </div>
  );
}
