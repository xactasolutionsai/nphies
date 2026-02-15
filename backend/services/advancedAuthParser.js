/**
 * Advanced Authorization Parser
 * 
 * Parses FHIR ClaimResponse with advanced-authorization profile into
 * a flat structure suitable for database storage and frontend display.
 * 
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/advanced-authorization
 */

class AdvancedAuthParser {

  /**
   * Parse a FHIR ClaimResponse with advanced-authorization profile
   * @param {Object} claimResponse - The raw FHIR ClaimResponse resource
   * @returns {Object} Parsed data suitable for DB insertion
   */
  parseAdvancedAuthorization(claimResponse) {
    if (!claimResponse || claimResponse.resourceType !== 'ClaimResponse') {
      throw new Error('Invalid ClaimResponse resource');
    }

    const extensions = claimResponse.extension || [];

    return {
      // Identifier
      identifier_system: claimResponse.identifier?.[0]?.system || claimResponse.identifier?.system || null,
      identifier_value: claimResponse.identifier?.[0]?.value || claimResponse.identifier?.value || null,

      // Core fields
      status: claimResponse.status || 'active',
      claim_type: this.extractCodeFromCodeableConcept(claimResponse.type),
      claim_subtype: this.extractCodeFromCodeableConcept(claimResponse.subType),
      use_field: claimResponse.use || 'preauthorization',
      outcome: claimResponse.outcome || null,
      disposition: claimResponse.disposition || null,

      // Advanced Auth specific extensions
      auth_reason: this.extractExtensionCode(extensions, 'extension-advancedAuth-reason'),
      adjudication_outcome: this.extractExtensionCode(extensions, 'extension-adjudication-outcome'),
      reissue_reason: this.extractExtensionCode(extensions, 'extension-adjudication-reissue'),
      is_newborn: this.extractExtensionBoolean(extensions, 'extension-newborn'),

      // References
      patient_reference: this.extractReference(claimResponse.patient),
      insurer_reference: this.extractReference(claimResponse.insurer),
      service_provider_reference: this.extractExtensionReference(extensions, 'extension-serviceProvider'),
      referring_provider_reference: this.extractExtensionReference(extensions, 'extension-referringProvider'),
      referring_provider_display: this.extractExtensionDisplay(extensions, 'extension-referringProvider'),

      // PreAuth details
      pre_auth_ref: claimResponse.preAuthRef || null,
      pre_auth_period_start: claimResponse.preAuthPeriod?.start || null,
      pre_auth_period_end: claimResponse.preAuthPeriod?.end || null,
      created_date: claimResponse.created || null,

      // Prescription
      prescription_reference: this.extractPrescriptionExtension(extensions),

      // Transfer fields
      transfer_auth_number: this.extractExtensionString(extensions, 'extension-transferAuthorizationNumber'),
      transfer_auth_period_start: this.extractTransferPeriod(extensions, 'start'),
      transfer_auth_period_end: this.extractTransferPeriod(extensions, 'end'),
      transfer_auth_provider: this.extractExtensionReference(extensions, 'extension-transferAuthorizationProvider'),

      // Complex parsed data
      diagnoses: this.parseDiagnoses(extensions),
      supporting_info: this.parseSupportingInfo(extensions),
      add_items: this.parseAddItems(claimResponse.addItem || []),
      totals: this.parseTotals(claimResponse.total || []),
      insurance: claimResponse.insurance || null,
      process_notes: claimResponse.processNote || null,

      // Full raw resource
      response_bundle: claimResponse,
    };
  }

  // ============================================================================
  // EXTENSION EXTRACTION HELPERS
  // ============================================================================

  /**
   * Extract code from a CodeableConcept
   */
  extractCodeFromCodeableConcept(codeableConcept) {
    if (!codeableConcept) return null;
    return codeableConcept.coding?.[0]?.code || null;
  }

  /**
   * Extract display from a CodeableConcept
   */
  extractDisplayFromCodeableConcept(codeableConcept) {
    if (!codeableConcept) return null;
    return codeableConcept.coding?.[0]?.display || codeableConcept.text || null;
  }

