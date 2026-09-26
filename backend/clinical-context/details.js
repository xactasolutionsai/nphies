// Deterministic readers for details that are written in the text: medication dose/route/
// frequency/duration, vital-sign style measurements, dates, and "no known allergies"
// statements. Nothing here fills in a value that is not written.

const B = '(?<![A-Za-z0-9])';   // left boundary (works for tokens with / . ')
const E = '(?![A-Za-z0-9])';    // right boundary

const DURATION = new RegExp(`${B}(?:for\\s+\\d+(?:\\.\\d+)?\\s*(?:days?|weeks?|wks?|months?|doses?)|x\\s*\\d+\\s*(?:days?|d|weeks?|wks?))${E}`, 'i');
const FREQUENCY = new RegExp(`${B}(?:once daily|twice daily|three times (?:a day|daily)|four times (?:a day|daily)|every \\d+ hours?|q\\s?\\d+\\s?h(?:rs?|ours?)?|q\\.h\\.s\\.|qhs|b\\.i\\.d\\.|bid|t\\.i\\.d\\.|tid|q\\.i\\.d\\.|qid|q\\.d\\.|qd|o\\.d\\.|od|qam|qpm|daily|nightly|at bedtime|weekly|monthly|p\\.r\\.n\\.|prn|as needed|stat)${E}`, 'i');
const ROUTE = new RegExp(`${B}(?:PO|p\\.o\\.|per os|oral(?:ly)?|by mouth|IV|intravenous(?:ly)?|IM|intramuscular(?:ly)?|SC|SQ|subcut(?:aneous(?:ly)?)?|topical(?:ly)?|inhaled|inhalation|PR|per rectum|rectal(?:ly)?|SL|sublingual(?:ly)?|intranasal(?:ly)?|nasal|transdermal|ophthalmic|NG)${E}`, 'i');
const DOSE = new RegExp(`${B}(\\d+(?:\\.\\d+)?(?:\\s*-\\s*\\d+(?:\\.\\d+)?)?)(?:\\s*(mg|mcg|µg|ug|g|gm|grams?|mL|ml|L|units?|IU|mEq|mmol|puffs?|tabs?|tablets?|caps?|capsules?|drops?|sachets?))?${E}`, 'i');

function take(window, regex, offset, masks) {
  const m = regex.exec(window);
  if (!m) return null;
  const start = offset + m.index, end = start + m[0].length;
  masks.push([m.index, m.index + m[0].length]);
  return { match: m, span: { text: m[0], start, end } };
}

function mask(window, ranges) {
  let out = window;
  for (const [s, e] of ranges) out = out.slice(0, s) + ' '.repeat(e - s) + out.slice(e);
  return out;
}

/**
 * Read medication details written after a medication mention.
 * `window` is the text between the mention's end and the next entity / clause end.
 */
export function readMedicationDetails(window, offset) {
  const masks = [];
  const duration = take(window, DURATION, offset, masks);
  const frequency = take(mask(window, masks), FREQUENCY, offset, masks);
  const route = take(mask(window, masks), ROUTE, offset, masks);
  const dose = take(mask(window, masks), DOSE, offset, masks);
  return {
    dose: dose ? dose.match[1].replace(/\s+/g, '') : null,
    unit: dose?.match[2] ?? null,
    route: route?.span.text ?? null,
    frequency: frequency?.span.text ?? null,
    duration: duration?.span.text ?? null,
    spans: Object.fromEntries(Object.entries({ dose, route, frequency, duration })
      .filter(([, v]) => v).map(([k, v]) => [k, v.span]))
  };
}

