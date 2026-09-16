"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PHOTO_ANGLE_LABEL, type PhotoAngle } from "@/lib/progress-photo-types";

// Same standing-forward outline works for both FRONT and BACK — the guide
// is only about vertical/horizontal alignment (distance from camera,
// centering), which doesn't depend on which way the body is actually
// facing; the instruction text above is what tells the two apart.
function BodySilhouette({ angle }: { angle: PhotoAngle }) {
  if (angle === "SIDE") {
    return (
      <svg viewBox="0 0 300 400" className="h-full w-full" aria-hidden="true">
        <g fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="178" cy="48" r="28" />
          <path
            d="M155 76
               L140 130
               L132 300
               L128 378
               L158 378
               L163 300
               L195 130
               L183 68
               C176 74, 163 74, 155 76 Z"
          />
          <path d="M158 100 L133 192" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 400" className="h-full w-full" aria-hidden="true">
      <g fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="150" cy="50" r="32" />
        <path
          d="M104 110
             L98 230
             L95 340
             L130 390
             L150 340
             L170 390
             L205 340
             L202 230
             L196 110
             C182 92, 118 92, 104 110 Z"
        />
        <path d="M100 120 L70 220" />
        <path d="M200 120 L230 220" />
      </g>
    </svg>
  );
}

// Full-screen live camera view with a translucent body-outline overlay, so
// repeat progress photos land at roughly the same distance/framing every
// time instead of drifting — the single biggest thing that makes a
// before/after comparison look misleading (someone standing a step closer
// reads as "lost weight" even when nothing changed). Captures the raw
// video frame via canvas — the <video> preview is never CSS-mirrored, so
// what's on screen is exactly what gets saved, keeping the guide's
// alignment meaningful. Falls back to the plain gallery/file picker
// (still available in ProgressPhotosCard, unchanged) if the camera can't
// be opened at all (no device, permission denied, insecure context).
export function PoseGuideCamera({
  angle,
  onCapture,
  onClose,
}: {
  angle: PhotoAngle;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const t = useTranslations("nutrition.poseGuideCamera");
  const angleInstruction: Record<PhotoAngle, string> = {
    FRONT: t("instruction.FRONT"),
    SIDE: t("instruction.SIDE"),
    BACK: t("instruction.BACK"),
  };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) setError(t("cameraFailed"));
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturing(false);
        if (blob) onCapture(new File([blob], "progress-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-300">{error}</div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="h-full max-h-[80%] w-full max-w-[70%]">
                <BodySilhouette angle={angle} />
              </div>
            </div>
            <p className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm font-medium text-white drop-shadow">
              {angleInstruction[angle]}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 bg-black/90 p-5">
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-white">
          {t("cancel")}
        </button>
        {!error && (
          <button
            onClick={capture}
            disabled={capturing}
            aria-label={t("takePhotoOf", { angle: PHOTO_ANGLE_LABEL[angle] })}
            className="h-16 w-16 flex-none rounded-full border-4 border-white bg-white/20 transition disabled:opacity-50"
          />
        )}
        {!error ? (
          <button
            onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
            className="text-sm text-neutral-400 hover:text-white"
          >
            {t("switchCamera")}
          </button>
        ) : (
          <span className="w-12" />
        )}
      </div>
    </div>
  );
}
