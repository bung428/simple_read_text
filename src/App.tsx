import { useRef } from "react";
import { useAppStore } from "./store";
import { useCamera } from "./hooks/useCamera";
import { useScanner } from "./hooks/useScanner";
import { CameraView } from "./components/CameraView";
import { ResultScreen } from "./components/ResultScreen";
import { StartScreen } from "./components/StartScreen";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roiRef = useRef<HTMLDivElement>(null);

  const phase = useAppStore((s) => s.phase);

  const { start, stop } = useCamera(videoRef);
  // 스캐너(품질분석 + OCR worker)는 앱 생애주기 동안 한 번만 마운트
  useScanner(videoRef, roiRef);

  // 카메라 스트림은 scanning ↔ result 사이에서 살아있어야 재스캔이 즉시 된다
  const cameraActive =
    phase === "requesting" || phase === "scanning" || phase === "result";

  const handleStart = () => {
    void start();
  };

  // 앱바 뒤로가기: 카메라 끄고 시작화면으로
  const handleClose = () => {
    stop();
    useAppStore.getState().reset();
    useAppStore.getState().setPhase("init");
  };

  // 결과화면 → 다시 스캔. 카메라가 살아있으면 즉시 재개, 아니면 재시작.
  const handleRescan = () => {
    useAppStore.getState().reset();
    const v = videoRef.current;
    const stream = v?.srcObject;
    const live =
      stream instanceof MediaStream &&
      stream.getTracks().some((t) => t.readyState === "live");
    if (live) {
      useAppStore.getState().setPhase("scanning");
    } else {
      void start();
    }
  };

  return (
    <div className="relative mx-auto h-full max-w-md overflow-hidden bg-black">
      {cameraActive ? (
        <CameraView ref={roiRef} videoRef={videoRef} onClose={handleClose} />
      ) : (
        <StartScreen onStart={handleStart} />
      )}

      {phase === "result" && (
        <ResultScreen onBack={handleRescan} onClose={handleClose} />
      )}
    </div>
  );
}
