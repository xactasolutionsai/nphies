// Read-only audit: downloads public definitions only; never uploads the input bundle.
// Usage: node scripts/auditNphiesBundle.js /path/to/request.json
import fs from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/auditNphiesBundle.js request.json');
const document = JSON.parse(fs.readFileSync(input, 'utf8'));
const definitions = new Map();
const findings = [];
const profiles = [];
const count = value => value === undefined || value === null || value === '' ? 0 : Array.isArray(value) ? value.length : 1;

async function inspect(resource, location) {
  if (!resource || typeof resource !== 'object') return;
  if (resource.resourceType === 'Claim') {
    const canonical = resource.meta?.profile?.find(p => /^http:\/\/nphies.sa\/fhir\/ksa\/nphies-fs\/StructureDefinition\/[a-z-]+(?:\|[^|]+)?$/.test(p));
    if (!canonical) findings.push({ location, problem: 'No supported NPHIES Claim profile declared' });
    else {
      const name = canonical.split('/').at(-1).split('|')[0];
      if (!definitions.has(name)) {
        const source = `https://portal.nphies.sa/ig/StructureDefinition-${name}.json`;
        const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Profile download failed: ${response.status} ${source}`);
        const profile = await response.json();
        if (!profile.snapshot?.element) throw new Error(`No snapshot: ${source}`);
        definitions.set(name, profile);
        profiles.push({ source, version: profile.version, date: profile.date });
      }
      const profile = definitions.get(name);
      const elements = profile.snapshot.element;
      for (const element of elements.filter(e => /^Claim\.[^.]+$/.test(e.id) && e.min > 0)) {
        const [field, slice] = element.id.slice(6).split(':');
        let values = resource[field];
        if (slice) {
          if (field === 'supportingInfo') {
            const coding = elements.find(e => e.id === `${element.id}.category`)?.patternCodeableConcept?.coding?.[0];
            if (!coding) continue;
            values = (values || []).filter(v => v.category?.coding?.some(c => c.system === coding.system && c.code === coding.code));
          } else if (field === 'extension') {
            const url = elements.find(e => e.id === `${element.id}.url`)?.fixedUri || element.type?.[0]?.profile?.[0]?.split('|')[0];
            if (!url) continue;
            values = (values || []).filter(v => v.url === url);
          } else continue;
        }
        const actual = count(values);
        if (actual < element.min || (element.max !== '*' && actual > Number(element.max))) {
          findings.push({ location: `${location}.${element.id.slice(6)}`, expected: `${element.min}..${element.max}`, actual });
        }
      }
    }
  }
  for (const [i, entry] of (resource.entry || []).entries()) await inspect(entry.resource, `${location}.entry[${i}].resource`);
}
if (document.resourceType) await inspect(document, 'Bundle');
else for (const [name, bundle] of Object.entries(document)) await inspect(bundle, name);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), profiles, findings,
  scope: 'Required Claim top-level fields and supported extension/supportingInfo slices only. Not a full FHIR validator; does not evaluate terminology, FHIRPath, clinical truth or server business rules.' }, null, 2));
process.exitCode = findings.length ? 1 : 0;
