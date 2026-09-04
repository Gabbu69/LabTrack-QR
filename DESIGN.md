---
name: AISAT Davao LabTrack QR
description: An AISAT Davao-inspired aviation laboratory tool-control station for fast, accountable handoffs.
colors:
  structure-navy: "#06344f"
  structure-navy-raised: "#07577f"
  aisat-flight-blue: "#20b0e0"
  institutional-silver: "#a3afb4"
  action-cobalt: "#0878ad"
  action-cobalt-deep: "#07577f"
  caution-yellow: "#f7c809"
  work-surface: "#f2f7fa"
  panel-white: "#ffffff"
  divider-silver: "#cbd2db"
  instrument-ink: "#15232c"
  secondary-ink: "#526671"
  serviceable-green: "#137c34"
  exception-orange: "#c94f06"
  active-violet: "#7047bc"
typography:
  display:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "clamp(2.375rem, 4.5vw, 3.625rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
    lineHeight: 1.55
  label:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  control: "5px"
  panel: "8px"
spacing:
  tight: "8px"
  control: "12px"
  panel: "22px"
  page: "34px"
components:
  button-primary:
    backgroundColor: "{colors.action-cobalt}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.action-cobalt-deep}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  content-card:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
---

# Design System: AISAT Davao LabTrack QR

## Overview

**Creative North Star: "The AISAT Flight-Line Tool Crib"**

LabTrack QR feels like an orderly AISAT Davao aviation laboratory issue counter translated into a browser: bright work surfaces, deep flight-blue structure, cyan aviation accents, and disciplined operational color. The school influence is recognizable without turning the product into a copy of the official crest or website.

The interface is an Operate surface. Hierarchy, large targets, clear custody states, and guided next actions take priority over decorative novelty. Industrial character comes from condensed headings, square controls, precise rules, and restrained instrument colors.

The institutional cues are based on the [official AISAT Davao website](https://aisat.edu.ph/) and its light-background logo: bright cyan-blue aviation geometry, neutral gray, black, and white. LabTrack uses a newly drawn aircraft silhouette inside QR scan corners rather than embedding or tracing the official logo.

**Key Characteristics:**

- Bright white and silver working surfaces held by a deep flight-blue frame
- AISAT cyan-blue for institutional identity; accessible blue for decisive actions
- An original aircraft-and-QR-corners mark paired with AISAT Davao and LabTrack QR
- Yellow reserved for warnings, focus, and demo identity
- Condensed operational headings paired with highly readable body text
- Icon-plus-text states and explicit recovery language
- Fluid desktop density with a single-column 390px mobile flow

## Colors

The palette is derived from AISAT Davao’s recognizable bright cyan-blue, neutral gray, black, and white identity, then deepened where needed for accessible controls and navigation. Token values in the frontmatter are normative.

**The Signal Discipline Rule.** Cyan communicates school identity, darker blue means action, yellow means attention, green means serviceable or complete, and orange/red means exception; never use semantic colors as decoration.

## Typography

**Display Font:** Saira Condensed with a sans-serif fallback  
**Body Font:** Inter Variable with a sans-serif fallback  
**Label/Mono Font:** system monospace only for immutable asset and transaction codes

Saira Condensed makes headings read like cabinet labels and control-station signage. Inter keeps forms, instructions, tables, and recovery messages comfortable at laptop and phone sizes.

**The Two-Voice Rule.** Use condensed type for headings, metrics, navigation, and status labels; use Inter for every sentence a user must comprehend.

## Layout

Desktop pages use a fixed structural rail and a fluid working area. The approved counter dashboard arranges inventory readiness, central actions, and live custody in three columns; other pages use a bounded working canvas with bordered panels and horizontally scrollable tables.

Below 1100px the rail condenses to icons and complex workflows become one column. At 720px and below, a labeled Menu exposes every role destination in a 48px-target dropdown, panels stack, forms use one column, and the document itself must never overflow horizontally. Primary controls remain at least 44px tall.

## Elevation & Depth

The system is flat by default. Silver borders, tonal white/silver layering, and navy framing create depth; shadows are reserved for transient overlays and the login icon offset, never routine cards.

**The Countertop Rule.** Operational cards sit on the work surface with borders, not floating ambient shadows.

## Shapes

Panels use gently industrial 8px corners; buttons and fields use tighter 5px corners. QR frames, scan corners, rules, and status dots keep the geometry crisp. Avoid pills except compact status chips where the contained state needs fast recognition.

## Components

### Buttons

- Primary buttons are cobalt, white, at least 44px high, and reserved for the next committed action.
- Secondary buttons are white with a steel/cobalt border.
- Focus uses a 3px caution-yellow outline with a 3px offset.

### Chips

Every status chip carries text and a dot or icon. Semantic background tints are pale enough to preserve black/dark text contrast.

### Cards / Containers

Panels are white with a silver 1px border and 8px corners. Standard page-card padding is 22px, with tighter padding in dense inventory and custody rows.

### Inputs / Fields

Fields are white with a steel 1px stroke, 5px corners, and at least 46px height. Labels remain visible; placeholders never carry the only instruction. Errors use text plus an icon in a bordered notice.

### Navigation

The desktop rail uses deep flight blue with icon-plus-text entries, a cyan leading line, and an accessible blue active state. Narrow desktop hides labels but preserves accessible names. Mobile uses a clearly labeled Menu containing every role destination.

### Guided Scanner

The scanner combines an explicit camera button, framed preview, image upload, and a persistent typed/USB input. Camera activation is never automatic. Borrow and Return use a three-step strip and a sticky reconciliation panel on wide screens.

## Do's and Don'ts

### Do:

- **Do** make the next physical action unmistakable.
- **Do** show asset codes in monospace and preserve their visual priority.
- **Do** pair every color state with text and, where useful, an icon.
- **Do** keep fictional records under the persistent yellow DEMO banner.
- **Do** keep the original flight mark visually distinct from the official AISAT logo.

### Don't:

- **Don't** turn the interface into a dark cockpit, neon scanner, or generic SaaS card grid.
- **Don't** embed scanners in the dashboard; route users into Borrow or Return.
- **Don't** infer missing status from an unscanned partial return.
- **Don't** use decorative motion that delays counter work or ignores reduced-motion preferences.
- **Don't** imply institutional endorsement or aviation regulatory approval.
