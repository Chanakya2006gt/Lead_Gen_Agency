import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export type ReviewTrend = "GROWING" | "STABLE" | "DECLINING" | "STALE" | "UNKNOWN";
export type OpportunityType =
  | "WEBSITE"
  | "WEBSITE_AUTOMATION"
  | "CUSTOM_OPERATIONAL_SOFTWARE"
  | "UNKNOWN";
export type AuditStatus = "PENDING" | "NO_WEBSITE" | "AUDITED" | "FAILED";
export type HumanStatus = "NEW" | "REVIEWED" | "READY_FOR_OUTREACH" | "ARCHIVED";

export interface AuditFinding {
  category: "technical" | "ux" | "conversion" | "operational";
  finding: string;
  evidence: string;
  selectorOrUrl?: string;
  confidence: number; // 0.0 - 1.0
}

export interface AuditTelemetry {
  isHttps: boolean;
  hasMobileViewport: boolean;
  hasHorizontalScroll: boolean;
  domLoadTimeSec: number;
  hasPhoneCta: boolean;
  hasWhatsAppCta: boolean;
  hasEnquiryOrBookingForm: boolean;
  brokenLinksCount: number;
  jsErrorsCount: number;
  extractedServices: string[];
  findings: AuditFinding[];
}

export interface PitchDetails {
  coreAngle: string;
  identifiedBottlenecks: string[];
  suggestedScope: string;
  estimatedValueRange: string;
}

export interface BusinessDossier {
  reputationScore: number;
  digitalGapScore: number;
  opportunityScore: number;
  confidenceScore: number;
  overallLeadScore: number; // 0 to 100
  opportunityType: OpportunityType;
  operationalSignals: string[];
  recommendedPitch: PitchDetails;
}

export const discoveryScans = sqliteTable("discovery_scans", {
  id: text("id").primaryKey(),
  niche: text("niche").notNull(),
  locationInput: text("location_input").notNull(),
  radiusKm: integer("radius_km").notNull().default(15),
  status: text("status").notNull().default("RUNNING"), // RUNNING, COMPLETED, FAILED
  rawDiscoveredCount: integer("raw_discovered_count").default(0),
  qualifiedCount: integer("qualified_count").default(0),
  createdAt: text("created_at").notNull(),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  scanId: text("scan_id").references(() => discoveryScans.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  formattedAddress: text("formatted_address"),
  phone: text("phone"),
  googleMapsUrl: text("google_maps_url"),
  websiteUrl: text("website_url"),

  // Universal Reputation Rules
  rating: real("rating").notNull(),
  reviewCount: integer("review_count").notNull(),
  lastReviewDate: text("last_review_date"),
  reviewsLast30Days: integer("reviews_last_30_days").default(0),
  reviewsLast90Days: integer("reviews_last_90_days").default(0),
  reviewsLast180Days: integer("reviews_last_180_days").default(0),
  reviewTrend: text("review_trend").notNull().default("UNKNOWN"), // ReviewTrend

  // Audit & Opportunity Engine
  hasWebsite: integer("has_website", { mode: "boolean" }).notNull().default(false),
  auditStatus: text("audit_status").notNull().default("PENDING"), // AuditStatus
  auditTelemetry: text("audit_telemetry", { mode: "json" }).$type<AuditTelemetry | null>(),

  // 4-Dimension Scores & Classification
  reputationScore: integer("reputation_score").default(0),
  digitalGapScore: integer("digital_gap_score").default(0),
  opportunityScore: integer("opportunity_score").default(0),
  confidenceScore: integer("confidence_score").default(0),
  totalLeadScore: integer("total_lead_score").default(0),
  opportunityType: text("opportunity_type").notNull().default("UNKNOWN"), // OpportunityType

  // Dossier & Synthesis
  dossier: text("dossier", { mode: "json" }).$type<BusinessDossier | null>(),
  humanStatus: text("human_status").notNull().default("NEW"), // HumanStatus

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type DiscoveryScan = typeof discoveryScans.$inferSelect;
export type InsertDiscoveryScan = typeof discoveryScans.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
