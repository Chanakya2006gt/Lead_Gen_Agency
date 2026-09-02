import { sqliteTable, text as sqliteText, integer as sqliteInteger, real as sqliteReal } from "drizzle-orm/sqlite-core";

export type ReviewTrend = "GROWING" | "STABLE" | "DECLINING" | "STALE" | "UNKNOWN";
export type OpportunityType = "WEBSITE" | "WEBSITE_AUTOMATION" | "CUSTOM_OPERATIONAL_SOFTWARE" | "UNKNOWN";
export type HumanStatus = "NEW" | "REVIEWED" | "READY_FOR_OUTREACH" | "ARCHIVED";

export interface AuditFinding {
  category: "technical" | "ux" | "conversion" | "operational";
  finding: string;
  evidence: string;
  selectorOrUrl?: string;
  confidence: number;
}

export interface AuditTelemetry {
  viewportMetaPresent: boolean;
  hasHorizontalOverflow: boolean;
  hasSsl: boolean;
  brokenLinksCount: number;
  jsConsoleErrorsCount: number;
  initialLoadLatencyMs: number;
  hasDirectClickToCall: boolean;
  hasWhatsAppDirectLink: boolean;
  hasInteractiveBookingForm: boolean;
  findings: AuditFinding[];
}

export interface SignalProvenance {
  ratingConfidence: "high" | "medium" | "low";
  reviewVelocityConfidence: "observed" | "longitudinal" | "unknown";
  identityConfidence: "google_verified" | "deterministic";
  auditConfidence: "empirical" | "pending";
}

export interface BusinessDossier {
  reputationScore: number;
  digitalGapScore: number;
  opportunityScore: number;
  confidenceScore: number;
  overallLeadScore: number;
  opportunityType: OpportunityType;
  identifiedStrengths: string[];
  identifiedBottlenecks: string[];
  provenance?: SignalProvenance;
  recommendedPitch: {
    coreAngle: string;
    suggestedScope: string;
    identifiedBottlenecks: string[];
    estimatedValueRange: string;
  };
  executiveSummary: string;
}

// =========================================================================
// SQLite Schema (Local Dedicated Workstation Engine)
// =========================================================================

export const discoveryScans = sqliteTable("discovery_scans", {
  id: sqliteText("id").primaryKey(),
  niche: sqliteText("niche").notNull(),
  locationInput: sqliteText("location_input").notNull(),
  radiusKm: sqliteInteger("radius_km").notNull().default(15),
  status: sqliteText("status").notNull().default("RUNNING"),
  rawDiscoveredCount: sqliteInteger("raw_discovered_count").default(0),
  qualifiedCount: sqliteInteger("qualified_count").default(0),
  createdAt: sqliteText("created_at").notNull(),
});

export const leads = sqliteTable("leads", {
  id: sqliteText("id").primaryKey(),
  scanId: sqliteText("scan_id").references(() => discoveryScans.id, { onDelete: "cascade" }),
  placeId: sqliteText("place_id").notNull(),
  name: sqliteText("name").notNull(),
  category: sqliteText("category"),
  formattedAddress: sqliteText("formatted_address"),
  phone: sqliteText("phone"),
  googleMapsUrl: sqliteText("google_maps_url"),
  websiteUrl: sqliteText("website_url"),
  rating: sqliteReal("rating").notNull(),
  reviewCount: sqliteInteger("review_count").notNull(),
  lastReviewDate: sqliteText("last_review_date"),
  reviewsLast30Days: sqliteInteger("reviews_last_30_days"),
  reviewsLast90Days: sqliteInteger("reviews_last_90_days"),
  reviewsLast180Days: sqliteInteger("reviews_last_180_days"),
  reviewTrend: sqliteText("review_trend").$type<ReviewTrend>().notNull().default("UNKNOWN"),
  hasWebsite: sqliteInteger("has_website", { mode: "boolean" }).notNull().default(false),
  auditStatus: sqliteText("audit_status").notNull().default("PENDING"),
  auditTelemetry: sqliteText("audit_telemetry", { mode: "json" }).$type<AuditTelemetry>(),
  reputationScore: sqliteInteger("reputation_score").default(0),
  digitalGapScore: sqliteInteger("digital_gap_score").default(0),
  opportunityScore: sqliteInteger("opportunity_score").default(0),
  confidenceScore: sqliteInteger("confidence_score").default(0),
  totalLeadScore: sqliteInteger("total_lead_score").default(0),
  opportunityType: sqliteText("opportunity_type").$type<OpportunityType>().notNull().default("UNKNOWN"),
  dossier: sqliteText("dossier", { mode: "json" }).$type<BusinessDossier>(),
  humanStatus: sqliteText("human_status").$type<HumanStatus>().notNull().default("NEW"),
  // Observation and Longitudinal Intelligence
  firstObservedAt: sqliteText("first_observed_at"),
  lastObservedAt: sqliteText("last_observed_at"),
  observationCount: sqliteInteger("observation_count").notNull().default(1),
  reviewCountDelta: sqliteInteger("review_count_delta").default(0),
  ratingDelta: sqliteReal("rating_delta").default(0),
  identitySource: sqliteText("identity_source").default("deterministic"),
  createdAt: sqliteText("created_at").notNull(),
  updatedAt: sqliteText("updated_at").notNull(),
});

export const leadObservations = sqliteTable("lead_observations", {
  id: sqliteText("id").primaryKey(),
  leadId: sqliteText("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  scanId: sqliteText("scan_id").references(() => discoveryScans.id, { onDelete: "cascade" }),
  observedRating: sqliteReal("observed_rating").notNull(),
  observedReviewCount: sqliteInteger("observed_review_count").notNull(),
  observedWebsiteUrl: sqliteText("observed_website_url"),
  observedPhone: sqliteText("observed_phone"),
  observedAt: sqliteText("observed_at").notNull(),
});

export type DiscoveryScan = typeof discoveryScans.$inferSelect;
export type InsertDiscoveryScan = typeof discoveryScans.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type LeadObservation = typeof leadObservations.$inferSelect;
export type InsertLeadObservation = typeof leadObservations.$inferInsert;
