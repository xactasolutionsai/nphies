/**
 * Shared NPHIES identity, date and amount helpers for all mappers
 * (prior authorization, claim, cancel, status-check, communication, eligibility).
 *
 * Keeping these in one place guarantees that a Task.focus / Communication.about
 * identifier always equals the Claim.identifier that was originally submitted.
 */
import { formatSaudiDateTime } from '../../utils/dateTime.js';

/** Full bundles contain patient data; log them only when NPHIES_DEBUG_BUNDLES=true. */
export const debugBundlesEnabled = () => process.env.NPHIES_DEBUG_BUNDLES === 'true';

/** ICD-10 code system used by NPHIES for diagnoses (ICD-10-AM per CHI). */
export const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-am';

/** Error for data that must be supplied rather than invented. Controllers map `status` to HTTP. */
export function mappingError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'NPHIES_MAPPING_VALIDATION';
  return error;
}

/**
 * Provider domain used in provider-owned identifier systems, e.g.
 * "Saudi General Hospital" -> "saudigeneralhospital.com.sa".
 * Accepts a provider object or a provider name.
 */
export function providerDomain(providerOrName) {
  const name = typeof providerOrName === 'string'
    ? providerOrName
    : (providerOrName?.provider_name || providerOrName?.name);
  return `${(name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa`;
}

/** Base identifier system for resources the provider owns (Claim, Task, Communication, ...). */
export function providerIdentifierSystem(provider) {
  return provider?.identifier_system || `http://${providerDomain(provider)}/identifiers`;
}

/**
 * Claim.identifier system. Claims (use=claim) use `/claim`; prior authorizations
 * (use=preauthorization) use `/authorization`.
 */
export function claimIdentifierSystem(provider, use = 'preauthorization') {
  return `${providerIdentifierSystem(provider)}/${use === 'claim' ? 'claim' : 'authorization'}`;
}

/**
 * The Claim.identifier ({ system, value }) of a stored request bundle (request_bundle column:
 * object or JSON string), i.e. exactly what was submitted. Follow-up messages (status check,
 * cancel, Communication.about, poll focus) must echo it. Returns null when there is none.
 */
export function submittedClaimIdentifier(requestBundle) {
  let bundle = requestBundle;
  if (typeof bundle === 'string') {
    try { bundle = JSON.parse(bundle); } catch { return null; }
  }
  const identifier = bundle?.entry?.find(e => e.resource?.resourceType === 'Claim')?.resource?.identifier?.[0];
  return identifier?.system && identifier?.value ? { system: identifier.system, value: identifier.value } : null;
}

/** Provider license (provider.nphies_id). Required: never substitute another provider's license. */
export function requireProviderLicense(provider) {
  const license = provider?.nphies_id;
  if (!license) throw mappingError('Provider NPHIES license (provider.nphies_id) is required');
  return String(license);
}

/** Payer license (insurer.nphies_id). Required: never substitute a test or default payer. */
export function requireInsurerLicense(insurer) {
  const license = insurer?.nphies_id;
  if (!license) throw mappingError('Insurer NPHIES license (insurer.nphies_id) is required');
  return String(license);
}

/**
 * FHIR date (YYYY-MM-DD) in Saudi time. Plain dates pass through unchanged; instants
 * ("2023-12-03T21:00:00Z") are converted to the Riyadh calendar date (2023-12-04),
 * independent of the host timezone. Returns null for empty or invalid input.
 */
export function formatSaudiDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatSaudiDateTime(date).slice(0, 10);
}

/** Round a monetary amount to 2 decimals (avoids float drift in totals). */
export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Parse a JSON column that may arrive as a string; malformed input is a validation error. */
export function parseJsonField(value, fieldName) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw mappingError(`${fieldName} is not valid JSON`);
  }
}

/** Deep copy caller input so mappers never mutate the records they were given. */
export function cloneInput(value) {
  return value === undefined || value === null ? value : structuredClone(value);
}

/**
 * NPHIES provider-type (http://nphies.sa/terminology/CodeSystem/provider-type).
 * Single table for all mappers, matching the seeded nphies_codes rows in
 * migrations/create_nphies_code_tables.sql: 1 Hospital, 2 Polyclinic, 3 Pharmacy,
 * 4 Optical Shop, 5 Clinic (6 Optical, 7 Home Health, 8 Nursing Home).
 */
const PROVIDER_TYPE_DISPLAY = {
  '1': 'Hospital', '2': 'Polyclinic', '3': 'Pharmacy', '4': 'Optical Shop', '5': 'Clinic',
  '6': 'Optical', '7': 'Home Health', '8': 'Nursing Home'
};
const PROVIDER_TYPE_BY_NAME = {
  hospital: '1', polyclinic: '2', pharmacy: '3', optical: '4', optical_shop: '4',
  clinic: '5', dental: '5', dental_clinic: '5', vision: '5', vision_clinic: '5',
  home_health: '7', 'home health': '7', home_healthcare: '7', nursing_home: '8'
};

/** { code, display } for a provider type stored as an NPHIES code or a text name (default Hospital). */
export function providerTypeCoding(rawType) {
  const value = (rawType ?? '').toString().trim().toLowerCase();
  const code = PROVIDER_TYPE_DISPLAY[value] ? value : (PROVIDER_TYPE_BY_NAME[value] || '1');
  return { code, display: PROVIDER_TYPE_DISPLAY[code] };
}
