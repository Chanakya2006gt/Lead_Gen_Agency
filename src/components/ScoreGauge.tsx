import React from "react";

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function ScoreGauge({ score, label, size = "md" }: ScoreGaugeProps) {
  let ringClasses = "text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/20";
  if (score < 50) {
    ringClasses = "text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/20";
  } else if (score < 75) {
    ringClasses = "text-amber-400 border-amber-500/40 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/20";
  }

  const sizeClasses = {
    sm: "w-9 h-9 text-xs font-bold border-[1.5px]",
    md: "w-12 h-12 text-sm font-bold border-2",
    lg: "w-16 h-16 text-xl font-bold border-2",
    xl: "w-22 h-22 text-3xl font-extrabold border-[2.5px]",
  }[size];

  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <div
        className={`flex items-center justify-center rounded-full font-mono transition-all duration-500 group-hover:scale-105 ${ringClasses} ${sizeClasses}`}
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
