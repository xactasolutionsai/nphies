/**
 * ClaimCommunicationPanel Component
 * 
 * Handles NPHIES Communication workflow for Claims:
 * - Status Check: Check processing status of queued/pended claims
 * - Poll: Retrieve pending messages (CommunicationRequests, ClaimResponses)
 * - Communications: Handle solicited (response to HIC request) and unsolicited (proactive)
 * 
 * Key difference from Prior Auth CommunicationPanel:
 * - Claims use status-check message first to check processing status
 * - CommunicationRequest is CONDITIONAL - may or may not be received
 * - If no CommunicationRequest, the claim may be directly adjudicated
 * 
 * Flow:
 * 1. Claim is queued/pended
 * 2. Provider sends status-check to NPHIES
 * 3. NPHIES responds with acknowledgment (queued) or status
 * 4. Provider polls for updates
 * 5. Poll may return:
 *    - CommunicationRequest (HIC needs more info) -> respond and poll again
 *    - ClaimResponse (final adjudication) -> done
 */

import React, { useState, useEffect, useCallback } from 'react';
import Select from 'react-select';
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  FileText, 
  Paperclip, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
  Upload,
  X,
  Copy,
  Eye,
  Code,
  Activity,
  ArrowRight,
  Info
} from 'lucide-react';
import api from '../../services/api';

// Select styles for dropdowns
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: '#e5e7eb',
    borderRadius: '6px',
    backgroundColor: state.isDisabled ? '#f3f4f6' : 'white',
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
    borderWidth: '1px',
    cursor: state.isDisabled ? 'not-allowed' : 'default',
    '&:hover': {
      borderColor: '#e5e7eb'
    }
  }),
  option: (base, { isFocused, isSelected, isDisabled }) => ({
    ...base,
    backgroundColor: isDisabled 
      ? '#f3f4f6'
      : isSelected 
        ? '#2563eb' 
        : isFocused 
          ? '#dbeafe' 
          : 'white',
    color: isDisabled 
      ? '#9ca3af'
      : isSelected 
        ? 'white' 
        : '#374151',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    padding: '8px 12px',
    opacity: isDisabled ? 0.7 : 1,
    '&:hover': {
      backgroundColor: isDisabled 
        ? '#f3f4f6'
        : isSelected 
          ? '#1d4ed8' 
          : '#dbeafe'
    }
  }),
  menu: (base) => ({ 
    ...base, 
    zIndex: 9999,
    position: 'absolute'
  }),
  menuPortal: (base) => ({ 
    ...base, 
    zIndex: 9999 
  })
};

