/**
 * Structural comparison of two FHIR request bundles (deterministic).
 *
 * normalizeBundle() flattens a bundle into "path -> set of values", where the path starts with
 * the resource type and array elements are keyed by their url (extensions), system (codings,
 * identifiers) or supportingInfo category, e.g.
 *   Claim.item[].extension[http://nphies.sa/.../extension-maternity].valueBoolean
 * Volatile values are dropped (id, fullUrl, timestamps, meta.lastUpdated, narrative) or replaced by
 * placeholders: references -> "Patient/{id}", dates -> "{date}", money values -> "{amount}"
 * (unless includeAmounts), other free values -> "{value}". Only codes, systems, profiles, urls,
 * status-like codes, sequences and booleans keep their value; Patient-like resources keep only
 * systems/urls. Kept values and path keys are structural (codes, systems, urls), so they are not
 * run through the free-text PHI redactor (a name part "Patient" would turn "patient-history" into
 * "[NAME]-history"); a kept value that is exactly one of the bundle's own patient identifiers or
 * full names is still replaced (redactExactValue).
 *
 * diffBundles() reports { path, kind: 'missing'|'extra'|'different', failed, reference }:
 * a subtree present on one side only is reported once at its highest missing path.
 */
import { redactExactValue } from './ai/phi.js';

const DROP_KEYS = new Set(['id', 'fullUrl', 'timestamp', 'lastUpdated', 'created', 'div', 'versionId']);
const KEEP_KEYS = new Set(['system', 'code', 'url', 'profile', 'use', 'status', 'currency', 'unit', 'mode', 'type', 'language',
  'focal', 'sequence', 'itemSequence', 'careTeamSequence', 'diagnosisSequence', 'procedureSequence', 'informationSequence', 'eventCoding']);
const PERSON_KEEP_KEYS = new Set(['system', 'url', 'profile']);
const PERSON_TYPES = new Set(['Patient', 'RelatedPerson', 'Person']);
const DATE_LIKE = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const MAX_VALUES = 5;

function elementKey(element) {
  if (element && typeof element === 'object') {
    if (typeof element.url === 'string') return element.url;
    if (typeof element.system === 'string') return element.system;
    const category = element.category?.coding?.[0]?.code;
    if (category) return `category=${category}`;
  }
  return '';
}

function normalizeReference(value) {
  const text = String(value);
  if (/^urn:uuid:/i.test(text)) return 'urn:uuid:{id}';
  const match = text.match(/(?:^|\/)([A-Z][A-Za-z]+)\/[^/]+$/);
  return match ? `${match[1]}/{id}` : '{reference}';
}

/** Names and identifier values of Patient-like resources, used as known PHI for redaction. */
function knownPhi(bundle) {
  const names = [];
  const identifiers = [];
  for (const entry of Array.isArray(bundle?.entry) ? bundle.entry : []) {
    const resource = entry?.resource;
    if (!resource || !PERSON_TYPES.has(resource.resourceType)) continue;
    for (const name of resource.name || []) {
      if (name.text) names.push(name.text);
      if (name.family) names.push(name.family);
      for (const given of name.given || []) names.push(given);
    }
    for (const id of resource.identifier || []) if (id?.value) identifiers.push(String(id.value));
    for (const telecom of resource.telecom || []) if (telecom?.value) identifiers.push(String(telecom.value));
  }
  return { names, identifiers };
}

function leafValue(key, value, ctx, parent) {
  if (key === 'reference') return normalizeReference(value);
  if (typeof value === 'boolean') return String(value);
  const keep = ctx.person ? PERSON_KEEP_KEYS.has(key) : KEEP_KEYS.has(key);
  if (typeof value === 'number') {
    if (keep) return String(value);
    if (key === 'value' && parent && 'currency' in parent) return ctx.includeAmounts ? String(value) : '{amount}';
    return '{number}';
  }
  if (typeof value !== 'string') return '{value}';
  if (!keep) return DATE_LIKE.test(value) ? '{date}' : '{value}';
  return redactExactValue(value, ctx.phi);
}