const MEASUREMENTS = [
  ['blood_pressure', /(?<![A-Za-z0-9])(?:BP|blood pressure)[:\s]*(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*(mm\s?Hg))?/gi,
    m => ({ value: { systolic: m[1], diastolic: m[2] }, unit: m[3] ?? null })],
  ['heart_rate', /(?<![A-Za-z0-9])(?:HR|heart rate|pulse)[:\s]*(\d{2,3})(?:\s*(bpm|\/min))?(?![\d/])/gi,
    m => ({ value: m[1], unit: m[2] ?? null })],
  ['respiratory_rate', /(?<![A-Za-z0-9])(?:RR|resp(?:iratory)? rate)[:\s]*(\d{1,2})(?:\s*(\/min|breaths\/min))?(?!\d)/gi,
    m => ({ value: m[1], unit: m[2] ?? null })],
  ['temperature', /(?<![A-Za-z0-9])(?:temp|temperature)[:\s]*(\d{2,3}(?:\.\d{1,2})?)(?:\s*°?\s*(C|F)(?![A-Za-z]))?/gi,
    m => ({ value: m[1], unit: m[2] ?? null })],
  ['oxygen_saturation', /(?<![A-Za-z0-9])(?:SpO2|SaO2|O2 sat|oxygen saturation)[:\s]*(\d{2,3})\s*(%)/gi,
    m => ({ value: m[1], unit: m[2] })],
  ['weight', /(?<![A-Za-z0-9])(?:weight|wt)[:\s]*(\d{1,3}(?:\.\d{1,2})?)\s*(kg|lbs?)(?![A-Za-z])/gi,
    m => ({ value: m[1], unit: m[2] })],
  ['height', /(?<![A-Za-z0-9])(?:height|ht)[:\s]*(\d{1,3}(?:\.\d{1,2})?)\s*(cm|m)(?![A-Za-z])/gi,
    m => ({ value: m[1], unit: m[2] })],
  ['glucose', /(?<![A-Za-z0-9])(?:glucose|blood sugar|FBS|RBS)[:\s]*(\d{1,3}(?:\.\d{1,2})?)\s*(mg\/dL|mmol\/L)/gi,
    m => ({ value: m[1], unit: m[2] })],
  ['hba1c', /(?<![A-Za-z0-9])(?:HbA1c|A1c)[:\s]*(\d{1,2}(?:\.\d{1,2})?)\s*(%|mmol\/mol)/gi,
    m => ({ value: m[1], unit: m[2] })],
  ['egfr', /(?<![A-Za-z0-9])eGFR[:\s]*(\d{1,3}(?:\.\d{1,2})?)(?:\s*(mL\/min(?:\/1\.73\s?m2)?))?/gi,
    m => ({ value: m[1], unit: m[2] ?? null })],
  ['creatinine', /(?<![A-Za-z0-9])(?:creatinine|Cr)[:\s]*(\d{1,4}(?:\.\d{1,2})?)\s*(mg\/dL|umol\/L|µmol\/L)/gi,
    m => ({ value: m[1], unit: m[2] })]
];

export function readMeasurements(text) {
  const found = [];
  for (const [kind, regex, read] of MEASUREMENTS) {
    for (const m of text.matchAll(regex)) {
      found.push({ kind, text: m[0], start: m.index, end: m.index + m[0].length, ...read(m),
        method: 'regex', missing: read(m).unit ? [] : ['unit'] });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DATES = [
  ['iso', /(?<![\d/-])(\d{4})-(\d{2})-(\d{2})(?![\d/-])/g],
  ['day_month_year_numeric', /(?<![\d/.-])(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?![\d/.-])/g],
  ['day_month_name_year', new RegExp(`(?<![A-Za-z0-9])(\\d{1,2})\\s+(${MONTHS})\\.?\\s+(\\d{4})(?![A-Za-z0-9])`, 'gi')],
  ['month_name_day_year', new RegExp(`(?<![A-Za-z0-9])(${MONTHS})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})(?![A-Za-z0-9])`, 'gi')]
];

export function readDates(text) {
  const found = [];
  for (const [format, regex] of DATES) {
    for (const m of text.matchAll(regex)) {
      const d = { text: m[0], start: m.index, end: m.index + m[0].length, format, method: 'regex' };
      // 03/04/2025 could be 3 April or March 4: keep as written and ask.
      if (format === 'day_month_year_numeric' && Number(m[1]) <= 12 && Number(m[2]) <= 12 && m[1] !== m[2]) {
        d.ambiguous = true;
      }
      found.push(d);
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

const ALLERGY_STATEMENTS = [
  ['no_known_drug_allergies', /(?<![A-Za-z0-9])(?:NKDA|no known drug allergies|no known drug allergy)(?![A-Za-z0-9])/gi],
  ['no_known_allergies', /(?<![A-Za-z0-9])(?:NKA|no known allergies)(?![A-Za-z0-9])/gi]
];

export function readAllergyStatements(text) {
  const found = [];
  for (const [statement, regex] of ALLERGY_STATEMENTS) {
    for (const m of text.matchAll(regex)) {
      found.push({ statement, text: m[0], start: m.index, end: m.index + m[0].length, method: 'regex',
        verification: 'unverified' });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
