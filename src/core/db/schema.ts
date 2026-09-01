import { pgTable, text, varchar, integer, boolean, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
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

export interface BusinessDossier {
  reputationScore: number;
  digitalGapScore: number;
  opportunityScore: number;
  confidenceScore: number;
  overallLeadScore: number;
  opportunityType: OpportunityType;
  identifiedStrengths: string[];
  identifiedBottlenecks: string[];
  recommendedPitch: {
    coreAngle: string;
    suggestedScope: string;
    identifiedBottlenecks: string[];
    estimatedValueRange: string;
  };
  executiveSummary: string;
}

// =========================================================================
// SQLite Schema (Local Zero-Config Mode)
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
  placeId: sqliteText("place_id").notNull().unique(),
  name: sqliteText("name").notNull(),
  category: sqliteText("category"),
  formattedAddress: sqliteText("formatted_address"),
  phone: sqliteText("phone"),
  googleMapsUrl: sqliteText("google_maps_url"),
  websiteUrl: sqliteText("website_url"),
  rating: sqliteReal("rating").notNull(),
  reviewCount: sqliteInteger("review_count").notNull(),
  lastReviewDate: sqliteText("last_review_date"),
  reviewsLast30Days: sqliteInteger("reviews_last_30_days").default(0),
  reviewsLast90Days: sqliteInteger("reviews_last_90_days").default(0),
  reviewsLast180Days: sqliteInteger("reviews_last_180_days").default(0),
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
  createdAt: sqliteText("created_at").notNull(),
  updatedAt: sqliteText("updated_at").notNull(),
});

export type DiscoveryScan = typeof discoveryScans.$inferSelect;
export type InsertDiscoveryScan = typeof discoveryScans.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
