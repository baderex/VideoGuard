import { useState, useEffect } from "react";
import { DetectionSnapshot } from "@workspace/api-client-react";
import { Focus, AlertCircle } from "lucide-react";
import { formatTime } from "@/lib/utils";

export function SimulatedFeed({ snapshot, status }: { snapshot?: DetectionSnapshot, status?: string }) {
  const [frameId, setFrameId] = useState(0);

  // Simulate minor frame updates
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      setFrameId(f => f + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === 'inactive') {
    return (
      <div className="w-full aspect-video bg-black rounded-lg border border-border flex items-center justify-center flex-col text-muted-foreground">
        <Focus className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-display tracking-widest uppercase">Feed Offline</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full aspect-video bg-black rounded-lg border border-destructive/50 flex items-center justify-center flex-col text-destructive shadow-[inset_0_0_50px_rgba(255,0,0,0.1)]">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="font-display tracking-widest uppercase text-xl">Connection Lost</p>
        <p className="text-sm font-mono mt-2">ERR_STREAM_TIMEOUT</p>
      </div>
    );
  }

  // Generate deterministic "random" positions based on person ID so they don't jump wildly
  const getBoxStyle = (id: string, isCompliant: boolean) => {
    // Simple hash to get a pseudo-random 0-1 value
    const hash = id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const top = 20 + Math.abs(hash % 50);
    const left = 10 + Math.abs((hash >> 4) % 70);
    
    // Add slight jitter based on frameId to simulate movement
    const jitterTop = top + Math.sin(frameId * 0.5 + hash) * 2;
    const jitterLeft = left + Math.cos(frameId * 0.3 + hash) * 2;

    return {
      top: `${jitterTop}%`,
      left: `${jitterLeft}%`,
      borderColor: isCompliant ? 'hsl(142, 71%, 45%)' : 'hsl(348, 83%, 47%)',
      boxShadow: isCompliant ? '0 0 10px rgba(0,255,0,0.3)' : '0 0 15px rgba(255,0,0,0.5), inset 0 0 10px rgba(255,0,0,0.3)',
      backgroundColor: isCompliant ? 'transparent' : 'rgba(255,0,0,0.05)'
    };
  };

  return (
    <div className="relative w-full aspect-video bg-[#050a10] rounded-lg border border-border/50 overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiPjxsaW5lIHgxPSIwIiB5MT0iNDAiIHgyPSI0MCIgeTI9IjQwIi8+PGxpbmUgeDE9IjQwIiB5MT0iMCIgeDI9IjQwIiB5Mj0iNDAiLz48L2c+PC9zdmc+')] opacity-50" />
      
      {/* Scanning Line overlay */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/80 shadow-[0_0_15px_rgba(0,255,255,1)] animate-scan z-10" />

      {/* Timestamp HUD */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur border border-primary/30 px-3 py-1.5 rounded text-primary font-mono text-xs z-20 flex items-center">
        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse mr-2" />
        REC • {snapshot ? formatTime(snapshot.timestamp) : 'WAITING...'}
      </div>

      {/* Target Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <Focus className="w-32 h-32 text-primary" />
      </div>

      {/* Detected Persons Bounding Boxes */}
      {snapshot?.detectedPersons.map((person) => {
        const style = getBoxStyle(person.id, person.compliant);
        return (
          <div 
            key={person.id}
            className="absolute border-2 transition-all duration-300 ease-linear z-20 w-[12%] h-[25%]"
            style={style}
          >
            {/* Box corners */}
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: style.borderColor }} />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: style.borderColor }} />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: style.borderColor }} />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: style.borderColor }} />
            
            {/* Label */}
            <div 
              className="absolute -top-6 left-0 bg-black/80 backdrop-blur px-1 py-0.5 text-[9px] font-mono whitespace-nowrap border"
              style={{ borderColor: style.borderColor, color: style.borderColor }}
            >
              ID:{person.id.substring(0,4)} | CF:{Math.round(person.confidence * 100)}%
            </div>
            
            {/* Alert Indicator if missing PPE */}
            {!person.compliant && (
              <div className="absolute -bottom-6 left-0 text-[10px] font-display font-bold text-destructive bg-destructive/20 px-1 border border-destructive/50 flex items-center shadow-[0_0_10px_rgba(255,0,0,0.3)] uppercase">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Violation
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
