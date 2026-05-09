import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Beer, Footprints, MapPin, SlidersHorizontal, Waves } from 'lucide-react';
import { cities, type City } from './data';
import { vacationDataByKey, type VacationRecord } from './vacationData';
import './styles.css';

const verdictColors: Record<City['verdict'], string> = {
  'top pick': '#22c55e',
  possible: '#38bdf8',
  'weak fit': '#f59e0b',
  reject: '#ef4444',
};

const countries = ['All', ...Array.from(new Set(cities.map((c) => c.country))).sort()];
const verdicts = ['Viable only', 'All', 'top pick', 'possible', 'weak fit', 'reject'] as const;

const verdictRank: Record<City['verdict'], number> = {
  'top pick': 0,
  possible: 1,
  'weak fit': 2,
  reject: 3,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function beachQualityComposite(city: City) {
  return (
    city.swimmability +
    city.beachQualityScore +
    city.waterCleanlinessScore +
    city.currentSafetyScore +
    city.eveningBeachLifeScore
  ) / 5;
}

function nightlifeDepthComposite(city: City) {
  const radiusScore = 100 - clamp(((city.barClusterRadiusMeters - 400) / 2600) * 100);
  const barsScore = clamp((city.barsWithin10MinWalk / 60) * 100);
  const lateScore = clamp((city.lateNightVenuesCount / 25) * 100);
  return Math.round(radiusScore * 0.35 + barsScore * 0.35 + lateScore * 0.3);
}

function scoreCity(city: City) {
  const lowInternationalScore = 100 - city.internationalPct;
  const densityScore = clamp(city.nightlifeDensity / 7);
  const beachScore = beachQualityComposite(city) * 10;
  const nightlifeScore = nightlifeDepthComposite(city);
  const beachWalkScore = city.walkability * 10;

  return Math.round(
    lowInternationalScore * 0.22 +
      densityScore * 0.18 +
      beachScore * 0.28 +
      nightlifeScore * 0.22 +
      beachWalkScore * 0.1
  );
}

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

const months = ['Any', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
type TripMonth = (typeof months)[number];

function vacationKey(city: City) {
  return `${city.country}::${city.city}::${city.district}`;
}

function getVacation(city: City) {
  return vacationDataByKey[vacationKey(city)];
}

function selectedMonth(vacation: VacationRecord | undefined, month: TripMonth) {
  if (!vacation || month === 'Any') return undefined;
  return vacation.seasonality.monthly.find((entry) => entry.label === month);
}

function passesMinKnown(value: number | undefined | null, min: number) {
  return value == null ? true : value >= min;
}

function passesMaxKnown(value: number | undefined | null, max: number) {
  return value == null ? true : value <= max;
}

function formatNumber(value: number | null | undefined, suffix = '') {
  return value == null || !Number.isFinite(value) ? '—' : `${value}${suffix}`;
}

function formatMoney(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `$${value.toLocaleString()}`;
}

function formatMonths(values: string[] | undefined) {
  return values?.length ? values.join(', ') : '—';
}

function App() {
  const [country, setCountry] = useState('All');
  const [verdict, setVerdict] = useState<(typeof verdicts)[number]>('All');
  const [maxInternational, setMaxInternational] = useState(80);
  const [minSwimmability, setMinSwimmability] = useState(0);
  const [minWaterCleanliness, setMinWaterCleanliness] = useState(0);
  const [maxClusterRadius, setMaxClusterRadius] = useState(3500);
  const [minLateNightVenues, setMinLateNightVenues] = useState(0);
  const [minNightlifeDensity, setMinNightlifeDensity] = useState(0);
  const [tripMonth, setTripMonth] = useState<TripMonth>('Any');
  const [minVacationReliability, setMinVacationReliability] = useState(0);
  const [maxArrivalFriction, setMaxArrivalFriction] = useState(100);
  const [maxNoiseChaos, setMaxNoiseChaos] = useState(100);
  const [minFoodCafeDensity, setMinFoodCafeDensity] = useState(0);
  const [minDayTripScore, setMinDayTripScore] = useState(0);

  const filtered = useMemo(() => {
    return cities
      .filter((c) => country === 'All' || c.country === country)
      .filter((c) =>
        verdict === 'All' ? true : verdict === 'Viable only' ? c.verdict !== 'reject' : c.verdict === verdict
      )
      .filter((c) => c.internationalPct <= maxInternational)
      .filter((c) => c.swimmability >= minSwimmability)
      .filter((c) => c.waterCleanlinessScore >= minWaterCleanliness)
      .filter((c) => c.barClusterRadiusMeters <= maxClusterRadius)
      .filter((c) => c.lateNightVenuesCount >= minLateNightVenues)
      .filter((c) => c.nightlifeDensity >= minNightlifeDensity)
      .filter((c) => {
        const vacation = getVacation(c);
        const month = selectedMonth(vacation, tripMonth);
        const reliability = tripMonth === 'Any'
          ? Math.max(...(vacation?.seasonality.monthly.map((entry) => entry.vacationReliabilityScore) ?? [0]))
          : month?.vacationReliabilityScore;
        return (
          passesMinKnown(reliability, minVacationReliability) &&
          passesMaxKnown(vacation?.arrival.arrivalFrictionScore, maxArrivalFriction) &&
          passesMaxKnown(vacation?.noiseChaosMetrics.noiseChaosScore, maxNoiseChaos) &&
          passesMinKnown(vacation?.osmPoiMetrics.foodCafeDensityPerKm2, minFoodCafeDensity) &&
          passesMinKnown(vacation?.dayTripMetrics.dayTripScore, minDayTripScore)
        );
      })
      .sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict] || scoreCity(b) - scoreCity(a));
  }, [
    country,
    maxClusterRadius,
    maxInternational,
    minLateNightVenues,
    minNightlifeDensity,
    minVacationReliability,
    maxArrivalFriction,
    maxNoiseChaos,
    minFoodCafeDensity,
    minDayTripScore,
    tripMonth,
    minSwimmability,
    minWaterCleanliness,
    verdict,
  ]);

  const top = filtered[0];
  const denseEnough = cities.filter((c) => c.nightlifeDensity >= 250 && c.swimmability >= 5).length;
  const vacationRecordsShown = filtered.map(getVacation).filter(Boolean) as VacationRecord[];
  const reliableCount = vacationRecordsShown.filter((v) => {
    const month = selectedMonth(v, tripMonth);
    const score = tripMonth === 'Any'
      ? Math.max(...v.seasonality.monthly.map((entry) => entry.vacationReliabilityScore))
      : month?.vacationReliabilityScore ?? 0;
    return score >= 75;
  }).length;
  const heatmapCities = filtered.slice(0, 12).map((city) => ({ city, vacation: getVacation(city) })).filter((item) => item.vacation);
  const arrivalChart = filtered
    .map((city) => ({ ...city, arrivalFrictionScore: getVacation(city)?.arrival.arrivalFrictionScore }))
    .filter((city) => city.arrivalFrictionScore != null);

  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow">SEA vacation spot filter</div>
        <h1>Find beach vacation spots with dense nightlife and fewer foreigners.</h1>
        <p>
          Re-audited for the real target: swimmable beaches, most bars/clubs concentrated in one
          walkable nightlife area, and lower international-tourist share. City-grid false positives
          now get punished hard.
        </p>
        <div className="heroStats">
          <Stat icon={<MapPin />} label="places shown" value={`${filtered.length}/${cities.length}`} />
          <Stat icon={<Beer />} label="dense + swimmable" value={denseEnough.toString()} />
          <Stat icon={<Waves />} label={tripMonth === 'Any' ? 'reliable months' : `reliable in ${tripMonth}`} value={reliableCount.toString()} />
          <Stat icon={<Footprints />} label="top shown" value={top ? top.city : '—'} />
        </div>
      </section>

      <section className="shell panel filters">
        <div className="sectionTitle">
          <SlidersHorizontal />
          <div>
            <h2>Filters</h2>
            <p>{`Default view shows all ${cities.length} audited places. Tighten filters to find the actual target band.`}</p>
          </div>
        </div>
        <div className="filterGrid">
          <label>
            Country
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Verdict
            <select value={verdict} onChange={(e) => setVerdict(e.target.value as typeof verdict)}>
              {verdicts.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Range label="Max international" value={maxInternational} min={0} max={80} step={5} onChange={setMaxInternational} suffix="%" />
          <Range label="Min swimmability" value={minSwimmability} min={0} max={10} step={0.5} onChange={setMinSwimmability} suffix="/10" />
          <Range label="Min clean water" value={minWaterCleanliness} min={0} max={10} step={0.5} onChange={setMinWaterCleanliness} suffix="/10" />
          <Range label="Max bar radius" value={maxClusterRadius} min={400} max={3500} step={100} onChange={setMaxClusterRadius} suffix="m" />
          <Range label="Min late venues" value={minLateNightVenues} min={0} max={120} step={5} onChange={setMinLateNightVenues} />
          <Range label="Min nightlife density" value={minNightlifeDensity} min={0} max={900} step={50} onChange={setMinNightlifeDensity} suffix="/km²" />
          <label>
            Trip month
            <select value={tripMonth} onChange={(e) => setTripMonth(e.target.value as TripMonth)}>
              {months.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>
          <Range label="Min vacation reliability" value={minVacationReliability} min={0} max={100} step={5} onChange={setMinVacationReliability} suffix="/100" />
          <Range label="Max arrival friction" value={maxArrivalFriction} min={0} max={100} step={5} onChange={setMaxArrivalFriction} suffix="/100" />
          <Range label="Max noise / chaos" value={maxNoiseChaos} min={0} max={100} step={5} onChange={setMaxNoiseChaos} suffix="/100" />
          <Range label="Min food+cafe density" value={minFoodCafeDensity} min={0} max={200} step={5} onChange={setMinFoodCafeDensity} suffix="/km²" />
          <Range label="Min day-trip proxy" value={minDayTripScore} min={0} max={100} step={5} onChange={setMinDayTripScore} suffix="/100" />
        </div>
      </section>

      <section className="shell charts">
        <div className="panel chartPanel">
          <h2>International tourists vs nightlife density</h2>
          <p>Best zone is upper-left: fewer foreigners, denser nightlife. Bubble size = beach swimmability. X-axis focuses on the 0–40% target band.</p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 28, bottom: 42, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis
                type="number"
                dataKey="internationalPct"
                name="International tourists"
                unit="%"
                domain={[0, 40]}
                allowDataOverflow
                ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40]}
                stroke="#94a3b8"
                label={{ value: 'International tourists in vacation core — lower is better', position: 'insideBottom', offset: -24, fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="nightlifeDensity"
                name="Nightlife density"
                unit="/km²"
                domain={[0, 900]}
                ticks={[0, 150, 300, 450, 600, 750, 900]}
                stroke="#94a3b8"
              />
              <ZAxis type="number" dataKey="swimmability" range={[70, 260]} />
              <Tooltip content={<CityTooltip />} />
              <Scatter data={filtered}>
                {filtered.map((entry) => (
                  <Cell key={entry.city} fill={verdictColors[entry.verdict]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chartPanel">
          <h2>Beach false-positive audit</h2>
          <p>Separates “near a beach” from actually usable: sand/usefulness, clean water, safety, and evening beach life.</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={filtered} margin={{ top: 20, right: 20, bottom: 80, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="city" angle={-35} textAnchor="end" interval={0} stroke="#94a3b8" height={90} />
              <YAxis stroke="#94a3b8" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="beachQualityScore" name="Beach quality" fill="#38bdf8" />
              <Bar dataKey="waterCleanlinessScore" name="Clean water" fill="#22c55e" />
              <Bar dataKey="currentSafetyScore" name="Swim safety" fill="#f59e0b" />
              <Bar dataKey="eveningBeachLifeScore" name="Evening beach" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chartPanel chartPanelWide">
          <h2>Nightlife compactness + late-night depth</h2>
          <p>Bars within a 10-minute walk and late-night venues catch spread-out resort strips versus real bar grids.</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={filtered} margin={{ top: 20, right: 20, bottom: 80, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="city" angle={-35} textAnchor="end" interval={0} stroke="#94a3b8" height={90} />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="barsWithin10MinWalk" name="Bars / 10-min walk" fill="#38bdf8" />
              <Bar dataKey="lateNightVenuesCount" name="Late-night venues" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chartPanel chartPanelWide">
          <h2>Monthly vacation reliability</h2>
          <p>Open-Meteo weather + marine proxy by month. Shows the first 12 filtered places to keep the heatmap readable.</p>
          <div className="heatmap">
            <div className="heatmapHeader"><span />{months.slice(1).map((month) => <b key={month}>{month}</b>)}</div>
            {heatmapCities.map(({ city, vacation }) => (
              <div className="heatmapRow" key={city.city}>
                <strong>{city.city}</strong>
                {vacation!.seasonality.monthly.map((month) => (
                  <span
                    key={month.label}
                    className="heatmapCell"
                    style={{ background: reliabilityColor(month.vacationReliabilityScore) }}
                    title={`${city.city} ${month.label}: ${month.vacationReliabilityScore}/100, rain ${month.rainyDaysPct}%, wave P90 ${formatNumber(month.waveHeightMaxP90M, 'm')}`}
                  >
                    {month.vacationReliabilityScore}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel chartPanel chartPanelWide">
          <h2>Arrival friction vs fit score</h2>
          <p>Airport-distance + country advisory proxy. Transfer minutes and direct flights stay unknown until route-specific sources are added.</p>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 20, right: 28, bottom: 42, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" dataKey={(city) => scoreCity(city as City)} name="Fit score" domain={[0, 100]} stroke="#94a3b8" />
              <YAxis type="number" dataKey="arrivalFrictionScore" name="Arrival friction" domain={[0, 100]} stroke="#94a3b8" />
              <Tooltip content={<ArrivalTooltip />} />
              <Scatter data={arrivalChart}>
                {arrivalChart.map((entry) => (
                  <Cell key={entry.city} fill={verdictColors[entry.verdict]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="shell list">
        {filtered.map((city, index) => (
          <CityCard key={`${city.city}-${city.district}`} city={city} rank={index + 1} />
        ))}
        {!filtered.length && <div className="panel empty">No places match the current filters.</div>}
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = '',
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label>
      <span className="rangeHeader">
        {label} <b>{prefix}{value}{suffix}</b>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function CityTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null;
  const city: City = payload[0].payload;
  return (
    <div className="tooltip">
      <strong>{city.city}</strong>
      <span>{city.district}</span>
      <span>International: {city.internationalPct}%</span>
      <span>Density: {city.nightlifeDensity}/km²</span>
      <span>Beach quality: {city.beachQualityScore}/10</span>
      <span>Clean water: {city.waterCleanlinessScore}/10</span>
      <span>Bars / 10-min walk: {city.barsWithin10MinWalk}</span>
      <span>Late-night venues: {city.lateNightVenuesCount}</span>
      <span>Cluster radius: {city.barClusterRadiusMeters}m</span>
      <span>Fit score: {scoreCity(city)}/100</span>
    </div>
  );
}

function reliabilityColor(score: number) {
  if (score >= 80) return 'rgba(34, 197, 94, 0.78)';
  if (score >= 65) return 'rgba(56, 189, 248, 0.72)';
  if (score >= 50) return 'rgba(245, 158, 11, 0.72)';
  return 'rgba(239, 68, 68, 0.72)';
}

function ArrivalTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null;
  const city: City = payload[0].payload;
  const vacation = getVacation(city);
  return (
    <div className="tooltip">
      <strong>{city.city}</strong>
      <span>Fit score: {scoreCity(city)}/100</span>
      <span>Arrival friction: {formatNumber(vacation?.arrival.arrivalFrictionScore, '/100')}</span>
      <span>Airport: {vacation?.arrival.nearestAirport ?? '—'} · {formatNumber(vacation?.arrival.airportDistanceKm, 'km')}</span>
      <span>Safety: {vacation?.arrival.safetyAdvisory?.label ?? '—'}</span>
    </div>
  );
}

function CityCard({ city, rank }: { city: City; rank: number }) {
  const vacation = getVacation(city);
  const bestMonth = vacation?.seasonality.monthly.reduce((best, month) => month.vacationReliabilityScore > best.vacationReliabilityScore ? month : best, vacation.seasonality.monthly[0]);
  return (
    <article className="panel cityCard" style={{ borderColor: `${verdictColors[city.verdict]}55` }}>
      <div className="rank">#{rank}</div>
      <div className="cityMain">
        <div className="cityHeader">
          <div>
            <h3>{city.city}</h3>
            <p>{city.country} · {city.district}</p>
          </div>
          <span className="pill" style={{ background: `${verdictColors[city.verdict]}22`, color: verdictColors[city.verdict] }}>
            {city.verdict}
          </span>
        </div>
        <p className="notes">{city.notes}</p>
        <div className="tagRow">
          {city.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <div className="metrics">
          <Metric label="International" value={`${city.internationalPct}%`} />
          <Metric label="Nightlife density" value={`${city.nightlifeDensity}/km²`} />
          <Metric label="Bars / 10-min" value={`${city.barsWithin10MinWalk}`} />
          <Metric label="Late venues" value={`${city.lateNightVenuesCount}`} />
          <Metric label="Bar radius" value={`${city.barClusterRadiusMeters}m`} />
          <Metric label="Swimmability" value={`${city.swimmability}/10`} />
          <Metric label="Beach quality" value={`${city.beachQualityScore}/10`} />
          <Metric label="Clean water" value={`${city.waterCleanlinessScore}/10`} />
          <Metric label="Swim safety" value={`${city.currentSafetyScore}/10`} />
          <Metric label="Evening beach" value={`${city.eveningBeachLifeScore}/10`} />
          <Metric label="Beach walk" value={`${city.walkability}/10`} />
          <Metric label="Beach distance" value={`${city.beachDistanceKm}km`} />
          <Metric label="vs Amsterdam" value={`${city.densityVsAmsterdamPct}%`} />
          <Metric label="Monthly cost" value={`${money(city.monthlyLocalCostUsd)} mid`} />
          <Metric label="Fit score" value={`${scoreCity(city)}/100`} />
        </div>
        {vacation && (
          <section className="vacationSection">
            <div className="vacationHeader">
              <h4>Vacation reality</h4>
              <span>generated {vacation.seasonality.generatedAt}</span>
            </div>
            <div className="metrics vacationGrid">
              <Metric label="Best months" value={formatMonths(vacation.seasonality.bestMonths)} />
              <Metric label="Avoid months" value={formatMonths(vacation.seasonality.avoidMonths)} />
              <Metric label="Best month score" value={bestMonth ? `${bestMonth.label} ${bestMonth.vacationReliabilityScore}/100` : '—'} />
              <Metric label="Rainy days best" value={formatNumber(bestMonth?.rainyDaysPct, '%')} />
              <Metric label="Wave P90 best" value={formatNumber(bestMonth?.waveHeightMaxP90M, 'm')} />
              <Metric label="Sea temp best" value={formatNumber(bestMonth?.seaSurfaceTempMeanC, '°C')} />
              <Metric label="Nearest airport" value={`${vacation.arrival.nearestAirport} · ${vacation.arrival.airportDistanceKm}km`} />
              <Metric label="Arrival friction" value={formatNumber(vacation.arrival.arrivalFrictionScore, '/100')} />
              <Metric label="Safety advisory" value={vacation.arrival.safetyAdvisory?.level ? `US L${vacation.arrival.safetyAdvisory.level}` : '—'} />
              <Metric label="Transfer time" value="— route source needed" />
              <Metric label="Monthly cost proxy" value={formatMoney(vacation.accommodation.monthlyCostProxyUsd)} />
              <Metric label="Accommodation supply" value={formatNumber(vacation.accommodation.accommodationSupplyScore, '/100')} />
              <Metric label="Hotel nightly" value="— manual sample needed" />
              <Metric label="Food+cafe density" value={formatNumber(vacation.osmPoiMetrics.foodCafeDensityPerKm2, '/km²')} />
              <Metric label="Bar/pub/club density" value={formatNumber(vacation.osmPoiMetrics.barPubClubDensityPerKm2, '/km²')} />
              <Metric label="Noise / chaos proxy" value={formatNumber(vacation.noiseChaosMetrics.noiseChaosScore, '/100')} />
              <Metric label="Quietness proxy" value={formatNumber(vacation.noiseChaosMetrics.quietnessScore, '/100')} />
              <Metric label="Day-trip proxy" value={formatNumber(vacation.dayTripMetrics.dayTripScore, '/100')} />
            </div>
          </section>
        )}
        <details className="evidence">
          <summary>Evidence + audit method</summary>
          <p>{city.densityMethod}</p>
          <p><strong>Beach audit:</strong> {city.beachAudit}</p>
          <p><strong>Nightlife audit:</strong> {city.nightlifeAudit}</p>
          {vacation && (
            <>
              <p><strong>Vacation data:</strong> Weather/marine from Open-Meteo 2021–2025; coordinates from OSM Nominatim; airport from OurAirports; POI/accommodation/noise proxies from OSM Overpass; safety level from US State Dept country advisory. Hotel nightly prices, transfer minutes, direct flights, and passport-specific visa rules stay unknown until sourced.</p>
              <div className="sourceLinks">
                <a href={vacation.coordinate.sourceUrl} target="_blank" rel="noreferrer">coordinate</a>
                <a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">Open-Meteo weather</a>
                <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer">Open-Meteo marine</a>
                <a href="https://ourairports.com/data/" target="_blank" rel="noreferrer">OurAirports</a>
                <a href="https://wiki.openstreetmap.org/wiki/Overpass_API" target="_blank" rel="noreferrer">OSM Overpass</a>
                <a href={vacation.arrival.safetyAdvisory.sourceUrl} target="_blank" rel="noreferrer">US advisory</a>
                <a href={vacation.arrival.visa.gbSourceUrl} target="_blank" rel="noreferrer">GB entry rules</a>
              </div>
            </>
          )}
          <div className="sourceLinks">
            {city.sourceUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">source {i + 1}</a>
            ))}
          </div>
        </details>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
