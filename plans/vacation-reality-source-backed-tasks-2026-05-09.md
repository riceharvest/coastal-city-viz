# Vacation Reality Source-Backed Tasks

> **For Hermes:** Use `subagent-driven-development` + wave execution to implement this plan. Do not enter new numeric vacation data unless it has source metadata or is script-derived from source-backed raw data.

**Goal:** Add a source-backed “should I actually vacation there?” layer to the coastal-city-viz dashboard without hallucinated data.

**Architecture:** Keep the current beach/nightlife/foreigner fit model intact. Add new grouped, source-backed vacation-reality metrics, generated/validated where possible. Unknown or unsourced values must render as `—` and must not silently become `0`.

**Tech Stack:** Vite, React, TypeScript, Recharts, Node scripts, source-backed JSON artifacts.

---

## Non-negotiable source rules

1. Every new displayed datapoint must be one of:
   - official/API-sourced,
   - script-derived from source-backed raw data,
   - date-stamped manual sample,
   - labeled proxy,
   - or `unknown`.
2. Do not hand-enter hard numeric claims like “best months,” “wave risk,” “direct flights,” “hotel average,” or “noise level.” Generate them or attach source metadata.
3. New metrics need source metadata: URL, source type, accessed/generated date, confidence, and supported fields.
4. Keep country-level claims separate from city/district-level claims.
5. Existing `sourceUrls` can remain, but new vacation metrics should use structured sources.
6. Scripts must fail validation if required source metadata is missing.

Recommended shared types:

```ts
type Confidence = 'low' | 'medium' | 'high';

type SourceRecord = {
  url: string;
  title?: string;
  publisher?: string;
  accessedAt: string;
  sourceType:
    | 'official-tourism'
    | 'official-statistics'
    | 'official-advisory'
    | 'weather-api'
    | 'marine-api'
    | 'airport-open-data'
    | 'osm-overpass'
    | 'wikidata-sparql'
    | 'unesco'
    | 'booking-sample'
    | 'hotel-official'
    | 'route-source'
    | 'crowd-proxy'
    | 'editorial-proxy'
    | 'manual-note';
  supportsFields: string[];
  notes?: string;
};
```

---

## Wave plan

### Wave 1 — schema + validation foundations

These tasks should land before metric-specific work.

#### Task 1: Add source metadata and optional vacation metric shells

**Objective:** Extend the `City` model without breaking existing rows.

**Files:**
- Modify: `src/data.ts`

**Steps:**
1. Add `Confidence` and `SourceRecord` types.
2. Add optional grouped fields to `City`: `seasonality`, `arrival`, `accommodation`, `osmPoiMetrics`, `noiseChaosMetrics`, `dayTripMetrics`, `sources`.
3. Keep all new fields optional so the current 40 records still compile.
4. Add comments that unknown values are allowed and must render as missing, not zero.

**Acceptance criteria:**
- `pnpm build` passes.
- Existing city records do not need placeholder data.

#### Task 2: Add data validation script framework

**Objective:** Create one validator that can grow as each metric group lands.

**Files:**
- Create: `scripts/validate-data.mjs`
- Modify: `package.json`

**Steps:**
1. Add `data:validate` script: `node scripts/validate-data.mjs`.
2. Validate shared rules:
   - no invalid score ranges,
   - no empty source URLs when metric group exists,
   - every source has `url`, `sourceType`, `accessedAt`, `supportsFields`.
3. Make the validator pass on the current dataset with no new metric groups.
4. Print warnings for missing optional vacation metrics, not failures.

**Acceptance criteria:**
- `pnpm data:validate` passes.
- `pnpm build` passes.

#### Task 3: Fix stale dashboard copy

**Objective:** Remove stale “28 audited places” hardcode found during subagent inspection.

**Files:**
- Modify: `src/main.tsx`

**Steps:**
1. Replace “Default view shows all 28 audited places” with dynamic copy using `cities.length`.
2. Verify the hero already shows `40/40` correctly.

