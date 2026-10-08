---
name: Mauze Tahfeez Atfal
description: Sacred Illumination design system for Quran memorization, daily jadwal, and madrasah management
colors:
  primary: "#c5a059"
  primary-accent: "#d4af37"
  primary-dark: "#8a6515"
  primary-light: "#f9f4e8"
  secondary-brown: "#3d2b1f"
  secondary-soft: "#6d4c41"
  neutral-bg: "#fcfaf5"
  neutral-surface: "#ffffff"
  neutral-parchment: "#f7f3eb"
  neutral-text: "#2c1e14"
  neutral-muted: "#8d7362"
  tajweed-ghunnah: "#ff5722"
  tajweed-qalqalah: "#2196f3"
  tajweed-madda: "#e91e63"
  tajweed-ikhfa: "#9c27b0"
  tajweed-idgham: "#4caf50"
  status-success: "#2e7d32"
  status-error: "#ef5350"
typography:
  display:
    fontFamily: "Cinzel, 'Plus Jakarta Sans', serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  headline:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
    fontSize: "clamp(1.5rem, 3.5vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-ghost:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  card-surface:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Mauze Tahfeez Atfal

## Overview

**Creative North Star: "The Sacred Illumination"**

The Mauze Tahfeez Atfal design language balances sacred institutional reverence with modern tactile clarity. Rooted in traditional Fatemi aesthetics—warm hand-finished parchment, luminous antique gold, and deep espresso walnut—the system avoids both sterile corporate SaaS dryness and oversaturated neon dashboards. Every surface is sculpted to feel luminous, authentic, and peaceful, fostering focus during intense Quranic memorization and study.

Surfaces use gentle claymorphic depth, translucent glass accents, and warm golden highlights rather than stark drop shadows or harsh dividers. The layout is optimized for rapid classroom workflows on mobile and tablet screens, offering large, confident touch targets for teachers while providing parents and students with delightful, easy-to-read progress cards and spiritual calendar milestones.

**Key Characteristics:**
- **Luminous Warmth**: Cream parchment backgrounds (`#fcfaf5`), radiant gold gradients, and deep espresso text.
- **Tactile Claymorphism**: Soft, pillowy 18px–26px corner radii paired with subtle inner highlights and warm ambient shadows.
- **Sacred Typography**: Classical majestic serif display headers (`Cinzel`), crisp modern geometric sans for UI density (`Outfit` / `Plus Jakarta Sans`), and authentic Quranic calligraphy (`Kanz al Marjaan`).
- **High-Velocity Ergonomics**: Optimized touch targets, zero-distraction layout, and instant visual state feedback.

## Colors

The palette combines warm organic neutrals, sacred gold accents, and authoritative deep earth tones, supplemented by precise functional colors for Tajweed rules and student attendance.

