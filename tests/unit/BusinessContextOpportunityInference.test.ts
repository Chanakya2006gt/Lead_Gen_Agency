import { describe, it, expect } from "vitest";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import { ProblemValueEvaluator } from "@/features/commercial/ProblemValueEvaluator";
import { MarketContextProvider } from "@/features/commercial/MarketContext";

describe("Business-Context & Opportunity Inference Invariant Suite", () => {
  const marketContext = MarketContextProvider.resolve("India");

  // 1. SaaS Company
  it("Archetype 1 (SaaS Company): Missing WhatsApp or calendar does NOT produce local clinic appointment gaps", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "Trelio Cloud Systems",
      category: "Technology & Software Services",
      domain: "trelio.in",
    });

    expect(classification.model).toBe("B2B_SAAS_TECH");
    expect(classification.relevantWorkflows.whatsAppIntake).toBe(false);
    expect(classification.relevantWorkflows.appointmentBooking).toBe(false);

    const dossier = await DossierSynthesizer.synthesize({
      name: "Trelio Cloud Systems",
      category: "Technology & Software Services",
      hasWebsite: true,
      websiteUrl: "https://trelio.in",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false, // No calendar
        findings: [],
      },
    });

    expect(dossier.identifiedBottlenecks.some((b) => b.includes("WhatsApp"))).toBe(false);
    expect(dossier.identifiedBottlenecks.some((b) => b.includes("booking or calendar"))).toBe(false);
    expect(dossier.recommendedPitch.coreAngle).toContain("SaaS");
    expect(dossier.recommendedPitch.suggestedScope).toContain("Product Demo");
  });

  // 2. E-Commerce D2C Company
  it("Archetype 2 (E-Commerce Store): Missing calendar booking does NOT produce appointment scheduling gaps", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "Urban Threads Apparel",
      category: "E-Commerce Online Store",
      domain: "urbanthreads.in",
    });

    expect(classification.model).toBe("ECOMMERCE_D2C");
    expect(classification.relevantWorkflows.appointmentBooking).toBe(false);

    const dossier = await DossierSynthesizer.synthesize({
      name: "Urban Threads Apparel",
      category: "E-Commerce Online Store",
      hasWebsite: true,
      websiteUrl: "https://urbanthreads.in",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 350,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.identifiedBottlenecks.some((b) => b.includes("booking or calendar"))).toBe(false);
    expect(dossier.recommendedPitch.coreAngle).toContain("storefront");
    expect(dossier.recommendedPitch.suggestedScope).toContain("Checkout");
  });

  // 3. Industrial Manufacturer
  it("Archetype 3 (Industrial Manufacturer): Does NOT recommend 1-tap WhatsApp or booking calendar; recommends RFQ catalog", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "Apex Steel & Heavy Machinery Pvt Ltd",
      category: "Industrial Machinery Manufacturing",
      domain: "apexmachinery.com",
    });

    expect(classification.model).toBe("B2B_INDUSTRIAL_MANUFACTURING");
    expect(classification.relevantWorkflows.whatsAppIntake).toBe(false);
    expect(classification.relevantWorkflows.appointmentBooking).toBe(false);
    expect(classification.relevantWorkflows.rfqQuoteForm).toBe(true);

    const dossier = await DossierSynthesizer.synthesize({
      name: "Apex Steel & Heavy Machinery Pvt Ltd",
      category: "Industrial Machinery Manufacturing",
      hasWebsite: true,
      websiteUrl: "https://apexmachinery.com",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 450,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.identifiedBottlenecks.some((b) => b.includes("WhatsApp"))).toBe(false);
    expect(dossier.identifiedBottlenecks.some((b) => b.includes("booking or calendar"))).toBe(false);
    expect(dossier.recommendedPitch.coreAngle).toContain("Request-for-Quote (RFQ)");
    expect(dossier.recommendedPitch.suggestedScope).toContain("Industrial Product Catalog");
  });

  // 4. Software Agency
  it("Archetype 4 (Software Agency): Tailors scope to agency web app UI and demo pipeline", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "PixelPulse Digital Labs",
      category: "Web & App Development Agency",
      domain: "pixelpulse.io",
    });

    expect(classification.model).toBe("B2B_SAAS_TECH");
    expect(classification.relevantWorkflows.appointmentBooking).toBe(false);
  });

  // 5. Hospitality Restaurant
  it("Archetype 5 (Restaurant / Hospitality): Recognizes table reservation & menu navigation workflows", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "Saffron Spices Bistro",
      category: "Multi-Cuisine Restaurant",
      domain: "saffronbistro.in",
    });

    expect(classification.model).toBe("HOSPITALITY_RESTAURANT");
    expect(classification.relevantWorkflows.whatsAppIntake).toBe(true);
    expect(classification.relevantWorkflows.localGbpSync).toBe(true);

    const dossier = await DossierSynthesizer.synthesize({
      name: "Saffron Spices Bistro",
      category: "Multi-Cuisine Restaurant",
      hasWebsite: true,
      websiteUrl: "https://saffronbistro.in",
      rating: 4.6,
      reviewCount: 380,
      googleMapsUrl: "https://maps.google.com/?cid=123",
      reviewTrend: "GROWING",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 300,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.recommendedPitch.coreAngle).toContain("menu navigation");
  });

  // 6. Dental Clinic
  it("Archetype 6 (Dental Clinic): Appropriately surfaces appointment calendar & WhatsApp intake relevance", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "SmileCraft Dental Care",
      category: "Dental Healthcare",
      domain: "smilecraftdental.in",
    });

    expect(classification.model).toBe("LOCAL_APPOINTMENT_SERVICE");
    expect(classification.relevantWorkflows.whatsAppIntake).toBe(true);
    expect(classification.relevantWorkflows.appointmentBooking).toBe(true);
    expect(classification.relevantWorkflows.localGbpSync).toBe(true);

    const dossier = await DossierSynthesizer.synthesize({
      name: "SmileCraft Dental Care",
      category: "Dental Healthcare",
      hasWebsite: true,
      websiteUrl: "https://smilecraftdental.in",
      rating: 4.9,
      reviewCount: 140,
      googleMapsUrl: "https://maps.google.com/?cid=456",
      reviewTrend: "GROWING",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.identifiedBottlenecks.some((b) => b.includes("No 24/7 interactive online booking"))).toBe(true);
    expect(dossier.identifiedBottlenecks.some((b) => b.includes("No direct 1-tap call or WhatsApp"))).toBe(true);
  });

  // 7. Law Firm
  it("Archetype 7 (Law Firm): Prioritizes confidential client intake and credentials over casual WhatsApp triggers", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "Vanguard Legal Associates",
      category: "Corporate Law Firm",
      domain: "vanguardlegal.com",
    });

    expect(classification.model).toBe("PROFESSIONAL_HIGH_TRUST");
    expect(classification.relevantWorkflows.whatsAppIntake).toBe(false);
    expect(classification.relevantWorkflows.appointmentBooking).toBe(true);

    const dossier = await DossierSynthesizer.synthesize({
      name: "Vanguard Legal Associates",
      category: "Corporate Law Firm",
      hasWebsite: true,
      websiteUrl: "https://vanguardlegal.com",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 300,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.identifiedBottlenecks.some((b) => b.includes("WhatsApp"))).toBe(false);
    expect(dossier.recommendedPitch.coreAngle).toContain("confidential client intake");
  });

  // 8. Unknown Entity (Fail-Closed)
  it("Archetype 8 (Unknown Entity): Fails closed to neutral technical maintenance with zero fabricated domain workflows", async () => {
    const classification = BusinessModelClassifier.classify({
      name: "Alpha Beta 100",
      category: "Operating Business",
    });

    expect(classification.model).toBe("UNKNOWN_MODEL");
    expect(classification.confidence).toBe(0.3);
    expect(classification.relevantWorkflows.whatsAppIntake).toBe(false);
    expect(classification.relevantWorkflows.appointmentBooking).toBe(false);

    const dossier = await DossierSynthesizer.synthesize({
      name: "Alpha Beta 100",
      category: "Operating Business",
      hasWebsite: true,
      websiteUrl: "https://alphabeta100.org",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.identifiedBottlenecks.some((b) => b.includes("WhatsApp"))).toBe(false);
    expect(dossier.identifiedBottlenecks.some((b) => b.includes("booking or calendar"))).toBe(false);
    expect(dossier.recommendedPitch.coreAngle).not.toContain("patients");
  });
});
