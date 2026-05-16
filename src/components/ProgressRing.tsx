import React from 'react';
import { motion } from 'motion/react';

interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number;
  color: string;
  children?: React.ReactNode;
}

export function ProgressRing({ radius, stroke, progress, color, children }: ProgressRingProps) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Make sure progress is clamped 0-100 for visual
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="relative flex items-center justify-center p-4" style={{ width: radius * 2 + 32, height: radius * 2 + 32 }}>
      <svg
        height={radius * 2}
        width={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        className="transform -rotate-90 overflow-visible"
      >
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <circle
          stroke="#F3F4F6" // gray-100
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <motion.circle
          stroke="url(#ringGradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (clampedProgress / 100) * circumference }}
          transition={{ duration: 1, ease: 'easeOut' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
