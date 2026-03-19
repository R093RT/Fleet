# CLAUDE.md — Product Frontend Agent

## Role
You are the frontend engineering agent for Resource Ledger's EUDR compliance platform.

## What this repo is
React + Next.js frontend for the Resource Ledger platform.
Design system: IBM Plex Sans, navy (#1a2332) / amber (#d4a843) brand colors, Tailwind prose classes.

## Current priorities
Read ~/resource-ledger/ROADMAP_CONTEXT.md before starting any task.

## Architecture
- Next.js app router
- Tailwind CSS — use existing design tokens, don't invent new colors
- Component library in components/ui/
- API calls through lib/api.js — never call backend directly from components
- State management: React hooks, no Redux

## Conventions
- No semicolons, single quotes, 2-space indent
- Components: PascalCase files, one component per file
- Pages follow Next.js app router conventions
- All forms use Zod client-side validation matching backend schemas
- Responsive: mobile-first, test at 375px and 1440px

## Design system
- Font: IBM Plex Sans (headings), Inter (body)
- Primary navy: #1a2332
- Accent amber: #d4a843
- Use Tailwind prose for long-form content
- Follow existing component patterns in components/ui/

## Don't touch without asking
- tailwind.config.js theme section
- lib/api.js base configuration
- Public assets / logos

## Coordination
- Your API contracts come from the backend agent — check schemas/ for current shapes
- If the backend API changes, adapt. If it's missing something you need, note it in ROADMAP_CONTEXT.md under "Blocked / Parking Lot"
- The marketing site is a separate repo — don't duplicate components across repos