**Acceptance criteria:**
- UI copy cannot go stale when city count changes.
- `pnpm build` passes.

---

### Wave 2 — source-backed data generators, parallelizable

Run these in parallel after Wave 1.

#### Task 4: Seasonality + beach reliability generator

**Objective:** Generate monthly vacation reliability from weather and marine APIs.

**Files:**
- Create: `src/seasonalityScoring.ts`
- Create: `scripts/fetch-seasonality.mjs`
- Create: `scripts/validate-seasonality.mjs`
- Create: `scripts/city-beach-points.json`
- Generated: `src/generated/seasonality.json`
- Modify: `package.json`

**Sources:**
- Open-Meteo Historical Weather API docs: `https://open-meteo.com/en/docs/historical-weather-api`
- Historical endpoint: `https://archive-api.open-meteo.com/v1/archive`
- Open-Meteo Marine API docs: `https://open-meteo.com/en/docs/marine-weather-api`
- Marine endpoint: `https://marine-api.open-meteo.com/v1/marine`
- Open-Meteo Climate API optional/future only: `https://open-meteo.com/en/docs/climate-api`

**Fields:**
- `bestMonths`, `shoulderMonths`, `avoidMonths`
- monthly: `weatherComfortScore`, `beachReliabilityScore`, `vacationReliabilityScore`
- monthly weather: `avgTempMaxC`, `avgTempMeanC`, `avgApparentTempMaxC`, `precipSumMm`, `rainyDaysPct`, `heavyRainDaysPct`, `windMaxP90Kmh`
- monthly marine: `waveHeightMeanM`, `waveHeightP90M`, `highWaveDaysPct`, `seaSurfaceTempMeanC`, `marineDataStatus`

**Rules:**
1. Use representative beach coordinates, not city hall.
2. Coordinate source URL is required per city.
3. Use last 5–7 complete calendar years; example if running in 2026: 2019-01-01 through 2025-12-31.
4. Do not mix climate projections into current vacation reliability.
5. If marine data is unavailable, show `marineDataStatus: 'unavailable'`; do not fabricate beach reliability.
6. Use deterministic formulas in `src/seasonalityScoring.ts`.

**Acceptance criteria:**
- Every generated city has exactly 12 months.
- All scores are finite `0–100`.
- `bestMonths`/`shoulderMonths`/`avoidMonths` match generated monthly scores.
- `pnpm data:seasonality` and `pnpm validate:seasonality` pass.

#### Task 5: Arrival friction, airport, direct-flight, visa, safety model

**Objective:** Add data structures and scripts/tasks for how hard a place is to reach and how much official travel hassle exists.

**Files:**
- Create: `scripts/fetch-ourairports.mjs`
- Create: `scripts/derive-nearest-airports.mjs`
- Create: `scripts/validate-arrival-data.mjs`
- Generated: `data/generated/airports.json`
- Generated/review: `data/review/nearest-airport-candidates.json`
- Modify: `src/data.ts`
- Modify: `package.json`

**Sources:**
- OurAirports data page: `https://ourairports.com/data/`
- OurAirports CSV: `https://davidmegginson.github.io/ourairports-data/airports.csv`
- GOV.UK foreign travel advice: `https://www.gov.uk/foreign-travel-advice`
- GOV.UK Content API root: `https://www.gov.uk/api/content/foreign-travel-advice`
- US State Department advisories: `https://travel.state.gov/en/international-travel/travel-advisories.html`
- Route evidence must be current airline/airport/flight-search evidence; OpenFlights is historical only and cannot be final current truth.

**Fields:**
- `nearestAirport`
- `airportTransfer`
- `directFlights`
- `directFlightScore`
- `visaProfiles`
- `visaHassleScore`
- `safetyAdvisories`
- `safetyHassleScore`
- `arrivalFrictionScore`
- `arrivalFrictionConfidence`

