---
name: Happier Chat
description: Chat with AI, happier every day.
colors:
  kiln-terracotta: "#c96442"
  kiln-terracotta-dark: "#d97757"
  on-terracotta: "#ffffff"
  cream-paper: "#faf9f5"
  sheet-white: "#ffffff"
  linen: "#f0eee6"
  linen-hover: "#ebe9df"
  sidebar-cream: "#f5f4ee"
  walnut-ink: "#3d3929"
  ash-muted: "#83827d"
  sand-border: "#e5e2d6"
  sand-input: "#dad6c8"
  brick-warning: "#b5452c"
  lamplit-ground: "#262624"
  lamplit-card: "#30302e"
  lamplit-ink: "#e5e3db"
  lamplit-muted: "#a3a199"
  lamplit-border: "#3e3d39"
  lamplit-sidebar: "#1f1e1d"
  lamplit-bubble: "#141413"
  lavender-chart: "#9c87f5"
typography:
  display:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 300
    lineHeight: 1.1
  headline:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  reply:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "calc(1.03125rem * var(--chat-font-scale))"
    fontWeight: 400
    lineHeight: 1.7
  chat:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "calc(0.9375rem * var(--chat-font-scale))"
    fontWeight: 400
    lineHeight: 1.625
  title:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "7.2px"
  md: "9.6px"
  lg: "12px"
  xl: "16.8px"
  2xl: "21.6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.kiln-terracotta}"
    textColor: "{colors.on-terracotta}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
    typography: "{typography.body}"
  button-outline:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.linen}"
  button-ghost:
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.linen}"
  button-destructive:
    textColor: "{colors.brick-warning}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  input:
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  user-bubble:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.walnut-ink}"
    typography: "{typography.chat}"
    rounded: "{rounded.2xl}"
    padding: "10px 16px"
  assistant-reply:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.walnut-ink}"
    typography: "{typography.reply}"
    rounded: "{rounded.2xl}"
    padding: "12px 16px"
  composer:
    backgroundColor: "{colors.sheet-white}"
    rounded: "{rounded.2xl}"
    typography: "{typography.chat}"
  card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge:
    backgroundColor: "{colors.kiln-terracotta}"
    textColor: "{colors.on-terracotta}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
    typography: "{typography.label}"
  sidebar-item:
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.md}"
    padding: "8px"
    height: "32px"
  sidebar-item-active:
    backgroundColor: "{colors.linen-hover}"
---

# Design System: Happier Chat

## Overview

**Creative North Star: "The Warm Study"**

Happier Chat feels like a quiet reading room with good light. Warm cream paper is the ground, walnut-brown ink carries the text, and one kiln-fired terracotta accent marks what you can act on. The assistant answers in a book serif, so a reply reads like a page someone wrote for you, while the interface around it (composer, sidebar, settings) speaks in a calm, neutral sans. Night mode is the same room after dark: lamplit charcoal, warm grey ink, and terracotta that glows a little brighter.

Density is relaxed but not sparse. The conversation sits in a centred column with generous line height, and the chrome steps back so the reply and the generative cards lead. Depth comes from tone (cream ground, white sheets, linen bubbles) and hairline sand borders, not from shadows. Components are soft and restrained: medium radii, thin borders, near-zero lift, and quick color-only hover changes.

The system rejects three looks: neon or gradient "AI" styling (glowing purple-blue, glassmorphism), cold enterprise dashboards (blue-grey, dense, clinical), and childish playfulness (candy colors, mascots, over-rounded blobs). "Happier" is carried by warmth, clarity, and small, considered motion, never by decoration.

**Key Characteristics:**
- Warm cream / walnut / terracotta palette; every neutral leans warm.
- Serif for the assistant's voice and display moments; sans for everything the user operates.
- Flat, tonal layering with hairline borders; shadows only for floating layers.
- One accent, used sparingly for actions, focus, and live states (speaking, active).
- User-adjustable: chat text scales with `--chat-font-scale`, and users may override every color token in Appearance settings.

## Colors

A warm, paper-and-clay palette: one terracotta accent over cream and walnut neutrals, mirrored into a lamplit dark mode.

### Primary
- **Kiln Terracotta** (light `kiln-terracotta`, dark `kiln-terracotta-dark`): primary buttons, focus rings, the logo mark, active toggles, links, the speaking-word underline and the `[data-speaking]` highlight (at 14% mix). Also chart series 1.
- **On Terracotta** (`on-terracotta`): text and icons sitting on terracotta, in both modes.

### Secondary
- **Lavender** (`lavender-chart`): chart series 2 only. Not a UI accent.