  /**
   * Extract a code from a CodeableConcept extension value
   */
  extractExtensionCode(extensions, urlSuffix) {
    const ext = extensions.find(e => e.url?.includes(urlSuffix));
    if (!ext) return null;
    return ext.valueCodeableConcept?.coding?.[0]?.code || null;
  }

  /**
   * Extract a boolean from an extension
   */
  extractExtensionBoolean(extensions, urlSuffix) {
    const ext = extensions.find(e => e.url?.includes(urlSuffix));
    if (!ext) return false;
    return ext.valueBoolean ?? false;
  }

  /**
   * Extract a string from an extension
   */
  extractExtensionString(extensions, urlSuffix) {
    const ext = extensions.find(e => e.url?.includes(urlSuffix));
    if (!ext) return null;
    return ext.valueString || null;
  }

  /**
   * Extract a reference from an extension
   */
  extractExtensionReference(extensions, urlSuffix) {
    const ext = extensions.find(e => e.url?.includes(urlSuffix));
    if (!ext) return null;
    return ext.valueReference?.reference || ext.valueReference?.identifier?.value || null;
  }

  /**
   * Extract display from a reference extension
   */
  extractExtensionDisplay(extensions, urlSuffix) {
    const ext = extensions.find(e => e.url?.includes(urlSuffix));
    if (!ext) return null;
    return ext.valueReference?.display || null;
  }

  /**
   * Extract reference from a FHIR Reference object
   */
  extractReference(ref) {
    if (!ref) return null;
    return ref.reference || ref.identifier?.value || ref.display || null;
  }

  /**
   * Extract prescription extension
   */
  extractPrescriptionExtension(extensions) {
    const ext = extensions.find(e => e.url?.includes('extension-prescription'));
    if (!ext) return null;
    return {
      reference: ext.valueReference?.reference || null,
      system: ext.valueReference?.identifier?.system || null,
      value: ext.valueReference?.identifier?.value || null,
    };
  }

  /**
   * Extract transfer period start or end
   */
  extractTransferPeriod(extensions, field) {
    const ext = extensions.find(e => e.url?.includes('extension-transferAuthorizationPeriod'));
    if (!ext) return null;
    return ext.valuePeriod?.[field] || null;
  }

  // ============================================================================
  // COMPLEX EXTENSION PARSERS
  // ============================================================================

  /**
   * Parse diagnosis extensions into a structured array
   */
  parseDiagnoses(extensions) {
    const diagnosisExts = extensions.filter(e => 
      e.url?.includes('extension-diagnosis') && 
      !e.url?.includes('extension-diagnosis-sequence') &&
      !e.url?.includes('extension-diagnosis-type') &&
      !e.url?.includes('extension-diagnosesSequence') &&
      Array.isArray(e.extension) // Must have sub-extensions
    );

    return diagnosisExts.map(diagExt => {
      const subExts = diagExt.extension || [];
      
      const sequenceExt = subExts.find(e => e.url?.includes('extension-diagnosis-sequence'));
      const codeExt = subExts.find(e => e.url?.includes('extension-diagnosis-diagnosisCodeableConcept'));
      const typeExt = subExts.find(e => e.url?.includes('extension-diagnosis-type'));

      return {
        sequence: sequenceExt?.valuePositiveInt || null,
        code: codeExt?.valueCodeableConcept?.coding?.[0]?.code || null,
        system: codeExt?.valueCodeableConcept?.coding?.[0]?.system || null,
        display: codeExt?.valueCodeableConcept?.coding?.[0]?.display || null,
        type: typeExt?.valueCodeableConcept?.coding?.[0]?.code || null,
        typeDisplay: typeExt?.valueCodeableConcept?.coding?.[0]?.display || null,
      };
    });
  }