**Rules:**
1. Allowed commercial airport types: `large_airport`, `medium_airport`, or `small_airport` only if scheduled service + IATA.
2. Direct-flight truth must be checked within 12 months and sourced; OpenFlights can only seed manual checks.
3. Visa claims are passport-specific. Start with `US` and `GB`, not universal “visa required.”
4. Government advisory warnings must not be over-applied to cities if they only concern remote regions.
5. Transfer time needs a route/manual source; distance can be haversine from coordinates.

**Acceptance criteria:**
- `pnpm validate:arrival` fails on unsourced route/visa/safety claims.
- Unknown direct flights/visa values render as unknown, not false certainty.
- `arrivalFrictionScore` formula is documented.

#### Task 6: OSM POI, food/cafe, accommodation supply generator

**Objective:** Replace/supplement subjective density estimates with reproducible OSM POI counts around the actual vacation core.

**Files:**
- Create: `scripts/city-cores.json`
- Create: `scripts/fetch-osm-pois.mjs`
- Generated: `data/osm-poi-metrics.json`
- Cached: `data/sources/osm/*.json`
- Modify: `package.json`

**Sources:**
- Overpass API docs: `https://wiki.openstreetmap.org/wiki/Overpass_API`
- OSM amenity tags: `https://wiki.openstreetmap.org/wiki/Key:amenity`
- OSM tourism tags: `https://wiki.openstreetmap.org/wiki/Key:tourism`

**Tags:**
- Food/nightlife: `amenity=restaurant|cafe|fast_food|food_court|bar|pub|nightclub`
- Accommodation: `tourism=hotel|guest_house|hostel|apartment|chalet|resort`

**Fields:**
- `restaurantCount`, `cafeCount`, `barPubCount`, `nightclubCount`, `fastFoodCount`
- `hotelCount`, `guestHouseCount`, `hostelCount`, `apartmentAccommodationCount`
- `foodCafeDensityPerKm2`, `barPubClubDensityPerKm2`, `accommodationDensityPerKm2`
- `overpassQueriedAt`, `centerLat`, `centerLon`, `radiusMeters`, `osmMethod`, `osmSourceUrl`

**Rules:**
1. Store a reviewed center coordinate + radius for each vacation core.
2. Normalize by radius area if radii differ.
3. Deduplicate nodes/ways/relations by OSM ID.
4. Cache raw Overpass responses.
5. Label OSM incompleteness as confidence caveat.

**Acceptance criteria:**
- OSM metrics are reproducible from cached response/query.
- Existing nightlife estimates remain clearly labeled as estimates until replaced.

#### Task 7: Accommodation sampled-price methodology

**Objective:** Add a defensible sampled-price dataset instead of claiming permanent hotel averages.

**Files:**
- Create: `data/accommodation-samples.json`
- Create: `scripts/compute-accommodation-metrics.mjs`
- Generated: `data/accommodation-metrics.json`
- Modify: `package.json`

**Sources:**
- Date-stamped manual samples from Booking/Agoda/Google Hotels/Airbnb or hotel official pages.
- Do not bulk scrape platforms if ToS prohibits it.
- Generic travel blogs/cost sites are context only, not primary price data.

**Sampling method:**
- 7 nights.
- 1 adult.
- 6–10 weeks out, plus high-season/weekend sample where relevant.
- Inside or within 2km of the named vacation district.
- Include private hotel/guesthouse/aparthotel/entire apartment only.
- Exclude dorms, luxury outliers, isolated resort inventory unless target district is resort-only.

**Fields:**
- raw samples with `sourceUrl`, `sampledAt`, `checkIn`, `nights`, `guests`, `roomType`, `neighborhood`, `nightlyUsd`, `originalCurrency`, notes.
- computed `medianHotelNightlyUsd`, `medianApartmentNightlyUsd`, `p25`, `p75`, `accommodationSampleCount`, `accommodationValueScore`.

**Rules:**
1. Minimum 12 valid samples per city to show a score.
2. 20+ samples preferred for high confidence.
3. Store raw samples so medians can be recomputed.
4. UI label must say “sampled nightly price,” not “average hotel cost.”