### Primary
- **Primary Gold** (#c5a059): The foundational brand gold, used for active navigational states, primary action buttons, key metrics, and celebratory highlights.
- **Accent Radiant Gold** (#d4af37): High-luminance gold for focus rings, shimmer gradients, star ratings, and celebratory badges.
- **Dark Gold** (#8a6515): Grounded ochre gold for high-contrast borders, active hover states, and small icon accents.
- **Light Gold / Cream Glow** (#f9f4e8): Luminous background tint for selected items, hover states, and subtle badge containers.

### Secondary
- **Deep Espresso Brown** (#3d2b1f): Authoritative, rich grounding color for hero headers, primary typography, and dark administrative surfaces.
- **Soft Walnut Brown** (#6d4c41): Warm secondary text, subtle borders, and contextual labels.

### Neutral
- **Cream Canvas** (#fcfaf5): Base background color across all app screens, preventing eye strain and evoking traditional manuscript parchment.
- **Pure White Surface** (#ffffff): Card surfaces, modal sheets, and interactive input backgrounds.
- **Warm Parchment** (#f7f3eb): Secondary surface backgrounds, inactive tab rails, and inner container wells.
- **Main Text** (#2c1e14): Primary body and title color delivering optimal legibility against cream and white.
- **Muted Text** (#8d7362): Secondary captions, timestamps, and placeholder labels.

### Functional & Tajweed
- **Tajweed Ghunnah / Warning** (#ff5722): Nasalization rules and non-blocking warnings.
- **Tajweed Qalqalah / Info** (#2196f3): Echo/vibration rules and informational alerts.
- **Tajweed Madda** (#e91e63): Prolongation markers and special memorization targets.
- **Tajweed Ikhfa** (#9c27b0): Concealment rules and secondary category tags.
- **Tajweed Idgham / Success** (#4caf50 / #2e7d32): Assimilation rules, completed Juz/Surah status, and present attendance.
- **Status Error / Absent** (#ef5350): Incomplete requirements, absent status, and critical form errors.

### Named Rules
**The Sacred Accent Rule.** Gold is a beacon, not a background fill. Solid gold backgrounds are reserved for primary action triggers and milestone achievements; ambient cards remain cream or white with gold perimeter illumination.

**The No-Cold-Gray Rule.** Never use pure `#808080` or cold slate gray. All muted tones and borders must carry warm walnut (`#8d7362`) or golden amber undertones.

## Typography

**Display Font:** `Cinzel, serif` (Fallback: `'Times New Roman', serif`)
**UI / Headline / Body Font:** `'Outfit', 'Plus Jakarta Sans', sans-serif` (Fallback: `'Inter', system-ui, sans-serif`)
**Quranic Arabic Font:** `'Kanz al Marjaan', 'Al-Kanz', serif` (Fallback: `'Scheherazade New', 'Amiri', serif`)

**Character:** A dignified dialogue between timeless imperial serif titles, ultra-clean contemporary geometric sans-serif data displays, and authentic Arabic Quranic calligraphy.

### Hierarchy
- **Display** (Bold 700, `clamp(2rem, 5vw, 3rem)`, line-height 1.2): Screen titles, hero welcome headers, and major milestone achievements.
- **Headline** (Bold 700, `clamp(1.5rem, 3.5vw, 2rem)`, line-height 1.3): Section headers, modal titles, and student names.
- **Title** (SemiBold 600, `1.25rem`, line-height 1.4): Card headings, Jadwal block labels, and table column titles.
- **Body** (Regular 400 & Medium 500, `1rem`, line-height 1.6): Narrative notes, teacher comments, and descriptions.
- **Label** (SemiBold 600, `0.875rem`, letter-spacing `0.04em`): Badges, chip tags, button text, and metadata keys.
- **Quranic Verse** (Regular 400, `2.2rem`, line-height 2.8, `direction: rtl`): Holy Quran text with dedicated Tajweed color annotations.

### Named Rules
**The Quranic Integrity Rule.** Arabic Quranic verses must never be displayed below `1.8rem` on mobile and must maintain at least `2.5` line-height with correct right-to-left directional isolation.

## Layout

The spatial rhythm is built around an 8px base grid (`8px`, `16px`, `24px`, `32px`, `48px`).

- **Application Shell**: Sticky top navigation bar (`64px` height) with responsive safe-area inset support (`env(safe-area-inset-top)`), desktop fixed sidebar (`280px` width), and mobile bottom navigation dock (`72px` height).
- **Responsive Grid**:
  - Desktop (>1024px): 3-column / 4-column cards grid with maximum container width `1440px`.
  - Tablet (640px–1024px): 2-column adaptive flow with `16px` gutters.
  - Mobile (<640px): Single-column stacked cards with edge-to-edge padding (`16px`).
- **Safe Area Insets**: All topbars and fixed navigation docks respect mobile notches and home indicator bars (`--safe-top`, `--safe-bottom`).

## Elevation & Depth

The system uses a warm layered depth model combining claymorphic pillowed containers, translucent frosted glass overlays, and soft amber-tinted ambient drops.

### Shadow Vocabulary
- **Ambient Card Shadow** (`box-shadow: 0 12px 40px rgba(61, 43, 31, 0.08)`): Standard resting elevation for white content cards.
- **Gold Hover Glow** (`box-shadow: 0 8px 24px rgba(197, 160, 89, 0.25)`): Active elevation on hovered buttons, focused cards, and interactive chips.
- **Hero Elevation** (`box-shadow: 0 20px 50px rgba(74, 52, 16, 0.35), inset 0 2px 0 rgba(249, 231, 193, 0.35)`): Rich 3D depth for header banners and premium announcement panels.
- **Glass Panel Surface** (`background: rgba(255, 255, 255, 0.88); backdrop-filter: blur(16px); border: 1px solid rgba(197, 160, 89, 0.2)`): Floating drawers, popups, and sticky header bars.

### Named Rules
**The Warm Glow Rule.** Elevation is signaled by warm brown ambient diffusion and subtle golden inner rim highlights rather than harsh black drop shadows.

## Shapes

- **Base Form Language**: Soft, welcoming squircles and smooth rounded rectangles.
- **Corner Radii Scale**:
  - `sm` (6px): Small tags, inline tooltips, and table cell badges.
  - `md` (12px): Standard form inputs, dropdown select boxes, and secondary buttons.
  - `lg` (18px): Compact cards, interactive Jadwal blocks, and modal action sheets.
  - `xl` (24px–26px): Main feature cards, hero containers, and student progress overviews.
  - `pill` (9999px): Primary CTA pills, filter chips, and attendance status indicators.
- **Borders**: Translucent hairline borders (`1px solid rgba(197, 160, 89, 0.2)`) provide gentle definition against cream backgrounds.

## Components

### Buttons
- **Shape**: Rounded squircle (`12px` radius) or full pill (`9999px` radius).
- **Primary Action**: Gradient background (`linear-gradient(135deg, #d4af37 0%, #c5a059 100%)`), crisp white or deep espresso text, padding `12px 24px`, bold typography.
- **Hover / Focus**: `transform: translateY(-2px); box-shadow: 0 8px 24px rgba(197, 160, 89, 0.35);`.
- **Secondary / Ghost**: Background `rgba(249, 244, 232, 0.8)`, border `1px solid rgba(197, 160, 89, 0.4)`, text `var(--dark-gold)`.

### Cards & Infographic Containers
- **Corner Style**: `22px` to `26px` smooth border-radius.
- **Background**: Claymorphic pure white (`#ffffff`) or frosted cream (`rgba(255, 255, 255, 0.92)`).
- **Border**: Subtle warm gold border `1px solid rgba(197, 160, 89, 0.18)`.
- **Padding**: `20px` to `28px` internal breathing room.

### Inputs & Select Fields
- **Style**: Background `#ffffff`, border `1.5px solid rgba(197, 160, 89, 0.25)`, radius `12px`, padding `12px 16px`.
- **Focus**: `border-color: #c5a059; box-shadow: 0 0 0 4px rgba(197, 160, 89, 0.2); outline: none;`.

### Chips & Badges
- **Style**: Compact pill (`9999px`), padding `6px 14px`, uppercase or bold label (`0.8125rem`).
- **Variants**: Present/Complete (emerald tint), Absent/Pending (soft red tint), Miqaat/Special (radiant gold tint).

### Navigation
- **Desktop Sidebar**: Espresso & gold ambient glass (`#3d2b1f` / `#2c1e14`), gold active indicators, smooth hover transitions.
- **Mobile Bottom Nav**: Frosted glass surface, large touch icons with active gold glow and subtle haptic micro-bounce.

## Do's and Don'ts

### Do:
- **Do** use warm cream (`#fcfaf5`) as the standard canvas backdrop for all content screens.
- **Do** preserve the golden accent hierarchy: reserve solid gold fills for primary user goals and celebratory milestones.
- **Do** ensure all interactive inputs and buttons have at least `48px` minimum touch target height on mobile screens.
- **Do** render Quranic Arabic text in dedicated large serif fonts (`Kanz al Marjaan` / `Al-Kanz`) with ample line height.
- **Do** use warm espresso (`#3d2b1f`) and walnut (`#6d4c41`) for typography and iconography instead of pure black or cool slate.

### Don't:
- **Don't** use stark pure black (`#000000`) or cold blue-gray shadows.
- **Don't** crowd teacher data entry screens with decorative clutter; keep daily Jadwal workflows rapid and clean.
- **Don't** use square, sharp-cornered (0px) rectangular boxes for primary cards or buttons.
- **Don't** apply low-contrast gray text on cream or gold backgrounds; maintain WCAG AA contrast.
- **Don't** mix discordant neon accents (e.g. electric cyan or hot magenta) into the sacred gold-and-espresso palette.
