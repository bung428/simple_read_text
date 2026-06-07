import { forwardRef } from "react";
import { ROI_ASPECT, ROI_WIDTH_RATIO } from "../config";
import { useAppStore } from "../store";
import { FeedbackBanner } from "./FeedbackBanner";
import { QualityMeter } from "./QualityMeter";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
}

/**
 * 카메라 프리뷰 + 중앙 ROI 박스 오버레이.
 * ROI 박스 div 의 ref 를 부모로 전달(forwardRef)하여 스캐너가 좌표를 읽는다.
 */
export const CameraView = forwardRef<HTMLDivElement, Props>(
  ({ videoRef }, roiRef) => {
    const quality = useAppStore((s) => s.quality);
    const feedback = useAppStore((s) => s.feedback);
    const isProcessing = useAppStore((s) => s.isProcessing);

    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* 어둡게 처리하는 마스크 + 중앙 투명 ROI */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {/* 상단 안내 */}
          <div className="absolute left-0 right-0 top-0 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <FeedbackBanner feedback={feedback} />
          </div>

          {/* ROI 박스 */}
          <div
            ref={roiRef}
            className="relative rounded-2xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-colors duration-200"
            style={{
              width: `${ROI_WIDTH_RATIO * 100}%`,
              aspectRatio: `${1 / ROI_ASPECT}`,
              borderColor:
                feedback === "found"
                  ? "rgb(16 185 129)"
                  : feedback === "ready"
                  ? "rgb(56 189 248)"
                  : "rgba(255,255,255,0.75)",
            }}
          >
            {/* 모서리 가이드 */}
            <span className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-tl-2xl border-l-4 border-t-4 border-white" />
            <span className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-tr-2xl border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-2xl border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-2xl border-b-4 border-r-4 border-white" />

            {isProcessing && (
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-2xl">
                <div className="h-full w-1/3 animate-[scan_1.1s_linear_infinite] bg-sky-400" />
              </div>
            )}
          </div>

          {/* 하단 품질 미터 */}
          <div className="absolute bottom-3 left-0 right-0 px-4">
            <QualityMeter quality={quality} />
          </div>
        </div>
      </div>
    );
  }
);

CameraView.displayName = "CameraView";
