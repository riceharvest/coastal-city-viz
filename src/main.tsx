import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  Map as MapIcon,
  MapPin,
  Plane,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
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
const locationTypes = ['All', 'Island Only', 'Mainland Only'] as const;
const safetyOptions = ['All', 'Level 1 Only', 'Level 1 & 2'] as const;

type PresetFilter = 'all' | 'crystal' | 'island-hopping' | 'surf' | 'quiet' | 'late-night' | 'budget';

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

function getAirportEase(city: City) {
  const vacation = getVacation(city);
  const dist = vacation?.arrival.airportDistanceKm;
  const airport = vacation?.arrival.nearestAirport ?? 'Airport';
  if (dist == null) return { label: 'Unknown', dist: null };

  const isFerryIsland =
    city.tags.includes('island') &&
    (city.city.includes('Gili') || city.city.includes('Perhentian') || city.city.includes('Phangan'));

  if (isFerryIsland) {
    return { label: 'Ferry+Road', dist };
  }

  if (dist <= 15) return { label: 'Very Easy', dist };
  if (dist <= 40) return { label: 'Easy', dist };
  if (dist <= 85) return { label: 'Moderate', dist };
  return { label: 'Long Transfer', dist };
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

function formatMonths(values: string[] | undefined) {
  return values?.length ? values.join(', ') : '—';
}

function reliabilityColor(score: number) {
  if (score >= 80) return 'rgba(16, 185, 129, 0.85)';
  if (score >= 65) return 'rgba(6, 182, 212, 0.8)';
  if (score >= 50) return 'rgba(245, 158, 11, 0.8)';
  return 'rgba(239, 68, 68, 0.8)';
}

function MapView({ cities }: { cities: City[] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [10.0, 108.0],
        zoom: 5,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();
    const bounds: [number, number][] = [];

    cities.forEach((city) => {
      const vacation = getVacation(city);
      if (!vacation?.coordinate?.lat || !vacation?.coordinate?.lon) return;

      const lat = vacation.coordinate.lat;
      const lon = vacation.coordinate.lon;
      bounds.push([lat, lon]);

      const color = verdictColors[city.verdict];
      const fitScore = scoreCity(city);

      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color: ${color}; width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px;">${fitScore}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([lat, lon], { icon });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
          <div style="font-weight: 800; font-size: 15px; color: #0f172a;">${city.city}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">${city.country} · ${city.district}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="background: ${color}20; color: ${color}; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; text-transform: uppercase;">${city.verdict}</span>
            <strong style="color: #0284c7; font-size: 14px;">Fit ${fitScore}/100</strong>
          </div>
          <div style="font-size: 11px; color: #334155; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            👥 Foreign: <b>${city.internationalPct}%</b> | 🏊 Swim: <b>${city.swimmability}/10</b><br/>
            🍸 Density: <b>${city.nightlifeDensity}/km²</b> | 💰 <b>${money(city.monthlyLocalCostUsd)}</b>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      layerGroupRef.current?.addLayer(marker);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
    }
  }, [cities]);

  return <div ref={mapContainerRef} className="mapContainer" />;
}

function App() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'map' | 'analytics' | 'audit'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('All');
  const [verdict, setVerdict] = useState<(typeof verdicts)[number]>('All');
  const [locationType, setLocationType] = useState<(typeof locationTypes)[number]>('All');
  const [preset, setPreset] = useState<PresetFilter>('all');
  const [maxInternational, setMaxInternational] = useState(80);
  const [minSwimmability, setMinSwimmability] = useState(0);
  const [maxAirportDistance, setMaxAirportDistance] = useState(200);
  const [tripMonth, setTripMonth] = useState<TripMonth>('Any');

  // Advanced Drawer Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [safetyFilter, setSafetyFilter] = useState<(typeof safetyOptions)[number]>('All');
  const [maxMonthlyCost, setMaxMonthlyCost] = useState(1500);
  const [minWalkability, setMinWalkability] = useState(0);
  const [minBarsWithin10Walk, setMinBarsWithin10Walk] = useState(0);
  const [minEveningBeachLife, setMinEveningBeachLife] = useState(0);
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
    setLocationType('All');
    setPreset('all');
    setSafetyFilter('All');
    setMaxInternational(80);
    setMinSwimmability(0);
    setMaxAirportDistance(200);
    setTripMonth('Any');
    setMaxMonthlyCost(1500);
    setMinWalkability(0);
    setMinBarsWithin10Walk(0);
    setMinEveningBeachLife(0);
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
    if (safetyFilter !== 'All') count++;
    if (maxAirportDistance < 200) count++;
    if (maxMonthlyCost < 1500) count++;
    if (minWalkability > 0) count++;
    if (minBarsWithin10Walk > 0) count++;
    if (minEveningBeachLife > 0) count++;
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
    safetyFilter,
    maxAirportDistance,
    maxMonthlyCost,
    minWalkability,
    minBarsWithin10Walk,
    minEveningBeachLife,
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
      .filter((c) => {
        const isIsland = c.tags.includes('island');
        if (locationType === 'Island Only') return isIsland;
        if (locationType === 'Mainland Only') return !isIsland;
        return true;
      })
      .filter((c) => {
        if (preset === 'crystal') return c.swimmability >= 8 && c.waterCleanlinessScore >= 8;
        if (preset === 'island-hopping') return c.tags.includes('island-hopping') || (getVacation(c)?.dayTripMetrics.dayTripScore ?? 0) >= 65;
        if (preset === 'surf') return c.tags.includes('surf-culture') || c.tags.includes('kitesurfing');
        if (preset === 'quiet') return (getVacation(c)?.noiseChaosMetrics.noiseChaosScore ?? 50) <= 40;
        if (preset === 'late-night') return c.lateNightVenuesCount >= 18;
        if (preset === 'budget') return c.monthlyLocalCostUsd <= 750;
        return true;
      })
      .filter((c) => {
        const level = getVacation(c)?.arrival.safetyAdvisory?.level;
        if (safetyFilter === 'Level 1 Only') return level === 1;
        if (safetyFilter === 'Level 1 & 2') return level == null || level <= 2;
        return true;
      })
      .filter((c) => c.internationalPct <= maxInternational)
      .filter((c) => c.swimmability >= minSwimmability)
      .filter((c) => c.monthlyLocalCostUsd <= maxMonthlyCost)
      .filter((c) => c.walkability >= minWalkability)
      .filter((c) => c.barsWithin10MinWalk >= minBarsWithin10Walk)
      .filter((c) => c.eveningBeachLifeScore >= minEveningBeachLife)
      .filter((c) => passesMaxKnown(getVacation(c)?.arrival.airportDistanceKm, maxAirportDistance))
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
    locationType,
    preset,
    safetyFilter,
    maxInternational,
    minSwimmability,
    maxMonthlyCost,
    minWalkability,
    minBarsWithin10Walk,
    minEveningBeachLife,
    maxAirportDistance,
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

  const denseAndSwimmable = cities.filter((c) => c.nightlifeDensity >= 200 && c.swimmability >= 7.5).length;
  const topPicksCount = cities.filter((c) => c.verdict === 'top pick').length;

  const heatmapCities = filtered.slice(0, 14).map((city) => ({ city, vacation: getVacation(city) })).filter((item) => item.vacation);
  const arrivalChart = filtered
    .map((city) => ({
      ...city,
      arrivalFrictionScore: getVacation(city)?.arrival.arrivalFrictionScore,
      airportDistanceKm: getVacation(city)?.arrival.airportDistanceKm,
    }))
    .filter((city) => city.arrivalFrictionScore != null);

  return (
    <main className="shell">
      {/* Header */}
      <header>
        <div className="brand">
          <Compass size={22} color="#0284c7" />
          <h1>SEA Coastal Explorer</h1>
        </div>

        <nav>
          <button
            className={activeTab === 'explorer' ? 'active' : ''}
            onClick={() => setActiveTab('explorer')}
          >
            <Compass size={14} /> Explorer
          </button>
          <button
            className={activeTab === 'map' ? 'active' : ''}
            onClick={() => setActiveTab('map')}
          >
            <MapIcon size={14} /> 2D Map
          </button>
          <button
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            <SlidersHorizontal size={14} /> Analytics
          </button>
          <button
            className={activeTab === 'audit' ? 'active' : ''}
            onClick={() => setActiveTab('audit')}
          >
            <Info size={14} /> Methodology
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero">
        <h2>Find swimmable beaches with dense nightlife & lower foreign share</h2>
        <p>
          Source-backed comparison of 52 Southeast Asian coastal destinations.
        </p>

        <div className="heroSummary">
          <span><MapPin size={14} /> Showing <b>{filtered.length}</b> of {cities.length} places</span>
          <span><Beer size={14} /> <b>{denseAndSwimmable}</b> dense + swimmable</span>
          <span><Waves size={14} /> <b>{topPicksCount}</b> top picks</span>
        </div>
      </section>

      {/* Control Panel */}
      <section className="controls">
        <div className="presets">
          <span>Vibe Presets:</span>
          <button className={preset === 'all' ? 'active' : ''} onClick={() => setPreset('all')}>
            <Sparkles size={12} /> All
          </button>
          <button className={preset === 'crystal' ? 'active' : ''} onClick={() => setPreset(preset === 'crystal' ? 'all' : 'crystal')}>
            🌊 Crystal Water
          </button>
          <button className={preset === 'island-hopping' ? 'active' : ''} onClick={() => setPreset(preset === 'island-hopping' ? 'all' : 'island-hopping')}>
            🏝️ Island Hopping
          </button>
          <button className={preset === 'surf' ? 'active' : ''} onClick={() => setPreset(preset === 'surf' ? 'all' : 'surf')}>
            🏄 Surf
          </button>
          <button className={preset === 'quiet' ? 'active' : ''} onClick={() => setPreset(preset === 'quiet' ? 'all' : 'quiet')}>
            🔇 Quiet
          </button>
          <button className={preset === 'late-night' ? 'active' : ''} onClick={() => setPreset(preset === 'late-night' ? 'all' : 'late-night')}>
            🔥 Late-Night
          </button>
          <button className={preset === 'budget' ? 'active' : ''} onClick={() => setPreset(preset === 'budget' ? 'all' : 'budget')}>
            💰 Budget (&le;$750/mo)
          </button>
        </div>

        <div className="search">
          <Search />
          <input
            type="text"
            placeholder="Search by city, country, district, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filterGrid">
          <div className="field">
            <label>Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Verdict</label>
            <select value={verdict} onChange={(e) => setVerdict(e.target.value as typeof verdict)}>
              {verdicts.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Location</label>
            <select value={locationType} onChange={(e) => setLocationType(e.target.value as typeof locationType)}>
              {locationTypes.map((loc) => (
                <option key={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Trip Month</label>
            <select value={tripMonth} onChange={(e) => setTripMonth(e.target.value as TripMonth)}>
              {months.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>
              Max Foreign % <b>{maxInternational}%</b>
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

          <div className="field">
            <label>
              Min Swim <b>{minSwimmability}/10</b>
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
            className={`toggleBtn ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <SlidersHorizontal size={14} /> Advanced {activeAdvancedCount > 0 && `(${activeAdvancedCount})`}
          </button>
        </div>

        {showAdvanced && (
          <div className="drawer">
            <div className="field">
              <label>Safety Advisory Level</label>
              <select value={safetyFilter} onChange={(e) => setSafetyFilter(e.target.value as typeof safetyFilter)}>
                {safetyOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <RangeField label="Max Monthly Budget" value={maxMonthlyCost} min={400} max={1500} step={50} onChange={setMaxMonthlyCost} prefix="$" />
            <RangeField label="Min Walkability" value={minWalkability} min={0} max={10} step={0.5} onChange={setMinWalkability} suffix="/10" />
            <RangeField label="Max Airport Distance" value={maxAirportDistance} min={10} max={200} step={10} onChange={setMaxAirportDistance} suffix="km" />
            <RangeField label="Min 10m-Walk Bars" value={minBarsWithin10Walk} min={0} max={60} step={5} onChange={setMinBarsWithin10Walk} />
            <RangeField label="Min Late-Night Venues" value={minLateNightVenues} min={0} max={120} step={5} onChange={setMinLateNightVenues} />
            <RangeField label="Min Evening Beach" value={minEveningBeachLife} min={0} max={10} step={0.5} onChange={setMinEveningBeachLife} suffix="/10" />
            <RangeField label="Min Clean Water" value={minWaterCleanliness} min={0} max={10} step={0.5} onChange={setMinWaterCleanliness} suffix="/10" />
            <RangeField label="Max Bar Cluster Radius" value={maxClusterRadius} min={400} max={3500} step={100} onChange={setMaxClusterRadius} suffix="m" />
            <RangeField label="Min Nightlife Density" value={minNightlifeDensity} min={0} max={900} step={50} onChange={setMinNightlifeDensity} suffix="/km²" />
            <RangeField label="Min Reliability" value={minVacationReliability} min={0} max={100} step={5} onChange={setMinVacationReliability} suffix="/100" />
            <RangeField label="Max Friction" value={maxArrivalFriction} min={0} max={100} step={5} onChange={setMaxArrivalFriction} suffix="/100" />
            <RangeField label="Max Noise / Chaos" value={maxNoiseChaos} min={0} max={100} step={5} onChange={setMaxNoiseChaos} suffix="/100" />
            <RangeField label="Min Food Density" value={minFoodCafeDensity} min={0} max={200} step={5} onChange={setMinFoodCafeDensity} suffix="/km²" />
            <RangeField label="Min Day Trips" value={minDayTripScore} min={0} max={100} step={5} onChange={setMinDayTripScore} suffix="/100" />
            <div className="reset">
              <button onClick={resetFilters}>
                <RotateCcw size={12} /> Reset Filters
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2D Map Tab View */}
      {activeTab === 'map' && (
        <section>
          <MapView cities={filtered} />
        </section>
      )}

      {/* Destination List */}
      {activeTab === 'explorer' && (
        <section className="cardList">
          {filtered.map((city, idx) => (
            <DestinationCard key={`${city.city}-${city.district}`} city={city} rank={idx + 1} />
          ))}
          {filtered.length === 0 && (
            <div className="empty">
              No destinations match your filter criteria. Try resetting filters or choosing "All".
            </div>
          )}
        </section>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <section className="analytics">
          <div className="chartCard">
            <h3>Foreign Tourists vs Nightlife Density</h3>
            <p>Upper-left is target: low foreign share + high bar density. Bubble size = swimmability.</p>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis type="number" dataKey="internationalPct" name="Foreign Tourists" unit="%" domain={[0, 50]} stroke="#64748b" />
                <YAxis type="number" dataKey="nightlifeDensity" name="Nightlife Density" unit="/km²" stroke="#64748b" />
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
            <h3>Beach Quality & Water Cleanliness</h3>
            <p>Comparing physical beach usability and water cleanliness scores.</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={filtered.slice(0, 12)} margin={{ top: 10, right: 10, bottom: 50, left: 0 }}>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis dataKey="city" angle={-35} textAnchor="end" stroke="#64748b" interval={0} height={60} />
                <YAxis stroke="#64748b" domain={[0, 10]} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, color: '#0f172a' }} />
                <Legend />
                <Bar dataKey="beachQualityScore" name="Beach Quality" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="waterCleanlinessScore" name="Water Cleanliness" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chartCard chartCardFull">
            <h3>Monthly Weather Reliability Heatmap</h3>
            <p>Open-Meteo multi-year climate & marine P90 wave history score per month (0–100).</p>
            <div className="heatmap">
              <div className="heatmapRow">
                <span className="lbl" />
                {months.slice(1).map((m) => (
                  <span className="lbl" key={m}>{m}</span>
                ))}
              </div>
              {heatmapCities.map(({ city, vacation }) => (
                <div className="heatmapRow" key={city.city}>
                  <strong>{city.city}</strong>
                  {vacation!.seasonality.monthly.map((m) => (
                    <div
                      key={m.label}
                      className="cell"
                      style={{ background: reliabilityColor(m.vacationReliabilityScore) }}
                      title={`${city.city} (${m.label}): ${m.vacationReliabilityScore}/100 | Rain ${m.rainyDaysPct}% | Wave P90 ${formatNumber(m.waveHeightMaxP90M, 'm')}`}
                    >
                      {m.vacationReliabilityScore}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Methodology Tab */}
      {activeTab === 'audit' && (
        <section className="audit">
          <h3>Audit & Fit Score Methodology</h3>
          <p>
            This dashboard compares Southeast Asian coastal destinations on three primary factors:
          </p>
          <p>1. <strong>Domestic Atmosphere (22%)</strong>: High local share, low foreign tourist overcrowding.</p>
          <p>2. <strong>Beach Usability (28%)</strong>: Swimmability, clean water, sand quality, rip safety, evening promenade.</p>
          <p>3. <strong>Compact Nightlife (40%)</strong>: Nightlife density per km², 10-min walk venues, cluster compactness.</p>
        </section>
      )}
    </main>
  );
}

function RangeField({
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
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="field">
      <label>
        {label} <b>{prefix}{value}{suffix}</b>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function DestinationCard({ city, rank }: { city: City; rank: number }) {
  const vacation = getVacation(city);
  const fitScore = scoreCity(city);
  const airportEase = getAirportEase(city);

  return (
    <article className="card">
      <header className="cardHead">
        <div className="cardTitle">
          <span className="rank">#{rank}</span>
          <div>
            <h3 className="name">{city.city}</h3>
            <span className="sub">{city.country} · {city.district}</span>
          </div>
        </div>

        <div className="cardBadges">
          <span
            className="verdict"
            style={{ background: `${verdictColors[city.verdict]}20`, color: verdictColors[city.verdict] }}
          >
            {city.verdict}
          </span>
          <span className="score">{fitScore}</span>
        </div>
      </header>

      <p className="notes">{city.notes}</p>

      {/* Streamlined Metrics Line */}
      <div className="cardMetrics">
        <span>👥 Foreigners: <strong>{city.internationalPct}%</strong></span>
        <span>🏊 Swim: <strong>{city.swimmability}/10</strong></span>
        <span>✈️ Airport: <strong>{airportEase.label} ({airportEase.dist != null ? `${airportEase.dist}km` : '—'})</strong></span>
        <span>🍸 Density: <strong>{city.nightlifeDensity}/km²</strong></span>
        <span>🚶 10m Bars: <strong>{city.barsWithin10MinWalk}</strong></span>
        <span>💰 Cost: <strong>{money(city.monthlyLocalCostUsd)}</strong></span>
        <span>☀️ Best: <strong>{formatMonths(vacation?.seasonality.bestMonths)}</strong></span>
      </div>

      <div className="tags">
        {city.tags.map((tag) => (
          <span key={tag} className="tag">#{tag}</span>
        ))}
      </div>

      {/* Native Lightweight Details Drawer */}
      <details>
        <summary>View Evidence & Audit Notes</summary>
        <div className="detailsContent">
          <p><strong>Nightlife Density:</strong> {city.densityMethod}</p>
          <p><strong>Beach Audit:</strong> {city.beachAudit}</p>
          <p><strong>Nightlife Audit:</strong> {city.nightlifeAudit}</p>
          <p><strong>Beach Walkability:</strong> {city.walkability}/10 | <strong>Clean Water:</strong> {city.waterCleanlinessScore}/10 | <strong>Safety:</strong> {city.currentSafetyScore}/10</p>
          {vacation?.arrival.nearestAirport && (
            <p><strong>Airport:</strong> {vacation.arrival.nearestAirport} ({vacation.arrival.airportDistanceKm}km) | <strong>Advisory:</strong> {vacation.arrival.safetyAdvisory?.level ? `US Level ${vacation.arrival.safetyAdvisory.level}` : '—'}</p>
          )}

          <div className="links">
            {city.sourceUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                Source #{i + 1}
              </a>
            ))}
          </div>
        </div>
      </details>
    </article>
  );
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null;
  const city: City = payload[0].payload;
  return (
    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
      <strong>{city.city}</strong> ({city.country})<br />
      Foreign Tourists: {city.internationalPct}% | Density: {city.nightlifeDensity}/km²<br />
      Fit Score: {scoreCity(city)}/100
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
