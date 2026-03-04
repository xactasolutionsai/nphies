/**
 * ClaimCommunicationPanel Component
 * 
 * Handles NPHIES Communication workflow for Claims:
 * - Send UNSOLICITED Communication (proactive info to HIC)
 * - Send SOLICITED Communication (respond to HIC's CommunicationRequest)
 * 
 * Features:
 * - View pending CommunicationRequests from HIC
 * - Compose and send Communications with free text or attachments
 * - Select which claim items the communication relates to (ClaimItemSequence)
 * - View sent Communications and their acknowledgment status
 * 
 * Note: Polling is handled by the System Poll service. This panel is display-only
 * for poll results. Use "Refresh" to reload data from the database.
 */

import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import api from '../../services/api';
import { selectStyles } from '../prior-auth/styles';

const ClaimCommunicationPanel = ({ 
  claimId, 
  claimStatus,
  nphiesClaimId,
  items = [],
  onStatusUpdate 
}) => {
  const [isPolling, setIsPolling] = useState(false);
  const [communicationRequests, setCommunicationRequests] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [pollPreviewCopied, setPollPreviewCopied] = useState(false);

  const generatePollRequestBundle = () => {
    const bundleId = crypto.randomUUID();
    const messageHeaderId = crypto.randomUUID();
    const taskId = `${Date.now()}`;
    const providerOrgId = `provider-org-${Date.now()}`;
    const providerId = communications?.[0]?.provider_nphies_id || '1010613708';
    const providerName = 'Healthcare Provider';
    const providerEndpoint = 'http://provider.com/fhir';
    const nphiesBaseURL = 'http://176.105.150.83';
    const timestamp = new Date().toISOString();
    const providerBaseUrl = providerEndpoint.replace(/\/fhir\/?$/, '');
    const taskFullUrl = `${providerBaseUrl}/Task/${taskId}`;
    const providerOrgFullUrl = `${providerBaseUrl}/Organization/${providerOrgId}`;
    const nphiesOrgFullUrl = `${providerBaseUrl}/Organization/NPHIES`;

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: timestamp,
      entry: [
        {
          fullUrl: `urn:uuid:${messageHeaderId}`,
          resource: {
            resourceType: 'MessageHeader',
            id: messageHeaderId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
            },
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'poll-request'
            },
            sender: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: providerId
              }
            },
            source: { endpoint: providerBaseUrl },
            destination: [{
              endpoint: `${nphiesBaseURL}/$process-message`,
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/nphies',
                  value: 'NPHIES'
                }
              }
            }],
            focus: [{ reference: taskFullUrl }]
          }
        },
        {
          fullUrl: taskFullUrl,
          resource: {
            resourceType: 'Task',
            id: taskId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/poll-request|1.0.0']
            },
            identifier: [{
              system: `${providerBaseUrl}/identifiers/poll-request`,
              value: `req_${taskId}`
            }],
            status: 'requested',
            intent: 'order',
            code: {
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/task-code',
                code: 'poll'
              }]
            },
            requester: { reference: `Organization/${providerOrgId}` },
            owner: { reference: 'Organization/NPHIES' },
            authoredOn: timestamp
          }
        },
        {
          fullUrl: providerOrgFullUrl,
          resource: {
            resourceType: 'Organization',
            id: providerOrgId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0']
            },
            identifier: [{
              system: 'http://nphies.sa/license/provider-license',
              value: providerId
            }],
            active: true,
            type: [{ coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/organization-type', code: 'prov' }] }],
            name: providerName
          }
        },
        {
          fullUrl: nphiesOrgFullUrl,
          resource: {
            resourceType: 'Organization',
            id: 'NPHIES',
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/organization|1.0.0']
            },
            identifier: [{
              use: 'official',
              system: 'http://nphies.sa/license/nphies',
              value: 'NPHIES'
            }],
            active: true,
            name: 'National Program for Health Information Exchange Services'
          }
        }
      ]
    };
  };

  const handleCopyPollJson = async () => {
    const pollBundle = generatePollRequestBundle();
    await navigator.clipboard.writeText(JSON.stringify(pollBundle, null, 2));
    setPollPreviewCopied(true);
    setTimeout(() => setPollPreviewCopied(false), 2000);
  };
  
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
  
  const [expandedSections, setExpandedSections] = useState({
    requests: true,
    compose: true,
    history: true
  });
  
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  
  const [showResponsePreview, setShowResponsePreview] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState(null);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewMetadata, setPreviewMetadata] = useState(null);
  
  const [showPollPreview, setShowPollPreview] = useState(false);
  const [pollBundle, setPollBundle] = useState(null);
  const [pollMetadata, setPollMetadata] = useState(null);
  const [isLoadingPollPreview, setIsLoadingPollPreview] = useState(false);
  const [pollBundleCopied, setPollBundleCopied] = useState(false);

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

  const handleRefresh = async () => {
    setIsPolling(true);
    setError(null);
    try {
      await loadData();
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data');
    } finally {
      setIsPolling(false);
    }
  };

  const handlePreviewPollBundle = async () => {
    setIsLoadingPollPreview(true);
    setError(null);
    try {
      const result = await api.previewClaimPollBundle(claimId);
      setPollBundle(result.bundle);
      setPollMetadata(result.metadata);
      setShowPollPreview(true);
    } catch (err) {
      console.error('Error fetching poll bundle preview:', err);
      setError('Failed to load poll bundle preview: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingPollPreview(false);
    }
  };

  const copyPollBundleToClipboard = async () => {
    setIsLoadingPollPreview(true);
    try {
      const result = await api.previewClaimPollBundle(claimId);
      await navigator.clipboard.writeText(JSON.stringify(result.bundle, null, 2));
      setPollBundleCopied(true);
      setTimeout(() => setPollBundleCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy poll bundle:', err);
      setError('Failed to copy poll bundle: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingPollPreview(false);
    }
  };

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
          size: file.size,
          creation: new Date().toISOString().split('T')[0]
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };
  
  const removeAttachment = (attachmentId) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const updateAttachment = (attachmentId, field, value) => {
    setAttachments(prev => prev.map(a => a.id === attachmentId ? { ...a, [field]: value } : a));
  };

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
          data: attachment.data,
          creation: attachment.creation || new Date().toISOString().split('T')[0]
        },
        category: communicationCategory,
        priority: communicationPriority
      });
    });
    
    return payloads;
  };
  
  const buildPayloadForApi = () => {
    const payloads = buildPayloadsForApi();
    return payloads.length > 0 ? payloads[0] : {
      contentType: 'string',
      contentString: '',
      category: communicationCategory,
      priority: communicationPriority
    };
  };

  const fetchPreviewFromBackend = async () => {
    try {
      const payloads = buildPayloadsForApi();
      const result = await api.previewClaimCommunicationBundle(
        claimId,
        payloads.length > 0 ? payloads : [buildPayloadForApi()],
        communicationType,
        communicationType === 'solicited' ? selectedRequestId : null
      );
      return result;
    } catch (err) {
      console.error('Error fetching preview:', err);
      throw err;
    }
  };

  const generateLocalPreviewJson = () => {
    const payloads = buildPayloadsForApi();
    
    const fhirPayloads = payloads.map(p => {
      if (p.contentType === 'string') {
        return {
          contentString: p.contentString,
          ...(p.claimItemSequences?.length > 0 && {
            extension: p.claimItemSequences.map(seq => ({
              url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-claim-item-sequence',
              valuePositiveInt: seq
            }))
          })
        };
      } else if (p.contentType === 'attachment' && p.attachment) {
        return {
          contentAttachment: {
            contentType: p.attachment.contentType,
            title: p.attachment.title,
            data: `[BASE64 DATA - ${p.attachment.size} bytes]`
          }
        };
      }
      return null;
    }).filter(Boolean);

    return {
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
              code: 'communication'
            },
            source: { endpoint: 'http://provider.com' },
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
            category: [{ coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/communication-category', code: communicationCategory }] }],
            priority: communicationPriority,
            subject: { reference: 'Patient/patient-id', type: 'Patient' },
            about: [{
              identifier: {
                system: 'http://provider.com.sa/identifiers/claim',
                value: `claim-${claimId}`
              }
            }],
            sent: new Date().toISOString(),
            payload: fhirPayloads.length > 0 ? fhirPayloads : [{ contentString: '(No content provided)' }],
            ...(communicationType === 'solicited' && selectedRequestId && {
              basedOn: [{
                identifier: {
                  system: 'http://insurer.com.sa/identifiers/communicationrequest',
                  value: `CommReq_${selectedRequestId}`
                }
              }]
            })
          }
        }
      ]
    };
  };

  const copyJsonToClipboard = async () => {
    setIsLoadingPreview(true);
    try {
      const result = await fetchPreviewFromBackend();
      await navigator.clipboard.writeText(JSON.stringify(result.bundle, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      const localJson = generateLocalPreviewJson();
      await navigator.clipboard.writeText(JSON.stringify(localJson, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
      setError('Used local preview (backend unavailable)');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleShowPreview = async () => {
    setIsLoadingPreview(true);
    setError(null);
    try {
      const result = await fetchPreviewFromBackend();
      setPreviewJson(result.bundle);
      setPreviewMetadata(result.metadata);
    } catch (err) {
      console.error('Failed to fetch preview:', err);
      setPreviewJson(generateLocalPreviewJson());
      setPreviewMetadata(null);
      setError('Using local preview (backend unavailable)');
    } finally {
      setIsLoadingPreview(false);
      setShowJsonPreview(true);
    }
  };

  const toggleItemSequence = (sequence) => {
    setSelectedItemSequences(prev => 
      prev.includes(sequence)
        ? prev.filter(s => s !== sequence)
        : [...prev, sequence]
    );
  };

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

      let result;
      if (communicationType === 'unsolicited') {
        result = await api.sendClaimUnsolicitedCommunication(claimId, payloads);
      } else {
        result = await api.sendClaimSolicitedCommunication(claimId, selectedRequestId, payloads);
      }

      if (result.success) {
        setFreeText('');
        setAttachments([]);
        setSelectedItemSequences([]);
        setShowComposeForm(false);
        setSelectedRequestId(null);
        setCommunicationCategory('notification');
        setCommunicationPriority('routine');
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

  const handleRespondToRequest = (request) => {
    setCommunicationType('solicited');
    setSelectedRequestId(request.id);
    setShowComposeForm(true);
    setExpandedSections(prev => ({ ...prev, compose: true }));
  };

  const handleViewResponse = (comm) => {
    setSelectedCommunication(comm);
    setShowResponsePreview(true);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

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

  const canSendCommunication = claimStatus === 'queued' || claimStatus === 'pended' || claimStatus === 'approved' || claimStatus === 'partial';

  if (loading) {
    return (
      <div className="p-6 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
        <p className="mt-2 text-gray-500">Loading communication data...</p>
      </div>
    );
  }

  const allRequests = communicationRequests;
  const pendingCount = communicationRequests.filter(r => !r.responded_at).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
            NPHIES Communications
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {canSendCommunication 
              ? 'Send additional information to the insurer or respond to their requests'
              : 'Communication is only available for queued, pended, approved, or partial claims'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviewPollBundle}
            disabled={isLoadingPollPreview}
            className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Preview Poll Bundle"
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </button>
          <button
            onClick={copyPollBundleToClipboard}
            disabled={isLoadingPollPreview}
            className={`flex items-center px-3 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
              pollBundleCopied 
                ? 'border-green-500 text-green-700 bg-green-50' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title="Copy Poll Bundle JSON"
          >
            {pollBundleCopied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy Bundle
              </>
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={isPolling}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

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
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={() => setError(null)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Dismiss
                </button>
                <span className="text-gray-300">|</span>
                <button 
                  onClick={handlePreviewPollBundle}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View Poll Bundle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Poll Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center">
          <RefreshCw className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
          <p className="text-blue-800 text-sm">
            Polling is now handled by the{' '}
            <a href="/system-poll" className="font-semibold underline hover:text-blue-900">System Poll</a> service.
            After sending a communication, use System Poll to retrieve responses. Click "Refresh" to see updated data.
          </p>
        </div>
      </div>

      {/* CommunicationRequests from HIC */}
      {allRequests.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('requests')}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center">
              <Inbox className="w-5 h-5 text-orange-600 mr-2" />
              <span className="font-medium text-orange-800">
                Requests from Insurer ({allRequests.length})
              </span>
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-orange-200 text-orange-800 rounded-full">
                  {pendingCount} new
                </span>
              )}
            </div>
            {expandedSections.requests ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {expandedSections.requests && (
            <div className="p-4 pt-0 space-y-3">
              {allRequests.map(request => (
                <div key={request.id} className={`bg-white rounded-lg p-4 border ${request.responded_at ? 'border-gray-200' : 'border-orange-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">Request ID: {request.request_id}</p>
                        {request.responded_at && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Responded {formatDate(request.responded_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Received: {formatDate(request.received_at)}
                      </p>
                      {request.payloads && request.payloads.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {request.payloads.map((payload, pIdx) => (
                            <div key={pIdx}>
                              {payload.content_type === 'string' && payload.content_string && (
                                <div className="p-2 bg-gray-50 rounded text-sm text-gray-700">
                                  <strong>Message:</strong> {payload.content_string}
                                </div>
                              )}
                              {payload.content_type === 'attachment' && (
                                <div className="p-2 bg-blue-50 rounded text-sm text-gray-700 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Paperclip className="w-4 h-4 text-blue-500" />
                                    <span className="font-medium">{payload.attachment_title}</span>
                                    <span className="text-xs text-gray-500">
                                      ({payload.attachment_content_type})
                                      {payload.attachment_size && ` - ${(payload.attachment_size / 1024).toFixed(1)} KB`}
                                    </span>
                                  </div>
                                  {payload.has_data && (
                                    <button
                                      onClick={() => api.downloadClaimCommunicationRequestAttachment(claimId, request.id, payload.index)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                      <Download className="w-3 h-3" />
                                      Download
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : request.payload_content_string ? (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          <strong>Message:</strong> {request.payload_content_string}
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => handleRespondToRequest(request)}
                      disabled={!canSendCommunication}
                      className={`px-3 py-1.5 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        request.responded_at 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      {request.responded_at ? 'Respond Again' : 'Respond'}
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
                      disabled={allRequests.length === 0}
                      className="mr-2"
                    />
                    <span className={`text-sm ${allRequests.length === 0 ? 'text-gray-400' : ''}`}>
                      Solicited (Response to Request)
                    </span>
                  </label>
                </div>
              </div>

              {communicationType === 'solicited' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Responding to Request
                  </label>
                  <Select
                    value={allRequests.map(req => ({
                      value: req.id,
                      label: `${req.request_id} - ${formatDate(req.received_at)}${req.responded_at ? ' (responded)' : ''}`
                    })).find(opt => opt.value === selectedRequestId)}
                    onChange={(option) => setSelectedRequestId(option?.value || null)}
                    options={allRequests.map(req => ({
                      value: req.id,
                      label: `${req.request_id} - ${formatDate(req.received_at)}${req.responded_at ? ' (responded)' : ''}`
                    }))}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select a request..."
                    isClearable
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Message Content</label>
                  <span className="text-xs text-gray-500">NPHIES supports text + attachments together</span>
                </div>
                
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
                          <div className="flex items-center flex-1 min-w-0">
                            <Paperclip className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                            <span className="text-sm truncate max-w-xs">{att.title}</span>
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              ({Math.round(att.size / 1024)} KB)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <input
                              type="date"
                              value={att.creation || ''}
                              onChange={(e) => updateAttachment(att.id, 'creation', e.target.value)}
                              className="text-xs border border-gray-300 rounded px-1.5 py-1 w-[130px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                              title="Attachment creation date"
                            />
                            <button
                              onClick={() => removeAttachment(att.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove attachment"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
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
                          onClick={() => toggleItemSequence(sequence)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            isSelected
                              ? 'bg-blue-100 border-blue-500 text-blue-700'
                              : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          #{sequence}: {item.product_or_service_display || item.product_or_service_code || item.product_or_service || 'Item'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={handleShowPreview}
                    disabled={isLoadingPreview}
                    className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {isLoadingPreview ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-2" />Preview JSON</>
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
                      <><CheckCircle className="w-4 h-4 mr-2" />Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" />Copy JSON</>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Send Communication</>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {(!comm.acknowledgment_received || comm.acknowledgment_status === 'queued') && (
                          <button
                            onClick={handleCopyPollJson}
                            className="flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                            title="Copy the Poll Bundle JSON"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            {pollPreviewCopied ? 'Copied!' : 'Copy Poll JSON'}
                          </button>
                        )}
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

                    {comm.response_bundle ? (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-2">NPHIES Response:</p>
                        {comm.response_bundle._fallback ? (
                          <div className="bg-red-50 rounded border border-red-200 p-2">
                            <p className="text-xs text-red-700 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                              No response bundle received
                              {comm.response_bundle.status && <span className="ml-1">(HTTP {comm.response_bundle.status})</span>}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white rounded border p-3 space-y-2">
                            {(() => {
                              const messageHeader = comm.response_bundle.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
                              const responseCode = messageHeader?.response?.code;
                              const eventCode = messageHeader?.eventCoding?.code;
                              
                              return (
                                <>
                                  <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                      responseCode === 'ok' 
                                        ? 'bg-green-100 text-green-800' 
                                        : responseCode === 'fatal-error' 
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {responseCode === 'ok' ? (
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                      ) : (
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                      )}
                                      {responseCode?.toUpperCase() || 'PENDING'}
                                    </span>
                                    {eventCode && (
                                      <span className="text-xs text-gray-500">Event: {eventCode}</span>
                                    )}
                                  </div>
                                  {messageHeader?.response?.identifier && (
                                    <p className="text-xs text-gray-600">
                                      Response to: {messageHeader.response.identifier}
                                    </p>
                                  )}
                                  {messageHeader?.meta?.tag?.some(t => t.code === 'queued-messages') && (
                                    <p className="text-xs text-blue-600 flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Message queued for processing
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-400 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          No NPHIES response bundle received
                        </p>
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
                    jsonCopied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {jsonCopied ? (<><CheckCircle className="w-4 h-4 mr-1" />Copied!</>) : (<><Copy className="w-4 h-4 mr-1" />Copy</>)}
                </button>
                <button
                  onClick={() => setShowJsonPreview(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

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
              </div>
            )}
            
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(previewJson, null, 2)}
              </pre>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {previewMetadata ? (
                  <span className="text-green-600">This is the actual bundle that will be sent to NPHIES</span>
                ) : (
                  <span className="text-yellow-600">This is a local preview. Server preview unavailable.</span>
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

      {/* Communication Response Details Modal */}
      {showResponsePreview && selectedCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center">
                <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Communication Details</h3>
              </div>
              <button
                onClick={() => { setShowResponsePreview(false); setSelectedCommunication(null); }}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                    <span className="text-gray-500">NPHIES Communication ID:</span>
                    <p className="font-mono text-gray-900 break-all text-xs">
                      {selectedCommunication.nphies_communication_id || <span className="text-gray-400 italic">Not assigned</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        selectedCommunication.communication_type === 'unsolicited' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
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
                    <span className="text-gray-500">Category:</span>
                    <p className="font-medium capitalize">{selectedCommunication.category || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Priority:</span>
                    <p className="font-medium capitalize">{selectedCommunication.priority || 'routine'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Sent At:</span>
                    <p className="font-medium">{formatDate(selectedCommunication.sent_at)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Acknowledgment:</span>
                    <p className="font-medium">
                      {selectedCommunication.acknowledgment_received ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">Yes</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">No</span>
                      )}
                    </p>
                  </div>
                  {selectedCommunication.acknowledgment_status && (
                    <div>
                      <span className="text-gray-500">Acknowledgment Status:</span>
                      <p className="font-medium">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          selectedCommunication.acknowledgment_status === 'ok' ? 'bg-green-100 text-green-800'
                          : selectedCommunication.acknowledgment_status === 'transient-error' ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedCommunication.acknowledgment_status === 'ok' ? 'OK' : selectedCommunication.acknowledgment_status?.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  )}
                  {selectedCommunication.acknowledgment_at && (
                    <div>
                      <span className="text-gray-500">Acknowledged At:</span>
                      <p className="font-medium text-green-600">{formatDate(selectedCommunication.acknowledgment_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Related References */}
              {(selectedCommunication.claim_id || selectedCommunication.patient_id || selectedCommunication.based_on_request_id) && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />Related References
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedCommunication.claim_id && (
                      <div>
                        <span className="text-gray-500">Claim ID:</span>
                        <p className="font-mono text-purple-800 break-all text-xs">{selectedCommunication.claim_id}</p>
                      </div>
                    )}
                    {selectedCommunication.patient_id && (
                      <div>
                        <span className="text-gray-500">Patient ID:</span>
                        <p className="font-mono text-purple-800 break-all text-xs">{selectedCommunication.patient_id}</p>
                      </div>
                    )}
                    {selectedCommunication.based_on_request_id && (
                      <div>
                        <span className="text-gray-500">Based On Request ID:</span>
                        <p className="font-mono text-purple-800 break-all text-xs">{selectedCommunication.based_on_request_id}</p>
                      </div>
                    )}
                    {selectedCommunication.based_on_request_nphies_id && (
                      <div>
                        <span className="text-gray-500">Based On Request NPHIES ID:</span>
                        <p className="font-mono text-purple-800 break-all text-xs">{selectedCommunication.based_on_request_nphies_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sender & Recipient */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
                    <Send className="w-4 h-4 mr-2" />Sender (Provider)
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Type:</span> {selectedCommunication.sender_type}</p>
                    <p><span className="text-gray-500">ID:</span> <span className="font-mono">{selectedCommunication.sender_identifier}</span></p>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center">
                    <Inbox className="w-4 h-4 mr-2" />Recipient (Insurer)
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Type:</span> {selectedCommunication.recipient_type}</p>
                    <p><span className="text-gray-500">ID:</span> <span className="font-mono">{selectedCommunication.recipient_identifier}</span></p>
                  </div>
                </div>
              </div>

              {/* Payloads */}
              {selectedCommunication.payloads && selectedCommunication.payloads.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />Payloads ({selectedCommunication.payloads.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedCommunication.payloads.map((payload, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">Payload #{payload.sequence || idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            payload.content_type === 'string' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {payload.content_type === 'string' ? 'Text' : 'Attachment'}
                          </span>
                        </div>
                        {payload.content_type === 'string' && payload.content_string && (
                          <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded border">{payload.content_string}</p>
                        )}
                        {payload.content_type === 'attachment' && (
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-700">
                              <Paperclip className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{payload.attachment_title || 'Attachment'}</span>
                              {payload.attachment_content_type && (
                                <span className="ml-2 text-xs text-gray-500">({payload.attachment_content_type})</span>
                              )}
                            </div>
                            {payload.attachment_size && (
                              <p className="text-xs text-gray-500">Size: {(payload.attachment_size / 1024).toFixed(2)} KB</p>
                            )}
                          </div>
                        )}
                        {payload.claim_item_sequences && payload.claim_item_sequences.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2">Related items: #{payload.claim_item_sequences.join(', #')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NPHIES Response */}
              {selectedCommunication.response_bundle ? (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />NPHIES Response
                  </h4>
                  {(() => {
                    const response = selectedCommunication.response_bundle;
                    if (response._fallback) {
                      return (
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-800">NPHIES did not return a response bundle</p>
                              <p className="text-xs text-red-600 mt-1">{response.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    const messageHeader = response.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
                    
                    return (
                      <div className="space-y-3">
                        <div className="bg-white rounded-lg p-3 border border-indigo-200">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Response Code:</span>
                              <p className="font-medium">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                  messageHeader?.response?.code === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {messageHeader?.response?.code === 'ok' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                                  {messageHeader?.response?.code?.toUpperCase() || 'N/A'}
                                </span>
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Event:</span>
                              <p className="font-mono text-sm">{messageHeader?.eventCoding?.code || '-'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Response To:</span>
                              <p className="font-mono text-sm break-all">{messageHeader?.response?.identifier || '-'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Timestamp:</span>
                              <p className="text-sm">{formatDate(response.timestamp)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <span className="text-xs text-gray-500">Response From:</span>
                            <p className="font-mono text-sm">{messageHeader?.sender?.identifier?.value || '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <span className="text-xs text-gray-500">Response To:</span>
                            <p className="font-mono text-sm">{messageHeader?.destination?.[0]?.receiver?.identifier?.value || '-'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2 text-gray-400" />NPHIES Response
                  </h4>
                  <p className="text-sm text-gray-500">No response bundle was received from NPHIES for this communication.</p>
                </div>
              )}

              {/* Acknowledgment Bundle */}
              {selectedCommunication.acknowledgment_bundle && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />Acknowledgment Bundle
                  </h4>
                  <button
                    onClick={() => {
                      setPreviewJson(selectedCommunication.acknowledgment_bundle);
                      setPreviewMetadata(null);
                      setShowJsonPreview(true);
                    }}
                    className="flex items-center px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />View Acknowledgment Bundle JSON
                  </button>
                </div>
              )}

              {/* View Raw JSON Buttons */}
              <div className="flex justify-center gap-3">
                {selectedCommunication.request_bundle && (
                  <button
                    onClick={() => { setPreviewJson(selectedCommunication.request_bundle); setPreviewMetadata(null); setShowJsonPreview(true); }}
                    className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />View Request Bundle JSON
                  </button>
                )}
                {selectedCommunication.response_bundle ? (
                  <button
                    onClick={() => { setPreviewJson(selectedCommunication.response_bundle); setPreviewMetadata(null); setShowJsonPreview(true); }}
                    className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />View Response Bundle JSON
                  </button>
                ) : (
                  <span className="flex items-center px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm border border-dashed border-gray-300 cursor-not-allowed">
                    <Code className="w-4 h-4 mr-2" />No Response Bundle
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => { setShowResponsePreview(false); setSelectedCommunication(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Poll Bundle Preview Modal */}
      {showPollPreview && pollBundle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Code className="w-5 h-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">NPHIES Poll Request Bundle</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(pollBundle, null, 2));
                      setPollBundleCopied(true);
                      setTimeout(() => setPollBundleCopied(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  className={`flex items-center px-3 py-1.5 rounded-lg transition-colors ${
                    pollBundleCopied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {pollBundleCopied ? (<><CheckCircle className="w-4 h-4 mr-1" />Copied!</>) : (<><Copy className="w-4 h-4 mr-1" />Copy</>)}
                </button>
                <button onClick={() => setShowPollPreview(false)} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {pollMetadata && (
              <div className="p-4 bg-purple-50 border-b border-purple-200">
                <h4 className="text-sm font-semibold text-purple-800 mb-2">Poll Request Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Claim ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.claimId || claimId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">NPHIES Claim ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.nphiesClaimId || nphiesClaimId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.status || claimStatus}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Provider:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.provider?.name || 'N/A'}</span>
                    <span className="ml-1 text-xs text-purple-600">({pollMetadata.provider?.nphiesId || 'No NPHIES ID'})</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(pollBundle, null, 2)}
              </pre>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span className="text-purple-600">This is the exact bundle that will be sent to NPHIES when polling</span>
              </div>
              <button onClick={() => setShowPollPreview(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
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
