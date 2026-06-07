import { forwardRef } from "react";
import { ROI_ASPECT, ROI_WIDTH_RATIO } from "../config";
import { useAppStore } from "../store";
import { FeedbackBanner } from "./FeedbackBanner";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  onClose: () => void;
}

/**
 * 풀스크린 카메라 프리뷰 + 신분증 스캔 앱 스타일의 중앙 ROI 프레임.
 * - 좌상단 앱바: 뒤로가기(카메라 끄기) 아이콘
 * - ROI 박스 테두리/모서리 색상: 안정권 초록 / 불안정 빨강
 * - 별도 게이지 UI 없음
 */
export const CameraView = forwardRef<HTMLDivElement, Props>(
  ({ videoRef, onClose }, roiRef) => {
    const feedback = useAppStore((s) => s.feedback);
    const isProcessing = useAppStore((s) => s.isProcessing);

    // 밝기·선명도 안정권이면 초록, 아니면 빨강
    const stable = feedback === "ready" || feedback === "found";
    const accent = stable ? "rgb(34 197 94)" : "rgb(239 68 68)";

    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* 상단 모바일 앱바 (뒤로가기) */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-2 pb-6 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <button
            onClick={onClose}
            aria-label="카메라 끄기"
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
          <span className="text-sm font-medium text-white/90">텍스트 스캔</span>
        </div>

        {/* ROI 오버레이 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {/* ROI 박스 (신분증 프레임) */}
          <div
            ref={roiRef}
            className="relative rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors duration-200"
            style={{
              width: `${ROI_WIDTH_RATIO * 100}%`,
              aspectRatio: `${1 / ROI_ASPECT}`,
              border: `2px solid ${accent}`,
            }}
          >
            {/* L자 모서리 가이드 */}
            {[
              "left-2 top-2 border-l-4 border-t-4 rounded-tl-xl",
              "right-2 top-2 border-r-4 border-t-4 rounded-tr-xl",
              "bottom-2 left-2 border-b-4 border-l-4 rounded-bl-xl",
              "bottom-2 right-2 border-b-4 border-r-4 rounded-br-xl",
            ].map((pos) => (
              <span
                key={pos}
                className={`absolute h-7 w-7 ${pos}`}
                style={{ borderColor: accent }}
              />
            ))}

            {/* 인식 중 스캔 라인 */}
            {isProcessing && (
              <div className="absolute inset-x-3 top-0 h-1 overflow-hidden rounded-full">
                <div className="h-full w-1/3 animate-[scan_1.1s_linear_infinite] bg-white/90" />
              </div>
            )}
          </div>

          {/* 박스 아래 안내 문구 */}
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+2rem)] flex justify-center px-6">
            <FeedbackBanner feedback={feedback} />
          </div>
        </div>
      </div>
    );
  }
);

CameraView.displayName = "CameraView";
