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
  Code,
  XCircle
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
  
  // Acknowledgment polling state
  const [pollingAckFor, setPollingAckFor] = useState(null); // Communication ID being polled
  const [ackPollResult, setAckPollResult] = useState(null);
  const [ackPollJsonCopied, setAckPollJsonCopied] = useState(null); // 'request' or 'response'
  const [pollPreviewCopied, setPollPreviewCopied] = useState(false);
  
  // Auto-poll state (Step 7-8)
  const [isAutoPolling, setIsAutoPolling] = useState(false);
  const [autoPollTimeout, setAutoPollTimeout] = useState(null);
  const [finalResponseStatus, setFinalResponseStatus] = useState(null); // 'waiting', 'received', 'approved', 'denied', 'partial'

  // Generate the full Poll Request Bundle that will be sent to NPHIES
  // Based on official NPHIES IG: https://portal.nphies.sa/ig/Bundle-a84aabfa-1163-407d-aa38-f8119a0b7aa1.json.html
  // NPHIES Poll uses MessageHeader with eventCoding: 'poll-request' and Task resource
  const generatePollRequestBundle = () => {
    const bundleId = crypto.randomUUID();
    const messageHeaderId = crypto.randomUUID();
    // Use simple numeric ID format matching NPHIES example (e.g., "560082")
    const taskId = `${Date.now()}`;
    const providerOrgId = `provider-org-${Date.now()}`; // Simple ID format for provider org
    // Get provider ID from the first communication if available, otherwise use placeholder
    const providerId = communications?.[0]?.provider_nphies_id || '1010613708';
    const providerName = 'Healthcare Provider';
    const providerEndpoint = 'http://provider.com/fhir';
    const nphiesBaseURL = 'http://176.105.150.83'; // Should match backend env
    const timestamp = new Date().toISOString();
    
    // Extract base URL from provider endpoint (remove /fhir if present)
    // Example: http://provider.com/fhir -> http://provider.com
    const providerBaseUrl = providerEndpoint.replace(/\/fhir\/?$/, '');
    
    // Use absolute URLs for fullUrl values (matching NPHIES specification example)
    // Example from spec: http://saudigeneralhospital.com.sa/Task/560082
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
        // 1. MessageHeader
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
            source: {
              endpoint: providerBaseUrl
            },
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
            // Focus uses full URL matching Task fullUrl exactly
            focus: [{
              reference: taskFullUrl
            }]
          }
        },
        // 2. Task (poll-request) - minimal fields only
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
            requester: {
              reference: `Organization/${providerOrgId}`
            },
            owner: {
              reference: 'Organization/NPHIES'
            },
            authoredOn: timestamp
          }
        },
        // 3. Provider Organization - simplified (no extension, no address)
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
            type: [{
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
                code: 'prov'
              }]
            }],
            name: providerName
          }
        },
        // 4. NPHIES Organization - simplified (no use field in identifier)
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
  // NPHIES supports multiple payloads: text + attachments together
  const [freeText, setFreeText] = useState('');
  const [attachments, setAttachments] = useState([]); // Changed to array for multiple files
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
  
  // Response bundle preview state
  const [showResponsePreview, setShowResponsePreview] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState(null);

  // Load data on mount
  useEffect(() => {
    if (priorAuthId) {
      loadData();
    }
  }, [priorAuthId]);

  // Cleanup auto-poll timeout on unmount
  useEffect(() => {
    return () => {
      if (autoPollTimeout) {
        clearTimeout(autoPollTimeout);
      }
    };
  }, [autoPollTimeout]);

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
  const handlePoll = async (isAutoPoll = false) => {
    if (isAutoPoll) {
      setIsAutoPolling(true);
    } else {
      setIsPolling(true);
    }
    setError(null);
    setPollResult(null);
    
    try {
      const result = await api.pollPriorAuthorizationResponse(priorAuthId);
      setPollResult(result);
      
      // Reload data to get new requests/acknowledgments
      await loadData();
      
      // Check if we should auto-poll for final response (Step 7)
      if (result.pollResults?.shouldAutoPollForFinalResponse && !isAutoPoll) {
        const delayMs = result.pollResults.autoPollDelayMs || 3000;
        console.log(`[CommunicationPanel] Auto-polling for final response in ${delayMs}ms...`);
        
        // Clear any existing timeout
        if (autoPollTimeout) {
          clearTimeout(autoPollTimeout);
        }
        
        // Set timeout for auto-poll
        const timeout = setTimeout(async () => {
          console.log('[CommunicationPanel] Executing auto-poll for final response...');
          await handlePoll(true); // Recursive call with isAutoPoll flag
        }, delayMs);
        
        setAutoPollTimeout(timeout);
        setFinalResponseStatus('waiting');
      }
      
      // Check if final response was received (Step 8)
      if (result.pollResults?.claimResponses && result.pollResults.claimResponses.length > 0) {
        const claimResponse = result.pollResults.claimResponses[0];
        // claimResponse is already processed, check status field
        if (claimResponse.status === 'approved' || claimResponse.status === 'denied' || claimResponse.status === 'partial') {
          setFinalResponseStatus(claimResponse.status);
        } else if (claimResponse.outcome === 'complete') {
          const disposition = claimResponse.disposition?.toLowerCase() || '';
          if (disposition.includes('approved') || disposition.includes('accept')) {
            setFinalResponseStatus('approved');
          } else if (disposition.includes('denied') || disposition.includes('reject')) {
            setFinalResponseStatus('denied');
          } else {
            setFinalResponseStatus('approved'); // Default
          }
        } else if (claimResponse.outcome === 'partial') {
          setFinalResponseStatus('partial');
        }
      }
      
      // Notify parent if status changed
      if (result.data && onStatusUpdate) {
        onStatusUpdate(result.data);
      }
    } catch (err) {
      console.error('Error polling:', err);
      // Handle error object properly - extract message string
      const errorData = err.response?.data?.error;
      let errorMessage;
      if (typeof errorData === 'object' && errorData !== null) {
        errorMessage = errorData.message || errorData.details || JSON.stringify(errorData);
      } else {
        errorMessage = errorData || err.response?.data?.details || err.message || 'Failed to poll for updates';
      }
      setError(errorMessage);
      
      // If auto-poll failed, allow manual retry
      if (isAutoPoll) {
        setFinalResponseStatus('waiting'); // Keep waiting, show manual button
      }
    } finally {
      if (isAutoPoll) {
        setIsAutoPolling(false);
      } else {
        setIsPolling(false);
      }
    }
  };

  // Poll for acknowledgment of a specific communication
  const handlePollAcknowledgment = async (communicationId) => {
    setPollingAckFor(communicationId);
    setAckPollResult(null);
    setError(null);
    
    try {
      const result = await api.pollCommunicationAcknowledgment(priorAuthId, communicationId);
      
      setAckPollResult(result);
      
      // Reload communications to get updated acknowledgment status
      await loadData();
      
      // Show success/info message
      if (result.acknowledgmentFound) {
        setAckPollResult({
          ...result,
          message: `Acknowledgment received: ${result.acknowledgmentStatus}`
        });
        
        // Check if this was an unsolicited communication - trigger auto-poll (Step 7)
        const comm = communications.find(c => c.communication_id === communicationId);
        if (comm && comm.communication_type === 'unsolicited') {
          const delayMs = 3000; // Default delay
          console.log(`[CommunicationPanel] Unsolicited communication acknowledged. Auto-polling for final response in ${delayMs}ms...`);
          
          // Clear any existing timeout
          if (autoPollTimeout) {
            clearTimeout(autoPollTimeout);
          }
          
          // Set timeout for auto-poll
          const timeout = setTimeout(async () => {
            console.log('[CommunicationPanel] Executing auto-poll for final response after acknowledgment...');
            await handlePoll(true); // Auto-poll
          }, delayMs);
          
          setAutoPollTimeout(timeout);
          setFinalResponseStatus('waiting');
        }
      } else if (result.alreadyAcknowledged) {
        setAckPollResult({
          ...result,
          message: 'Communication was already acknowledged'
        });
      }
    } catch (err) {
      console.error('Error polling for acknowledgment:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to poll for acknowledgment';
      setError(errorMessage);
    } finally {
      setPollingAckFor(null);
    }
  };

  // Poll for all queued acknowledgments
  const handlePollAllAcknowledgments = async () => {
    setIsPolling(true);
    setAckPollResult(null);
    setError(null);
    
    try {
      const result = await api.pollAllQueuedAcknowledgments(priorAuthId);
      
      setAckPollResult(result);
      
      // Reload communications to get updated acknowledgment status
      await loadData();
    } catch (err) {
      console.error('Error polling for all acknowledgments:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to poll for acknowledgments';
      setError(errorMessage);
    } finally {
      setIsPolling(false);
    }
  };

  // Preview poll bundle (without sending)
  const handlePreviewPollBundle = async () => {
    setIsLoadingPollPreview(true);
    setError(null);
    try {
      const result = await api.previewPollBundle(priorAuthId);
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

  // Copy poll bundle to clipboard
  const copyPollBundleToClipboard = async () => {
    setIsLoadingPollPreview(true);
    try {
      const result = await api.previewPollBundle(priorAuthId);
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

  // Handle file upload - supports multiple files per NPHIES spec
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Process each file
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
    
    // Reset input to allow selecting same file again
    e.target.value = '';
  };
  
  // Remove a specific attachment
  const removeAttachment = (attachmentId) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  // Generate preview JSON for the communication bundle
  // Build payloads for API calls - supports multiple payloads per NPHIES spec
  // NPHIES allows: text + multiple attachments in a single Communication
  const buildPayloadsForApi = () => {
    const payloads = [];
    
    // Add text payload if free text is provided
    if (freeText.trim()) {
      payloads.push({
        contentType: 'string',
        contentString: freeText,
        category: communicationCategory,
        priority: communicationPriority,
        claimItemSequences: selectedItemSequences.length > 0 ? selectedItemSequences : undefined
      });
    }
    
    // Add attachment payloads for each file
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
        // Note: claimItemSequences typically only apply to text payloads
      });
    });
    
    return payloads;
  };
  
  // Legacy single payload builder for backwards compatibility
  const buildPayloadForApi = () => {
    const payloads = buildPayloadsForApi();
    return payloads.length > 0 ? payloads[0] : {
      contentType: 'string',
      contentString: '',
      category: communicationCategory,
      priority: communicationPriority
    };
  };

  // Fetch preview from backend API (returns actual FHIR bundle)
  const fetchPreviewFromBackend = async () => {
    try {
      const payloads = buildPayloadsForApi();
      const result = await api.previewCommunicationBundle(
        priorAuthId,
        payloads.length > 0 ? payloads : [buildPayloadForApi()], // Fallback to single payload
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
    const payloads = buildPayloadsForApi();
    
    // Build FHIR payload array with truncated base64 data for display
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
              code: 'communication'
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
                system: 'http://nphies.sa/terminology/CodeSystem/communication-category',
                code: communicationCategory
              }]
            }],
            priority: communicationPriority,
            subject: {
              reference: `Patient/patient-id`,
              type: 'Patient'
            },
            about: [{
              identifier: {
                system: 'http://provider.com.sa/identifiers/authorization',
                value: `prior-auth-${priorAuthId}`
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

    return communicationBundle;
  };

  // State for preview loading
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewMetadata, setPreviewMetadata] = useState(null);
  
  // Poll bundle preview state
  const [showPollPreview, setShowPollPreview] = useState(false);
  const [pollBundle, setPollBundle] = useState(null);
  const [pollMetadata, setPollMetadata] = useState(null);
  const [isLoadingPollPreview, setIsLoadingPollPreview] = useState(false);
  const [pollBundleCopied, setPollBundleCopied] = useState(false);

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
    // Validate - must have at least text OR attachment(s)
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
      // Build payloads array - supports text + multiple attachments per NPHIES spec
      const payloads = buildPayloadsForApi();
      
      if (payloads.length === 0) {
        setError('No content to send');
        setIsSending(false);
        return;
      }

      let result;
      if (communicationType === 'unsolicited') {
        result = await api.sendUnsolicitedCommunication(priorAuthId, payloads);
      } else {
        result = await api.sendSolicitedCommunication(priorAuthId, selectedRequestId, payloads);
      }

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
        
        // If unsolicited communication was sent, auto-poll for acknowledgment after a delay
        if (communicationType === 'unsolicited') {
          console.log('[CommunicationPanel] Unsolicited communication sent. Auto-polling for acknowledgment in 2 seconds...');
          
          // Wait 2 seconds for NPHIES to process, then poll for acknowledgment
          setTimeout(async () => {
            console.log('[CommunicationPanel] Auto-polling for acknowledgment...');
            await handlePoll(false); // Poll for acknowledgment
          }, 2000);
        }
      } else {
        // Handle error object properly
        const errMsg = result.message;
        if (typeof errMsg === 'object' && errMsg !== null) {
          setError(errMsg.message || errMsg.details || JSON.stringify(errMsg));
        } else {
          setError(errMsg || 'Failed to send communication');
        }
      }
    } catch (err) {
      console.error('Error sending communication:', err);
      // Handle error object properly - extract message string
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

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  // Get status badge - handles acknowledgment status including queued messages
  const getStatusBadge = (status, acknowledged, acknowledgmentStatus) => {
    // Check acknowledgment status first
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

  // Check if can send communication - allow for queued and approved PAs
  const canSendCommunication = priorAuthStatus === 'queued' || priorAuthStatus === 'approved';

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
              : 'Communication is only available for queued or approved authorizations'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Preview Poll Bundle Button */}
          <button
            onClick={handlePreviewPollBundle}
            disabled={isLoadingPollPreview}
            className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Preview Poll Bundle"
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </button>
          {/* Copy Poll Bundle Button */}
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

      {/* Final Response Status (Step 8) */}
      {finalResponseStatus && (
        <div className={`border rounded-lg p-4 ${
          finalResponseStatus === 'approved' 
            ? 'bg-green-50 border-green-200' 
            : finalResponseStatus === 'denied'
            ? 'bg-red-50 border-red-200'
            : finalResponseStatus === 'partial'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start">
            {finalResponseStatus === 'approved' && (
              <>
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-800 font-semibold">✅ Final Authorization Response Received: Approved</p>
                  <p className="text-sm text-green-700 mt-1">
                    The authorization has been approved. Check the Prior Authorization details for approved amounts and disposition.
                  </p>
                </div>
              </>
            )}
            {finalResponseStatus === 'denied' && (
              <>
                <XCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-semibold">❌ Final Authorization Response Received: Denied</p>
                  <p className="text-sm text-red-700 mt-1">
                    The authorization has been denied. Check the Prior Authorization details for denial reason.
                  </p>
                </div>
              </>
            )}
            {finalResponseStatus === 'partial' && (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-800 font-semibold">⚠️ Final Authorization Response Received: Partial</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    The authorization has been partially approved. Check the Prior Authorization details for approved items.
                  </p>
                </div>
              </>
            )}
            {finalResponseStatus === 'waiting' && (
              <>
                <Clock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="text-blue-800 font-semibold">⏳ Waiting for Final Authorization Response</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {isAutoPolling 
                      ? 'Polling for final response...' 
                      : 'After HIC acknowledges your communication, they will adjudicate and send the final authorization response. Click "Poll for Updates" to retrieve it.'}
                  </p>
                  {!isAutoPolling && (
                    <button
                      onClick={() => handlePoll(false)}
                      disabled={isPolling}
                      className="mt-2 flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${isPolling ? 'animate-spin' : ''}`} />
                      Poll for Final Response
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Poll Result */}
      {pollResult && (
        <div className={`border rounded-lg p-4 ${
          pollResult.errors && pollResult.errors.length > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <p className={`font-medium ${
            pollResult.errors && pollResult.errors.length > 0
              ? 'text-red-800'
              : 'text-green-800'
          }`}>
            {pollResult.message}
          </p>
          
          {/* Display Errors if any */}
          {pollResult.errors && pollResult.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-red-300">
              <p className="text-red-800 font-semibold mb-2">⚠️ Errors Found:</p>
              <div className="space-y-2">
                {pollResult.errors.map((err, index) => (
                  <div key={index} className="bg-red-100 border border-red-300 rounded p-2">
                    <p className="text-sm text-red-800">
                      <span className="font-medium">Error {index + 1}:</span>
                      {err.code && <span className="ml-2">Code: <code className="bg-red-200 px-1 rounded">{err.code}</code></span>}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {err.message || err.details || JSON.stringify(err)}
                    </p>
                    {err.expression && (
                      <p className="text-xs text-red-600 mt-1 font-mono">
                        Location: {err.expression}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {pollResult.pollResults && (
            <div className={`mt-2 text-sm ${
              pollResult.errors && pollResult.errors.length > 0
                ? 'text-red-700'
                : 'text-green-700'
            }`}>
              <p>• ClaimResponses: {pollResult.pollResults.claimResponses?.length || 0}</p>
              <p>• CommunicationRequests: {pollResult.pollResults.communicationRequests?.length || 0}</p>
              <p>• Acknowledgments: {pollResult.pollResults.acknowledgments?.length || 0}</p>
              {pollResult.pollResults.shouldAutoPollForFinalResponse && (
                <p className="mt-2 text-blue-700 font-medium">
                  ℹ️ Acknowledgment received! Auto-polling for final response in {pollResult.pollResults.autoPollDelayMs || 3000}ms...
                </p>
              )}
            </div>
          )}
          
          {/* Show responseCode if available */}
          {pollResult.responseCode && (
            <p className={`text-xs mt-2 ${
              pollResult.responseCode === 'ok' ? 'text-green-600' : 'text-red-600'
            }`}>
              Response Code: <code className="bg-gray-100 px-1 rounded">{pollResult.responseCode}</code>
            </p>
          )}
        </div>
      )}

      {/* Acknowledgment Poll Result */}
      {ackPollResult && (
        <div className={`border rounded-lg p-4 ${
          ackPollResult.acknowledgmentFound 
            ? 'bg-green-50 border-green-200' 
            : ackPollResult.alreadyAcknowledged
            ? 'bg-blue-50 border-blue-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={`font-medium ${
                ackPollResult.acknowledgmentFound 
                  ? 'text-green-800' 
                  : ackPollResult.alreadyAcknowledged
                  ? 'text-blue-800'
                  : 'text-yellow-800'
              }`}>
                {ackPollResult.acknowledgmentFound && (
                  <><CheckCircle className="w-4 h-4 inline mr-1" /> Acknowledgment Received!</>
                )}
                {ackPollResult.alreadyAcknowledged && (
                  <><CheckCircle className="w-4 h-4 inline mr-1" /> Already Acknowledged</>
                )}
                {!ackPollResult.acknowledgmentFound && !ackPollResult.alreadyAcknowledged && (
                  <><Clock className="w-4 h-4 inline mr-1" /> No Acknowledgment Yet</>
                )}
              </p>
              <p className={`text-sm mt-1 ${
                ackPollResult.acknowledgmentFound 
                  ? 'text-green-700' 
                  : ackPollResult.alreadyAcknowledged
                  ? 'text-blue-700'
                  : 'text-yellow-700'
              }`}>
                {ackPollResult.message}
              </p>
              {ackPollResult.acknowledgmentStatus && (
                <p className="text-sm mt-1">
                  Status: <span className="font-medium">{ackPollResult.acknowledgmentStatus}</span>
                </p>
              )}
              {ackPollResult.queuedCount !== undefined && (
                <p className="text-sm mt-1">
                  Polled: {ackPollResult.queuedCount} communication(s) | 
                  Acknowledged: {ackPollResult.acknowledgedCount || 0} | 
                  Still queued: {ackPollResult.stillQueuedCount || 0}
                </p>
              )}
              
              {/* Copy JSON Buttons */}
              {(ackPollResult.pollBundle || ackPollResult.responseBundle) && (
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    <strong>Poll Request:</strong> POST /$process-message with poll-request Bundle
                  </p>
                  <div className="flex items-center gap-2">
                    {ackPollResult.pollBundle && (
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(JSON.stringify(ackPollResult.pollBundle, null, 2));
                          setAckPollJsonCopied('request');
                          setTimeout(() => setAckPollJsonCopied(null), 2000);
                        }}
                        className="flex items-center px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {ackPollJsonCopied === 'request' ? '✓ Copied!' : 'Copy Poll Bundle'}
                      </button>
                    )}
                    {ackPollResult.responseBundle && (
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(JSON.stringify(ackPollResult.responseBundle, null, 2));
                          setAckPollJsonCopied('response');
                          setTimeout(() => setAckPollJsonCopied(null), 2000);
                        }}
                        className="flex items-center px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {ackPollJsonCopied === 'response' ? '✓ Copied!' : 'Copy Response JSON'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setAckPollResult(null)}
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

              {/* Content Section - NPHIES supports multiple payloads: text + attachments */}
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
                  
                  {/* Display existing attachments */}
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
                  
                  {/* Upload area */}
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
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
          <button
            onClick={() => toggleSection('history')}
            className="flex items-center flex-1"
          >
            <MessageSquare className="w-5 h-5 text-gray-600 mr-2" />
            <span className="font-medium text-gray-800">
              Communication History ({communications.length})
            </span>
            {/* Show count of queued communications */}
            {communications.filter(c => c.acknowledgment_status === 'queued' || (!c.acknowledgment_received && c.status === 'completed')).length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                {communications.filter(c => c.acknowledgment_status === 'queued' || (!c.acknowledgment_received && c.status === 'completed')).length} awaiting ack
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            {/* Poll All Acknowledgments button */}
            {communications.filter(c => c.acknowledgment_status === 'queued' || (!c.acknowledgment_received && c.status === 'completed')).length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePollAllAcknowledgments();
                }}
                disabled={isPolling}
                className="flex items-center px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Poll for all pending acknowledgments"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isPolling ? 'animate-spin' : ''}`} />
                {isPolling ? 'Polling...' : 'Poll All Acks'}
              </button>
            )}
            <button onClick={() => toggleSection('history')}>
              {expandedSections.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
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
                        {/* Poll for Acknowledgment button - show when queued or not acknowledged */}
                        {(!comm.acknowledgment_received || comm.acknowledgment_status === 'queued') && (
                          <>
                            <button
                              onClick={handleCopyPollJson}
                              className="flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                              title="Copy the $poll Parameters JSON that will be sent to NPHIES"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              {pollPreviewCopied ? '✓ Copied!' : 'Copy Poll JSON'}
                            </button>
                            <button
                              onClick={() => handlePollAcknowledgment(comm.communication_id)}
                              disabled={pollingAckFor === comm.communication_id}
                              className="flex items-center px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Poll NPHIES for acknowledgment"
                            >
                              <RefreshCw className={`w-3 h-3 mr-1 ${pollingAckFor === comm.communication_id ? 'animate-spin' : ''}`} />
                              {pollingAckFor === comm.communication_id ? 'Polling...' : 'Poll Ack'}
                            </button>
                          </>
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

                    {/* Response Summary - Show key info from response_bundle */}
                    {comm.response_bundle && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-2">NPHIES Response:</p>
                        <div className="bg-white rounded border p-3 space-y-2">
                          {/* Extract MessageHeader response info */}
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
                                    <span className="text-xs text-gray-500">
                                      Event: {eventCode}
                                    </span>
                                  )}
                                </div>
                                {messageHeader?.response?.identifier && (
                                  <p className="text-xs text-gray-600">
                                    Response to: {messageHeader.response.identifier}
                                  </p>
                                )}
                                {/* Check for queued-messages tag */}
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
                    <span className="text-gray-500">NPHIES Communication ID:</span>
                    <p className="font-mono text-gray-900 break-all text-xs">
                      {selectedCommunication.nphies_communication_id || 
                        <span className="text-gray-400 italic">Not assigned</span>
                      }
                    </p>
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
                    <span className="text-gray-500">Acknowledgment Received:</span>
                    <p className="font-medium">
                      {selectedCommunication.acknowledgment_received ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                          ✓ Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          No
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Acknowledgment Status:</span>
                    <p className="font-medium">
                      {selectedCommunication.acknowledgment_status ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          selectedCommunication.acknowledgment_status === 'ok' 
                            ? 'bg-green-100 text-green-800'
                            : selectedCommunication.acknowledgment_status === 'transient-error'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedCommunication.acknowledgment_status === 'ok' ? '✓ OK' : selectedCommunication.acknowledgment_status?.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </p>
                  </div>
                  {selectedCommunication.acknowledgment_at && (
                    <div>
                      <span className="text-gray-500">Acknowledged At:</span>
                      <p className="font-medium text-green-600">{formatDate(selectedCommunication.acknowledgment_at)}</p>
                    </div>
                  )}
                  {selectedCommunication.created_at && (
                    <div>
                      <span className="text-gray-500">Created At:</span>
                      <p className="font-medium text-gray-600">{formatDate(selectedCommunication.created_at)}</p>
                    </div>
                  )}
                  {selectedCommunication.updated_at && (
                    <div>
                      <span className="text-gray-500">Updated At:</span>
                      <p className="font-medium text-gray-600">{formatDate(selectedCommunication.updated_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Related References */}
              {(selectedCommunication.claim_id || selectedCommunication.patient_id || selectedCommunication.based_on_request_id || selectedCommunication.based_on_request_nphies_id) && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Related References
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

              {/* About Reference */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  About Reference (Claim)
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Reference Type:</span>
                    <p className="font-medium">{selectedCommunication.about_type || 'Claim'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Reference Value:</span>
                    <p className="font-mono text-blue-800 break-all">{selectedCommunication.about_reference || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Sender & Recipient */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
                    <Send className="w-4 h-4 mr-2" />
                    Sender (Provider)
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Type:</span> {selectedCommunication.sender_type}</p>
                    <p><span className="text-gray-500">ID:</span> <span className="font-mono">{selectedCommunication.sender_identifier}</span></p>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center">
                    <Inbox className="w-4 h-4 mr-2" />
                    Recipient (Insurer)
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
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-700">
                              <Paperclip className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{payload.attachment_title || 'Attachment'}</span>
                              {payload.attachment_content_type && (
                                <span className="ml-2 text-xs text-gray-500">({payload.attachment_content_type})</span>
                              )}
                            </div>
                            {payload.attachment_size && (
                              <p className="text-xs text-gray-500">
                                Size: {(payload.attachment_size / 1024).toFixed(2)} KB
                              </p>
                            )}
                            {payload.attachment_url && (
                              <p className="text-xs text-gray-500 break-all">
                                URL: <a href={payload.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{payload.attachment_url}</a>
                              </p>
                            )}
                            {payload.attachment_hash && (
                              <p className="text-xs text-gray-500 font-mono">
                                Hash: {payload.attachment_hash}
                              </p>
                            )}
                          </div>
                        )}
                        {(payload.reference_value || payload.reference_type) && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Reference:</p>
                            {payload.reference_type && (
                              <p className="text-xs text-gray-600">Type: {payload.reference_type}</p>
                            )}
                            {payload.reference_value && (
                              <p className="text-xs text-gray-600 font-mono break-all">Value: {payload.reference_value}</p>
                            )}
                          </div>
                        )}
                        {payload.claim_item_sequences && payload.claim_item_sequences.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Related items: #{payload.claim_item_sequences.join(', #')}
                          </p>
                        )}
                        {payload.created_at && (
                          <p className="text-xs text-gray-400 mt-2">
                            Created: {formatDate(payload.created_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NPHIES Response Details */}
              {selectedCommunication.response_bundle && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    NPHIES Response
                  </h4>
                  {(() => {
                    const response = selectedCommunication.response_bundle;
                    const messageHeader = response.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
                    
                    return (
                      <div className="space-y-3">
                        {/* Response Status */}
                        <div className="bg-white rounded-lg p-3 border border-indigo-200">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Response Code:</span>
                              <p className="font-medium">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                  messageHeader?.response?.code === 'ok' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {messageHeader?.response?.code === 'ok' ? (
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                  )}
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
                          
                          {/* Tags */}
                          {messageHeader?.meta?.tag && messageHeader.meta.tag.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <span className="text-xs text-gray-500">Tags:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {messageHeader.meta.tag.map((tag, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                                    {tag.code}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Sender/Receiver Info */}
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
              )}

              {/* Acknowledgment Bundle */}
              {selectedCommunication.acknowledgment_bundle && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Acknowledgment Bundle
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Full acknowledgment bundle received from NPHIES
                  </p>
                  <button
                    onClick={() => {
                      setPreviewJson(selectedCommunication.acknowledgment_bundle);
                      setPreviewMetadata(null);
                      setShowJsonPreview(true);
                    }}
                    className="flex items-center px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    View Acknowledgment Bundle JSON
                  </button>
                </div>
              )}

              {/* View Raw JSON Button */}
              <div className="flex justify-center gap-3">
                {selectedCommunication.request_bundle && (
                  <button
                    onClick={() => {
                      setPreviewJson(selectedCommunication.request_bundle);
                      setPreviewMetadata(null);
                      setShowJsonPreview(true);
                    }}
                    className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    View Request Bundle JSON
                  </button>
                )}
                {selectedCommunication.response_bundle && (
                  <button
                    onClick={() => {
                      setPreviewJson(selectedCommunication.response_bundle);
                      setPreviewMetadata(null);
                      setShowJsonPreview(true);
                    }}
                    className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    View Response Bundle JSON
                  </button>
                )}
              </div>
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

      {/* Poll Bundle Preview Modal */}
      {showPollPreview && pollBundle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Code className="w-5 h-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  NPHIES Poll Request Bundle
                </h3>
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
                    pollBundleCopied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {pollBundleCopied ? (
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
                  onClick={() => setShowPollPreview(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metadata Panel */}
            {pollMetadata && (
              <div className="p-4 bg-purple-50 border-b border-purple-200">
                <h4 className="text-sm font-semibold text-purple-800 mb-2">Poll Request Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Prior Auth ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.priorAuthId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Request Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.requestNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">NPHIES Request ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.nphiesRequestId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Provider:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.provider?.name || 'N/A'}</span>
                    <span className="ml-1 text-xs text-purple-600">({pollMetadata.provider?.nphiesId || 'No NPHIES ID'})</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Message Types:</span>
                    <span className="ml-2 font-medium text-gray-900">{pollMetadata.messageTypes?.join(', ')}</span>
                  </div>
                </div>
                {!pollMetadata.provider?.nphiesId && (
                  <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-xs">
                    ⚠️ Warning: Missing Provider NPHIES ID may cause poll to fail
                  </div>
                )}
              </div>
            )}
            
            {/* Modal Body - JSON Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(pollBundle, null, 2)}
              </pre>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span className="text-purple-600">This is the exact bundle that will be sent to NPHIES when you click "Poll for Updates"</span>
              </div>
              <button
                onClick={() => setShowPollPreview(false)}
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

