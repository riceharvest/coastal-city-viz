# SEA Coastal City Visualizer

Interactive dashboard for comparing Southeast Asian coastal / near-coastal cities by:

- Domestic vs international tourism share
- Nightlife density versus Amsterdam center reference
- Beach-to-bar walkability
- Registered population
- Normal solo local-ish monthly living cost
- Distance from bar district to beach
- Beach quality, water cleanliness, swimmability, and compactness

## Run

```bash
pnpm install
pnpm dev
```

Open the local Vite URL.

## Edit data

All city metrics live in:

```txt
src/data.ts
```

## Research status

The visitor-mix and destination fields are editorial estimates unless a generated source field says otherwise:

- Prefer official tourism/statistics sources where available: MOTS/TAT Thailand, VNAT/local Vietnam, DOSM/LADA/Sabah, DOT/Bohol/SBMA, BPS Indonesia, Cambodia tourism statistics.
- Use city/province official visitor splits when accessible.
- When only province/state totals exist, estimate the nightlife-zone split and mark confidence lower.
- `internationalPct` is an estimated visitor mix. It is not foreign-resident data.
- Swimmability, beach quality, water cleanliness, and current safety scores are editorial proxies. They have no reproducible measurement rubric yet.
- Nightlife density, bars-within-walk, and cluster radius remain structured estimates, not a scraped POI census.
- Generated airport distances are straight-line distances. They are not driving, walking, ferry, or total-transfer distances.
- Generated OSM counts use circular radii and OSM completeness is uneven. They are not 10-minute walking counts.
- If an external advisory cannot be parsed, generation must publish `Unknown`, not a stale fallback level.
- A parallel regional verification pass is documented in `plans/parallel-data-verification-2026-05-08.md`.

So: better than the first pass, still not a field-level or paid-market-data audit.

## Build

```bash
pnpm build
```
