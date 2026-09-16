import { AuditTelemetry } from "@/core/db/schema";
import { BusinessScale, ProblemSeverity, WbsDeliverable } from "./types";

export interface WbsItemizeParams {
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  auditTelemetry?: AuditTelemetry | null;
  businessScale: BusinessScale;
  relevantWorkflows?: {
    whatsAppIntake?: boolean;
    appointmentBooking?: boolean;
    ecommerceCart?: boolean;
    rfqQuoteForm?: boolean;
    saasDemoOrSignup?: boolean;
    localGbpSync?: boolean;
    mobileViewport?: boolean;
    sslSecurity?: boolean;
  };
  currency: string;
  hourlyRate: number;
}

export interface WbsItemizeResult {
  deliverables: WbsDeliverable[];
  totalBaseHours: number;
  totalScaledHours: number;
  scaleMultiplier: number;
  wbsFloorPrice: number;
  wbsCeilingPrice: number;
  scopeSummary: string;
}

export class FindingWbsEngine {
  /**
   * Complexity Multiplier based on organizational footprint.
   * A large hospital or enterprise requires multi-provider calendars, departmental routing,
   * and high-availability architecture compared to a single-chair local shop.
   */
  public static getScaleMultiplier(scale: BusinessScale): number {
    switch (scale) {
      case "ENTERPRISE":
        return 6.0;
      case "LARGE":
        return 3.5;
      case "MEDIUM":
        return 2.2;
      case "SMALL_MEDIUM":
        return 1.6;
      case "SMALL":
        return 1.25;
      case "MICRO":
      case "UNKNOWN":
      default:
        return 1.0;
    }
  }

