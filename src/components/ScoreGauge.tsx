import React from "react";

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function ScoreGauge({ score, label, size = "md" }: ScoreGaugeProps) {
  let colorStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (score < 60) {
    colorStyle = "text-slate-400 bg-slate-800/40 border-slate-700/50";
  } else if (score < 80) {
    colorStyle = "text-indigo-400 bg-indigo-500/10 border-indigo-500/30";
  }

  const sizeClasses = {
    sm: "w-8 h-8 text-xs font-bold border",
    md: "w-10 h-10 text-xs font-bold border",
    lg: "w-14 h-14 text-base font-bold border",
    xl: "w-20 h-20 text-2xl font-extrabold border-2",
  }[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex items-center justify-center rounded-lg font-mono transition-all ${colorStyle} ${sizeClasses}`}
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
