import type { FeedbackKind } from "../types";

const MESSAGES: Record<FeedbackKind, { text: string; tone: string }> = {
  idle: { text: "박스 안에 숫자를 맞춰주세요", tone: "bg-slate-700/80" },
  "too-dark": { text: "너무 어두워요 · 밝은 곳에서 시도해주세요", tone: "bg-amber-600/90" },
  "too-bright": { text: "너무 밝아요 · 빛 반사를 피해주세요", tone: "bg-amber-600/90" },
  motion: { text: "카메라를 고정해주세요", tone: "bg-amber-600/90" },
  blur: { text: "초점을 맞춰주세요", tone: "bg-amber-600/90" },
  ready: { text: "인식 중...", tone: "bg-sky-600/90" },
  scanning: { text: "인식 중...", tone: "bg-sky-600/90" },
  found: { text: "숫자를 찾았어요!", tone: "bg-emerald-600/90" },
};

export function FeedbackBanner({ feedback }: { feedback: FeedbackKind }) {
  const { text, tone } = MESSAGES[feedback] ?? MESSAGES.idle;
  return (
    <div
      className={`pointer-events-none rounded-full px-4 py-2 text-center text-sm font-medium text-white shadow-lg backdrop-blur transition-colors ${tone}`}
    >
      {text}
    </div>
  );
}
