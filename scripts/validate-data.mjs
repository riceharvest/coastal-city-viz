#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataPath = path.join(rootDir, 'src', 'data.ts');

const metricGroups = [
  'seasonality',
  'arrival',
  'accommodation',
  'osmPoiMetrics',
  'noiseChaosMetrics',
  'dayTripMetrics',
];

const tenPointFields = new Set([
  'nightlifeCompactness',
  'swimmability',
  'beachQualityScore',
  'waterCleanlinessScore',
  'currentSafetyScore',
  'eveningBeachLifeScore',
  'walkability',
  'shortStaySupplyScore',
  'nightlifeNoiseScore',
  'trafficChaosScore',
  'crowdingScore',
  'constructionScore',
]);

const hundredPointFields = new Set(['internationalPct', 'domesticPct']);

const requiredSourceFields = ['id', 'url', 'sourceType', 'accessedAt', 'supportsFields'];

const errors = [];
const missingOptionalGroups = new Map();

function fail(message) {
  errors.push(message);
}

function noteMissingOptionalGroup(group) {
  missingOptionalGroups.set(group, (missingOptionalGroups.get(group) ?? 0) + 1);
}

function isIdentifierChar(char) {
  return /[A-Za-z0-9_$]/.test(char ?? '');
}

function skipString(source, index) {
  const quote = source[index];
  index += 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === quote) return index + 1;
    index += 1;
  }
  return index;
}

function skipTemplate(source, index) {
  index += 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '`') return index + 1;
    index += 1;
  }
  return index;
}

function skipComment(source, index) {
  if (source[index] === '/' && source[index + 1] === '/') {
    const nextNewline = source.indexOf('\n', index + 2);
    return nextNewline === -1 ? source.length : nextNewline + 1;
  }
  if (source[index] === '/' && source[index + 1] === '*') {
    const end = source.indexOf('*/', index + 2);
    return end === -1 ? source.length : end + 2;
  }
  return index;
}

function findMatching(source, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' || char === "'") {
      index = skipString(source, index) - 1;
      continue;
    }
    if (char === '`') {
      index = skipTemplate(source, index) - 1;
      continue;
    }
    if (char === '/' && (source[index + 1] === '/' || source[index + 1] === '*')) {
      index = skipComment(source, index) - 1;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findProperty(source, propertyName) {
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9_$])${propertyName}\\s*:`, 'g');
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const propertyStart = match.index + (match[0].startsWith(propertyName) ? 0 : 1);
    if (isIdentifierChar(source[propertyStart - 1]) || isIdentifierChar(source[propertyStart + propertyName.length])) {
      continue;
    }
    const colon = source.indexOf(':', propertyStart + propertyName.length);
    return { propertyStart, valueStart: colon + 1 };
  }
  return null;
}

function extractBracketedProperty(source, propertyName, openChar, closeChar) {
  const property = findProperty(source, propertyName);
  if (!property) return null;
  const openIndex = source.indexOf(openChar, property.valueStart);
  if (openIndex === -1) return null;
  const between = source.slice(property.valueStart, openIndex).trim();
  if (between.length > 0) return null;
  const closeIndex = findMatching(source, openIndex, openChar, closeChar);
  if (closeIndex === -1) return null;
  return source.slice(openIndex, closeIndex + 1);
}

function extractStringProperty(source, propertyName) {
  const property = findProperty(source, propertyName);
  if (!property) return null;
  const rest = source.slice(property.valueStart);
  const match = rest.match(/^\s*(['"])((?:\\.|(?!\1).)*)\1/s);
  return match ? match[2].replace(/\\(['"\\])/g, '$1') : null;
}

function extractStringArrayValues(arraySource) {
  const values = [];
  const stringPattern = /(['"])((?:\\.|(?!\1).)*)\1/gs;
  let match;
  while ((match = stringPattern.exec(arraySource)) !== null) {
    values.push(match[2].replace(/\\(['"\\])/g, '$1'));
  }
  return values;
}

function splitTopLevelObjects(arraySource) {
  const objects = [];
  for (let index = 1; index < arraySource.length - 1; index += 1) {
    const char = arraySource[index];
    if (char === '"' || char === "'") {
      index = skipString(arraySource, index) - 1;
      continue;
    }
    if (char === '`') {
      index = skipTemplate(arraySource, index) - 1;
      continue;
    }
    if (char === '/' && (arraySource[index + 1] === '/' || arraySource[index + 1] === '*')) {
      index = skipComment(arraySource, index) - 1;
      continue;
    }
    if (char === '{') {
      const closeIndex = findMatching(arraySource, index, '{', '}');
      if (closeIndex === -1) break;
      objects.push(arraySource.slice(index, closeIndex + 1));
      index = closeIndex;
    }
  }
  return objects;
}

function validateUrl(value, context) {
  if (!value || value.trim().length === 0) {
    fail(`${context} is empty`);
    return;
  }
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      fail(`${context} must use http(s): ${value}`);
    }
  } catch {
    fail(`${context} is not a valid URL: ${value}`);
  }
}