### Neutral
- **Cream Paper** (`cream-paper`): app background in light mode.
- **Sheet White** (`sheet-white`): cards, popovers, the composer, and assistant reply bubbles; sits one tone above the cream ground.
- **Linen** (`linen`): user message bubbles, secondary buttons, muted fills.
- **Linen Hover** (`linen-hover`): hover and active fills, the active sidebar item.
- **Sidebar Cream** (`sidebar-cream`): sidebar ground, a half-step darker than the page.
- **Walnut Ink** (`walnut-ink`): primary text. Never pure black.
- **Ash Muted** (`ash-muted`): secondary text, placeholders, timestamps, scrollbar thumbs (at 35% mix).
- **Sand Border** (`sand-border`) and **Sand Input** (`sand-input`): hairline borders and form field strokes.
- **Brick Warning** (`brick-warning`): destructive actions and errors, mostly as a 10% tint with brick text rather than a solid fill.
- **Lamplit** family (`lamplit-ground`, `lamplit-card`, `lamplit-ink`, `lamplit-muted`, `lamplit-border`, `lamplit-sidebar`, `lamplit-bubble`): the dark-mode equivalents. In dark mode the user bubble drops to the deepest tone (`lamplit-bubble`) instead of rising, so the user's words recede and the reply card stays the brightest surface.

### Named Rules
**The One Clay Rule.** Terracotta is the only UI accent. It marks actions, focus, and live state; it never fills large areas or decorates.

**The Warm Neutral Rule.** Every neutral leans yellow-brown. No cool greys, no blue-greys, no `#000` or `#fff` text on the page ground.

**The User's Palette Rule.** All color tokens are user-overridable (`src/lib/custom-colors.ts`). New UI must read colors from tokens (`bg-primary`, `bg-card`, `text-muted-foreground`, `border-border`), never hard-code hex, so custom palettes keep working.

## Typography

**Display Font:** Source Serif 4 Variable (with Georgia, serif)
**Body Font:** Geist Variable (with sans-serif)

**Character:** A literary serif gives the assistant a voice worth reading; a clean geometric sans keeps the controls quiet and precise. The serif speaks, the sans operates.

### Hierarchy
- **Display** (300, 2.25rem, 1.1): the empty-state greeting on a new chat. Light weight, centred.
- **Headline** (400, 1.875rem, 1.2, tight tracking): auth page titles, the headword on word-learning cards (semibold there).
- **Reply** (400, 1.03125rem × chat scale, 1.7): every assistant reply. Serif, generous leading, capped by the 85% bubble width inside a `max-w-4xl` column.
- **Chat** (400, 0.9375rem × chat scale, 1.625): the user's messages and the composer textarea. Sans.
- **Title** (500, 1rem, 1.375): card titles, settings section titles.
- **Body** (400, 0.875rem, 1.43): UI text, buttons, menus, form fields (16px on mobile inputs to prevent zoom).
- **Label** (500, 0.75rem): badges, small meta, extra-small buttons.

### Named Rules
**The Two Voices Rule.** Serif belongs to the assistant and to display moments (greeting, brand wordmark in the sidebar, auth titles, word cards). Controls, menus, settings, and user input are always sans.

**The Reader's Scale Rule.** Conversation text uses `text-reply` / `text-chat`, which follow the user's font-scale setting. Never set conversation text in fixed sizes.

## Layout

- **App shell:** collapsible left sidebar (16rem wide, 3rem as an icon rail, an 18rem sheet on mobile) beside a single conversation column.
- **Conversation column:** centred, `max-w-4xl` with 24px side padding; message groups separated by 24px. The composer is pinned to the bottom in the same column width with 16px padding.
- **Bubbles:** user messages align right, assistant replies left, both capped at 85% of the column. Generative cards sit in the assistant's lane.
- **Empty state:** a narrower `max-w-2xl` column, vertically centred with the greeting above the composer, lifted by a 12vh bottom pad.
- **Spacing rhythm:** 4px base; 8 / 12 / 16 / 24 are the working steps. Controls are compact (32px default height, 28px small, 24px extra-small).
- **Breakpoint:** a single mobile breakpoint at 768px switches the sidebar to a sheet and inputs to 16px text.
- **Print:** the print editor renders an A4 sheet (210mm, 15mm padding) with a neutral paper palette that overrides the theme tokens.

## Elevation & Depth

Flat, tonal layering. Surfaces separate by tone (cream ground → white sheet → linen bubble) and by hairline sand borders or a 1px `foreground/10` ring on cards. Message bubbles carry only `shadow-xs` to lift them off the page by a hair. The composer has a very soft ambient glow. Real shadows (`shadow-md` / `shadow-lg`) are reserved for floating layers: popovers, menus, dialogs, sheets.

### Shadow Vocabulary
- **Hairline lift** (`shadow-xs`): user and assistant message bubbles.
- **Composer glow** (`box-shadow: 0 0.25rem 1.25rem rgba(0,0,0,0.04)`): the chat input group only.
- **Floating layer** (`shadow-md` / `shadow-lg`): popovers, dropdowns, dialogs, sheets.
- **Speaking halo** (`box-shadow: 0 0 0 0.25rem color-mix(in oklab, var(--primary) 14%, transparent)`): the paragraph currently being read aloud.

