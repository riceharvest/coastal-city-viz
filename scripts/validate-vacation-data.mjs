#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'src', 'vacationData.ts'), 'utf8');
const start = source.indexOf('export const vacationData = ');
const end = source.indexOf(' satisfies VacationRecord[];', start);
const errors = [];

if (start === -1 || end === -1) {
  errors.push('Could not locate vacationData export');
} else {
  const raw = source.slice(start + 'export const vacationData = '.length, end).trim();
  let records = [];
  try {
    records = JSON.parse(raw);
  } catch (error) {
    errors.push(`vacationData is not parseable JSON: ${error.message}`);
  }

  if (records.length !== 40) errors.push(`Expected 40 vacation records, got ${records.length}`);
  const keys = new Set();
  for (const record of records) {
    const label = record.key ?? record.city ?? 'unknown';
    if (!record.key) errors.push(`${label}: missing key`);
    if (keys.has(record.key)) errors.push(`${label}: duplicate key`);
    keys.add(record.key);

    if (!record.coordinate?.sourceUrl) errors.push(`${label}: missing coordinate source URL`);
    if (!record.seasonality?.monthly || record.seasonality.monthly.length !== 12) errors.push(`${label}: seasonality must have 12 months`);
    for (const month of record.seasonality?.monthly ?? []) {
      for (const field of ['weatherComfortScore', 'vacationReliabilityScore']) {
        if (!Number.isFinite(month[field]) || month[field] < 0 || month[field] > 100) {
          errors.push(`${label} ${month.label}: invalid ${field}`);
        }
      }
      if (month.beachReliabilityScore != null && (month.beachReliabilityScore < 0 || month.beachReliabilityScore > 100)) {
        errors.push(`${label} ${month.label}: invalid beachReliabilityScore`);
      }
    }

    if (!record.arrival?.nearestAirport) errors.push(`${label}: missing nearest airport`);
    if (!Number.isFinite(record.arrival?.airportDistanceKm)) errors.push(`${label}: missing airport distance`);
    if (!record.arrival?.safetyAdvisory?.sourceUrl) errors.push(`${label}: missing safety source URL`);
    if (!record.osmPoiMetrics?.osmSourceUrl) errors.push(`${label}: missing OSM source URL`);
    for (const field of ['foodCafeSupplyScore', 'accommodationSupplyScore', 'noiseChaosScore']) {
      const value = field === 'noiseChaosScore' ? record.noiseChaosMetrics?.noiseChaosScore : record.osmPoiMetrics?.[field];
      if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${label}: invalid ${field}`);
    }
    if (record.accommodation?.hotelNightlyRangeUsd !== null) {
      errors.push(`${label}: hotelNightlyRangeUsd must remain null until manual sampled price evidence exists`);
    }
  }
  console.log(`Validated ${records.length} generated vacation records`);
}

if (errors.length) {
  console.error('Vacation data validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Vacation data validation passed.');