  /**
   * Parse supporting info extensions into a structured array
   */
  parseSupportingInfo(extensions) {
    const infoExts = extensions.filter(e => 
      e.url?.includes('extension-supportingInfo') &&
      !e.url?.includes('extension-supportingInfo-') && // Exclude sub-extensions at top level
      Array.isArray(e.extension) // Must have sub-extensions
    );

    return infoExts.map(infoExt => {
      const subExts = infoExt.extension || [];
      
      const sequenceExt = subExts.find(e => e.url?.includes('extension-supportingInfo-sequence'));
      const categoryExt = subExts.find(e => e.url?.includes('extension-supportingInfo-category'));
      const valueStringExt = subExts.find(e => e.url?.includes('extension-supportingInfo-valueString'));
      const valueQuantityExt = subExts.find(e => e.url?.includes('extension-supportingInfo-valueQuantity'));
      const codeExt = subExts.find(e => e.url?.includes('extension-supportingInfo-code'));
      const attachmentExt = subExts.find(e => e.url?.includes('extension-supportingInfo-valueAttachment'));
      const reasonExt = subExts.find(e => e.url?.includes('extension-supportingInfo-reason'));
      const timingDateExt = subExts.find(e => e.url?.includes('extension-supportingInfo-timingDate'));
      const timingPeriodExt = subExts.find(e => e.url?.includes('extension-supportingInfo-timingPeriod'));

      const info = {
        sequence: sequenceExt?.valuePositiveInt || null,
        category: categoryExt?.valueCodeableConcept?.coding?.[0]?.code || null,
        categoryDisplay: categoryExt?.valueCodeableConcept?.coding?.[0]?.display || null,
      };

      // Value types (mutually exclusive per item)
      if (valueStringExt) {
        info.valueType = 'string';
        info.value = valueStringExt.valueString;
      } else if (valueQuantityExt) {
        info.valueType = 'quantity';
        info.value = valueQuantityExt.valueQuantity?.value;
        info.unit = valueQuantityExt.valueQuantity?.code || valueQuantityExt.valueQuantity?.unit;
        info.unitSystem = valueQuantityExt.valueQuantity?.system;
      } else if (codeExt) {
        info.valueType = 'code';
        info.code = codeExt.valueCodeableConcept?.coding?.[0]?.code || null;
        info.codeSystem = codeExt.valueCodeableConcept?.coding?.[0]?.system || null;
        info.codeDisplay = codeExt.valueCodeableConcept?.coding?.[0]?.display || null;
        info.codeText = codeExt.valueCodeableConcept?.text || null;
      } else if (attachmentExt) {
        info.valueType = 'attachment';
        info.contentType = attachmentExt.valueAttachment?.contentType || null;
        info.title = attachmentExt.valueAttachment?.title || null;
        info.creation = attachmentExt.valueAttachment?.creation || null;
        // Don't store base64 data in parsed form, it's in the raw bundle
        info.hasData = !!attachmentExt.valueAttachment?.data;
      }

      // Reason (e.g., weight-absence-reason)
      if (reasonExt) {
        info.reason = reasonExt.valueCodeableConcept?.coding?.[0]?.code || null;
        info.reasonDisplay = reasonExt.valueCodeableConcept?.coding?.[0]?.display || null;
      }

      // Timing
      if (timingDateExt) {
        info.timingDate = timingDateExt.valueDate || null;
      }
      if (timingPeriodExt) {
        info.timingPeriodStart = timingPeriodExt.valuePeriod?.start || null;
        info.timingPeriodEnd = timingPeriodExt.valuePeriod?.end || null;
      }

      return info;
    });
  }

  /**
   * Parse addItem entries with their extensions and adjudication
   */
  parseAddItems(addItems) {
    return addItems.map(item => {
      const itemExts = item.extension || [];

      const parsed = {
        // Extensions
        maternity: this.extractExtensionBoolean(itemExts, 'extension-maternity'),
        adjudicationOutcome: this.extractExtensionCode(itemExts, 'extension-adjudication-outcome'),
        sequence: this.extractItemExtensionPositiveInt(itemExts, 'extension-sequence'),
        diagnosisSequences: this.extractAllPositiveInts(itemExts, 'extension-diagnosis-sequence'),
        informationSequences: this.extractAllPositiveInts(itemExts, 'extension-informationSequence'),
        isPackage: this.extractExtensionBoolean(itemExts, 'extension-package'),

        // Product/Service
        productOrService: {
          code: item.productOrService?.coding?.[0]?.code || null,
          system: item.productOrService?.coding?.[0]?.system || null,
          display: item.productOrService?.coding?.[0]?.display || null,
        },

        // Quantity
        quantity: item.quantity?.value || null,

        // Body site (dental)
        bodySite: item.bodySite ? {
          code: item.bodySite.coding?.[0]?.code || null,
          system: item.bodySite.coding?.[0]?.system || null,
          display: item.bodySite.coding?.[0]?.display || null,
        } : null,

        // Sub site (dental)
        subSite: item.subSite?.[0] ? {
          code: item.subSite[0].coding?.[0]?.code || null,
          system: item.subSite[0].coding?.[0]?.system || null,
          display: item.subSite[0].coding?.[0]?.display || null,
        } : null,

        // Provider
        provider: item.provider ? this.extractReference(item.provider) : null,

        // Note numbers
        noteNumbers: item.noteNumber || [],

        // Adjudication
        adjudication: this.parseAdjudication(item.adjudication || []),

        // Detail items (sub-items)
        details: (item.detail || []).map(detail => this.parseAddItemDetail(detail)),
      };

      return parsed;
    });
  }

