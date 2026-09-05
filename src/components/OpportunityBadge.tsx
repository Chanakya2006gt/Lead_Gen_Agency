import React from "react";
import { Lead } from "@/core/db/schema";
import { Unlink, XCircle, Sparkles, Smartphone } from "lucide-react";

interface OpportunityBadgeProps {
  lead: Lead;
}

export function OpportunityBadge({ lead }: OpportunityBadgeProps) {
  if (lead.isGbpDisconnected) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
        <Unlink className="w-3 h-3 text-purple-400" />
        <span>Unlinked GBP Asset</span>
      </span>
    );
  }

  if (!lead.hasWebsite) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <XCircle className="w-3 h-3 text-amber-400" />
        <span>No Website Gap</span>
      </span>
    );
  }

  if (lead.opportunityType === "CUSTOM_OPERATIONAL_SOFTWARE") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
        <Sparkles className="w-3 h-3 text-indigo-400" />
        <span>Custom Ops Software</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
      <Smartphone className="w-3 h-3 text-blue-400" />
      <span>Mobile / Booking Gap</span>
    </span>
  );
}