### Named Rules
**The Flat-By-Default Rule.** Surfaces at rest are flat. A shadow means "this floats above the page", and nothing in the page flow floats.

## Shapes

Gently rounded throughout, derived from a single `--radius` of 0.75rem (12px): sm 7.2px, md 9.6px, lg 12px, xl 16.8px, 2xl 21.6px. Buttons and inputs use lg; cards use xl; message bubbles and the composer use 2xl. Bubbles cut one corner tighter (`rounded-br-md` for the user, `rounded-bl-md` for the assistant) to point toward their speaker. Badges and reaction pills are fully round. Borders are 1px hairlines; no heavy strokes.

The logo is a twelve-petal flower that turns 120° on hover. It is the one organic, ornamental form in the system.

## Components

### Buttons
Soft and restrained: compact, color-only transitions, a 1px press-down on active.
- **Shape:** gently rounded (12px); small sizes cap at 10–12px.
- **Primary:** terracotta fill, white text, 32px tall, 10px horizontal padding, 14px medium text. Hover drops to 80% opacity.
- **Outline:** cream ground with a sand border; hover fills linen.
- **Secondary:** linen fill; hover darkens 5% toward ink.
- **Ghost:** transparent; hover fills linen. The default for toolbar and message actions.
- **Destructive:** 10% brick tint with brick text, never a solid red fill.
- **Focus:** border shifts to terracotta plus a 3px terracotta ring at 50%.
- **Disabled:** 50% opacity, no pointer events.

### Chips / Badges
- **Style:** fully round pills, 20px tall, 12px medium text. Default is terracotta; secondary is linen; outline uses a sand border.
- **Reactions:** emoji pills on bubble edges, muted fill with a 3px card-colored ring to cut them out of the bubble.

### Cards / Containers
- **Corner Style:** 16.8px (xl).
- **Background:** sheet white (`card`).
- **Shadow Strategy:** none; a 1px ink ring at 10% opacity.
- **Internal Padding:** 16px (12px in the small size). Footers sit on a 50% muted band with a top hairline.

### Inputs / Fields
- **Style:** 1px sand-input stroke, transparent fill (input at 30% in dark), 12px radius, 32px tall.
- **Focus:** terracotta border plus 3px terracotta ring at 50%.
- **Error:** brick border and a 20% brick ring. **Disabled:** 50% opacity on a filled ground.

### Navigation (Sidebar)
- **Style:** sidebar-cream ground, 32px items with 9.6px radius, 14px text, 16px icons.
- **States:** hover and active fill with linen-hover; the active item also turns medium weight.
- **Brand:** the flower logo with the "Happier Chat" wordmark in serif (18px, medium, tight tracking).
- **Mobile:** below 768px the sidebar becomes an 18rem sheet.

### Message Bubbles (Signature)
- **User:** linen bubble, sand border, `shadow-xs`, 21.6px radius with a tighter bottom-right corner, sans chat text, 10px × 16px padding, right-aligned.
- **Assistant:** white sheet bubble, sand border, `shadow-xs`, tighter bottom-left corner, serif reply text at 1.7 leading, 12px × 16px padding.
- **Speaking:** the paragraph being read aloud gets a 14% terracotta wash and halo; the current word is underlined in terracotta.

### Composer (Signature)
A white, 21.6px-radius input group with a sand border and a very soft ambient glow. The textarea grows with content (to 15rem) in chat text size. Model picker, settings menu, and project picker sit in its footer as ghost controls. Focus does not add a ring; the border simply firms up.

### Generative Cards
Weather, map, and word-learning cards render inside the assistant lane using `card` surfaces and tokens. Word cards lead with a serif headword (1.875rem semibold) and use tabs, skeleton loading, and a speak button.

## Do's and Don'ts

### Do:
- **Do** read every color from tokens (`primary`, `card`, `muted`, `border`…) so user palettes and dark mode keep working.
- **Do** set assistant output in Source Serif 4 at `text-reply` with 1.7 leading, and user input in Geist at `text-chat`.
- **Do** separate surfaces by tone and 1px sand borders; reserve `shadow-md` and above for floating layers.
- **Do** keep terracotta for actions, focus, and live state.
- **Do** honor `prefers-reduced-motion`; motion is short (200–380ms) with `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Do** design every string slot for more than two languages and longer translations.

### Don't:
- **Don't** use neon, purple-blue gradients, glows, or glassmorphism.
- **Don't** drift into a cold enterprise dashboard: no blue-grey neutrals, no dense data-grid chrome in the conversation.
- **Don't** go childish: no candy colors, mascots, or over-rounded blob shapes.
- **Don't** introduce a second UI accent color; lavender is for charts only.
- **Don't** hard-code hex values or fixed font sizes for conversation text.
- **Don't** use solid red fills for destructive actions; use the brick tint.