function walk(node, path, ctx, out, parent = null, key = null) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const element of node) {
      if (element && typeof element === 'object') walk(element, `${path}[${elementKey(element)}]`, ctx, out, node, key);
      else walk(element, path, ctx, out, parent, key);
    }
    return;
  }
  if (typeof node === 'object') {
    for (const [childKey, child] of Object.entries(node)) {
      if (DROP_KEYS.has(childKey) || childKey === 'resourceType') continue;
      walk(child, `${path}.${childKey}`, ctx, out, node, childKey);
    }
    return;
  }
  const value = leafValue(key, node, ctx, parent);
  if (!out.has(path)) out.set(path, new Set());
  out.get(path).add(value);
}

export function normalizeBundle(bundle, { includeAmounts = false } = {}) {
  const parsed = typeof bundle === 'string' ? JSON.parse(bundle) : bundle;
  const out = new Map();
  if (!parsed || typeof parsed !== 'object') return out;
  const phi = knownPhi(parsed);
  const { entry, ...bundleFields } = parsed;
  walk(bundleFields, 'Bundle', { includeAmounts, phi, person: false }, out);
  for (const item of Array.isArray(entry) ? entry : []) {
    const resource = item?.resource;
    if (!resource || typeof resource !== 'object') continue;
    const type = String(resource.resourceType || 'Resource');
    walk(resource, type, { includeAmounts, phi, person: PERSON_TYPES.has(type) }, out);
  }
  return out;
}

/** JSON text of the Claim's meta.profile (used to match "the same schema"), or null. */
export function claimProfile(bundle) {
  const parsed = typeof bundle === 'string' ? JSON.parse(bundle) : bundle;
  const claim = (Array.isArray(parsed?.entry) ? parsed.entry : []).map(e => e?.resource).find(r => r?.resourceType === 'Claim');
  const profile = claim?.meta?.profile;
  return Array.isArray(profile) && profile.length ? JSON.stringify(profile) : null;
}

// Split on dots outside [...] (urls inside brackets contain dots).
const segments = path => path.split(/\.(?![^[]*\])/);

function prefixes(map) {
  const all = new Set();
  for (const path of map.keys()) {
    const parts = segments(path);
    for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join('.'));
  }
  return all;
}

const values = set => (set ? [...set].sort().slice(0, MAX_VALUES) : null);

export function diffBundles(failedBundle, referenceBundle, { includeAmounts = false, limit = 200 } = {}) {
  const failed = normalizeBundle(failedBundle, { includeAmounts });
  const reference = normalizeBundle(referenceBundle, { includeAmounts });
  const failedPrefixes = prefixes(failed);
  const referencePrefixes = prefixes(reference);
  const found = new Map();

  const onlyOn = (map, otherPrefixes, kind) => {
    for (const path of map.keys()) {
      if (otherPrefixes.has(path)) continue;
      const parts = segments(path);
      for (let i = 1; i <= parts.length; i++) {
        const prefix = parts.slice(0, i).join('.');
        if (otherPrefixes.has(prefix)) continue;
        if (!found.has(prefix)) {
          const leaf = prefix === path;
          found.set(prefix, {
            path: prefix, kind,
            failed: leaf && kind === 'extra' ? values(map.get(path)) : null,
            reference: leaf && kind === 'missing' ? values(map.get(path)) : null
          });
        }
        break;
      }
    }
  };
  onlyOn(reference, failedPrefixes, 'missing');
  onlyOn(failed, referencePrefixes, 'extra');
  for (const [path, set] of failed) {
    const other = reference.get(path);
    if (!other) continue;
    const same = set.size === other.size && [...set].every(v => other.has(v));
    if (!same) found.set(path, { path, kind: 'different', failed: values(set), reference: values(other) });
  }

  const all = [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
  const summary = { missing: 0, extra: 0, different: 0 };
  for (const entry of all) summary[entry.kind]++;
  return { diff: all.slice(0, limit), truncated: all.length > limit, summary };
}
