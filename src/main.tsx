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
import {
  Beer,
  Compass,
  Footprints,
  Info,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Waves,
} from 'lucide-react';
import { cities, type City } from './data';
import { vacationDataByKey, type VacationRecord } from './vacationData';
import './styles.css';

const verdictColors: Record<City['verdict'], string> = {
  'top pick': '#10b981',
  possible: '#06b6d4',
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

function reliabilityColor(score: number) {
  if (score >= 80) return 'rgba(16, 185, 129, 0.85)';
  if (score >= 65) return 'rgba(6, 182, 212, 0.8)';
  if (score >= 50) return 'rgba(245, 158, 11, 0.8)';
  return 'rgba(239, 68, 68, 0.8)';
}

function App() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'analytics' | 'audit'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('All');
  const [verdict, setVerdict] = useState<(typeof verdicts)[number]>('All');
  const [maxInternational, setMaxInternational] = useState(80);
  const [minSwimmability, setMinSwimmability] = useState(0);
  const [tripMonth, setTripMonth] = useState<TripMonth>('Any');

  // Advanced Drawer Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minWaterCleanliness, setMinWaterCleanliness] = useState(0);
  const [maxClusterRadius, setMaxClusterRadius] = useState(3500);
  const [minLateNightVenues, setMinLateNightVenues] = useState(0);
  const [minNightlifeDensity, setMinNightlifeDensity] = useState(0);
  const [minVacationReliability, setMinVacationReliability] = useState(0);
  const [maxArrivalFriction, setMaxArrivalFriction] = useState(100);
  const [maxNoiseChaos, setMaxNoiseChaos] = useState(100);
  const [minFoodCafeDensity, setMinFoodCafeDensity] = useState(0);
  const [minDayTripScore, setMinDayTripScore] = useState(0);

  const resetFilters = () => {
    setSearchQuery('');
    setCountry('All');
    setVerdict('All');
    setMaxInternational(80);
    setMinSwimmability(0);
    setTripMonth('Any');
    setMinWaterCleanliness(0);
    setMaxClusterRadius(3500);
    setMinLateNightVenues(0);
    setMinNightlifeDensity(0);
    setMinVacationReliability(0);
    setMaxArrivalFriction(100);
    setMaxNoiseChaos(100);
    setMinFoodCafeDensity(0);
    setMinDayTripScore(0);
  };

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (minWaterCleanliness > 0) count++;
    if (maxClusterRadius < 3500) count++;
    if (minLateNightVenues > 0) count++;
    if (minNightlifeDensity > 0) count++;
    if (minVacationReliability > 0) count++;
    if (maxArrivalFriction < 100) count++;
    if (maxNoiseChaos < 100) count++;
    if (minFoodCafeDensity > 0) count++;
    if (minDayTripScore > 0) count++;
    return count;
  }, [
    minWaterCleanliness,
    maxClusterRadius,
    minLateNightVenues,
    minNightlifeDensity,
    minVacationReliability,
    maxArrivalFriction,
    maxNoiseChaos,
    minFoodCafeDensity,
    minDayTripScore,
  ]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cities
      .filter((c) => {
        if (!q) return true;
        return (
          c.city.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.notes.toLowerCase().includes(q)
        );
      })
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
    searchQuery,
    country,
    verdict,
    maxInternational,
    minSwimmability,
    minWaterCleanliness,
    maxClusterRadius,
    minLateNightVenues,
    minNightlifeDensity,
    tripMonth,
    minVacationReliability,
    maxArrivalFriction,
    maxNoiseChaos,
    minFoodCafeDensity,
    minDayTripScore,
  ]);

  const top = filtered[0];
  const denseAndSwimmable = cities.filter((c) => c.nightlifeDensity >= 200 && c.swimmability >= 7.5).length;
  const topPicksCount = cities.filter((c) => c.verdict === 'top pick').length;

  const heatmapCities = filtered.slice(0, 14).map((city) => ({ city, vacation: getVacation(city) })).filter((item) => item.vacation);
  const arrivalChart = filtered
    .map((city) => ({ ...city, arrivalFrictionScore: getVacation(city)?.arrival.arrivalFrictionScore }))
    .filter((city) => city.arrivalFrictionScore != null);

  return (
    <main className="shell">
      {/* Navigation Header */}
      <header className="headerNav">
        <div className="brand">
          <div className="brandIcon">
            <Compass size={24} />
          </div>
          <div>
            <div className="brandTitle">SEA Coastal Explorer</div>
            <div className="brandSubtitle">Source-backed audit of beach & nightlife destinations</div>
          </div>
        </div>

        <nav className="viewTabs">
          <button
            className={`tabBtn ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            <Compass size={16} /> Explorer
          </button>
          <button
            className={`tabBtn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <SlidersHorizontal size={16} /> Analytics
          </button>
          <button
            className={`tabBtn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <Info size={16} /> Methodology
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="heroEyebrow">
          <Waves size={14} /> 52 Audited SEA Coastal Destinations
        </div>
        <h1>Find swimmable beaches with dense nightlife and fewer foreigners.</h1>
        <p>
          Compare Southeast Asian coastal destinations by domestic tourist share, beach swimmability,
          nightlife compactness, weather reliability, and living costs.
        </p>

        <div className="heroStats">
          <StatCard icon={<MapPin />} label="Places Shown" value={`${filtered.length} / ${cities.length}`} />
          <StatCard icon={<Beer />} label="Dense + Swimmable" value={`${denseAndSwimmable} places`} />
          <StatCard icon={<Waves />} label="Top Pick Destinations" value={`${topPicksCount} spots`} />
          <StatCard icon={<Footprints />} label="#1 Match" value={top ? top.city : '—'} />
        </div>
      </section>

      {/* Main Controls (Filter Panel) */}
      <section className="controlPanel">
        <div className="searchBar">
          <Search className="searchIcon" />
          <input
            type="text"
            className="searchInput"
            placeholder="Search by city, country, district, or tag (e.g. Krabi, swimmable, Vietnam)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="primaryFilters">
          <div className="filterGroup">
            <label>Country</label>
            <select className="selectInput" value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <label>Verdict</label>
            <select className="selectInput" value={verdict} onChange={(e) => setVerdict(e.target.value as typeof verdict)}>
              {verdicts.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <label>Trip Month</label>
            <select className="selectInput" value={tripMonth} onChange={(e) => setTripMonth(e.target.value as TripMonth)}>
              {months.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <label>
              Max Foreign Tourists <span className="val">{maxInternational}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={maxInternational}
              onChange={(e) => setMaxInternational(Number(e.target.value))}
            />
          </div>

          <div className="filterGroup">
            <label>
              Min Swimmability <span className="val">{minSwimmability}/10</span>
            </label>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={minSwimmability}
              onChange={(e) => setMinSwimmability(Number(e.target.value))}
            />
          </div>

          <button
            className={`advancedToggleBtn ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <SlidersHorizontal size={16} /> Advanced {activeAdvancedCount > 0 && `(${activeAdvancedCount})`}
          </button>
        </div>

        {showAdvanced && (
          <div className="advancedDrawer">
            <RangeFilter label="Min Clean Water" value={minWaterCleanliness} min={0} max={10} step={0.5} onChange={setMinWaterCleanliness} suffix="/10" />
            <RangeFilter label="Max Bar Cluster Radius" value={maxClusterRadius} min={400} max={3500} step={100} onChange={setMaxClusterRadius} suffix="m" />
            <RangeFilter label="Min Late-Night Venues" value={minLateNightVenues} min={0} max={120} step={5} onChange={setMinLateNightVenues} />
            <RangeFilter label="Min Nightlife Density" value={minNightlifeDensity} min={0} max={900} step={50} onChange={setMinNightlifeDensity} suffix="/km²" />
            <RangeFilter label="Min Vacation Reliability" value={minVacationReliability} min={0} max={100} step={5} onChange={setMinVacationReliability} suffix="/100" />
            <RangeFilter label="Max Arrival Friction" value={maxArrivalFriction} min={0} max={100} step={5} onChange={setMaxArrivalFriction} suffix="/100" />
            <RangeFilter label="Max Noise / Chaos" value={maxNoiseChaos} min={0} max={100} step={5} onChange={setMaxNoiseChaos} suffix="/100" />
            <RangeFilter label="Min Food+Cafe Density" value={minFoodCafeDensity} min={0} max={200} step={5} onChange={setMinFoodCafeDensity} suffix="/km²" />
            <RangeFilter label="Min Day-Trip Score" value={minDayTripScore} min={0} max={100} step={5} onChange={setMinDayTripScore} suffix="/100" />
            <div className="drawerFooter">
              <button className="resetBtn" onClick={resetFilters}>
                <RotateCcw size={12} /> Reset All Filters
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Explorer Tab Content */}
      {activeTab === 'explorer' && (
        <section className="cardList">
          {filtered.map((city, idx) => (
            <DestinationCard key={`${city.city}-${city.district}`} city={city} rank={idx + 1} />
          ))}
          {filtered.length === 0 && (
            <div className="emptyState">
              No destinations match your filter criteria. Try resetting filters or choosing "All".
            </div>
          )}
        </section>
      )}

      {/* Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <section className="analyticsContainer">
          <div className="chartCard">
            <div className="chartHeader">
              <h2>International Tourists vs Nightlife Density</h2>
              <p>Top-left quadrant is ideal: low foreign share + high bar density. Bubble size represents swimmability.</p>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  type="number"
                  dataKey="internationalPct"
                  name="Foreign Tourists"
                  unit="%"
                  domain={[0, 50]}
                  stroke="#94a3b8"
                />
                <YAxis
                  type="number"
                  dataKey="nightlifeDensity"
                  name="Nightlife Density"
                  unit="/km²"
                  stroke="#94a3b8"
                />
                <ZAxis type="number" dataKey="swimmability" range={[60, 240]} />
                <Tooltip content={<ScatterTooltip />} />
                <Scatter data={filtered}>
                  {filtered.map((entry) => (
                    <Cell key={entry.city} fill={verdictColors[entry.verdict]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="chartCard">
            <div className="chartHeader">
              <h2>Beach Quality & Water Cleanliness Audit</h2>
              <p>Comparing physical beach usability and water cleanliness scores across filtered destinations.</p>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={filtered.slice(0, 12)} margin={{ top: 20, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="city" angle={-35} textAnchor="end" stroke="#94a3b8" interval={0} height={70} />
                <YAxis stroke="#94a3b8" domain={[0, 10]} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                <Legend />
                <Bar dataKey="beachQualityScore" name="Beach Quality" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="waterCleanlinessScore" name="Water Cleanliness" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chartCard chartCardFull">
            <div className="chartHeader">
              <h2>Monthly Weather & Vacation Reliability Heatmap</h2>
              <p>Multi-year Open-Meteo climate & marine P90 wave history score per month (0–100).</p>
            </div>
            <div className="heatmapWrapper">
              <div className="heatmapGrid">
                <div className="heatmapHeaderRow">
                  <span />
                  {months.slice(1).map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
                {heatmapCities.map(({ city, vacation }) => (
                  <div className="heatmapDataRow" key={city.city}>
                    <strong>{city.city}</strong>
                    {vacation!.seasonality.monthly.map((m) => (
                      <div
                        key={m.label}
                        className="heatmapCell"
                        style={{ background: reliabilityColor(m.vacationReliabilityScore) }}
                        title={`${city.city} (${m.label}): Reliability ${m.vacationReliabilityScore}/100 | Rain ${m.rainyDaysPct}% | Wave P90 ${formatNumber(m.waveHeightMaxP90M, 'm')}`}
                      >
                        {m.vacationReliabilityScore}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="chartCard chartCardFull">
            <div className="chartHeader">
              <h2>Arrival Friction vs Overall Fit Score</h2>
              <p>Airport transfer distance and safety advisory friction compared to city fit score.</p>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" dataKey={(c) => scoreCity(c as City)} name="Fit Score" domain={[0, 100]} stroke="#94a3b8" />
                <YAxis type="number" dataKey="arrivalFrictionScore" name="Arrival Friction" domain={[0, 100]} stroke="#94a3b8" />
                <Tooltip content={<ArrivalScatterTooltip />} />
                <Scatter data={arrivalChart}>
                  {arrivalChart.map((entry) => (
                    <Cell key={entry.city} fill={verdictColors[entry.verdict]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Audit / Methodology Tab Content */}
      {activeTab === 'audit' && (
        <section className="auditSection">
          <h2>Data Audit & Scoring Methodology</h2>
          <p>
            This index compares Southeast Asian coastal locations on three primary pillars:
            <strong> Domestic atmosphere</strong> (low international tourist congestion),
            <strong> Beach swimmability & cleanliness</strong>, and <strong> Compact walkable nightlife</strong>.
          </p>

          <div className="formulaGrid">
            <div className="formulaCard">
              <h3>1. Domestic Atmosphere (22%)</h3>
              <p>
                Calculated as <code>(100 - internationalPct)</code>. Locations with under 20% international
                tourist share rank significantly higher for authentic local culture and non-overcrowded vibes.
              </p>
            </div>

            <div className="formulaCard">
              <h3>2. Beach Usability (28%)</h3>
              <p>
                Composite score of 5 sub-factors: swimmability, physical sand/beach quality, water cleanliness,
                current/rip safety, and evening promenade activity.
              </p>
            </div>

            <div className="formulaCard">
              <h3>3. Walkable Nightlife (40%)</h3>
              <p>
                Combines bar density per km², venue count within a 10-minute walk, late-night operating venues,
                and compact cluster radius (penalizes spread-out 10km highway resort strips).
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="statCard">
      <div className="statIcon">{icon}</div>
      <div className="statInfo">
        <span className="statLabel">{label}</span>
        <span className="statValue">{value}</span>
      </div>
    </div>
  );
}

function RangeFilter({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="filterGroup">
      <label>
        {label} <span className="val">{value}{suffix}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function DestinationCard({ city, rank }: { city: City; rank: number }) {
  const [activeSubTab, setActiveSubTab] = useState<'beach' | 'nightlife' | 'travel' | 'evidence'>('beach');
  const vacation = getVacation(city);
  const fitScore = scoreCity(city);
  const bestMonth = vacation?.seasonality.monthly.reduce(
    (best, m) => (m.vacationReliabilityScore > best.vacationReliabilityScore ? m : best),
    vacation.seasonality.monthly[0]
  );

  return (
    <article className="destCard" style={{ borderColor: `${verdictColors[city.verdict]}44` }}>
      <div className="destCardHeader">
        <div className="destCardTitleRow">
          <div className="rankBadge">#{rank}</div>
          <div>
            <h3 className="cityName">{city.city}</h3>
            <div className="citySub">
              {city.country} · {city.district}
            </div>
          </div>
        </div>

        <div className="headerBadges">
          <span
            className="verdictPill"
            style={{ background: `${verdictColors[city.verdict]}22`, color: verdictColors[city.verdict] }}
          >
            {city.verdict}
          </span>
          <div className="fitScoreBadge">
            <span className="scoreNum">{fitScore}</span>
            <span className="scoreLabel">Fit Score</span>
          </div>
        </div>
      </div>

      <p className="cardNotes">{city.notes}</p>

      <div className="tagRow">
        {city.tags.map((tag) => (
          <span key={tag} className="tagPill">
            #{tag}
          </span>
        ))}
      </div>

      {/* Key Metrics Summary Grid */}
      <div className="cardMetricGrid">
        <div className="metricBox">
          <span className="label">Foreign Tourists</span>
          <span className="val">{city.internationalPct}%</span>
        </div>
        <div className="metricBox">
          <span className="label">Swimmability</span>
          <span className="val">{city.swimmability} / 10</span>
        </div>
        <div className="metricBox">
          <span className="label">Nightlife Density</span>
          <span className="val">{city.nightlifeDensity} / km²</span>
        </div>
        <div className="metricBox">
          <span className="label">10-Min Walk Bars</span>
          <span className="val">{city.barsWithin10MinWalk} venues</span>
        </div>
        <div className="metricBox">
          <span className="label">Local Monthly Cost</span>
          <span className="val">{money(city.monthlyLocalCostUsd)}</span>
        </div>
        <div className="metricBox">
          <span className="label">Best Weather</span>
          <span className="val">{formatMonths(vacation?.seasonality.bestMonths)}</span>
        </div>
      </div>

      {/* Expandable Sub-Tabs */}
      <div className="cardAccordion">
        <div className="accordionHeader">
          <div className="detailTabs">
            <button
              className={`detailTabBtn ${activeSubTab === 'beach' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('beach')}
            >
              🏖️ Beach & Swim
            </button>
            <button
              className={`detailTabBtn ${activeSubTab === 'nightlife' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('nightlife')}
            >
              🍸 Nightlife & Vibe
            </button>
            <button
              className={`detailTabBtn ${activeSubTab === 'travel' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('travel')}
            >
              ✈️ Travel & Weather
            </button>
            <button
              className={`detailTabBtn ${activeSubTab === 'evidence' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('evidence')}
            >
              📜 Audit & Evidence
            </button>
          </div>
        </div>

        <div className="detailPanel">
          {activeSubTab === 'beach' && (
            <div className="subMetricGrid">
              <div className="subMetricBox">
                <span>Beach Quality</span>
                <strong>{city.beachQualityScore} / 10</strong>
              </div>
              <div className="subMetricBox">
                <span>Water Cleanliness</span>
                <strong>{city.waterCleanlinessScore} / 10</strong>
              </div>
              <div className="subMetricBox">
                <span>Swim Safety</span>
                <strong>{city.currentSafetyScore} / 10</strong>
              </div>
              <div className="subMetricBox">
                <span>Evening Beach Life</span>
                <strong>{city.eveningBeachLifeScore} / 10</strong>
              </div>
              <div className="subMetricBox">
                <span>Beach Walkability</span>
                <strong>{city.walkability} / 10</strong>
              </div>
              <div className="subMetricBox">
                <span>Beach Distance</span>
                <strong>{city.beachDistanceKm} km</strong>
              </div>
            </div>
          )}

          {activeSubTab === 'nightlife' && (
            <div className="subMetricGrid">
              <div className="subMetricBox">
                <span>Bars in 10m Walk</span>
                <strong>{city.barsWithin10MinWalk}</strong>
              </div>
              <div className="subMetricBox">
                <span>Late Night Venues</span>
                <strong>{city.lateNightVenuesCount}</strong>
              </div>
              <div className="subMetricBox">
                <span>Bar Cluster Radius</span>
                <strong>{city.barClusterRadiusMeters} m</strong>
              </div>
              <div className="subMetricBox">
                <span>vs Amsterdam Core</span>
                <strong>{city.densityVsAmsterdamPct}%</strong>
              </div>
            </div>
          )}

          {activeSubTab === 'travel' && (
            <div className="subMetricGrid">
              <div className="subMetricBox">
                <span>Nearest Airport</span>
                <strong>{vacation?.arrival.nearestAirport ?? '—'} ({formatNumber(vacation?.arrival.airportDistanceKm, 'km')})</strong>
              </div>
              <div className="subMetricBox">
                <span>Arrival Friction</span>
                <strong>{formatNumber(vacation?.arrival.arrivalFrictionScore, ' / 100')}</strong>
              </div>
              <div className="subMetricBox">
                <span>US Safety Advisory</span>
                <strong>{vacation?.arrival.safetyAdvisory?.level ? `Level ${vacation.arrival.safetyAdvisory.level}` : '—'}</strong>
              </div>
              <div className="subMetricBox">
                <span>Peak Month Weather</span>
                <strong>{bestMonth ? `${bestMonth.label} (${bestMonth.vacationReliabilityScore}/100)` : '—'}</strong>
              </div>
            </div>
          )}

          {activeSubTab === 'evidence' && (
            <div className="evidenceBlock">
              <p><strong>Density Method:</strong> {city.densityMethod}</p>
              <p><strong>Beach Audit:</strong> {city.beachAudit}</p>
              <p><strong>Nightlife Audit:</strong> {city.nightlifeAudit}</p>

              <div className="sourceLinks">
                {city.sourceUrls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="sourceLink">
                    Source #{i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null;
  const city: City = payload[0].payload;
  return (
    <div className="customTooltip">
      <strong>{city.city}</strong>
      <span>Country: {city.country} ({city.district})</span>
      <span>Foreign Tourists: {city.internationalPct}%</span>
      <span>Nightlife Density: {city.nightlifeDensity} / km²</span>
      <span>Swimmability: {city.swimmability} / 10</span>
      <span>Fit Score: {scoreCity(city)} / 100</span>
    </div>
  );
}

function ArrivalScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null;
  const city: City = payload[0].payload;
  const vacation = getVacation(city);
  return (
    <div className="customTooltip">
      <strong>{city.city}</strong>
      <span>Fit Score: {scoreCity(city)} / 100</span>
      <span>Arrival Friction: {formatNumber(vacation?.arrival.arrivalFrictionScore, ' / 100')}</span>
      <span>Airport: {vacation?.arrival.nearestAirport ?? '—'} ({formatNumber(vacation?.arrival.airportDistanceKm, 'km')})</span>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
