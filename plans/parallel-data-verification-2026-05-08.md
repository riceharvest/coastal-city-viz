# Parallel city-data verification — 2026-05-08

Scope: all rows in `src/data.ts` were checked in four parallel regional audit passes: Thailand/Cambodia, Vietnam/Myanmar, Philippines, and Malaysia/Indonesia. The audit focused on visitor mix, beach-to-nightlife walkability, nightlife compactness, and whether the row should be treated as a candidate or reject/baseline.

## Important limitation

Official neighborhood-level visitor mix almost never exists. The dashboard therefore uses this hierarchy:

1. Official city/province/state tourism split when available.
2. Official regional proxy adjusted for the named nightlife zone.
3. Structured estimate when only national/provincial or airport/gateway evidence exists.

Nightlife density remains an estimated establishment-density score, not a scraped POI census.

## Corrections applied

- Da Nang: 41% → 38% international, matching the lower end of recent official full-year-style city reporting.
- Langkawi: 15% → 25% international, because Pantai Cenang has more foreign resort traffic than the earlier island-wide guess implied.
- Kuta Lombok: 35% → 25% international; still foreign-visible but not international-majority.
- George Town: 40% → 30% international; Penang remains domestic-majority, and George Town is a heritage/nightlife baseline more than a beach-nightlife fit.
- Desaru: 35% → 25% international; resort/Singapore exposure exists but domestic/Johor demand dominates.
- Jakarta: 5% → 12% international; still rejected because nightlife is not beach-adjacent.
- Surabaya: 3% → 7% international; still rejected for beach adjacency.
- Bali: 65% → 45% international island-wide baseline; south Bali nightlife cores can feel more international than island-wide totals.
- Medan: 4% → 12% international; still rejected for no beach-nightlife adjacency.
- Cebu/Mactan: 22% → 30% international; split-node problem remains.
- Dumaguete: 9% → 15% international; expat/dive visibility higher than the previous row, but city beach fit remains weak.
- Replaced several dead/renamed source URLs discovered during HTTP source checks.

## Rows confirmed as structurally invalid/reject baselines

- Bangkok, Jakarta, Surabaya, Medan, Semarang: nightlife may exist, but not beach-adjacent.
- Kampot: riverfront, not beach.
- Mudon: town/beach are not an integrated walkable nightlife district.
- Dawei: low-confidence local beach proxy, not dense nightlife.
- Serui/Nabire/Sorong: domestic/local coastal comparators only; too little nightlife density.
- Port Dickson/Desaru/Kep/Cha-am: domestic beach destinations, but weak nightlife density.
- Negros/Panay/Palawan: broad island/province proxies; acceptable only as weak/reject comparators unless split into specific towns.

## Source reachability check

A parallel-ish HTTP check over the dataset found 118/153 source URLs returned 2xx/3xx from this environment. Most failures were official sites blocking automated requests (403) or TLS issues, not necessarily bad sources. A few true 404/renamed travel-guide URLs were replaced in `src/data.ts`.
