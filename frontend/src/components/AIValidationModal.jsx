import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Lightbulb, 
  FileSearch,
  Activity,
  Clock,
  Brain,
  ChevronDown,
  ChevronUp,
  Code
} from 'lucide-react';

export default function AIValidationModal({ 
  isOpen, 
  onClose, 
  validationResult, 
  onProceed, 
  onFixIssues 
}) {
  const [showRawResponse, setShowRawResponse] = useState(false);
  
  if (!isOpen) return null;

  const {
    isValid,
    confidenceScore = 0,
    warnings = [],
    recommendations = [],
    missingAnalyses = [],
    metadata = {}
  } = validationResult || {};

  // Categorize warnings by severity
  const highSeverityWarnings = warnings.filter(w => w.severity === 'high');
  const mediumSeverityWarnings = warnings.filter(w => w.severity === 'medium');
  const lowSeverityWarnings = warnings.filter(w => w.severity === 'low');

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'low':
        return <Info className="h-5 w-5 text-yellow-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getValidityStatus = () => {
    if (metadata.error) {
      return {
        icon: <AlertTriangle className="h-6 w-6 text-orange-500" />,
        text: 'AI Validation Unavailable',
        color: 'text-orange-600'
      };
    }
    if (isValid) {
      return {
        icon: <CheckCircle2 className="h-6 w-6 text-green-500" />,
        text: 'Form Validated',
        color: 'text-green-600'
      };
    }
    return {
      icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
      text: 'Issues Detected',
      color: 'text-red-600'
    };
  };

  const status = getValidityStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6" />
            <h2 className="text-xl font-bold">AI Medical Validation Results</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overall Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {status.icon}
                  <div>
                    <h3 className={`text-lg font-semibold ${status.color}`}>
                      {status.text}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {metadata.error 
                        ? 'AI service temporarily unavailable. Manual review recommended.'
                        : isValid 
                        ? 'The form passes AI validation checks'
                        : 'Please review the issues below before proceeding'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Confidence</span>
                  </div>
                  <div className={`text-2xl font-bold ${getConfidenceColor(confidenceScore)}`}>
                    {(confidenceScore * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Metadata */}
              {metadata.model && (
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    <span>Model: {metadata.model}</span>
                  </div>
                  {metadata.responseTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Response: {metadata.responseTime}</span>
                    </div>
                  )}
                  {metadata.retrievedGuidelines > 0 && (
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4" />
                      <span>{metadata.retrievedGuidelines} guidelines used</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Warnings ({warnings.length})
                </h3>
                <div className="space-y-3">
                  {/* High Severity */}
                  {highSeverityWarnings.map((warning, idx) => (
                    <div 
                      key={`high-${idx}`}
                      className={`p-4 rounded-lg border ${getSeverityColor(warning.severity)}`}
                    >
                      <div className="flex gap-3">
                        {getSeverityIcon(warning.severity)}
                        <div className="flex-1">
                          <div className="font-medium">
                            {warning.field !== 'general' && warning.field !== 'system' && (
                              <span className="text-sm font-semibold uppercase tracking-wide">
                                {warning.field}:{' '}
                              </span>
                            )}
                            {warning.message}
                          </div>
                          <div className="text-sm mt-1 opacity-75">
                            Severity: {warning.severity}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Medium Severity */}
                  {mediumSeverityWarnings.map((warning, idx) => (
                    <div 
                      key={`medium-${idx}`}
                      className={`p-4 rounded-lg border ${getSeverityColor(warning.severity)}`}
                    >
                      <div className="flex gap-3">
                        {getSeverityIcon(warning.severity)}
                        <div className="flex-1">
                          <div className="font-medium">
                            {warning.field !== 'general' && warning.field !== 'system' && (
                              <span className="text-sm font-semibold uppercase tracking-wide">
                                {warning.field}:{' '}
                              </span>
                            )}
                            {warning.message}
                          </div>
                          <div className="text-sm mt-1 opacity-75">
                            Severity: {warning.severity}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Low Severity */}
                  {lowSeverityWarnings.map((warning, idx) => (
                    <div 
                      key={`low-${idx}`}
                      className={`p-4 rounded-lg border ${getSeverityColor(warning.severity)}`}
                    >
                      <div className="flex gap-3">
                        {getSeverityIcon(warning.severity)}
                        <div className="flex-1">
                          <div className="font-medium">
                            {warning.field !== 'general' && warning.field !== 'system' && (
                              <span className="text-sm font-semibold uppercase tracking-wide">
                                {warning.field}:{' '}
                              </span>
                            )}
                            {warning.message}
                          </div>
                          <div className="text-sm mt-1 opacity-75">
                            Severity: {warning.severity}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-blue-500" />
                  Recommendations ({recommendations.length})
                </h3>
                <ul className="space-y-2">
                  {recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      </div>
                      <span className="text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Missing Analyses */}
          {missingAnalyses.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-purple-500" />
                  Suggested Additional Tests ({missingAnalyses.length})
                </h3>
                <ul className="space-y-2">
                  {missingAnalyses.map((analysis, idx) => (
                    <li key={idx} className="flex gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                      </div>
                      <span className="text-gray-700">{analysis}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* No issues found */}
          {warnings.length === 0 && recommendations.length === 0 && missingAnalyses.length === 0 && !metadata.error && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    All Clear!
                  </h3>
                  <p className="text-gray-600">
                    No issues detected. The form appears to be complete and medically appropriate.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Raw AI Response (Debug Section) */}
          {metadata.rawResponse && (
            <Card className="border-gray-300">
              <CardContent className="pt-4">
                <button
                  type="button"
                  onClick={() => setShowRawResponse(!showRawResponse)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Raw AI Response (Debug)
                    </span>
                  </div>
                  {showRawResponse ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                
                {showRawResponse && (
                  <div className="mt-3 p-4 bg-gray-900 rounded-lg overflow-auto max-h-96">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {metadata.rawResponse}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {highSeverityWarnings.length > 0 && (
              <span className="text-red-600 font-medium">
                ⚠️ {highSeverityWarnings.length} high priority issue(s) detected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            {warnings.length > 0 && onFixIssues && (
              <Button
                type="button"
                variant="outline"
                onClick={onFixIssues}
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                Review & Fix
              </Button>
            )}
            <Button
              type="button"
              onClick={onProceed}
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              {warnings.length > 0 ? 'Proceed Anyway' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

