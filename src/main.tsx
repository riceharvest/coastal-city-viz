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

function scoreCity(city: City) {
  const lowInternationalScore = 100 - city.internationalPct;
  const densityScore = Math.min(city.nightlifeDensity / 7, 100);
  const compactScore = city.nightlifeCompactness * 10;
  const swimScore = city.swimmability * 10;
  const beachWalkScore = city.walkability * 10;

  return Math.round(
    lowInternationalScore * 0.25 +
      densityScore * 0.25 +
      compactScore * 0.2 +
      swimScore * 0.2 +
      beachWalkScore * 0.1
  );
}

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

function App() {
  const [country, setCountry] = useState('All');
  const [verdict, setVerdict] = useState<(typeof verdicts)[number]>('All');
  const [maxInternational, setMaxInternational] = useState(80);
  const [minSwimmability, setMinSwimmability] = useState(0);
  const [minNightlifeDensity, setMinNightlifeDensity] = useState(0);

  const filtered = useMemo(() => {
    return cities
      .filter((c) => country === 'All' || c.country === country)
      .filter((c) =>
        verdict === 'All' ? true : verdict === 'Viable only' ? c.verdict !== 'reject' : c.verdict === verdict
      )
      .filter((c) => c.internationalPct <= maxInternational)
      .filter((c) => c.swimmability >= minSwimmability)
      .filter((c) => c.nightlifeDensity >= minNightlifeDensity)
      .sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict] || scoreCity(b) - scoreCity(a));
  }, [country, maxInternational, minNightlifeDensity, minSwimmability, verdict]);

  const top = filtered[0];
  const denseEnough = cities.filter((c) => c.nightlifeDensity >= 250 && c.swimmability >= 5).length;

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
          <Stat icon={<Waves />} label="best beach" value={top ? `${top.swimmability}/10` : '—'} />
          <Stat icon={<Footprints />} label="top shown" value={top ? top.city : '—'} />
        </div>
      </section>

      <section className="shell panel filters">
        <div className="sectionTitle">
          <SlidersHorizontal />
          <div>
            <h2>Filters</h2>
            <p>Default view shows all 28 audited places. Tighten filters to find the actual target band.</p>
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
          <Range label="Min nightlife density" value={minNightlifeDensity} min={0} max={900} step={50} onChange={setMinNightlifeDensity} suffix="/km²" />
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
          <h2>Beach + nightlife quality</h2>
          <p>Scores are 1–10. This catches places that are local but too quiet, or dense but not swimmable.</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={filtered} margin={{ top: 20, right: 20, bottom: 80, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="city" angle={-35} textAnchor="end" interval={0} stroke="#94a3b8" height={90} />
              <YAxis stroke="#94a3b8" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="swimmability" name="Swimmable beach" fill="#38bdf8" />
              <Bar dataKey="nightlifeCompactness" name="Nightlife compactness" fill="#a78bfa" />
            </BarChart>
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
      <span>Compactness: {city.nightlifeCompactness}/10</span>
      <span>Swimmability: {city.swimmability}/10</span>
      <span>Fit score: {scoreCity(city)}/100</span>
    </div>
  );
}

function CityCard({ city, rank }: { city: City; rank: number }) {
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
          <Metric label="Compactness" value={`${city.nightlifeCompactness}/10`} />
          <Metric label="Swimmability" value={`${city.swimmability}/10`} />
          <Metric label="Beach walk" value={`${city.walkability}/10`} />
          <Metric label="Beach distance" value={`${city.beachDistanceKm}km`} />
          <Metric label="vs Amsterdam" value={`${city.densityVsAmsterdamPct}%`} />
          <Metric label="Monthly cost" value={`${money(city.monthlyLocalCostUsd)} mid`} />
          <Metric label="Cost range" value={`${money(city.monthlyCostRangeUsd[0])}-${money(city.monthlyCostRangeUsd[1])}`} />
          <Metric label="Fit score" value={`${scoreCity(city)}/100`} />
        </div>
        <details className="evidence">
          <summary>Evidence + audit method</summary>
          <p>{city.densityMethod}</p>
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
