// Preserve upstream codes even when they are absent from a local code catalogue.
export function operationOutcomeErrors(outcome) {
  return (outcome?.issue || []).map(issue => {
    const coding = issue.details?.coding || [];
    const locations = [...(issue.expression || []), ...(issue.location || []),
      ...coding.flatMap(c => (c.extension || []).filter(e => e.url?.endsWith('error-expression')).map(e => e.valueString).filter(Boolean))];
    const message = issue.details?.text || issue.diagnostics || coding[0]?.display || 'Unknown error';
    return { severity: issue.severity, code: coding[0]?.code || issue.code,
      issueCode: issue.code, coding, message, details: message, diagnostics: issue.diagnostics,
      expression: issue.expression || [], location: [...new Set(locations)].join(', ') || null };
  });
}

export function claimResponseErrors(response) {
  return (response?.error || []).map(error => ({
    code: error.code?.coding?.[0]?.code || 'UNKNOWN',
    coding: error.code?.coding || [],
    message: error.code?.text || error.code?.coding?.[0]?.display || 'Unknown error',
    location: (error.code?.coding || []).flatMap(c => (c.extension || [])
      .filter(e => e.url?.endsWith('error-expression')).map(e => e.valueString).filter(Boolean)).join(', ') || null,
    itemSequence: error.itemSequence, detailSequence: error.detailSequence, subDetailSequence: error.subDetailSequence
  }));
}
