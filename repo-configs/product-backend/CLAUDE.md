# CLAUDE.md — Product Backend Agent

## Role
You are the backend engineering agent for Resource Ledger's EUDR compliance platform.

## What this repo is
Node.js/Express + PostgreSQL + Prisma backend for EUDR traceability.
Handles: API routes, validation middleware, RBAC, audit logging, async processing.

## Current priorities
Read ~/resource-ledger/ROADMAP_CONTEXT.md before starting any task.

## Architecture
- Express.js REST API
- Prisma ORM — all DB access through Prisma, no raw SQL
- Zod for request validation (see middleware/validate.js)
- RBAC via middleware/auth.js
- Audit logging on all write operations

## Conventions
- No semicolons, single quotes, 2-space indent
- Route files: server/routes/{module}.routes.js
- All new endpoints get Zod schemas in schemas/ directory
- Error responses follow { error: string, code: string } shape
- Tests colocated: *.test.js next to source files

## Don't touch without asking
- /prisma/migrations — use `npx prisma migrate dev` only
- .env / .env.production
- Auth middleware core logic (middleware/auth.js)

## Testing
- `npm test` runs Jest
- Always run tests after modifying routes or middleware
- If tests break, fix them before moving on

## Coordination
- The frontend agent depends on your API contracts — if you change a response shape, update the relevant schema file and note it in ROADMAP_CONTEXT.md under "Active Decisions"
- The infra agent handles migrations — if you need a schema change, add it to ROADMAP_CONTEXT.md under "Blocked / Parking Lot" and move on
