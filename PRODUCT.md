# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Members of the public who sign up for an account and chat with AI models through providers they configure themselves. They use it on desktop and on mobile browsers, for everyday questions, research, and learning (notably vocabulary and languages). Admins manage users, roles, and the model catalog.

## Product Purpose

Happier Chat is a public AI chat client: "chat with AI, happier every day" ("Trò chuyện cùng AI, vui hơn mỗi ngày"). It aims to give a better user experience than ChatGPT and Claude, to support learning better than they do, and to let people customize far more. Success means users pick it over first-party chat apps for daily use and for learning.

## Positioning

- **Bring your own provider:** each user connects their own Anthropic, OpenAI, OpenRouter, OpenCode Go, or custom endpoint with their own API key, and picks models from the catalog.
- **Generative UI instead of plain text:** tools render rich cards inside the conversation (weather, maps, word-learning cards with images and pronunciation, message reactions, web search and page fetch).
- **Customizable:** appearance, display, chat, voice, and language settings; per-project instructions.
- **Built for learning:** `learn_word` cards, text-to-speech, and control over which languages the assistant replies in.

## Operating Context

- Account flow: sign up / log in, then onboard a provider before chatting.
- Conversations are threads, optionally grouped into projects that carry their own instructions.
- Composer offers model picker, effort/settings menu, and project picker.
- Conversations can be edited (erase / edit text) and printed through the print editor.
- Developer-facing panels exist (AG-UI inspector, debug panel, chat stats, conversation minimap).
- Admin area: users and roles, model catalog.

## Capabilities and Constraints

- Stack: TanStack Start + React 19, TanStack AI (Anthropic/OpenAI adapters, durable streams), Tailwind v4, Base UI / shadcn components, Tabler icons, Streamdown for Markdown, SQLite (`node:sqlite`) on the server.
- Provider API keys are stored encrypted server-side; signup is rate-limited.
- Bilingual UI (Vietnamese and English), Vietnamese is the default. Locale lives in a cookie so the server renders the right language. Every UI string needs all supported locales.
- More languages will be added later; copy, layout, and i18n structure must not assume only two languages or Vietnamese/English text lengths.
- Must work well on both desktop and mobile web.
- Printing conversations is a feature to preserve.

## Brand Commitments

- Name: **Happier Chat**. Keep it as is.
- Tagline: "Chat with AI, happier every day" / "Trò chuyện cùng AI, vui hơn mỗi ngày".
- Logo: the twelve-petal flower mark in `src/components/logo.tsx` (rotates on hover) and the icons in `public/`. Keep it.

## Evidence on Hand

- Icons and social image: `public/favicon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/og-image.png`, `public/manifest.webmanifest`.
- No testimonials, user counts, benchmarks, pricing, or press exist. Do not fabricate them.

## Product Principles

1. Better everyday UX than first-party chat apps: fewer steps, clearer state, nothing lost.
2. Answers can be interfaces: when a structured card serves the user better than prose, render the card.
3. The user is in control: their providers, their keys, their models, their settings.
4. Learning is a first-class use case, not a side feature.
5. Language-agnostic by design: Vietnamese first, English equal, more languages to come.
