# ROADMAP_CONTEXT.md
# Maintained by: PM Brain Agent
# Last updated: 2026-03-19
# All agents: read this at session start before doing anything.

---

## Priority Stack (work top to bottom)

1. **Verifier routes + validation middleware** — backend agent — SHIP THIS WEEK
2. **SurveyLink GPS polygon capture** — surveylink agent — field-testable by Friday
3. **DDS Field Builder blog widget** — marketing agent — publish ready
4. **Notification system scaffolding** — backend agent — structure only, no polish
5. **Enforcement countdown widget** — marketing agent — embed in blog + landing page

## Active Decisions

- Zod over Joi for all new validation (decided 15 Mar)
- SurveyLink is the name. Never reference GeoTrace. (decided Feb 2026)
- Blog tone: accessible, commercially credible, not academic
- Design system: IBM Plex Sans body, Outfit headings, navy #1a2332 / amber #d4a843
- All API responses follow { data, error, code } shape
- Prisma only — no raw SQL unless PostGIS requires it

## Blocked / Parking Lot

> Agents: add items here when you're stuck. PM brain will resolve and move to Active Decisions.

- [ ] Risk Intelligence UI — needs design direction before frontend can build
- [ ] Carbon demo — paused until EUDR blog series ships
- [ ] Offline sync strategy for SurveyLink — needs research

## Agent Coordination Notes

> Cross-agent dependencies. Check if any affect your current task.

- Backend → Frontend: if API response shapes change, backend agent updates schemas/ and notes here
- SurveyLink → Backend: polygon storage endpoint spec needed (see backend priority #1)
- Marketing → PM Brain: blog topics come from PM brain's content briefs
- All agents: don't start new work not on the priority stack without PM brain approval

## Context

- EUDR enforcement: Dec 2026 (large operators), Jun 2027 (SMEs)
- Target market: Thai rubber supply chain
- Target user: compliance officers, supply chain managers, commodity traders
- Competitive edge: origin-country infrastructure, first-mile smallholder data creation
- Company stage: launched Mar 2026, pre-revenue
- Funding: bootstrapped (Roger is sole founder)
- SAM: Thai rubber $40-85M/yr | TAM: Global EUDR $1.5-3.5B by 2030
