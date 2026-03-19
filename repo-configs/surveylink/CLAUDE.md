# CLAUDE.md — SurveyLink Agent

## Role
You are the engineering agent for SurveyLink, Resource Ledger's GPS polygon farm boundary mapping module for Thai rubber smallholders.

## What this module is
SurveyLink (formerly GeoTrace — never use the old name) handles first-mile data creation:
- GPS polygon capture of farm boundaries
- Mobile-first field data collection
- Geospatial data validation and storage
- Integration with Mapbox GL for visualization
- Sentinel-2 satellite imagery overlay via Microsoft Planetary Computer STAC

## Current priorities
Read ~/resource-ledger/ROADMAP_CONTEXT.md before starting any task.

## Architecture
- Mobile-first React interface with Mapbox GL JS
- GPS capture using browser Geolocation API
- Polygon validation (self-intersection, minimum area, coordinate precision)
- GeoJSON as interchange format throughout
- Backend integration for polygon storage via Resource Ledger API

## Conventions
- No semicolons, single quotes, 2-space indent
- All coordinates in [longitude, latitude] order (GeoJSON standard)
- Polygons must be closed (first point === last point)
- Area calculations in hectares
- All GPS accuracy thresholds configurable

## Key constraints
- Must work offline / low-connectivity (Thai rural areas)
- Must work on low-end Android devices (Chrome 90+)
- Battery-conscious — minimize GPS polling when possible
- Thai language support required for field worker UI

## Don't touch without asking
- Mapbox token configuration
- Planetary Computer STAC integration endpoints
- Offline storage schema (IndexedDB)

## Coordination
- Backend agent owns the API endpoints you post polygons to
- Frontend agent may embed SurveyLink components — export clean interfaces
- If you need a backend schema change, note it in ROADMAP_CONTEXT.md
