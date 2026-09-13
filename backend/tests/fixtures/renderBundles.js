// Separate process so deterministic IDs/time cannot leak into the application.
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { clinicalInput } from './clinicalInput.js';

process.env.TZ = 'Asia/Riyadh';
process.env.NPHIES_PROVIDER_ID = 'TEST-PROVIDER';
process.env.NPHIES_INSURER_ID = 'TEST-INSURER';
process.env.NPHIES_PROVIDER_DOMAIN = 'PR-FHIR';
process.env.NPHIES_INSURER_DOMAIN = 'sni';
process.env.NPHIES_BASE_URL = 'http://176.105.150.83'; // Wire fixture only; no network.
const OriginalDate = Date;
globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : ['2026-08-01T09:00:00.000Z'])); }
  static now() { return new OriginalDate('2026-08-01T09:00:00.000Z').getTime(); }
};
let sequence = 0;
crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
syncBuiltinESMExports();
Math.random = () => 0.123456;
console.log = () => {};
console.warn = () => {};
const root = process.argv[2] || path.resolve(import.meta.dirname, '../..');
const moduleAt = file => import(pathToFileURL(path.join(root, file)).href);
const { getMapper } = await moduleAt('services/priorAuthMapper/index.js');
const { getClaimMapper, batchClaimMapper } = await moduleAt('services/claimMapper/index.js');
const { default: CommunicationMapper } = await moduleAt('services/communicationMapper.js');
const { default: eligibilityMapper } = await moduleAt('services/nphiesMapper.js');
const output = {};
for (const type of ['professional', 'institutional', 'dental', 'vision', 'pharmacy']) {
  sequence = 0;
  output[`priorauth-${type}`] = getMapper(type).buildPriorAuthRequestBundle(clinicalInput(type));
  sequence = 0;
  output[`claim-${type}`] = getClaimMapper(type).buildClaimRequestBundle(clinicalInput(type));
}
const input = clinicalInput();
sequence = 0;
output.cancel = getMapper('professional').buildCancelRequestBundle(input.priorAuth, input.provider, input.insurer, 'WI');
sequence = 0;
output.poll = new CommunicationMapper().buildPollRequestBundle('TEST-PROVIDER', 'Test Hospital');
sequence = 0;
output.eligibility = eligibilityMapper.buildEligibilityRequestBundle({ ...input, purpose: ['validation'], servicedDate: '2026-08-01' });
sequence = 0;
output.batch = batchClaimMapper.buildBatchRequestBundle({
  batch: { batch_identifier: 'TEST-BATCH', batch_period_start: '2026-08-01', batch_period_end: '2026-08-01' },
  provider: input.provider, insurer: input.insurer,
  claims: [input, { ...clinicalInput(), claim: { ...input.claim, id: 2, claim_number: 'TEST-CLAIM-2' } }]
});
process.stdout.write(JSON.stringify(output, null, 2));