  public static itemize(params: WbsItemizeParams): WbsItemizeResult {
    const deliverables: WbsDeliverable[] = [];
    const multiplier = this.getScaleMultiplier(params.businessScale);
    const hourlyRate = params.hourlyRate;
    const isINR = params.currency === "INR";

    // 1. Digital State: Zero Website
    if (!params.hasWebsite) {
      deliverables.push({
        id: "deliv-storefront-rebuild",
        title: "Conversion-First Web Platform & Local SEO Architecture",
        description:
          "Full mobile-first website architecture, high-conversion service positioning, local schema markup, domain/DNS routing, and edge hosting deployment.",
        baseHours: 35,
        scaledHours: Math.round(35 * multiplier),
        value: Math.round((35 * multiplier * hourlyRate) / 1000) * 1000,
        severity: "CRITICAL",
      });
    }

    // 2. Digital State: Unlinked Google Business Profile
    if (params.isGbpDisconnected) {
      deliverables.push({
        id: "deliv-gbp-sync",
        title: "Google Maps CID Linkage & Local Knowledge Graph Sync",
        description:
          "Authoritative website linkage on Google Business Profile, LocalBusiness JSON-LD schema integration, and geographic 3-pack local authority synchronization.",
        baseHours: 8,
        scaledHours: Math.round(8 * multiplier),
        value: Math.round((8 * multiplier * hourlyRate) / 1000) * 1000,
        severity: "HIGH",
      });
    }

    // 3. Telemetry Findings (When website exists)
    if (params.hasWebsite && params.auditTelemetry) {
      const telemetry = params.auditTelemetry;
      const workflows = params.relevantWorkflows || {
        whatsAppIntake: true,
        appointmentBooking: true,
        ecommerceCart: false,
        rfqQuoteForm: false,
        saasDemoOrSignup: false,
        localGbpSync: true,
        mobileViewport: true,
        sslSecurity: true,
      };

      // Finding A: Insecure HTTP Protocol
      if (!telemetry.hasSsl) {
        deliverables.push({
          id: "deliv-ssl-security",
          title: "TLS/SSL Encryption & HSTS Protocol Hardening",
          description:
            "Provision automated SSL certificate, enforce HTTPS redirection, configure HSTS headers, and eliminate mixed-content browser security warnings.",
          baseHours: 3,
          scaledHours: Math.max(3, Math.round(3 * Math.min(multiplier, 2.0))),
          value: Math.max(isINR ? 3000 : 120, Math.round((3 * multiplier * hourlyRate) / 500) * 500),
          severity: "HIGH",
        });
      }

      // Finding B: Mobile Viewport & Horizontal Overflow
      if (!telemetry.viewportMetaPresent || telemetry.hasHorizontalOverflow) {
        deliverables.push({
          id: "deliv-responsive-viewport",
          title: "Mobile-First Responsive Layout & Viewport Containment",
          description:
            "CSS grid/flexbox refactoring, viewport meta injection, resolution of horizontal overflow leakage, and touch-target optimization for smartphone screens.",
          baseHours: 16,
          scaledHours: Math.round(16 * multiplier),
          value: Math.round((16 * multiplier * hourlyRate) / 1000) * 1000,
          severity: "CRITICAL",
        });
      }

      // Finding C: Missing 24/7 Online Booking (When relevant to business model)
      if (workflows.appointmentBooking && !telemetry.hasInteractiveBookingForm) {
        deliverables.push({
          id: "deliv-booking-funnel",
          title: "Interactive 24/7 Booking & Client Intake Architecture",
          description:
            "Automated appointment scheduling calendar, multi-provider availability management, real-time notification webhooks, and touch-friendly mobile intake.",
          baseHours: 18,
          scaledHours: Math.round(18 * multiplier),
          value: Math.round((18 * multiplier * hourlyRate) / 1000) * 1000,
          severity: "HIGH",
        });
      }

      // Finding D: Missing Direct 1-Tap Mobile Action Layer (When relevant)
      if (workflows.whatsAppIntake && !telemetry.hasDirectClickToCall && !telemetry.hasWhatsAppDirectLink) {
        deliverables.push({
          id: "deliv-mobile-intake-cta",
          title: "1-Tap Mobile Action Layer (Direct Call & WhatsApp)",
          description:
            "Floating smartphone conversion anchors, direct WhatsApp consultation trigger, and tel: protocol dialer integration for instantaneous mobile visitor capture.",
          baseHours: 4,
          scaledHours: Math.max(4, Math.round(4 * Math.min(multiplier, 2.0))),
          value: Math.max(isINR ? 4000 : 160, Math.round((4 * multiplier * hourlyRate) / 500) * 500),
          severity: "MEDIUM",
        });
      }

      // Finding E: Speed Degradation (>2500ms initial load latency)
      if (telemetry.initialLoadLatencyMs > 2500) {
        deliverables.push({
          id: "deliv-speed-cwv",
          title: "Core Web Vitals & Edge Asset Delivery Optimization",
          description:
            `Compression of heavy image assets, WebP conversion, critical CSS path inlining, and CDN caching to reduce load latency from ${telemetry.initialLoadLatencyMs}ms to <1.5s.`,
          baseHours: 8,
          scaledHours: Math.round(8 * multiplier),
          value: Math.round((8 * multiplier * hourlyRate) / 1000) * 1000,
          severity: "MEDIUM",
        });
      }

      // Finding F: Broken Internal Navigation Links
      if ((telemetry.brokenLinksCount ?? 0) > 0) {
        deliverables.push({
          id: "deliv-broken-links",
          title: "Navigation Routing Repair & 301 Redirect Architecture",
          description:
            `Resolution of ${telemetry.brokenLinksCount} dead-end internal links with permanent 301 redirection maps and custom branded 404 recovery page.`,
          baseHours: 5,
          scaledHours: Math.round(5 * multiplier),
          value: Math.round((5 * multiplier * hourlyRate) / 1000) * 1000,
          severity: "MEDIUM",
        });
      }
    }

    // 4. Fallback Deliverable if 0 gaps detected (Site is completely healthy or direct clean audit)
    if (deliverables.length === 0) {
      deliverables.push({
        id: "deliv-continuous-care",
        title: "Continuous UX Conversion & Infrastructure Optimization",
        description:
          "Periodic mobile layout auditing, monthly security patch validation, and conversion performance tuning.",
        baseHours: 6,
        scaledHours: Math.round(6 * multiplier),
        value: Math.round((6 * multiplier * hourlyRate) / 1000) * 1000,
        severity: "LOW",
      });
    }

    const totalBaseHours = deliverables.reduce((sum, d) => sum + d.baseHours, 0);
    const totalScaledHours = deliverables.reduce((sum, d) => sum + d.scaledHours, 0);
    const wbsFloorPrice = deliverables.reduce((sum, d) => sum + d.value, 0);
    const wbsCeilingPrice = Math.round((wbsFloorPrice * 1.25) / 1000) * 1000;

    // Construct Dynamic Scope Summary from Deliverable Titles
    const primaryTitles = deliverables.slice(0, 3).map((d) => d.title.split("&")[0].trim());
    const scopeSummary = primaryTitles.join(" + ") + (deliverables.length > 3 ? ` (+${deliverables.length - 3} technical enhancements)` : "");

    return {
      deliverables,
      totalBaseHours,
      totalScaledHours,
      scaleMultiplier: multiplier,
      wbsFloorPrice,
      wbsCeilingPrice,
      scopeSummary,
    };
  }
}
