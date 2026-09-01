# DESIGN SYSTEM: Lead Engine (V1)
### Executive Command Center — 60-30-10 Color Palette & High-End Visual Rules

---

## 1. The 60-30-10 Color Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 60% DOMINANT CANVAS                                                         │
│ #06080D (OLED Void) & #090D18 (Subtle Spatial Gradients)                    │
│ Creates extreme depth, zero eye strain, and infinite contrast.              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 30% STRUCTURAL SECONDARY                                                    │
│ #0B101D & #0F1626 (Double-Bezel Hardware Enclosures & Glass Panels)        │
│ Hairline borders (border-white/[0.08]), inner shadow bevels, tabular mono.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 10% KINETIC ACCENT                                                          │
│ • Electric Indigo (#6366F1): Primary CTAs, active radar beams, scan pings   │
│ • Cyber Emerald (#10B981): 90+ Score radial glow, velocity pulses (GROWING) │
│ • Solar Amber (#F59E0B): "NO WEBSITE (HIGH-TICKET GAP)" priority alerts      │
│ • Crimson Rose (#F43F5E): Stale warnings & destructive controls             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Double-Bezel Hardware Architecture (Doppelrand)

All primary interactive components (Discovery Launchpad, Master Data Grid, Slide-over Pitch Studio) use the double-bezel technique:
- **Outer Shell**: `bg-white/[0.03]`, `border border-white/[0.08]`, `rounded-[1.75rem]`, `p-1.5`, `shadow-2xl`.
- **Inner Core**: `bg-[#0B101D]`, `border border-white/[0.05]`, `rounded-[1.375rem]`, `shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]`.

---

## 3. Button-in-Button Nested CTA Architecture

Primary actions feature nested interactive wrappers that scale and translate dynamically on hover:
- Main Button: `rounded-xl`, `bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600`, `active:scale-[0.98]`.
- Trailing Nested Icon: `w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5`.

---

## 4. Typography Matrix

- **Primary Body & Display**: `Inter` / `Geist Sans` with `-webkit-font-smoothing: antialiased`.
- **Metrics, Timestamps & Ratings**: `Fira Code` / `Geist Mono` (`font-mono`) with `tabular-nums` for zero layout shift during real-time sorting.
- **Eyebrow Headers**: `text-[10px] font-mono uppercase tracking-widest font-bold text-indigo-300`.
