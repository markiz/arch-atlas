// Validate the curated significance register for atlas cards.
//
// The atlas is a curated architecture collection, not a directory of public
// institutions. A card without evidence of architectural/historical value must
// not be published, and a card that has been removed must not linger in the
// register. See docs/significance.md for the policy.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';

const CRITERIA = new Set(['authorship', 'publication', 'urban_role', 'integrity', 'heritage']);
const VERDICTS = new Set(['keep', 'review', 'remove']);

function parseArgs(argv) {
  const city = argv.find((value) => value.startsWith('--city='))?.slice('--city='.length);
  return { all: argv.includes('--all') || !city, city, strict: argv.includes('--strict') };
}

async function cardIds(city) {
  const directory = path.join('data', 'atlas', city);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return new Set(files.map((name) => name.slice(0, -'.json'.length)));
}

function requiredString(value, label, errors) {
  if (typeof value !== 'string' || !value.trim())
    errors.push(`${label}: must be a non-empty string`);
}

function validateEntry(id, entry, errors, warnings) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    errors.push(`${id}: entry must be an object`);
    return;
  }
  if (!VERDICTS.has(entry.verdict)) {
    errors.push(`${id}: verdict must be keep, review or remove`);
    return;
  }
  requiredString(entry.reason, `${id}: reason`, errors);
  if (!Array.isArray(entry.criteria)) {
    errors.push(`${id}: criteria must be an array`);
    return;
  }
  const criteria = [...new Set(entry.criteria)];
  for (const criterion of criteria) {
    if (!CRITERIA.has(criterion))
      errors.push(`${id}: unknown criterion ${JSON.stringify(criterion)}`);
  }
  if (!Array.isArray(entry.disqualifiers)) {
    errors.push(`${id}: disqualifiers must be an array`);
    return;
  }
  if (!Array.isArray(entry.evidence)) {
    errors.push(`${id}: evidence must be an array`);
    return;
  }
  if (entry.verdict === 'keep') {
    if (entry.disqualifiers.length) errors.push(`${id}: keep cannot have disqualifiers`);
    if (criteria.length < 2 && !criteria.includes('heritage')) {
      errors.push(`${id}: keep needs at least two criteria or an explicit heritage status`);
    }
    if (!entry.evidence.length) errors.push(`${id}: keep needs at least one evidence item`);
  }
  if (entry.verdict === 'review') {
    warnings.push(`${id}: review — significance is not confirmed`);
  }
}

async function checkCity(city, { quiet = false, strict = false } = {}) {
  const registerPath = path.join('data', 'significance', `${city}.json`);
  let raw;
  try {
    raw = JSON.parse(await readFile(registerPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!quiet) console.log(`Significance: no register for ${city}, skipped`);
      return { city, skipped: true, errors: [], warnings: [], counts: null };
    }
    throw error;
  }
  const errors = [];
  const warnings = [];
  if (raw.city !== city) errors.push(`${registerPath}: city must be ${city}`);
  if (!raw.cards || typeof raw.cards !== 'object' || Array.isArray(raw.cards)) {
    errors.push(`${registerPath}: cards must be an object keyed by card id`);
    return { city, errors, warnings, counts: null };
  }

  const ids = await cardIds(city);
  const entries = raw.cards;
  const progress = new Progress(ids.size, `significance ${city}`);
  progress.start();
  const counts = { keep: 0, review: 0, remove: 0 };
  for (const id of ids) {
    const entry = entries[id];
    if (!entry) {
      errors.push(`${id}: missing significance entry`);
    } else {
      validateEntry(id, entry, errors, warnings);
      if (entry.verdict in counts) counts[entry.verdict]++;
    }
    progress.advance(id);
  }
  for (const id of Object.keys(entries)) {
    if (!ids.has(id)) warnings.push(`${id}: significance entry has no card`);
  }
  progress.finish();

  if (counts.remove)
    errors.push(`${city}: ${counts.remove} card(s) still exist with verdict=remove`);
  if (strict && counts.review)
    errors.push(`${city}: ${counts.review} card(s) still have verdict=review`);
  return { city, errors, warnings, counts };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let cities;
  if (options.city) {
    cities = [options.city];
  } else {
    const directory = path.join('data', 'significance');
    try {
      cities = (await readdir(directory))
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -'.json'.length))
        .sort();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      cities = [];
    }
  }

  const results = [];
  for (const city of cities) results.push(await checkCity(city, { strict: options.strict }));
  const active = results.filter((result) => !result.skipped);
  const errors = active.flatMap((result) => result.errors);
  const warnings = active.flatMap((result) => result.warnings);
  for (const result of active) {
    const counts = result.counts;
    console.log(
      `Significance ${result.city}: keep ${counts?.keep ?? 0}, review ${counts?.review ?? 0}, remove ${counts?.remove ?? 0}`,
    );
  }
  if (warnings.length) {
    console.log(`Significance warnings: ${warnings.length}`);
    for (const warning of warnings.slice(0, 20)) console.log(`  ${warning}`);
    if (warnings.length > 20) console.log(`  ... ${warnings.length - 20} more`);
  }
  if (errors.length) {
    console.error(`Significance errors: ${errors.length}`);
    for (const error of errors) console.error(`  ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Significance: OK');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
