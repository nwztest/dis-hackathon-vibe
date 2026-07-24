"use client";

import { Camera, CircleStop, Play, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { frameRateIntervalMs, frameRateOptions, type DemoFrameRate } from "@/lib/demo-detection";
import type { RoomStatus } from "@/lib/mock-data";

export type DemoCameraRoom = {
  id: string;
  name: string;
  homeLabel: string;
  deviceId: string;
  status: RoomStatus;
};

type DemoResult = {
  status?: RoomStatus;
  reason?: string;
  evidence?: string;
  confidence?: number;
  fallStage?: "none" | "candidate" | "confirmed";
  fallDetected?: boolean;
  fallConfidence?: number;
  annotatedImageBase64?: string;
};

export function DemoCameraClient({ rooms }: { rooms: DemoCameraRoom[] }) {
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id ?? "");
  const [frameRate, setFrameRate] = useState<DemoFrameRate>("5s");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [message, setMessage] = useState("Camera is idle.");
  const [lastResult, setLastResult] = useState<DemoResult | null>(null);
  const [lastSentAt, setLastSentAt] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const selectedRoom = useMemo(() => rooms.find((room) => room.id === selectedRoomId), [rooms, selectedRoomId]);

  const stopCaptureLoop = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const waitForVideoFrame = useCallback(async () => {
    const currentVideo = videoRef.current;
    if (!currentVideo) return false;
    if (currentVideo.readyState >= 2 && currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0) return true;
    const readyVideo: HTMLVideoElement = currentVideo;

    return new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => {
        readyVideo.removeEventListener("loadeddata", onReady);
        readyVideo.removeEventListener("canplay", onReady);
        resolve(readyVideo.readyState >= 2 && readyVideo.videoWidth > 0 && readyVideo.videoHeight > 0);
      }, 1200);

      function onReady() {
        window.clearTimeout(timeout);
        readyVideo.removeEventListener("loadeddata", onReady);
        readyVideo.removeEventListener("canplay", onReady);
        resolve(readyVideo.videoWidth > 0 && readyVideo.videoHeight > 0);
      }

      readyVideo.addEventListener("loadeddata", onReady);
      readyVideo.addEventListener("canplay", onReady);
    });
  }, []);

  const sendFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !selectedRoomId || inFlightRef.current) return;
    if (videoRef.current.readyState < 2) return;

    const imageBase64 = captureImage(videoRef.current, canvasRef.current);
    if (!imageBase64) return;

    inFlightRef.current = true;
    const capturedAt = new Date().toISOString();
    setLastSentAt(new Intl.DateTimeFormat("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(capturedAt)));

    try {
      const response = await fetch("/api/demo/frame", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoomId,
          capturedAt,
          frameRate,
          imageBase64,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setMessage(body.error ?? "Frame could not be processed.");
        return;
      }

      setLastResult(body.result ?? null);
      setMessage("Last frame processed.");
    } catch {
      setMessage("Worker request failed. Check the local or external inference server.");
    } finally {
      inFlightRef.current = false;
    }
  }, [frameRate, selectedRoomId]);

  useEffect(() => {
    if (cameraState !== "active") return;
    stopCaptureLoop();
    void sendFrame();
    intervalRef.current = window.setInterval(() => {
      void sendFrame();
    }, frameRateIntervalMs(frameRate));
    return stopCaptureLoop;
  }, [cameraState, frameRate, sendFrame, stopCaptureLoop]);

  useEffect(
    () => () => {
      stopCaptureLoop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    },
    [stopCaptureLoop],
  );

  async function startCamera() {
    if (!selectedRoomId) {
      setMessage("Select a room camera first.");
      return;
    }

    setCameraState("starting");
    setMessage("Requesting camera access.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await waitForVideoFrame();
      setCameraState("active");
      setMessage("Camera active. Sending demo frames to the worker.");
    } catch {
      setCameraState("error");
      setMessage("Camera permission was denied or no camera is available.");
    }
  }

  function stopCamera() {
    stopCaptureLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLastResult(null);
    setCameraState("idle");
    setMessage("Camera stopped.");
  }

  return (
    <section className="demo-camera-grid">
      <article className="panel demo-camera-preview">
        <video ref={videoRef} muted playsInline />
        {lastResult?.annotatedImageBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="YOLO annotated frame" src={lastResult.annotatedImageBase64} />
        ) : null}
        <canvas ref={canvasRef} hidden />
      </article>
      <article className="panel demo-camera-controls">
        <div className="form-stack">
          <label>
            Room camera
            <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)} disabled={cameraState === "active"}>
              {rooms.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.homeLabel} · {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frame rate
            <select value={frameRate} onChange={(event) => setFrameRate(event.target.value as DemoFrameRate)}>
              {frameRateOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            {cameraState === "active" ? (
              <button type="button" onClick={stopCamera}>
                <CircleStop size={16} />
                Stop
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={startCamera} disabled={!rooms.length || cameraState === "starting"}>
                <Play size={16} />
                Start camera
              </button>
            )}
            <button type="button" onClick={() => void sendFrame()} disabled={cameraState !== "active"}>
              <Send size={16} />
              Send frame
            </button>
          </div>
        </div>
        <dl className="definition-list">
          <div><dt>State</dt><dd>{cameraState}</dd></div>
          <div><dt>Selected device</dt><dd>{selectedRoom?.deviceId ?? "No room camera"}</dd></div>
          <div><dt>Selected rate</dt><dd>{frameRateOptions.find((option) => option.value === frameRate)?.label}</dd></div>
          <div><dt>Last frame</dt><dd>{lastSentAt || "Not sent"}</dd></div>
          <div><dt>Latest status</dt><dd>{lastResult?.status ?? selectedRoom?.status ?? "Unknown"}</dd></div>
          <div><dt>Fall detection</dt><dd>{fallDetectionLabel(lastResult)}</dd></div>
        </dl>
        <p className="form-note">{message}</p>
        {lastResult ? (
          <div className="demo-result">
            <Camera size={18} />
            <div>
              <strong>{lastResult.reason ?? "Processed"}</strong>
              <span>{lastResult.evidence ?? "Worker returned a normalized result."}</span>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}

function captureImage(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return "";

  const maxWidth = 480;
  const scale = Math.min(1, maxWidth / sourceWidth);
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.62);
}

function fallDetectionLabel(result: DemoResult | null) {
  if (!result?.fallStage || result.fallStage === "none") return "No transition";
  const confidence = typeof result.fallConfidence === "number" ? ` · ${Math.round(result.fallConfidence)}%` : "";
  return `${result.fallStage}${confidence}`;
}
