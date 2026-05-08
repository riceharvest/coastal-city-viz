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

The visitor-mix fields were re-audited after the initial scouting pass:

- Prefer official tourism/statistics sources where available: MOTS/TAT Thailand, VNAT/local Vietnam, DOSM/LADA/Sabah, DOT/Bohol/SBMA, BPS Indonesia, Cambodia tourism statistics.
- Use city/province official visitor splits when accessible.
- When only province/state totals exist, estimate the nightlife-zone split and mark confidence lower.
- Nightlife density, bars-within-walk, and cluster radius remain structured estimates, not a scraped POI census.

So: better than the first pass, still not a paid-market-data audit.

## Build

```bash
pnpm build
```
