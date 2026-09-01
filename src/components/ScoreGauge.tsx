import React from "react";

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function ScoreGauge({ score, label, size = "md" }: ScoreGaugeProps) {
  let ringColor = "text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
  if (score < 50) {
    ringColor = "text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.15)]";
  } else if (score < 75) {
    ringColor = "text-amber-400 border-amber-500/40 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]";
  }

  const sizeClasses = {
    sm: "w-8 h-8 text-[11px] font-bold border",
    md: "w-11 h-11 text-xs font-bold border-[1.5px]",
    lg: "w-16 h-16 text-lg font-bold border-2",
    xl: "w-20 h-20 text-2xl font-bold border-2",
  }[size];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`flex items-center justify-center rounded-full font-mono transition-all duration-300 ${ringColor} ${sizeClasses}`}
      >
        <span>{score}</span>
      </div>
      {label && (
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
          {label}
        </span>
      )}
    </div>
  );
}