  /**
   * Parse addItem.detail
   */
  parseAddItemDetail(detail) {
    const detailExts = detail.extension || [];

    return {
      sequence: this.extractItemExtensionPositiveInt(detailExts, 'extension-sequence'),
      productOrService: {
        code: detail.productOrService?.coding?.[0]?.code || null,
        system: detail.productOrService?.coding?.[0]?.system || null,
        display: detail.productOrService?.coding?.[0]?.display || null,
      },
      quantity: detail.quantity?.value || null,
      noteNumbers: detail.noteNumber || [],
      adjudication: this.parseAdjudication(detail.adjudication || []),
    };
  }

  /**
   * Parse adjudication array
   */
  parseAdjudication(adjudications) {
    return adjudications.map(adj => ({
      category: adj.category?.coding?.[0]?.code || null,
      categorySystem: adj.category?.coding?.[0]?.system || null,
      amount: adj.amount?.value ?? null,
      currency: adj.amount?.currency || 'SAR',
      value: adj.value ?? null,
      reason: adj.reason?.coding?.[0]?.code || null,
      reasonDisplay: adj.reason?.coding?.[0]?.display || null,
    }));
  }

  /**
   * Parse totals
   */
  parseTotals(totals) {
    return totals.map(total => ({
      category: total.category?.coding?.[0]?.code || null,
      categorySystem: total.category?.coding?.[0]?.system || null,
      amount: total.amount?.value ?? null,
      currency: total.amount?.currency || 'SAR',
    }));
  }

  // ============================================================================
  // UTILITY HELPERS
  // ============================================================================

  /**
   * Extract a single positiveInt from extension
   */
  extractItemExtensionPositiveInt(extensions, urlSuffix) {
    const ext = extensions.find(e => e.url?.includes(urlSuffix));
    return ext?.valuePositiveInt || null;
  }

  /**
   * Extract all positiveInts matching a url suffix (for repeated extensions)
   */
  extractAllPositiveInts(extensions, urlSuffix) {
    return extensions
      .filter(e => e.url?.includes(urlSuffix))
      .map(e => e.valuePositiveInt)
      .filter(v => v != null);
  }

  /**
   * Check if a ClaimResponse has the advanced-authorization profile
   */
  isAdvancedAuthorization(claimResponse) {
    if (!claimResponse || claimResponse.resourceType !== 'ClaimResponse') return false;
    const profiles = claimResponse.meta?.profile || [];
    return profiles.some(p => p.includes('advanced-authorization'));
  }

  /**
   * Extract advanced authorizations from a poll response bundle
   * The poll response may contain nested message bundles
   */
  extractFromPollResponse(responseBundle) {
    const advancedAuths = [];

    if (!responseBundle || responseBundle.resourceType !== 'Bundle') {
      return advancedAuths;
    }

    const entries = responseBundle.entry || [];

    for (const entry of entries) {
      const resource = entry.resource;
      if (!resource) continue;

      // Check for direct ClaimResponse with advanced-authorization profile
      if (this.isAdvancedAuthorization(resource)) {
        advancedAuths.push(resource);
        continue;
      }

      // Check for nested message bundles
      if (resource.resourceType === 'Bundle' && resource.type === 'message') {
        for (const nestedEntry of (resource.entry || [])) {
          if (this.isAdvancedAuthorization(nestedEntry.resource)) {
            advancedAuths.push(nestedEntry.resource);
          }
        }
      }
    }

    return advancedAuths;
  }
}

export default new AdvancedAuthParser();