**Acceptance criteria:**
- `pnpm data:accommodation` recomputes medians.
- Validator fails if sample count is below threshold but score is displayed as confident.

#### Task 8: Noise / chaos proxy

**Objective:** Add a transparent proxy for noisy/chaotic vacation cores without pretending to have measured decibels.

**Files:**
- Create or extend: `scripts/fetch-osm-noise-proxy.mjs` / `scripts/fetch-osm-pois.mjs`
- Generated: `data/noise-chaos-metrics.json`

**Sources:**
- OSM/Overpass query + cached response.
- Official city noise maps only where available.

**Tags/proxies:**
- roads: `highway=motorway|trunk|primary|secondary|tertiary`
- transit: `amenity=bus_station`, `public_transport=station`, `railway=station`, `amenity=ferry_terminal`, `aeroway=aerodrome`
- nightlife: `amenity=bar|pub|nightclub`
- chaos: `shop=mall`, `amenity=marketplace`

**Fields:**
- `majorRoadDensityKmPerKm2`
- `nightlifeVenueCountWithin500m`
- `marketOrMallCountWithinCore`
- `ferryPortBusStationCountWithinCore`
- `noiseChaosScore`
- `quietnessScore`
- `noiseMethod`
- `noiseSourceUrls`

**Rules:**
1. UI label must say “Noise / chaos proxy.”
2. Do not show dB unless using official measured noise source.
3. Dense nightlife can be both useful and noisy; keep this separate from fit score initially.

**Acceptance criteria:**
- Formula is documented.
- Validator rejects measured-noise wording without official measured source.

#### Task 9: Day-trip / UNESCO / Wikidata metrics

**Objective:** Add source-backed nearby attraction depth without vague “lots to do” claims.

**Files:**
- Create: `scripts/fetch-wikidata-daytrips.mjs`
- Create: `scripts/fetch-unesco-sites.mjs`
- Generated: `data/daytrip-metrics.json`
- Generated: `data/unesco-sites.json`

**Sources:**
- Wikidata SPARQL service/examples: `https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples`
- UNESCO syndication/data: `https://whc.unesco.org/en/syndication/`
- UNESCO list: `https://whc.unesco.org/en/list/`
- Official tourism boards for practical verification of named attractions.

**Fields:**
- `unescoSitesWithin50Km`, `unescoSitesWithin100Km`
- `wikidataAttractionsWithin25Km`, `wikidataAttractionsWithin50Km`
- `nearestUnescoSiteName`, `nearestUnescoDistanceKm`
- `nearestMajorAttractionName`, `nearestMajorAttractionDistanceKm`
- `dayTripScore`, `dayTripMethod`, `dayTripSourceUrls`

**Rules:**
1. Store SPARQL query or generated URL and returned QIDs.
2. Verify actual Wikidata class QIDs before implementation; do not trust placeholder QIDs.
3. UNESCO status must be confirmed from UNESCO, not only Wikidata.
4. Exclude generic administrative entities.
5. Treat `<=25km` as local, `25–100km` as day-trip, `>100km` excluded unless transport is documented unusually fast.

**Acceptance criteria:**
- Counts are reproducible.
- False positives are manually reviewed before display.

---

### Wave 3 — UI integration, parallelizable after generated data shapes stabilize

#### Task 10: Add vacation-reality filters

**Objective:** Let users filter by actual trip constraints without hiding unknowns by default.

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Filters:**
- Trip month: `Any`, `Jan`…`Dec`
- Min vacation reliability
- Hide marine-data-unavailable
- Max arrival friction
- Max airport transfer minutes
- Passport profile: `US` / `GB`
- Require direct from selected origin hub
- Max sampled nightly price
- Min accommodation value
- Min food/cafe density
- Max noise/chaos proxy
- Min day-trip score
- Optional: hide missing new metrics

**Rules:**
1. Missing metrics render as `—`.
2. Missing metrics stay visible by default.
3. Only hide unknowns when user explicitly enables it.

