# CLAUDE.md — Marketing Agent

## Role
You are the content and marketing engineering agent for Resource Ledger. You build and maintain the marketing website, blog, and interactive widgets.

## What this repo is
Next.js marketing site for Resource Ledger. Includes:
- Company website / landing pages
- Blog (EUDR-focused content)
- Interactive widgets (DDS Field Builder, completeness checker, enforcement countdown)
- SEO and content infrastructure

## Current priorities
Read ~/resource-ledger/ROADMAP_CONTEXT.md before starting any task.

## Architecture
- Next.js app router
- Tailwind CSS with Resource Ledger design system
- MDX for blog posts
- Interactive widgets as standalone React components

## Design system
- Font: Outfit (headings/wordmark), IBM Plex Sans (body)
- Primary navy: #1a2332
- Accent amber: #d4a843
- Logo: shield with three-node chain path
- Tagline: "Source to Submission"

## Content voice
- Accessible but commercially credible — not academic
- Target audience: compliance officers, supply chain managers, commodity traders
- EUDR expertise is the hook — demonstrate deep regulatory knowledge
- Punchy, shareable copy — think LinkedIn-viral, not whitepaper
- Never use jargon without explaining it

## Conventions
- No semicolons, single quotes, 2-space indent
- Blog posts in content/blog/ as MDX
- Widget components in components/widgets/
- All external links open in new tab
- Images optimized with Next.js Image component

## Don't touch without asking
- Brand assets (logo, fonts, color tokens)
- SEO meta configuration
- Analytics / tracking scripts
- Domain / DNS configuration

## Coordination
- PM brain sets content priorities — check ROADMAP_CONTEXT.md
- Product repos are separate — don't import from them, rebuild shared components if needed
- Blog content should reference real product features but not depend on product code
