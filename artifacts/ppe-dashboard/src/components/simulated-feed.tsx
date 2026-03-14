import { useEffect, useState } from "react";
import { Focus, AlertCircle, Loader2 } from "lucide-react";

interface YoloStats {
  personCount: number;
  violationCount: number;
  complianceRate: number;
  timestamp: number;
}

interface SimulatedFeedProps {
  snapshot?: unknown;
  status?: string;
  cameraId?: number;
  onYoloStats?: (stats: YoloStats) => void;
}

export function SimulatedFeed({ status, cameraId, onYoloStats }: SimulatedFeedProps) {
  const [streamError, setStreamError] = useState(false);
  const [streamLoaded, setStreamLoaded] = useState(false);

  const streamUrl = cameraId ? `/api/yolo/stream/${cameraId}` : undefined;
  const statsUrl = cameraId ? `/api/yolo/stats/${cameraId}` : undefined;

  // Poll YOLO stats and pass them up
  useEffect(() => {
    if (!statsUrl || !onYoloStats || status !== "active") return;

    const poll = async () => {
      try {
        const res = await fetch(statsUrl);
        if (res.ok) {
          const data: YoloStats = await res.json();
          onYoloStats(data);
        }
      } catch {
        // service not yet ready
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [statsUrl, onYoloStats, status]);

  // Reset stream error/loaded state when camera changes
  useEffect(() => {
    setStreamError(false);
    setStreamLoaded(false);
  }, [cameraId]);

  if (status === "inactive") {
    return (
      <div className="w-full aspect-video bg-black rounded-lg border border-border flex items-center justify-center flex-col text-muted-foreground">
        <Focus className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-display tracking-widest uppercase">Feed Offline</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full aspect-video bg-black rounded-lg border border-destructive/50 flex items-center justify-center flex-col text-destructive shadow-[inset_0_0_50px_rgba(255,0,0,0.1)]">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="font-display tracking-widest uppercase text-xl">Connection Lost</p>
        <p className="text-sm font-mono mt-2">ERR_STREAM_TIMEOUT</p>
      </div>
    );
  }

  if (streamError) {
    return (
      <div className="w-full aspect-video bg-[#050a10] rounded-lg border border-border/50 flex items-center justify-center flex-col text-muted-foreground">
        <Loader2 className="w-10 h-10 mb-3 animate-spin text-primary/60" />
        <p className="font-display tracking-wider uppercase text-sm">Loading YOLO Detection Engine...</p>
        <p className="text-xs font-mono mt-1 opacity-60">Downloading model weights on first run</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-[#050a10] rounded-lg border border-border/50 overflow-hidden">
      {/* YOLO MJPEG stream — detection boxes, HUD, scan line all rendered by Python/OpenCV */}
      {streamUrl && (
        <>
          {!streamLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10">
              <Loader2 className="w-10 h-10 mb-3 animate-spin text-primary/60" />
              <p className="font-display tracking-wider uppercase text-sm">Initialising YOLO v11...</p>
              <p className="text-xs font-mono mt-1 opacity-60">CAM-{String(cameraId).padStart(2, "0")} ∙ Awaiting stream</p>
            </div>
          )}
          <img
            src={streamUrl}
            alt={`Camera ${cameraId} YOLO Feed`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ display: streamLoaded ? "block" : "none" }}
            onLoad={() => setStreamLoaded(true)}
            onError={() => {
              setStreamLoaded(false);
              setStreamError(true);
              // retry after 4 seconds
              setTimeout(() => setStreamError(false), 4000);
            }}
          />
        </>
      )}
    </div>
  );
}
