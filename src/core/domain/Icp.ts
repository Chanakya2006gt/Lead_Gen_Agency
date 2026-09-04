/**
 * Ideal Customer Profile (ICP) & Qualification Domain Invariants
 */

export const ICP_CONSTANTS = {
  MIN_RATING: 4.0,
  MIN_REVIEW_COUNT: 50,
  SAAS_OK_LATENCY_MS: 2000,
  HIGH_VOLUME_REVIEWS: 200,
  CUSTOM_OPS_VOLUME_REVIEWS: 250,
} as const;

export const CRITICAL_DEFECT = {
  LAYOUT_OVERFLOW: "layout_overflow",
  NO_VIEWPORT: "no_viewport",
  SEVERE_LATENCY: "severe_latency",
  BROKEN_LINKS: "broken_links",
} as const;
