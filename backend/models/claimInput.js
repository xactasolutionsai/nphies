import Joi from 'joi';
import { validationSchemas } from './schema.js';

export const serverClaimFields = [
  "id",
  "drg_mds_fingerprint",
  "status",
  "outcome",
  "adjudication_outcome",
  "disposition",
  "approved_amount",
  "eligible_amount",
  "benefit_amount",
  "copay_amount",
  "tax_amount",
  "request_bundle",
  "response_bundle",
  "request_date",
  "response_date",
  "payment_date",
  "created_at",
  "updated_at",
  "batch_id",
  "batch_number",
  "outbound_message_header_id",
  "is_nphies_generated",
  "nphies_claim_id",
  "nphies_request_id",
  "nphies_response_id",
  "nphies_message_id",
  "nphies_response_code",
  "selected_coverage_id",
  "cancellation_reason"
];

// Migrated fields supplement the original schema without dropping clinical extensions.
const migratedFields = {
  eligibility_response_id: Joi.string().allow('').allow(null).optional(),
  eligibility_response_system: Joi.string().allow('').allow(null).optional(),
  diagnosis_codes: Joi.string().allow('').allow(null).optional(),
  primary_diagnosis: Joi.string().allow('').allow(null).optional(),
  is_newborn: Joi.boolean().allow(null).optional(),
  birth_weight: Joi.number().allow(null).optional(),
  mother_patient_id: Joi.string().uuid().allow(null).optional(),
  icu_hours: Joi.number().allow(null).optional(),
  ventilation_hours: Joi.number().allow(null).optional(),
  lab_observations: Joi.alternatives().try(Joi.object(), Joi.array()).allow(null).optional(),
  drg_code: Joi.string().trim().uppercase().max(10).allow(null, '').optional(),
  drg_description: Joi.string().trim().max(1000).allow(null, '').optional(),
  drg_code_system: Joi.string().uri({ scheme: ['http', 'https'] }).max(255).allow(null, '').optional(),
  drg_version: Joi.string().max(10).allow(null, '').optional(),
  drg_grouper_name: Joi.string().trim().max(255).allow(null, '').optional(),
  drg_grouper_version: Joi.string().trim().max(50).allow(null, '').optional(),
  drg_grouper_certified: Joi.boolean().allow(null).optional(),
  drg_mds_confirmed: Joi.boolean().allow(null).optional(),
  drg_grouper_output: Joi.object().max(100).allow(null).optional(),
  drg_error_explanation: Joi.string().trim().max(4000).allow(null, '').optional(),
  drg_leave_days: Joi.number().integer().min(0).allow(null).optional(),
  drg_ventilation_used: Joi.boolean().allow(null).optional(),
  drg_no_procedures: Joi.boolean().allow(null).optional(),
  drg_procedures: Joi.array().max(200).items(Joi.object({
    code: Joi.string().trim().max(50).required(),
    system: Joi.string().uri().max(255).required(),
    version: Joi.string().max(10).required(),
    display: Joi.string().trim().max(1000).allow(null, '').optional(),
    date: Joi.date().iso().required(),
  })).allow(null).optional(),
  discharge_disposition: Joi.string().max(30).allow(null, '').optional(),
};
const schema = validationSchemas.claimSubmission.keys(migratedFields);

export function validateClaimInput(data, update = false) {
  const input = { ...data };
  for (const key of serverClaimFields) delete input[key];
  const selectedSchema = update ? schema.fork(['claim_type'], field => field.optional()) : schema;
  const { error, value } = selectedSchema.validate(input, { abortEarly: false });
  if (error) { const invalid = new Error(error.details.map(d => d.message).join('; ')); invalid.status = 400; throw invalid; }
  return value;
}
