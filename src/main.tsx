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
import { MapPin, SlidersHorizontal, Wallet, Users, Footprints, Beer } from 'lucide-react';
import { cities, type City } from './data';
import './styles.css';

const verdictColors: Record<City['verdict'], string> = {
  'top pick': '#22c55e',
  possible: '#38bdf8',
  'weak fit': '#f59e0b',
  reject: '#ef4444',
};

const countries = ['All', ...Array.from(new Set(cities.map((c) => c.country))).sort()];
const verdicts = ['All', 'top pick', 'possible', 'weak fit', 'reject'] as const;

function scoreCity(city: City) {
  const localScore = city.domesticPct;
  const densityScore = Math.min(city.densityVsAmsterdamPct, 120) / 1.2;
  const walkScore = city.walkability * 10;
  const beachScore = Math.max(0, 100 - city.beachDistanceKm * 35);
  return Math.round(localScore * 0.35 + densityScore * 0.25 + walkScore * 0.25 + beachScore * 0.15);
}

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

function App() {
  const [country, setCountry] = useState('All');
  const [verdict, setVerdict] = useState<(typeof verdicts)[number]>('All');
  const [maxInternational, setMaxInternational] = useState(35);
  const [minWalkability, setMinWalkability] = useState(1);
  const [maxCost, setMaxCost] = useState(1600);

  const filtered = useMemo(() => {
    return cities
      .filter((c) => country === 'All' || c.country === country)
      .filter((c) => verdict === 'All' || c.verdict === verdict)
      .filter((c) => c.internationalPct <= maxInternational)
      .filter((c) => c.walkability >= minWalkability)
      .filter((c) => c.monthlyLocalCostUsd <= maxCost)
      .sort((a, b) => scoreCity(b) - scoreCity(a));
  }, [country, maxCost, maxInternational, minWalkability, verdict]);

  const top = filtered[0];

  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow">SEA coastal city filter</div>
        <h1>Find local beach cities with real walkable nightlife density.</h1>
        <p>
          Compare domestic tourism %, nightlife density, registered population, local-ish monthly costs,
          and beach-to-bar walkability. Data is intentionally editable in <code>src/data.ts</code>.
        </p>
        <div className="heroStats">
          <Stat icon={<MapPin />} label="cities" value={cities.length.toString()} />
          <Stat icon={<Beer />} label="Amsterdam ref." value="700/km²" />
          <Stat icon={<Footprints />} label="best walk" value={top ? `${top.walkability}/10` : '—'} />
          <Stat icon={<Wallet />} label="cheapest shown" value={filtered.length ? money(Math.min(...filtered.map((c) => c.monthlyLocalCostUsd))) : '—'} />
        </div>
      </section>

      <section className="shell panel filters">
        <div className="sectionTitle">
          <SlidersHorizontal />
          <div>
            <h2>Filters</h2>
            <p>Default is strict: ≤35% international tourists.</p>
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
          <Range label="Max international %" value={maxInternational} min={5} max={80} step={5} onChange={setMaxInternational} suffix="%" />
          <Range label="Min walkability" value={minWalkability} min={1} max={10} step={0.5} onChange={setMinWalkability} suffix="/10" />
          <Range label="Max monthly local cost" value={maxCost} min={400} max={1800} step={50} onChange={setMaxCost} prefix="$" />
        </div>
      </section>

      <section className="shell charts">
        <div className="panel chartPanel">
          <h2>International tourists vs nightlife density</h2>
          <p>Best zone is upper-left: fewer foreigners, denser nightlife. Bubble size = beach-to-bar walkability.</p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 28, bottom: 42, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis
                type="number"
                dataKey="internationalPct"
                name="International tourists"
                unit="%"
                domain={[0, 80]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80]}
                stroke="#94a3b8"
                label={{ value: 'International tourists in nightlife zone — lower is better', position: 'insideBottom', offset: -24, fill: '#94a3b8', fontSize: 12 }}
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
              <ZAxis type="number" dataKey="walkability" range={[70, 260]} />
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
          <h2>Local cost by city</h2>
          <p>Rough normal solo local-ish monthly baseline, not luxury expat spend.</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={filtered} margin={{ top: 20, right: 20, bottom: 80, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="city" angle={-35} textAnchor="end" interval={0} stroke="#94a3b8" height={90} />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="monthlyLocalCostUsd" name="Monthly cost USD">
                {filtered.map((entry) => (
                  <Cell key={entry.city} fill={verdictColors[entry.verdict]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="shell list">
        {filtered.map((city, index) => (
          <CityCard key={`${city.city}-${city.district}`} city={city} rank={index + 1} />
        ))}
        {!filtered.length && <div className="panel empty">No cities match the current filters.</div>}
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
      <span>Domestic: {city.domesticPct}%</span>
      <span>Density: {city.nightlifeDensity}/km²</span>
      <span>Walkability: {city.walkability}/10</span>
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
          <Metric label="Domestic" value={`${city.domesticPct}%`} />
          <Metric label="Nightlife density" value={`${city.nightlifeDensity}/km²`} />
          <Metric label="vs Amsterdam" value={`${city.densityVsAmsterdamPct}%`} />
          <Metric label="Walkability" value={`${city.walkability}/10`} />
          <Metric label="Population" value={`${city.registeredPopulation.toLocaleString()} (${city.populationYear})`} />
          <Metric label="Monthly cost" value={`${money(city.monthlyLocalCostUsd)} mid`} />
          <Metric label="Cost range" value={`${money(city.monthlyCostRangeUsd[0])}-${money(city.monthlyCostRangeUsd[1])}`} />
          <Metric label="Beach distance" value={`${city.beachDistanceKm}km`} />
          <Metric label="Fit score" value={`${scoreCity(city)}/100`} />
        </div>
        <details className="evidence">
          <summary>Evidence + method</summary>
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