const ClaimCommunicationPanel = ({ 
  claimId, 
  claimStatus,
  nphiesClaimId,
  items = [],
  onStatusUpdate 
}) => {
  // State
  const [isPolling, setIsPolling] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [pollResult, setPollResult] = useState(null);
  const [statusCheckResult, setStatusCheckResult] = useState(null);
  const [communicationRequests, setCommunicationRequests] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Acknowledgment polling state
  const [pollingAckFor, setPollingAckFor] = useState(null);
  const [ackPollResult, setAckPollResult] = useState(null);
  const [ackPollJsonCopied, setAckPollJsonCopied] = useState(null);
  
  // Form state
  const [showComposeForm, setShowComposeForm] = useState(false);
  const [communicationType, setCommunicationType] = useState('unsolicited');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedItemSequences, setSelectedItemSequences] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [communicationCategory, setCommunicationCategory] = useState('notification');
  const [communicationPriority, setCommunicationPriority] = useState('routine');
  
  // HL7 Communication Categories
  const COMMUNICATION_CATEGORIES = [
    { value: 'alert', label: 'Alert', description: 'The communication conveys an alert' },
    { value: 'notification', label: 'Notification', description: 'The communication conveys a notification' },
    { value: 'reminder', label: 'Reminder', description: 'The communication conveys a reminder' },
    { value: 'instruction', label: 'Instruction', description: 'The communication conveys an instruction' }
  ];
  
  const PRIORITY_OPTIONS = [
    { value: 'routine', label: 'Routine' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'asap', label: 'ASAP' },
    { value: 'stat', label: 'STAT (Immediate)' }
  ];
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    statusCheck: true,
    requests: true,
    compose: true,
    history: true
  });
  
  // JSON Preview state
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState(null);
  const [previewJsonTitle, setPreviewJsonTitle] = useState('');
  const [jsonCopied, setJsonCopied] = useState(false);
  
  // Response bundle preview state
  const [showResponsePreview, setShowResponsePreview] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState(null);
  
  // Status Check and Poll bundle storage (for copy functionality)
  const [lastStatusCheckRequest, setLastStatusCheckRequest] = useState(null);
  const [lastStatusCheckResponse, setLastStatusCheckResponse] = useState(null);
  const [lastPollRequest, setLastPollRequest] = useState(null);
  const [lastPollResponse, setLastPollResponse] = useState(null);

  // Load data on mount
  useEffect(() => {
    if (claimId) {
      loadData();
    }
  }, [claimId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestsRes, commsRes] = await Promise.all([
        api.getClaimCommunicationRequests(claimId),
        api.getClaimCommunications(claimId)
      ]);
      
      setCommunicationRequests(requestsRes.data || []);
      setCommunications(commsRes.data || []);
    } catch (err) {
      console.error('Error loading communication data:', err);
      setError('Failed to load communication data');
    } finally {
      setLoading(false);
    }
  };

  // Send Status Check
  const handleStatusCheck = async () => {
    setIsCheckingStatus(true);
    setError(null);
    setStatusCheckResult(null);
    
    try {
      const result = await api.sendClaimStatusCheck(claimId);
      
      // Store the bundles for copy functionality
      if (result.statusCheckBundle) {
        setLastStatusCheckRequest(result.statusCheckBundle);
      }
      if (result.response) {
        setLastStatusCheckResponse(result.response);
      }
      
      setStatusCheckResult(result);
      
      // If queued, show info about next steps
      if (result.acknowledgmentStatus === 'queued') {
        setStatusCheckResult({
          ...result,
          nextStep: 'Poll for updates to retrieve the status check response'
        });
      }
      
      // Reload data to get any new responses
      await loadData();
      
      // Notify parent if status changed
      if (result.data && onStatusUpdate) {
        onStatusUpdate(result.data);
      }
    } catch (err) {
      console.error('Error sending status check:', err);
      const errorData = err.response?.data?.error;
      let errorMessage;
      if (typeof errorData === 'object' && errorData !== null) {
        errorMessage = errorData.message || errorData.details || JSON.stringify(errorData);
      } else {
        errorMessage = errorData || err.response?.data?.details || err.message || 'Failed to send status check';
      }
      setError(errorMessage);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Poll for updates
  const handlePoll = async () => {
    setIsPolling(true);
    setError(null);
    setPollResult(null);
    
    try {
      const result = await api.pollClaimCommunication(claimId);
      
      // Store the bundles for copy functionality
      if (result.pollBundle) {
        setLastPollRequest(result.pollBundle);
      }
      if (result.responseBundle) {
        setLastPollResponse(result.responseBundle);
      }
      
      setPollResult(result);
      
      // Reload data to get new requests/responses
      await loadData();
      
      // Notify parent if status changed
      if (result.data && onStatusUpdate) {
        onStatusUpdate(result.data);
      }
    } catch (err) {
      console.error('Error polling:', err);
      const errorData = err.response?.data?.error;
      let errorMessage;
      if (typeof errorData === 'object' && errorData !== null) {
        errorMessage = errorData.message || errorData.details || JSON.stringify(errorData);
      } else {
        errorMessage = errorData || err.response?.data?.details || err.message || 'Failed to poll for updates';
      }
      setError(errorMessage);
    } finally {
      setIsPolling(false);
    }
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setAttachments(prev => [...prev, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          contentType: file.type,
          data: base64,
          title: file.name,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };
  
  const removeAttachment = (attachmentId) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  // Build payloads for API
  const buildPayloadsForApi = () => {
    const payloads = [];
    
    if (freeText.trim()) {
      payloads.push({
        contentType: 'string',
        contentString: freeText,
        category: communicationCategory,
        priority: communicationPriority,
        claimItemSequences: selectedItemSequences.length > 0 ? selectedItemSequences : undefined
      });
    }
    
    attachments.forEach(attachment => {
      payloads.push({
        contentType: 'attachment',
        attachment: {
          contentType: attachment.contentType,
          title: attachment.title,
          size: attachment.size,
          data: attachment.data
        },
        category: communicationCategory,
        priority: communicationPriority
      });
    });
    
    return payloads;
  };

  // Send communication
  const handleSend = async () => {
    if (!freeText.trim() && attachments.length === 0) {
      setError('Please enter some text or attach at least one file');
      return;
    }
    if (communicationType === 'solicited' && !selectedRequestId) {
      setError('Please select a CommunicationRequest to respond to');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const payloads = buildPayloadsForApi();
      
      if (payloads.length === 0) {
        setError('No content to send');
        setIsSending(false);
        return;
      }

      const result = await api.sendClaimCommunication(claimId, {
        payloads,
        communicationType,
        basedOnRequestId: communicationType === 'solicited' ? selectedRequestId : null
      });

      if (result.success) {
        // Reset form
        setFreeText('');
        setAttachments([]);
        setSelectedItemSequences([]);
        setShowComposeForm(false);
        setSelectedRequestId(null);
        setCommunicationCategory('notification');
        setCommunicationPriority('routine');
        
        // Reload data
        await loadData();
      } else {
        const errMsg = result.message;
        if (typeof errMsg === 'object' && errMsg !== null) {
          setError(errMsg.message || errMsg.details || JSON.stringify(errMsg));
        } else {
          setError(errMsg || 'Failed to send communication');
        }
      }
    } catch (err) {
      console.error('Error sending communication:', err);
      const errorData = err.response?.data?.error;
      let errorMessage;
      if (typeof errorData === 'object' && errorData !== null) {
        errorMessage = errorData.message || errorData.details || JSON.stringify(errorData);
      } else {
        errorMessage = errorData || err.response?.data?.message || err.message || 'Failed to send communication';
      }
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Respond to a CommunicationRequest
  const handleRespondToRequest = (request) => {
    setCommunicationType('solicited');
    setSelectedRequestId(request.id);
    setShowComposeForm(true);
    setExpandedSections(prev => ({ ...prev, compose: true }));
  };

  // View communication response/request bundles
  const handleViewResponse = (comm) => {
    setSelectedCommunication(comm);
    setShowResponsePreview(true);
  };
  
  // View JSON bundle in modal
  const handleViewJson = (json, title) => {
    setPreviewJson(json);
    setPreviewJsonTitle(title);
    setShowJsonPreview(true);
    setJsonCopied(false);
  };
  
  // Copy JSON to clipboard
  const handleCopyJson = async (json) => {
    try {
      const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status, acknowledged, acknowledgmentStatus) => {
    if (acknowledgmentStatus === 'queued') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Queued at NPHIES
        </span>
      );
    }
    
    if (acknowledgmentStatus === 'fatal-error' || acknowledgmentStatus === 'transient-error') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          {acknowledgmentStatus === 'fatal-error' ? 'Error' : 'Transient Error'}
        </span>
      );
    }
    
    if (acknowledged || acknowledgmentStatus === 'ok') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Acknowledged
        </span>
      );
    }
    
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Send className="w-3 h-3 mr-1" />
          Sent
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    );
  };

  // Check if can send status check or communication
  const canSendStatusCheck = claimStatus === 'queued' || claimStatus === 'pended';
  const canSendCommunication = claimStatus === 'queued' || claimStatus === 'pended' || claimStatus === 'approved';

  if (loading) {
    return (
      <div className="p-6 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
        <p className="mt-2 text-gray-500">Loading communication data...</p>
      </div>
    );
  }

  const pendingRequests = communicationRequests.filter(r => !r.responded_at);

  return (
    <div className="space-y-4">
      {/* Header with Status Check and Poll Buttons */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
              NPHIES Communications
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {canSendStatusCheck 
                ? 'Check status of your claim or send additional information to the insurer'
                : canSendCommunication
                ? 'Send additional information to the insurer or respond to their requests'
                : 'Communication is only available for queued, pended, or approved claims'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Check Button */}
            {canSendStatusCheck && (
              <button
                onClick={handleStatusCheck}
                disabled={isCheckingStatus}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send status-check message to NPHIES"
              >
                <Activity className={`w-4 h-4 mr-2 ${isCheckingStatus ? 'animate-pulse' : ''}`} />
                {isCheckingStatus ? 'Checking...' : 'Status Check'}
              </button>
            )}
            {/* Poll Button */}
            <button
              onClick={handlePoll}
              disabled={isPolling}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
              {isPolling ? 'Polling...' : 'Poll for Updates'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Check Flow Info */}
      {canSendStatusCheck && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-indigo-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-indigo-800">Status Check Flow</h4>
              <div className="mt-2 flex items-center text-sm text-indigo-700">
                <span className="px-2 py-1 bg-indigo-100 rounded">1. Status Check</span>
                <ArrowRight className="w-4 h-4 mx-2" />
                <span className="px-2 py-1 bg-indigo-100 rounded">2. Poll</span>
                <ArrowRight className="w-4 h-4 mx-2" />
                <span className="px-2 py-1 bg-indigo-100 rounded">3. Response</span>
              </div>
              <p className="mt-2 text-sm text-indigo-600">
                <strong>Note:</strong> CommunicationRequest is conditional. You may receive a direct ClaimResponse 
                if the insurer doesn't need additional information.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm mt-1">
                {typeof error === 'object' 
                  ? (error.message || error.details || error.code || JSON.stringify(error)) 
                  : String(error)}
              </p>
              <button 
                onClick={() => setError(null)}
                className="text-sm text-red-600 hover:text-red-800 mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Check Result */}
      {statusCheckResult && (
        <div className={`border rounded-lg p-4 ${
          statusCheckResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={`font-medium ${
                statusCheckResult.success ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {statusCheckResult.success ? (
                  <><CheckCircle className="w-4 h-4 inline mr-1" /> Status Check Sent</>
                ) : (
                  <><Clock className="w-4 h-4 inline mr-1" /> Status Check Queued</>
                )}
              </p>
              <p className={`text-sm mt-1 ${
                statusCheckResult.success ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {statusCheckResult.message}
              </p>
              {statusCheckResult.acknowledgmentStatus && (
                <p className="text-sm mt-1">
                  Acknowledgment: <span className="font-medium">{statusCheckResult.acknowledgmentStatus}</span>
                </p>
              )}
              {statusCheckResult.nextStep && (
                <p className="text-sm mt-2 text-blue-600">
                  <strong>Next:</strong> {statusCheckResult.nextStep}
                </p>
              )}
              
              {/* JSON Copy Buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {lastStatusCheckRequest && (
                  <button
                    onClick={() => handleViewJson(lastStatusCheckRequest, 'Status Check Request Bundle')}
                    className="inline-flex items-center px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    View Request JSON
                  </button>
                )}
                {lastStatusCheckResponse && (
                  <button
                    onClick={() => handleViewJson(lastStatusCheckResponse, 'Status Check Response Bundle')}
                    className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    View Response JSON
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setStatusCheckResult(null)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Poll Result */}
      {pollResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-green-800 font-medium">{pollResult.message}</p>
              {pollResult.pollResults && (
                <div className="mt-2 text-sm text-green-700">
                  <p>• ClaimResponses: {pollResult.pollResults.claimResponses?.length || 0}</p>
                  <p>• CommunicationRequests: {pollResult.pollResults.communicationRequests?.length || 0}</p>
                  <p>• Acknowledgments: {pollResult.pollResults.acknowledgments?.length || 0}</p>
                </div>
              )}
              {pollResult.hasCommunicationRequest === false && pollResult.hasClaimResponse && (
                <p className="mt-2 text-sm text-blue-600">
                  <strong>Note:</strong> Direct ClaimResponse received (no CommunicationRequest needed)
                </p>
              )}
              
              {/* JSON Copy Buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {lastPollRequest && (
                  <button
                    onClick={() => handleViewJson(lastPollRequest, 'Poll Request Bundle')}
                    className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    View Request JSON
                  </button>
                )}
                {lastPollResponse && (
                  <button
                    onClick={() => handleViewJson(lastPollResponse, 'Poll Response Bundle')}
                    className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    View Response JSON
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setPollResult(null)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pending CommunicationRequests from HIC */}
      {pendingRequests.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('requests')}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center">
              <Inbox className="w-5 h-5 text-orange-600 mr-2" />
              <span className="font-medium text-orange-800">
                Pending Requests from Insurer ({pendingRequests.length})
              </span>
            </div>
            {expandedSections.requests ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {expandedSections.requests && (
            <div className="p-4 pt-0 space-y-3">
              {pendingRequests.map(request => (
                <div key={request.id} className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">Request ID: {request.request_id}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Received: {formatDate(request.received_at)}
                      </p>
                      {request.payload_content_string && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          <strong>Message:</strong> {request.payload_content_string}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRespondToRequest(request)}
                      disabled={!canSendCommunication}
                      className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Respond
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose Communication */}
      {canSendCommunication && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('compose')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <Send className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-medium text-gray-800">Compose Communication</span>
            </div>
            {expandedSections.compose ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.compose && (
            <div className="p-4 pt-0 space-y-4">
              {/* Communication Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Communication Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="unsolicited"
                      checked={communicationType === 'unsolicited'}
                      onChange={(e) => {
                        setCommunicationType(e.target.value);
                        setSelectedRequestId(null);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Unsolicited (Proactive)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="solicited"
                      checked={communicationType === 'solicited'}
                      onChange={(e) => setCommunicationType(e.target.value)}
                      disabled={pendingRequests.length === 0}
                      className="mr-2"
                    />
                    <span className={`text-sm ${pendingRequests.length === 0 ? 'text-gray-400' : ''}`}>
                      Solicited (Response to Request)
                    </span>
                  </label>
                </div>
              </div>

              {/* Select CommunicationRequest (for solicited) */}
              {communicationType === 'solicited' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Responding to Request
                  </label>
                  <Select
                    value={pendingRequests.map(req => ({
                      value: req.id,
                      label: `${req.request_id} - ${formatDate(req.received_at)}`
                    })).find(opt => opt.value === selectedRequestId)}
                    onChange={(option) => setSelectedRequestId(option?.value || null)}
                    options={pendingRequests.map(req => ({
                      value: req.id,
                      label: `${req.request_id} - ${formatDate(req.received_at)}`
                    }))}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select a request..."
                    isClearable
                  />
                </div>
              )}

              {/* Category & Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <Select
                    value={COMMUNICATION_CATEGORIES.find(c => c.value === communicationCategory)}
                    onChange={(option) => setCommunicationCategory(option?.value || 'notification')}
                    options={COMMUNICATION_CATEGORIES}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select category..."
                    isSearchable={false}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {COMMUNICATION_CATEGORIES.find(c => c.value === communicationCategory)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <Select
                    value={PRIORITY_OPTIONS.find(p => p.value === communicationPriority)}
                    onChange={(option) => setCommunicationPriority(option?.value || 'routine')}
                    options={PRIORITY_OPTIONS}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select priority..."
                    isSearchable={false}
                  />
                </div>
              </div>

              {/* Content Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Message Content
                  </label>
                  <span className="text-xs text-gray-500">
                    NPHIES supports text + attachments together
                  </span>
                </div>
                
                {/* Text Content */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">Text Message (optional)</span>
                  </div>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={3}
                    placeholder="Enter additional information for the insurer..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Attachments Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">Attachments (optional)</span>
                    {attachments.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {attachments.length} file{attachments.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-2">
                          <div className="flex items-center">
                            <Paperclip className="w-4 h-4 text-gray-500 mr-2" />
                            <span className="text-sm truncate max-w-xs">{att.title}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({Math.round(att.size / 1024)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => removeAttachment(att.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove attachment"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                      <p className="mt-1 text-sm text-gray-500">
                        {attachments.length > 0 ? 'Add more files' : 'Click to upload files'}
                      </p>
                      <p className="text-xs text-gray-400">PDF, Images, Documents (multiple allowed)</p>
                    </div>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.tiff,.bmp"
                      multiple
                    />
                  </label>
                </div>
              </div>

              {/* Item Sequence Selection */}
              {items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Items (ClaimItemSequence)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select which claim items this communication relates to
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, index) => {
                      const sequence = item.sequence || index + 1;
                      const isSelected = selectedItemSequences.includes(sequence);
                      return (
                        <button
                          key={sequence}
                          onClick={() => {
                            setSelectedItemSequences(prev => 
                              prev.includes(sequence)
                                ? prev.filter(s => s !== sequence)
                                : [...prev, sequence]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            isSelected
                              ? 'bg-blue-100 border-blue-500 text-blue-700'
                              : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          #{sequence}: {item.product_or_service_display || item.product_or_service_code || 'Item'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end">
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Communication
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Communication History */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
          <button
            onClick={() => toggleSection('history')}
            className="flex items-center flex-1"
          >
            <MessageSquare className="w-5 h-5 text-gray-600 mr-2" />
            <span className="font-medium text-gray-800">
              Communication History ({communications.length})
            </span>
            {communications.filter(c => c.acknowledgment_status === 'queued' || (!c.acknowledgment_received && c.status === 'completed')).length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                {communications.filter(c => c.acknowledgment_status === 'queued' || (!c.acknowledgment_received && c.status === 'completed')).length} awaiting ack
              </span>
            )}
          </button>
          <button onClick={() => toggleSection('history')}>
            {expandedSections.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {expandedSections.history && (
          <div className="p-4 pt-0">
            {communications.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No communications sent yet</p>
            ) : (
              <div className="space-y-3">
                {communications.map(comm => (
                  <div key={comm.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            comm.communication_type === 'unsolicited' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {comm.communication_type === 'unsolicited' ? 'Unsolicited' : 'Solicited'}
                          </span>
                          {getStatusBadge(comm.status, comm.acknowledgment_received, comm.acknowledgment_status)}
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Sent: {formatDate(comm.sent_at)}
                        </p>
                        {comm.acknowledgment_received && (
                          <p className="text-sm text-green-600">
                            Acknowledged: {formatDate(comm.acknowledgment_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewResponse(comm)}
                          className="flex items-center px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
                          title="View Response Details"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View Details
                        </button>
                        <span className="text-xs text-gray-500">ID: {comm.communication_id?.slice(0, 8)}...</span>
                      </div>
                    </div>
                    
                    {/* Payloads */}
                    {comm.payloads && comm.payloads.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-2">Payload:</p>
                        {comm.payloads.map((payload, idx) => (
                          <div key={idx} className="text-sm">
                            {payload.content_type === 'string' && (
                              <p className="text-gray-700 bg-white p-2 rounded border">
                                {payload.content_string}
                              </p>
                            )}
                            {payload.content_type === 'attachment' && (
                              <div className="flex items-center text-gray-700">
                                <Paperclip className="w-4 h-4 mr-1" />
                                {payload.attachment_title || 'Attachment'}
                              </div>
                            )}
                            {payload.claim_item_sequences && payload.claim_item_sequences.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Related items: #{payload.claim_item_sequences.join(', #')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Communication Response Details Modal */}
      {showResponsePreview && selectedCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center">
                <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Communication Details
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowResponsePreview(false);
                  setSelectedCommunication(null);
                }}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Communication Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                  Communication Summary
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Communication ID:</span>
                    <p className="font-mono text-gray-900 break-all text-xs">{selectedCommunication.communication_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        selectedCommunication.communication_type === 'unsolicited' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedCommunication.communication_type === 'unsolicited' ? 'Unsolicited' : 'Solicited'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p>{getStatusBadge(selectedCommunication.status, selectedCommunication.acknowledgment_received, selectedCommunication.acknowledgment_status)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Sent At:</span>
                    <p className="font-medium">{formatDate(selectedCommunication.sent_at)}</p>
                  </div>
                </div>
              </div>

              {/* Payloads */}
              {selectedCommunication.payloads && selectedCommunication.payloads.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Payloads ({selectedCommunication.payloads.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedCommunication.payloads.map((payload, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">Payload #{payload.sequence || idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            payload.content_type === 'string' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {payload.content_type === 'string' ? 'Text' : 'Attachment'}
                          </span>
                        </div>
                        {payload.content_type === 'string' && payload.content_string && (
                          <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded border">
                            {payload.content_string}
                          </p>
                        )}
                        {payload.content_type === 'attachment' && (
                          <div className="flex items-center text-sm text-gray-700">
                            <Paperclip className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{payload.attachment_title || 'Attachment'}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Bundle */}
              {selectedCommunication.response_bundle && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    NPHIES Response
                  </h4>
                  <button
                    onClick={() => handleViewJson(selectedCommunication.response_bundle, 'Communication Response Bundle')}
                    className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    View Response Bundle JSON
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setShowResponsePreview(false);
                  setSelectedCommunication(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Preview Modal */}
      {showJsonPreview && previewJson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Code className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">{previewJsonTitle || 'JSON Preview'}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(previewJson, null, 2));
                      setJsonCopied(true);
                      setTimeout(() => setJsonCopied(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  className={`flex items-center px-3 py-1.5 rounded-lg transition-colors ${
                    jsonCopied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {jsonCopied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowJsonPreview(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(previewJson, null, 2)}
              </pre>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowJsonPreview(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimCommunicationPanel;

