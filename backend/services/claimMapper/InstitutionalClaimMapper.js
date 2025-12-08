/**
 * NPHIES Institutional Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-claim
 * Reference: https://portal.nphies.sa/ig/Claim-483070.html
 */

import BaseClaimMapper from './BaseClaimMapper.js';

class InstitutionalClaimMapper extends BaseClaimMapper {
  constructor() {
    super();
    this.claimType = 'institutional';
  }

  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      encounter: this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId()
    };

    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: '08.00' },
      bundleResourceIds.practitioner
    );
    const encounterResource = this.buildEncounterResourceWithId(claim, patient, provider, bundleResourceIds);
    const claimResource = this.buildClaimResource(claim, patient, provider, insurer, coverage, encounterResource?.resource, practitioner, bundleResourceIds);
    
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    const entries = [
      messageHeader, claimResource, encounterResource, coverageResource,
      practitionerResource, providerResource, insurerResource, patientResource
    ].filter(Boolean);

    if (claim.attachments?.length > 0) {
      claim.attachments.forEach(att => entries.push(this.buildBinaryResource(att)));
    }

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0'] },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };
  }

  buildClaimResource(claim, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    const extensions = [{
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: { reference: `Encounter/${bundleResourceIds.encounter}` }
    }];

    if (claim.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: claim.eligibility_offline_ref
      });
    }

    if (claim.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(claim.eligibility_offline_date)
      });
    }

    if (claim.episode_identifier) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
        valueIdentifier: { system: `${providerIdentifierSystem}/episode`, value: claim.episode_identifier }
      });
    }

    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: { profile: [this.getClaimProfileUrl('institutional')] },
      extension: extensions,
      identifier: [{ system: `${providerIdentifierSystem}/claim`, value: claim.claim_number || `req_${Date.now()}` }],
      status: 'active',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'institutional' }] },
      subType: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype', code: claim.sub_type || 'ip' }] },
      use: 'claim',
      patient: { reference: `Patient/${bundleResourceIds.patient}` },
      created: this.formatDateTimeWithTimezone(claim.request_date || new Date()),
      insurer: { reference: `Organization/${bundleResourceIds.insurer}` },
      provider: { reference: `Organization/${bundleResourceIds.provider}` },
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: claim.priority || 'normal' }] },
      payee: { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payeetype', code: 'provider' }] } }
    };

    const pract = practitioner || claim.practitioner || {};
    const practiceCode = claim.practice_code || pract.practice_code || '08.00';
    claimResource.careTeam = [{
      sequence: 1,
      provider: { reference: `Practitioner/${bundleResourceIds.practitioner}` },
      role: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claimcareteamrole', code: 'primary' }] },
      qualification: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/practice-codes', code: practiceCode }] }
    }];

    let supportingInfoSequences = [];
    if (claim.supporting_info?.length > 0) {
      claimResource.supportingInfo = claim.supporting_info.map((info, idx) => {
        const seq = idx + 1;
        supportingInfoSequences.push(seq);
        return this.buildSupportingInfo({ ...info, sequence: seq });
      });
    }

    if (claim.diagnoses?.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => ({
        extension: [{
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-condition-onset',
          valueCodeableConcept: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/condition-onset', code: diag.condition_onset || 'NR' }] }
        }],
        sequence: diag.sequence || idx + 1,
        diagnosisCodeableConcept: { coding: [{ system: diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am', code: diag.diagnosis_code, display: diag.diagnosis_display }] },
        type: [{ coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-type', code: diag.diagnosis_type || 'principal' }] }],
        onAdmission: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-on-admission', code: diag.on_admission === false ? 'n' : 'y' }] }
      }));
    }

    claimResource.insurance = [{ sequence: 1, focal: true, coverage: { reference: `Coverage/${bundleResourceIds.coverage}` } }];

    const encounterPeriod = { start: claim.encounter_start || claim.service_date || new Date(), end: claim.encounter_end };
    if (claim.items?.length > 0) {
      claimResource.item = claim.items.map((item, idx) => this.buildClaimItem(item, 'institutional', idx + 1, supportingInfoSequences, encounterPeriod));
    }

    let totalAmount = claim.total_amount;
    if (!totalAmount && claim.items?.length > 0) {
      totalAmount = claim.items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity || 1) * parseFloat(item.unit_price || 0) * parseFloat(item.factor || 1)) + parseFloat(item.tax || 0);
      }, 0);
    }
    claimResource.total = { value: parseFloat(totalAmount || 0), currency: claim.currency || 'SAR' };

    return { fullUrl: `http://provider.com/Claim/${claimId}`, resource: claimResource };
  }

  buildEncounterResourceWithId(claim, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const encounterClass = claim.encounter_class || 'inpatient';
    const encounterIdentifier = claim.encounter_identifier || claim.claim_number || `ENC-${encounterId.substring(0, 8)}`;
    const providerNphiesId = provider?.nphies_id || 'provider';

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: { profile: [this.getEncounterProfileUrl()] },
      identifier: [{ system: `http://${providerNphiesId.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.sa/identifiers/encounter`, value: encounterIdentifier }],
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: this.getEncounterClassCode(encounterClass), display: this.getEncounterClassDisplay(encounterClass) },
      serviceType: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/service-type', code: claim.service_type || 'acute-care', display: this.getServiceTypeDisplay(claim.service_type || 'acute-care') }] },
      subject: { reference: `Patient/${bundleResourceIds.patient}` },
      period: { start: this.formatDateTimeWithTimezone(claim.encounter_start || claim.service_date || new Date()) },
      hospitalization: {
        extension: [{ url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-admissionSpecialty', valueCodeableConcept: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/practice-codes', code: claim.practice_code || '08.00' }] } }],
        admitSource: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/admit-source', code: claim.admit_source || 'WKIN' }] }
      },
      serviceProvider: { reference: `Organization/${bundleResourceIds.provider}` }
    };

    if (claim.encounter_end) encounter.period.end = this.formatDateTimeWithTimezone(claim.encounter_end);

    return { fullUrl: `http://provider.com/Encounter/${encounterId}`, resource: encounter };
  }
}

export default InstitutionalClaimMapper;
