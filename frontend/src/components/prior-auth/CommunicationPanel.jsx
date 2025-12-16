/**
 * CommunicationPanel Component
 * 
 * Handles NPHIES Communication workflow for Prior Authorizations:
 * - Test Case #1: Send UNSOLICITED Communication (proactive info to HIC)
 * - Test Case #2: Send SOLICITED Communication (respond to HIC's CommunicationRequest)
 * 
 * Features:
 * - Poll for updates (ClaimResponse, CommunicationRequests, Acknowledgments)
 * - View pending CommunicationRequests from HIC
 * - Compose and send Communications with free text or attachments
 * - Select which claim items the communication relates to (ClaimItemSequence)
 * - View sent Communications and their acknowledgment status
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
  Code
} from 'lucide-react';
import api from '../../services/api';
import { selectStyles } from './styles';

const CommunicationPanel = ({ 
  priorAuthId, 
  priorAuthStatus,
  items = [],
  onStatusUpdate 
}) => {
  // State
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState(null);
  const [communicationRequests, setCommunicationRequests] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form state
  const [showComposeForm, setShowComposeForm] = useState(false);
  const [communicationType, setCommunicationType] = useState('unsolicited');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [payloadType, setPayloadType] = useState('string');
  const [freeText, setFreeText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [selectedItemSequences, setSelectedItemSequences] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [communicationCategory, setCommunicationCategory] = useState('notification');
  const [communicationPriority, setCommunicationPriority] = useState('routine');
  
  // HL7 Communication Categories
  // See: https://terminology.hl7.org/CodeSystem-communication-category.html
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
    requests: true,
    compose: true,
    history: true
  });
  
  // JSON Preview state
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState(null);
  const [jsonCopied, setJsonCopied] = useState(false);

  // Load data on mount
  useEffect(() => {
    if (priorAuthId) {
      loadData();
    }
  }, [priorAuthId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestsRes, commsRes] = await Promise.all([
        api.getCommunicationRequests(priorAuthId),
        api.getCommunications(priorAuthId)
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

  // Poll for updates
  const handlePoll = async () => {
    setIsPolling(true);
    setError(null);
    setPollResult(null);
    
    try {
      const result = await api.pollPriorAuthorizationResponse(priorAuthId);
      setPollResult(result);
      
      // Reload data to get new requests/acknowledgments
      await loadData();
      
      // Notify parent if status changed
      if (result.data && onStatusUpdate) {
        onStatusUpdate(result.data);
      }
    } catch (err) {
      console.error('Error polling:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to poll for updates';
      setError(errorMessage);
    } finally {
      setIsPolling(false);
    }
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setAttachment({
          contentType: file.type,
          data: base64,
          title: file.name,
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate preview JSON for the communication bundle
  // Build payload for API calls
  const buildPayloadForApi = () => {
    const payload = {
      contentType: payloadType,
      category: communicationCategory,
      priority: communicationPriority,
      claimItemSequences: selectedItemSequences.length > 0 ? selectedItemSequences : undefined
    };

    if (payloadType === 'string') {
      payload.contentString = freeText;
    } else if (payloadType === 'attachment' && attachment) {
      payload.attachment = {
        contentType: attachment.contentType,
        title: attachment.title,
        size: attachment.size,
        data: attachment.data
      };
    }

    return payload;
  };

  // Fetch preview from backend API (returns actual FHIR bundle)
  const fetchPreviewFromBackend = async () => {
    try {
      const payload = buildPayloadForApi();
      const result = await api.previewCommunicationBundle(
        priorAuthId,
        [payload],
        communicationType,
        communicationType === 'solicited' ? selectedRequestId : null
      );
      return result;
    } catch (err) {
      console.error('Error fetching preview:', err);
      throw err;
    }
  };

  // Generate local preview (fallback if API fails)
  const generateLocalPreviewJson = () => {
    const payload = buildPayloadForApi();
    
    // Truncate base64 data for display
    if (payload.attachment?.data) {
      payload.attachment.data = `[BASE64 DATA - ${payload.attachment.size} bytes]`;
    }

    // Build a sample FHIR Communication bundle structure
    const communicationBundle = {
      resourceType: 'Bundle',
      id: `preview-${Date.now()}`,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: new Date().toISOString(),
      _note: 'This is a LOCAL preview. Click "Fetch from Server" for the actual bundle.',
      entry: [
        {
          fullUrl: 'urn:uuid:message-header-id',
          resource: {
            resourceType: 'MessageHeader',
            id: 'message-header-id',
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'communication-request'
            },
            source: {
              endpoint: 'http://provider.com'
            },
            focus: [{ reference: 'Communication/communication-id' }]
          }
        },
        {
          fullUrl: 'urn:uuid:communication-id',
          resource: {
            resourceType: 'Communication',
            id: 'communication-id',
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/communication|1.0.0']
            },
            status: 'completed',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/communication-category',
                code: communicationCategory
              }]
            }],
            priority: communicationPriority,
            subject: {
              reference: `Patient/patient-id`,
              type: 'Patient'
            },
            about: [{
              reference: `Claim/prior-auth-${priorAuthId}`,
              type: 'Claim'
            }],
            sent: new Date().toISOString(),
            payload: payload.contentString ? [{
              contentString: payload.contentString,
              ...(selectedItemSequences.length > 0 && {
                extension: selectedItemSequences.map(seq => ({
                  url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-claim-item-sequence',
                  valuePositiveInt: seq
                }))
              })
            }] : payload.attachment ? [{
              contentAttachment: {
                contentType: payload.attachment.contentType,
                title: payload.attachment.title,
                data: payload.attachment.data
              }
            }] : [],
            ...(communicationType === 'solicited' && selectedRequestId && {
              basedOn: [{
                reference: `CommunicationRequest/${selectedRequestId}`,
                type: 'CommunicationRequest'
              }]
            })
          }
        }
      ]
    };

    return communicationBundle;
  };

  // State for preview loading
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewMetadata, setPreviewMetadata] = useState(null);

  // Copy JSON to clipboard (uses backend preview)
  const copyJsonToClipboard = async () => {
    setIsLoadingPreview(true);
    try {
      const result = await fetchPreviewFromBackend();
      await navigator.clipboard.writeText(JSON.stringify(result.bundle, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback to local preview
      const localJson = generateLocalPreviewJson();
      await navigator.clipboard.writeText(JSON.stringify(localJson, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
      setError('Used local preview (backend unavailable)');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Show JSON preview modal (fetches from backend)
  const handleShowPreview = async () => {
    setIsLoadingPreview(true);
    setError(null);
    try {
      const result = await fetchPreviewFromBackend();
      setPreviewJson(result.bundle);
      setPreviewMetadata(result.metadata);
    } catch (err) {
      console.error('Failed to fetch preview:', err);
      // Fallback to local preview
      setPreviewJson(generateLocalPreviewJson());
      setPreviewMetadata(null);
      setError('Using local preview (backend unavailable)');
    } finally {
      setIsLoadingPreview(false);
      setShowJsonPreview(true);
    }
  };

  // Toggle item sequence selection
  const toggleItemSequence = (sequence) => {
    setSelectedItemSequences(prev => 
      prev.includes(sequence)
        ? prev.filter(s => s !== sequence)
        : [...prev, sequence]
    );
  };

  // Send communication
  const handleSend = async () => {
    // Validate
    if (payloadType === 'string' && !freeText.trim()) {
      setError('Please enter some text');
      return;
    }
    if (payloadType === 'attachment' && !attachment) {
      setError('Please select a file');
      return;
    }
    if (communicationType === 'solicited' && !selectedRequestId) {
      setError('Please select a CommunicationRequest to respond to');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // Build payload with category and priority
      const payload = {
        contentType: payloadType,
        category: communicationCategory,
        priority: communicationPriority,
        claimItemSequences: selectedItemSequences.length > 0 ? selectedItemSequences : undefined
      };

      if (payloadType === 'string') {
        payload.contentString = freeText;
      } else if (payloadType === 'attachment') {
        payload.attachment = attachment;
      }

      let result;
      if (communicationType === 'unsolicited') {
        result = await api.sendUnsolicitedCommunication(priorAuthId, [payload]);
      } else {
        result = await api.sendSolicitedCommunication(priorAuthId, selectedRequestId, [payload]);
      }

      if (result.success) {
        // Reset form
        setFreeText('');
        setAttachment(null);
        setSelectedItemSequences([]);
        setShowComposeForm(false);
        setSelectedRequestId(null);
        setCommunicationCategory('notification');
        setCommunicationPriority('routine');
        
        // Reload data
        await loadData();
      } else {
        setError(result.message || 'Failed to send communication');
      }
    } catch (err) {
      console.error('Error sending communication:', err);
      setError(err.message || 'Failed to send communication');
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
  const getStatusBadge = (status, acknowledged) => {
    if (acknowledged) {
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
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    );
  };

  // Check if can send communication
  const canSendCommunication = priorAuthStatus === 'queued';

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
      {/* Header with Poll Button */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
            NPHIES Communications
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {canSendCommunication 
              ? 'Send additional information to the insurer or respond to their requests'
              : 'Communication is only available for queued authorizations'}
          </p>
        </div>
        <button
          onClick={handlePoll}
          disabled={isPolling}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
          {isPolling ? 'Polling...' : 'Poll for Updates'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-sm text-red-600 hover:text-red-800 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Poll Result */}
      {pollResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">{pollResult.message}</p>
          {pollResult.pollResults && (
            <div className="mt-2 text-sm text-green-700">
              <p>• ClaimResponses: {pollResult.pollResults.claimResponses?.length || 0}</p>
              <p>• CommunicationRequests: {pollResult.pollResults.communicationRequests?.length || 0}</p>
              <p>• Acknowledgments: {pollResult.pollResults.acknowledgments?.length || 0}</p>
            </div>
          )}
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
                {/* Communication Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <Select
                    value={COMMUNICATION_CATEGORIES.find(c => c.value === communicationCategory)}
                    onChange={(option) => setCommunicationCategory(option?.value || 'instruction')}
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

                {/* Priority */}
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

              {/* Payload Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="string"
                      checked={payloadType === 'string'}
                      onChange={(e) => setPayloadType(e.target.value)}
                      className="mr-2"
                    />
                    <FileText className="w-4 h-4 mr-1 text-gray-500" />
                    <span className="text-sm">Free Text</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="attachment"
                      checked={payloadType === 'attachment'}
                      onChange={(e) => setPayloadType(e.target.value)}
                      className="mr-2"
                    />
                    <Paperclip className="w-4 h-4 mr-1 text-gray-500" />
                    <span className="text-sm">Attachment</span>
                  </label>
                </div>
              </div>

              {/* Content Input */}
              {payloadType === 'string' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Content
                  </label>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={4}
                    placeholder="Enter additional information for the insurer..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attachment
                  </label>
                  {attachment ? (
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <Paperclip className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="text-sm">{attachment.title}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({Math.round(attachment.size / 1024)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => setAttachment(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                        <p className="mt-2 text-sm text-gray-500">Click to upload file</p>
                        <p className="text-xs text-gray-400">PDF, Images, Documents</p>
                      </div>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Item Sequence Selection */}
              {items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Items (ClaimItemSequence)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select which authorization items this communication relates to
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, index) => {
                      const sequence = item.sequence || index + 1;
                      const isSelected = selectedItemSequences.includes(sequence);
                      return (
                        <button
                          key={sequence}
                          onClick={() => toggleItemSequence(sequence)}
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
              <div className="flex justify-between items-center">
                {/* Preview & Copy JSON Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleShowPreview}
                    disabled={isLoadingPreview}
                    className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {isLoadingPreview ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview JSON
                      </>
                    )}
                  </button>
                  <button
                    onClick={copyJsonToClipboard}
                    disabled={isLoadingPreview}
                    className={`flex items-center px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
                      jsonCopied 
                        ? 'border-green-500 text-green-700 bg-green-50' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {jsonCopied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy JSON
                      </>
                    )}
                  </button>
                </div>

                {/* Send Button */}
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
        <button
          onClick={() => toggleSection('history')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center">
            <MessageSquare className="w-5 h-5 text-gray-600 mr-2" />
            <span className="font-medium text-gray-800">
              Communication History ({communications.length})
            </span>
          </div>
          {expandedSections.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.history && (
          <div className="p-4 pt-0">
            {communications.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No communications sent yet</p>
            ) : (
              <div className="space-y-3">
                {communications.map(comm => (
                  <div key={comm.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            comm.communication_type === 'unsolicited' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {comm.communication_type === 'unsolicited' ? 'Unsolicited' : 'Solicited'}
                          </span>
                          {getStatusBadge(comm.status, comm.acknowledgment_received)}
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
                      <span className="text-xs text-gray-500">ID: {comm.communication_id?.slice(0, 8)}...</span>
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

      {/* JSON Preview Modal */}
      {showJsonPreview && previewJson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Code className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  FHIR Communication Bundle {previewMetadata ? '(Server Preview)' : '(Local Preview)'}
                </h3>
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

            {/* Metadata Panel (if from server) */}
            {previewMetadata && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Bundle Metadata (from database)</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Provider:</span>
                    <span className="ml-2 font-medium text-gray-900">{previewMetadata.provider?.name || 'N/A'}</span>
                    <span className="ml-1 text-xs text-blue-600">({previewMetadata.provider?.nphies_id || 'No NPHIES ID'})</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Insurer:</span>
                    <span className="ml-2 font-medium text-gray-900">{previewMetadata.insurer?.name || 'N/A'}</span>
                    <span className="ml-1 text-xs text-blue-600">({previewMetadata.insurer?.nphies_id || 'No NPHIES ID'})</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Patient:</span>
                    <span className="ml-2 font-medium text-gray-900">{previewMetadata.patient?.name || 'N/A'}</span>
                  </div>
                </div>
                {(!previewMetadata.provider?.nphies_id || !previewMetadata.insurer?.nphies_id) && (
                  <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-xs">
                    ⚠️ Warning: Missing NPHIES IDs may cause errors like BV-00176 or GE-00010
                  </div>
                )}
              </div>
            )}
            
            {/* Modal Body - JSON Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(previewJson, null, 2)}
              </pre>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {previewMetadata ? (
                  <span className="text-green-600">✓ This is the actual bundle that will be sent to NPHIES</span>
                ) : (
                  <span className="text-yellow-600">⚠ This is a local preview. Server preview unavailable.</span>
                )}
              </div>
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

export default CommunicationPanel;

