import { useCallback, useEffect, useRef } from "react";
import { CAMERA_CONSTRAINTS } from "../config";
import { useAppStore } from "../store";

/**
 * 카메라 스트림 관리 훅.
 * - getUserMedia 로 후면 카메라 스트림 획득
 * - video 요소에 연결
 * - 탭 전환/언마운트 시 track.stop() 으로 반드시 정리
 */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const setPhase = useAppStore((s) => s.setPhase);
  const setError = useAppStore((s) => s.setError);

  const stop = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저는 카메라 API를 지원하지 않습니다.");
      return;
    }
    try {
      setPhase("requesting");
      const stream = await navigator.mediaDevices.getUserMedia(
        CAMERA_CONSTRAINTS
      );
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      // iOS Safari autoplay 대응: muted + playsInline 필요 (JSX에서 설정)
      try {
        await video.play();
      } catch {
        // 자동재생 실패 시에도 사용자 제스처로 들어온 상태이므로 보통 성공.
      }
      setPhase("scanning");
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        setPhase("denied");
      } else if (e.name === "NotFoundError") {
        setError("사용 가능한 카메라를 찾을 수 없습니다.");
      } else {
        setError(`카메라를 시작할 수 없습니다: ${e.message || e.name}`);
      }
    }
  }, [setError, setPhase, videoRef]);

  // 탭이 백그라운드로 가면 카메라 정지(iOS 배터리/메모리), 복귀 시 재시작
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        if (useAppStore.getState().phase === "scanning") {
          useAppStore.getState().setPhase("init");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  return { start, stop };
}
