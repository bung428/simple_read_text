import { useRef } from "react";
import { useAppStore } from "./store";
import { useCamera } from "./hooks/useCamera";
import { useScanner } from "./hooks/useScanner";
import { CameraView } from "./components/CameraView";
import { ResultPanel } from "./components/ResultPanel";
import { StartScreen } from "./components/StartScreen";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roiRef = useRef<HTMLDivElement>(null);

  const phase = useAppStore((s) => s.phase);
  const paused = useAppStore((s) => s.paused);
  const togglePause = useAppStore((s) => s.togglePause);

  const { start, stop } = useCamera(videoRef);
  // 스캐너(품질분석 + OCR worker)는 앱 생애주기 동안 한 번만 마운트
  useScanner(videoRef, roiRef);

  const cameraActive = phase === "requesting" || phase === "scanning";
  const scanning = phase === "scanning";

  const handleStart = () => {
    void start();
  };

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-slate-900">
      {/* 카메라 영역 (상단 고정 비율) */}
      <div className="relative w-full" style={{ height: "58vh" }}>
        {cameraActive ? (
          <CameraView ref={roiRef} videoRef={videoRef} />
        ) : (
          <StartScreen onStart={handleStart} />
        )}
      </div>

      {/* 결과/컨트롤 영역 */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        {scanning && (
          <>
            <ResultPanel />
            <div className="mt-auto flex gap-2 pt-2">
              <button
                onClick={togglePause}
                className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-medium text-white active:bg-slate-600"
              >
                {paused ? "다시 스캔" : "일시정지"}
              </button>
              <button
                onClick={() => {
                  stop();
                  useAppStore.getState().setPhase("init");
                  useAppStore.getState().reset();
                }}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300 active:bg-slate-700"
              >
                카메라 끄기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
