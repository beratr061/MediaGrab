import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpeedGraphProps {
  speed: string;
  className?: string;
}

const MAX_POINTS = 30;

function parseSpeed(speed: string): number {
  if (!speed || speed === "--") return 0;
  
  const match = speed.match(/([\d.]+)\s*(B|KB|KiB|MB|MiB|GB|GiB)/i);
  if (!match || !match[1] || !match[2]) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 * 1024,
    mib: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    gib: 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 1);
}

export const SpeedGraph = memo(function SpeedGraph({ speed, className }: SpeedGraphProps) {
  const [points, setPoints] = useState<number[]>([]);
  const maxSpeedRef = useRef(0);

  useEffect(() => {
    const currentSpeed = parseSpeed(speed);
    
    setPoints((prev) => {
      const newPoints = [...prev, currentSpeed].slice(-MAX_POINTS);
      maxSpeedRef.current = Math.max(...newPoints, maxSpeedRef.current * 0.95);
      return newPoints;
    });
  }, [speed]);

  if (points.length < 2) return null;

  const width = 120;
  const height = 32;
  const maxSpeed = maxSpeedRef.current || 1;

  // Generate SVG path
  const pathData = points
    .map((point, index) => {
      const x = (index / (MAX_POINTS - 1)) * width;
      const y = height - (point / maxSpeed) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Generate area path (for gradient fill)
  const areaPath = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className={cn("relative", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="speedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill="url(#speedGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        
        {/* Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Current point */}
        {points.length > 0 && points[points.length - 1] !== undefined && (
          <motion.circle
            cx={width}
            cy={height - ((points[points.length - 1] ?? 0) / maxSpeed) * height}
            r="3"
            fill="hsl(var(--primary))"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          />
        )}
      </svg>
    </div>
  );
});
