import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import AIBadge from '@/components/ai/AIBadge';

/**
 * Deterministic duplicate-ingredient findings (source 'rules', from medication_codes.ingredients).
 * Shown independently of the AI analysis, so they stay visible when the AI is disabled or down.
 */
export const RuleFindingsSection = ({ ruleFindings }) => {
  if (!ruleFindings) return null;
  if (ruleFindings.available === false) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-900">
        <p className="font-medium">Duplicate-ingredient check could not run — review manually.</p>
        {ruleFindings.reason && <p>{ruleFindings.reason}</p>}
      </div>
    );
  }
  const findings = ruleFindings.findings || [];
  const unmatched = ruleFindings.unmatchedCodes || [];
  const noData = ruleFindings.codesWithoutIngredients || [];
  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-100 px-4 py-3 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-md font-semibold text-gray-900">Duplicate active ingredients (rule check)</h4>
        <AIBadge source={ruleFindings.source} certainty={ruleFindings.certainty} basis={ruleFindings.basis} />
      </div>
      <div className="p-4 space-y-2 text-sm">
        {findings.length === 0 && unmatched.length === 0 && noData.length === 0 && (
          <p className="text-gray-700">No shared active ingredient or repeated code among the checked items.</p>
        )}
        {findings.map((finding, idx) => (
          <div key={idx} className="flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded p-2">
            <AlertTriangle className="w-4 h-4 text-yellow-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-900">{finding.message}</p>
              <p className="text-xs text-gray-600">Codes: {(finding.codes || []).join(', ')}</p>
            </div>
          </div>
        ))}
        {unmatched.length > 0 && (
          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            Not in the local medication code list, so not checked: {unmatched.join(', ')}.
          </p>
        )}
        {noData.length > 0 && (
          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            No ingredient data for: {noData.join(', ')} — not checked.
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * MedicationSafetyPanel Component
 * Displays comprehensive medication safety analysis results.
 * `ruleFindings` (optional) is the deterministic duplicate-ingredient check; it is shown even when
 * the AI analysis is loading, failed or disabled.
 * `ai` (optional) is the backend's { available, source, certainty } for the language-model part
 * (falls back to analysis.ai, then to source 'llm', certainty 'low').
 */
const MedicationSafetyPanel = ({ analysis, isLoading, error, ruleFindings, ai }) => {
  const rules = ruleFindings ? <RuleFindingsSection ruleFindings={ruleFindings} /> : null;
  if (rules && (isLoading || error || !analysis)) {
    return (
      <div className="space-y-4">
        {rules}
        {(isLoading || error) && <MedicationSafetyPanel analysis={analysis} isLoading={isLoading} error={error} />}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Analyzing medication safety...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-900">Analysis Failed</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const { 
    drugInteractions: rawDrugInteractions,
    interactions: rawInteractions,
    ageRelatedWarnings = [], 
    pregnancyWarnings = [],
    duplicateIngredients = [],
    sideEffectsOverview = {},
    overallRiskAssessment: rawRisk,
    recommendations = []
  } = analysis;
  // Accept both backend shapes: the safety analysis (drugInteractions) and the
  // interaction check (interactions / hasInteractions).
  const drugInteractions = Array.isArray(rawDrugInteractions) ? rawDrugInteractions
    : Array.isArray(rawInteractions) ? rawInteractions : [];
  const knownRisks = ['low', 'moderate', 'high'];
  const overallRiskAssessment = knownRisks.includes(rawRisk) ? rawRisk : 'unknown';

  // Fail closed: an unreadable/partial AI reply ("analysisIncomplete", hasInteractions null,
  // risk "unknown") is NOT a confirmation that there are no interactions.
  const analysisIncomplete = analysis.analysisIncomplete === true
    || analysis.requiresManualReview === true
    || analysis.parsingError === true
    || analysis.hasInteractions === null
    || (rawRisk !== undefined && overallRiskAssessment === 'unknown')
    || (rawRisk === undefined && analysis.hasInteractions === undefined);

  const aiMeta = ai || analysis.ai || {};
  const llmHeader = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200 pb-2">
      <h4 className="text-md font-semibold text-gray-900">AI medication safety analysis (language model)</h4>
      <AIBadge
        source={aiMeta.source || 'llm'}
        certainty={analysisIncomplete ? undefined : (aiMeta.certainty || 'low')}
        basis="Language-model review of the listed medications; advisory, verify with a pharmacist or physician"
      />
    </div>
  );

  const hasIssues = drugInteractions.length > 0 || ageRelatedWarnings.length > 0 || 
                     pregnancyWarnings.length > 0 || duplicateIngredients.length > 0;

  return (
    <div className="space-y-4">
      {rules}
      {llmHeader}
      {/* Overall Risk Assessment */}
      {analysisIncomplete ? (
        <div className="border rounded-lg p-4 bg-amber-50 border-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                Analysis incomplete — manual review required
              </h3>
              <p className="text-sm text-amber-800">
                {analysis.message || 'The AI safety analysis could not be completed. This is NOT a confirmation that there are no interactions or safety concerns.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
      <div className={`border rounded-lg p-4 ${
        overallRiskAssessment === 'high' ? 'bg-red-50 border-red-300' :
        overallRiskAssessment === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
        'bg-green-50 border-green-300'
      }`}>
        <div className="flex items-center gap-3">
          {overallRiskAssessment === 'high' ? (
            <AlertCircle className="w-6 h-6 text-red-600" />
          ) : overallRiskAssessment === 'moderate' ? (
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-600" />
          )}
          <div>
            <h3 className={`text-lg font-semibold ${
              overallRiskAssessment === 'high' ? 'text-red-900' :
              overallRiskAssessment === 'moderate' ? 'text-yellow-900' :
              'text-green-900'
            }`}>
              Overall Risk: {overallRiskAssessment.charAt(0).toUpperCase() + overallRiskAssessment.slice(1)}
            </h3>
            <p className={`text-sm ${
              overallRiskAssessment === 'high' ? 'text-red-700' :
              overallRiskAssessment === 'moderate' ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {hasIssues ? 'Review warnings and recommendations below' : 'No major safety concerns detected'}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Drug Interactions */}
      {drugInteractions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Drug Interactions ({drugInteractions.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {drugInteractions.map((interaction, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-3 ${
                  interaction.severity === 'severe' ? 'bg-red-50 border-red-300' :
                  interaction.severity === 'moderate' ? 'bg-orange-50 border-orange-300' :
                  'bg-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    interaction.severity === 'severe' ? 'bg-red-200 text-red-900' :
                    interaction.severity === 'moderate' ? 'bg-orange-200 text-orange-900' :
                    'bg-yellow-200 text-yellow-900'
                  }`}>
                    {interaction.severity?.toUpperCase()}
                  </span>
                  <h5 className="text-sm font-semibold text-gray-900 flex-1">
                    {interaction.affectedDrugs?.join(' + ')}
                  </h5>
                </div>
                <p className="text-sm text-gray-700 mb-2">{interaction.interaction}</p>
                {interaction.clinicalSignificance && (
                  <p className="text-xs text-gray-600 mb-2">
                    <span className="font-medium">Clinical Significance:</span> {interaction.clinicalSignificance}
                  </p>
                )}
                {interaction.recommendation && (
                  <p className="text-xs font-medium text-blue-700 bg-blue-50 p-2 rounded">
                    💡 {interaction.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Age-Related Warnings */}
      {ageRelatedWarnings.length > 0 && (
        <div className="bg-white border border-orange-200 rounded-lg overflow-hidden">
          <div className="bg-orange-100 px-4 py-3 border-b border-orange-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Age-Related Warnings ({ageRelatedWarnings.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {ageRelatedWarnings.map((warning, idx) => (
              <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">{warning.medication}</p>
                <p className="text-sm text-gray-700 mb-2">{warning.warning}</p>
                {warning.recommendation && (
                  <p className="text-xs text-orange-800 bg-orange-100 p-2 rounded">
                    📋 {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pregnancy Warnings */}
      {pregnancyWarnings.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-100 px-4 py-3 border-b border-red-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Pregnancy Warnings ({pregnancyWarnings.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {pregnancyWarnings.map((warning, idx) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">{warning.medication}</p>
                  {warning.category && (
                    <span className="px-2 py-1 bg-red-200 text-red-900 rounded text-xs font-semibold">
                      Category {warning.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">{warning.warning}</p>
                {warning.recommendation && (
                  <p className="text-xs text-red-800 bg-red-100 p-2 rounded">
                    ⚠️ {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate Ingredients */}
      {duplicateIngredients.length > 0 && (
        <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
          <div className="bg-blue-100 px-4 py-3 border-b border-blue-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Duplicate Active Ingredients ({duplicateIngredients.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {duplicateIngredients.map((duplicate, idx) => (
              <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {duplicate.activeIngredient}
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  Found in: {duplicate.medications?.join(', ')}
                </p>
                <p className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                  ℹ️ {duplicate.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side Effects Overview */}
      {(sideEffectsOverview.common?.length > 0 || sideEffectsOverview.serious?.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b">
            <h4 className="text-md font-semibold text-gray-900">Side Effects Overview</h4>
          </div>
          <div className="p-4 space-y-4">
            {sideEffectsOverview.common?.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-gray-900 mb-2">Common Side Effects:</h5>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sideEffectsOverview.common.map((effect, idx) => (
                    <li key={idx}>{effect}</li>
                  ))}
                </ul>
              </div>
            )}
            {sideEffectsOverview.serious?.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-red-900 mb-2">Serious Side Effects (Seek medical attention):</h5>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {sideEffectsOverview.serious.map((effect, idx) => (
                    <li key={idx}>{effect}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinical Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
          <div className="bg-green-100 px-4 py-3 border-b border-green-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Clinical Recommendations ({recommendations.length})
            </h4>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationSafetyPanel;