function validateNumericRanges(citySource, cityName) {
  const numericPropertyPattern = /\b([A-Za-z][A-Za-z0-9_]*)\s*:\s*(-?\d+(?:\.\d+)?)(?=\s*[,}\]])/g;
  let match;
  while ((match = numericPropertyPattern.exec(citySource)) !== null) {
    const [, field, rawValue] = match;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    if (tenPointFields.has(field) && (value < 0 || value > 10)) {
      fail(`${cityName}.${field} must be within 0-10; got ${value}`);
    }
    if (hundredPointFields.has(field) && (value < 0 || value > 100)) {
      fail(`${cityName}.${field} must be within 0-100; got ${value}`);
    }
  }
}

function validateSources(citySource, cityName) {
  const sourcesArray = extractBracketedProperty(citySource, 'sources', '[', ']');
  if (!sourcesArray) return { hasStructuredSources: false, sourceIds: new Set() };

  const sourceObjects = splitTopLevelObjects(sourcesArray);
  if (sourceObjects.length === 0) {
    fail(`${cityName}.sources must contain at least one SourceRecord when present`);
    return { hasStructuredSources: true, sourceIds: new Set() };
  }

  const sourceIds = new Set();
  for (const [index, sourceObject] of sourceObjects.entries()) {
    const context = `${cityName}.sources[${index}]`;
    for (const field of requiredSourceFields) {
      if (!findProperty(sourceObject, field)) {
        fail(`${context} is missing required field '${field}'`);
      }
    }

    const id = extractStringProperty(sourceObject, 'id');
    if (id !== null) {
      if (id.trim().length === 0) fail(`${context}.id must be non-empty`);
      if (sourceIds.has(id)) fail(`${cityName}.sources contains duplicate id '${id}'`);
      sourceIds.add(id);
    }

    const url = extractStringProperty(sourceObject, 'url');
    if (url !== null) validateUrl(url, `${context}.url`);

    const supportsFields = extractBracketedProperty(sourceObject, 'supportsFields', '[', ']');
    if (supportsFields) {
      const fields = extractStringArrayValues(supportsFields).map((field) => field.trim()).filter(Boolean);
      if (fields.length === 0) fail(`${context}.supportsFields must be a non-empty string array`);
    }
  }

  return { hasStructuredSources: true, sourceIds };
}

function validateMetricGroups(citySource, cityName, sourceValidation) {
  const { hasStructuredSources, sourceIds: definedSourceIds } = sourceValidation;
  for (const group of metricGroups) {
    const groupObject = extractBracketedProperty(citySource, group, '{', '}');
    if (!groupObject) {
      noteMissingOptionalGroup(group);
      continue;
    }

    if (!hasStructuredSources) {
      fail(`${cityName}.${group} exists but ${cityName}.sources is missing structured SourceRecord metadata`);
      continue;
    }

    const sourceIdsArray = extractBracketedProperty(groupObject, 'sourceIds', '[', ']');
    const sourceIds = sourceIdsArray ? extractStringArrayValues(sourceIdsArray).map((id) => id.trim()).filter(Boolean) : [];
    if (sourceIds.length === 0) {
      fail(`${cityName}.${group} exists but has no non-empty sourceIds`);
    }
    for (const sourceId of sourceIds) {
      if (!definedSourceIds.has(sourceId)) {
        fail(`${cityName}.${group} references unknown sourceId '${sourceId}'`);
      }
    }
  }
}

const dataSource = await readFile(dataPath, 'utf8');
const citiesDeclaration = dataSource.match(/export\s+const\s+cities\s*:\s*City\[\]\s*=\s*\[/);
if (!citiesDeclaration) {
  fail('Could not find `export const cities: City[] = [` in src/data.ts');
} else {
  const arrayOpenIndex = citiesDeclaration.index + citiesDeclaration[0].length - 1;
  const arrayCloseIndex = findMatching(dataSource, arrayOpenIndex, '[', ']');
  if (arrayCloseIndex === -1) {
    fail('Could not find the end of the cities array in src/data.ts');
  } else {
    const citiesArray = dataSource.slice(arrayOpenIndex, arrayCloseIndex + 1);
    const cityObjects = splitTopLevelObjects(citiesArray);

    if (cityObjects.length === 0) {
      fail('No city records found in src/data.ts');
    }

    for (const [index, citySource] of cityObjects.entries()) {
      const cityName = extractStringProperty(citySource, 'city') ?? `city[${index}]`;

      validateNumericRanges(citySource, cityName);

      const sourceUrlsArray = extractBracketedProperty(citySource, 'sourceUrls', '[', ']');
      if (!sourceUrlsArray) {
        fail(`${cityName} is missing sourceUrls array`);
      } else {
        const urls = extractStringArrayValues(sourceUrlsArray);
        if (urls.length === 0) {
          fail(`${cityName}.sourceUrls must contain at least one URL`);
        }
        for (const [urlIndex, url] of urls.entries()) {
          validateUrl(url, `${cityName}.sourceUrls[${urlIndex}]`);
        }
      }

      const sourceValidation = validateSources(citySource, cityName);
      validateMetricGroups(citySource, cityName, sourceValidation);
    }

    console.log(`Validated ${cityObjects.length} city records in src/data.ts`);
  }
}

for (const [group, count] of missingOptionalGroups.entries()) {
  console.warn(`Warning: ${count} city records have no optional ${group} metrics yet`);
}

if (errors.length > 0) {
  console.error('\nData validation failed:');
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log('Data validation passed.');
