import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Activity,
  Shield,
  DollarSign,
  ClipboardList,
  RefreshCw,
  Copy,
  Check,
  Info,
  Lightbulb
} from 'lucide-react';

/**
 * AI Validation Panel Component
 * Displays validation results, risk scores, and suggestions for prior authorization
 */
const AIValidationPanel = ({ 
  validationResult, 
  loading = false, 
  onApplySuggestion,
  onDismiss,
  compact = false 
}) => {
  const [expandedSections, setExpandedSections] = useState({
    risks: true,
    suggestions: true,
    details: false
  });
  const [copiedText, setCopiedText] = useState(null);

  if (!validationResult && !loading) {
    return null;
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get risk level styling
  const getRiskLevelStyle = (level) => {
    switch (level) {
      case 'low':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: CheckCircle,
          iconColor: 'text-green-500'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          icon: AlertCircle,
          iconColor: 'text-yellow-500'
        };
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: XCircle,
          iconColor: 'text-red-500'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          icon: Info,
          iconColor: 'text-gray-500'
        };
    }
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'administrative':
        return FileText;
      case 'coverage':
        return Shield;
      case 'medicalNecessity':
        return Activity;
      case 'supportingEvidence':
        return ClipboardList;
      case 'billing':
        return DollarSign;
      default:
        return AlertCircle;
    }
  };

  // Format category name
  const formatCategoryName = (category) => {
    const names = {
      administrative: 'Administrative',
      coverage: 'Coverage',
      medicalNecessity: 'Medical Necessity',
      supportingEvidence: 'Supporting Evidence',
      billing: 'Billing'
    };
    return names[category] || category;
  };

  // Get severity badge style
  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary-purple animate-spin" />
          <div>
            <h3 className="font-medium text-gray-900">Analyzing Prior Authorization...</h3>
            <p className="text-sm text-gray-500">AI is reviewing your clinical documentation</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2 bg-gray-100 rounded animate-pulse"></div>
          <div className="h-2 bg-gray-100 rounded animate-pulse w-3/4"></div>
          <div className="h-2 bg-gray-100 rounded animate-pulse w-1/2"></div>
        </div>
      </div>
    );
  }

  const { riskScores, validation, suggestions, metadata } = validationResult;
  const riskLevel = riskScores?.riskLevel || 'low';
  const riskStyle = getRiskLevelStyle(riskLevel);
  const RiskIcon = riskStyle.icon;

  return (
    <div className={`bg-white rounded-xl border ${riskStyle.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className={`${riskStyle.bg} px-4 py-3 border-b ${riskStyle.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${riskLevel === 'low' ? 'bg-green-100' : riskLevel === 'medium' ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <RiskIcon className={`h-5 w-5 ${riskStyle.iconColor}`} />
            </div>
            <div>
              <h3 className={`font-semibold ${riskStyle.text}`}>
                {riskLevel === 'low' ? 'Low Rejection Risk' : 
                 riskLevel === 'medium' ? 'Medium Rejection Risk' : 
                 'High Rejection Risk'}
              </h3>
              <p className="text-sm text-gray-600">
                Overall Risk Score: {((riskScores?.overall || 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Risk Scores by Category */}
      {riskScores?.categories && (
        <div className="px-4 py-3 border-b border-gray-100">
          <button 
            onClick={() => toggleSection('risks')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-medium text-gray-700">Risk Breakdown by Category</span>
            {expandedSections.risks ? 
              <ChevronUp className="h-4 w-4 text-gray-400" /> : 
              <ChevronDown className="h-4 w-4 text-gray-400" />
            }
          </button>
          
          {expandedSections.risks && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(riskScores.categories).map(([category, score]) => {
                const CategoryIcon = getCategoryIcon(category);
                const scorePercent = (score * 100).toFixed(0);
                const scoreColor = score < 0.3 ? 'text-green-600' : score < 0.6 ? 'text-yellow-600' : 'text-red-600';
                const barColor = score < 0.3 ? 'bg-green-500' : score < 0.6 ? 'bg-yellow-500' : 'bg-red-500';
                
                return (
                  <div key={category} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CategoryIcon className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-xs text-gray-600 truncate">{formatCategoryName(category)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${barColor} rounded-full transition-all duration-300`}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${scoreColor}`}>{scorePercent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <button 
            onClick={() => toggleSection('suggestions')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">
                Suggestions ({suggestions.length})
              </span>
            </div>
            {expandedSections.suggestions ? 
              <ChevronUp className="h-4 w-4 text-gray-400" /> : 
              <ChevronDown className="h-4 w-4 text-gray-400" />
            }
          </button>
          
          {expandedSections.suggestions && (
            <div className="mt-3 space-y-2">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className={`rounded-lg border p-3 ${
                    suggestion.severity === 'high' ? 'bg-red-50 border-red-200' :
                    suggestion.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityStyle(suggestion.severity)}`}>
                          {suggestion.severity}
                        </span>
                        {suggestion.type && (
                          <span className="text-xs text-gray-500">
                            {suggestion.type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{suggestion.message}</p>
                      
                      {/* Show suggested text if available */}
                      {suggestion.suggestedText && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Suggested text:</span>
                            <button
                              onClick={() => copyToClipboard(suggestion.suggestedText, `suggestion-${index}`)}
                              className="text-xs text-primary-purple hover:text-primary-purple/80 flex items-center gap-1"
                            >
                              {copiedText === `suggestion-${index}` ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 italic">
                            "{suggestion.suggestedText.substring(0, 200)}{suggestion.suggestedText.length > 200 ? '...' : ''}"
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Apply button for actionable suggestions */}
                    {onApplySuggestion && suggestion.action === 'enhance' && suggestion.suggestedText && (
                      <button
                        onClick={() => onApplySuggestion(suggestion)}
                        className="px-3 py-1.5 text-xs bg-primary-purple text-white rounded-lg hover:bg-primary-purple/90 transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Validation Details */}
      {validation?.ai && (
        <div className="px-4 py-3 border-b border-gray-100">
          <button 
            onClick={() => toggleSection('details')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-purple" />
              <span className="text-sm font-medium text-gray-700">AI Analysis Details</span>
            </div>
            {expandedSections.details ? 
              <ChevronUp className="h-4 w-4 text-gray-400" /> : 
              <ChevronDown className="h-4 w-4 text-gray-400" />
            }
          </button>
          
          {expandedSections.details && (
            <div className="mt-3 space-y-3">
              {/* Medical Necessity Score */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Medical Necessity Score</span>
                <span className={`text-sm font-medium ${
                  validation.ai.medicalNecessityScore >= 0.7 ? 'text-green-600' :
                  validation.ai.medicalNecessityScore >= 0.5 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(validation.ai.medicalNecessityScore * 100).toFixed(0)}%
                </span>
              </div>

              {/* Consistency Check */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Clinical Consistency</span>
                <span className={`text-sm font-medium flex items-center gap-1 ${
                  validation.ai.consistencyCheck?.passed ? 'text-green-600' : 'text-red-600'
                }`}>
                  {validation.ai.consistencyCheck?.passed ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Pass
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Fail
                    </>
                  )}
                </span>
              </div>

              {/* Rejection Risks */}
              {validation.ai.rejectionRisks?.length > 0 && (
                <div className="p-2 bg-red-50 rounded-lg">
                  <span className="text-xs font-medium text-red-700 mb-2 block">Potential Rejection Codes:</span>
                  <div className="flex flex-wrap gap-1">
                    {validation.ai.rejectionRisks.map((risk, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                        title={risk.description}
                      >
                        {risk.code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentation Gaps */}
              {validation.ai.documentationGaps?.length > 0 && (
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <span className="text-xs font-medium text-yellow-700 mb-2 block">Documentation Gaps:</span>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {validation.ai.documentationGaps.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Justification Narrative */}
              {validation.ai.justificationNarrative && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-700">Suggested Justification Narrative:</span>
                    <button
                      onClick={() => copyToClipboard(validation.ai.justificationNarrative, 'justification')}
                      className="text-xs text-green-700 hover:text-green-800 flex items-center gap-1"
                    >
                      {copiedText === 'justification' ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-green-800 italic">
                    "{validation.ai.justificationNarrative}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer with metadata */}
      {metadata && (
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>
            Analyzed by {metadata.model || 'AI'} in {metadata.validationDuration || metadata.responseTime || 'N/A'}
          </span>
          <span>{new Date(metadata.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
};

export default AIValidationPanel;