**Acceptance criteria:**
- Filters do not convert missing values into zero.
- `pnpm build` passes.

#### Task 11: Add vacation-reality card sections

**Objective:** Show concise evidence-backed values on each city card.

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Card additions:**
- Best months / avoid months.
- Selected-month reliability, rain days, wave P90, sea temp.
- Nearest airport, transfer minutes, arrival friction.
- Direct origin hubs.
- Visa status for selected passport.
- Safety advisory summary.
- Sampled nightly price and accommodation value.
- Food/cafe density.
- Noise/chaos proxy and quietness.
- Day-trip score, UNESCO/major attraction nearest.

**Rules:**
- Add source/evidence details as compact links or expandable notes.
- Label proxies explicitly.

**Acceptance criteria:**
- Card remains readable on mobile.
- Source/checked dates are visible or reachable from each metric group.

#### Task 12: Add focused vacation-reality charts

**Objective:** Compare the new metrics visually without overloading the page.

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Charts:**
1. Arrival friction vs existing fit score.
2. Monthly vacation reliability heatmap/line chart.
3. Accommodation value vs nightlife/food density.
4. Quiet but useful: noise proxy vs food/cafe density.

**Rules:**
- Start with 1–2 charts if layout gets crowded.
- Do not bake all new metrics into `scoreCity` yet; keep them as separate filters and evidence.

**Acceptance criteria:**
- Existing beach/nightlife charts still work.
- New charts tolerate missing metric groups.

---

### Wave 4 — final integration and audit

#### Task 13: Add source reachability audit

**Objective:** Check that all source URLs are reachable or explicitly marked blocked/manual.

**Files:**
- Create: `scripts/audit-source-urls.mjs`
- Modify: `package.json`

**Rules:**
1. Treat 200/3xx as reachable.
2. Treat 403/TLS/bot blocks as “blocked from automation,” not automatically invalid.
3. Fail only on malformed URLs or true dead sources for required metrics.

**Acceptance criteria:**
- `pnpm audit:sources` prints counts: reachable, blocked, dead, skipped.

#### Task 14: Add audit documentation

**Objective:** Document what is official, proxy, sampled, generated, or unknown.

**Files:**
- Create: `plans/vacation-reality-data-audit.md`
- Modify: `README.md`

**Contents:**
- Source hierarchy.
- Metric formulas.
- Known limitations.
- Which metric groups are source-backed vs proxy.
- Date of generation/sampling.
- Manual review checklist.

**Acceptance criteria:**
- A future maintainer can reproduce the data or know exactly where uncertainty remains.

#### Task 15: Final verification

**Objective:** Verify implementation end-to-end before deploy.

**Commands:**
```bash
pnpm data:validate
pnpm validate:seasonality
pnpm validate:arrival
pnpm audit:sources
pnpm build
```

**Acceptance criteria:**
- All commands pass or documented non-blocking source blocks are listed.
- Live dashboard shows unknowns honestly.
- No new metric appears without source metadata.

---

## Parallel subagent work already performed for this plan

Three parallel research/decomposition agents were used:

1. **Seasonality + beach reliability**
   - Verified Open-Meteo historical, marine, and climate API docs/endpoints directly.
   - Produced weather/marine metric fields, scoring rules, and validation requirements.

2. **Arrival friction + visa/safety**
   - Verified OurAirports, GOV.UK advice/API, and US State Department advisory sources.
   - Flagged OpenFlights as historical only, not current direct-flight truth.
   - Found stale `28 audited places` copy in the UI.

3. **Accommodation + OSM POI + noise/day-trip**
   - Verified Overpass/OSM, Wikidata SPARQL, and UNESCO source pages.
   - Produced sampled accommodation methodology and proxy labeling requirements.

## Implementation note

This plan intentionally separates **task creation and source architecture** from the later expensive part: collecting 40-city source-backed data. The next implementation pass should first land the schemas, validators, and generators, then only display metrics where the generated or sampled data exists.
