import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api, { extractErrorMessage } from '@/services/api';
import {
  RefreshCw, Play, Clock, CheckCircle, AlertCircle, XCircle,
  ChevronDown, ChevronUp, FileJson, Copy, Activity,
  Inbox, Link2, HelpCircle, BarChart3, ArrowRight, ExternalLink
} from 'lucide-react';

const tableToRoute = {
  prior_authorizations: '/prior-authorizations',
  claim_submissions: '/claim-submissions',
  advanced_authorizations: '/advanced-authorizations',
};

const tableDisplayName = {
  prior_authorizations: 'Prior Auth',
  claim_submissions: 'Claim',
  advanced_authorizations: 'Advanced Auth',
  nphies_communications: 'Communication',
};

const RecordLink = ({ table, recordId, children }) => {
  const basePath = tableToRoute[table];
  if (!basePath || !recordId) {
    return <span>{children}</span>;
  }
  return (
    <Link
      to={`${basePath}/${recordId}`}
      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <ExternalLink className="w-3 h-3" />
    </Link>
  );
};

const statusColors = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  no_messages: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

const statusIcons = {
  success: CheckCircle,
  error: XCircle,
  no_messages: Inbox,
  in_progress: RefreshCw,
  pending: Clock,
};

const messageTypeColors = {
  solicited: 'bg-blue-100 text-blue-700',
  unsolicited: 'bg-purple-100 text-purple-700',
  unknown: 'bg-gray-100 text-gray-600',
};

const processingStatusColors = {
  processed: 'bg-green-100 text-green-700',
  new_record: 'bg-indigo-100 text-indigo-700',
  unmatched: 'bg-orange-100 text-orange-700',
  error: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

function SystemPoll() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [expandedLogData, setExpandedLogData] = useState(null);
  const [showPollBundle, setShowPollBundle] = useState(false);
  const [showResponseBundle, setShowResponseBundle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getSystemPollStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    try {
      const data = await api.getSystemPollLogs({ page, limit: 10 });
      setLogs(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0 });
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadLogs()]);
      setLoading(false);
    };
    init();
  }, [loadStats, loadLogs]);

  const handleTriggerPoll = async () => {
    try {
      setPolling(true);
      setPollResult(null);
      setShowPollBundle(false);
      setShowResponseBundle(false);
      const result = await api.triggerSystemPoll();
      setPollResult(result);
      // Refresh stats and logs after poll
      await Promise.all([loadStats(), loadLogs()]);
    } catch (error) {
      console.error('Poll error:', error);
      const errorData = error?.response?.data;
      setPollResult({
        success: false,
        message: errorData?.message || extractErrorMessage(error),
        pollBundle: errorData?.pollBundle || null,
        responseBundle: errorData?.responseBundle || null,
        errors: errorData?.errors || [],
        responseCode: errorData?.responseCode
      });
    } finally {
      setPolling(false);
    }
  };

  const handleExpandLog = async (logId) => {
    if (expandedLog === logId) {
      setExpandedLog(null);
      setExpandedLogData(null);
      return;
    }
    try {
      const data = await api.getSystemPollLog(logId);
      setExpandedLog(logId);
      setExpandedLogData(data);
    } catch (error) {
      console.error('Failed to load log detail:', error);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Poll</h1>
          <p className="text-sm text-gray-500 mt-1">
            System-level NPHIES polling - retrieves all queued messages for the organization endpoint
          </p>
        </div>
        <Button
          onClick={handleTriggerPoll}
          disabled={polling}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {polling ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Polling...</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Trigger Poll</>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-500">Polls Today</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.polls_today || 0}</p>
              <p className="text-xs text-gray-400">Total: {stats.total_polls || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-500" />
                <span className="text-sm text-gray-500">Messages Today</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.messages_today || 0}</p>
              <p className="text-xs text-gray-400">Total: {stats.total_messages || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-500">Matched Today</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.matched_today || 0}</p>
              <p className="text-xs text-gray-400">Total: {stats.total_matched || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                <span className="text-sm text-gray-500">Match Rate</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.match_rate_percent || 0}%</p>
              <p className="text-xs text-gray-400">
                Last poll: {stats.last_poll_at ? formatDate(stats.last_poll_at) : 'Never'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Latest Poll Result */}
      {pollResult && (
        <Card className={`border-l-4 ${pollResult.success ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {pollResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Latest Poll Result
              </CardTitle>
              {pollResult.duration && (
                <span className="text-xs text-gray-400">{pollResult.duration}ms</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={`text-sm ${pollResult.success ? 'text-gray-700' : 'text-red-600'}`}>
              {pollResult.message}
            </p>

            {/* Stats row */}
            {pollResult.stats && (
              <div className="flex gap-4 text-sm">
                <span className="text-gray-500">Received: <strong>{pollResult.stats.received}</strong></span>
                <span className="text-green-600">Matched: <strong>{pollResult.stats.matched}</strong></span>
                <span className="text-orange-600">Unmatched: <strong>{pollResult.stats.unmatched}</strong></span>
              </div>
            )}

            {/* Messages detail */}
            {pollResult.messages && pollResult.messages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Messages</p>
                {pollResult.messages.map((msg, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-gray-50 rounded p-2">
                    <Badge className={messageTypeColors[msg.messageType] || 'bg-gray-100'}>
                      {msg.messageType}
                    </Badge>
                    <span className="font-medium">{msg.resourceType}</span>
                    {msg.eventCode && <span className="text-gray-400">({msg.eventCode})</span>}
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                    {msg.matched ? (
                      <span className="text-green-600">
                        {msg.isNew ? 'New record' : 'Updated'}{' '}
                        <RecordLink table={msg.matchedTable} recordId={msg.matchedRecordId}>
                          {tableDisplayName[msg.matchedTable] || msg.matchedTable}#{msg.matchedRecordId}
                        </RecordLink>
                        <span className="text-gray-400 ml-1">via {msg.matchStrategy}</span>
                      </span>
                    ) : (
                      <span className="text-orange-500">Unmatched</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Debug JSON toggles */}
            <div className="flex gap-2 pt-2">
              {pollResult.pollBundle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPollBundle(!showPollBundle)}
                  className="text-xs"
                >
                  <FileJson className="w-3 h-3 mr-1" />
                  Request Bundle {showPollBundle ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
              )}
              {pollResult.responseBundle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResponseBundle(!showResponseBundle)}
                  className="text-xs"
                >
                  <FileJson className="w-3 h-3 mr-1" />
                  Response Bundle {showResponseBundle ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
              )}
            </div>

            {showPollBundle && pollResult.pollBundle && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(pollResult.pollBundle, 'pollBundle')}
                >
                  <Copy className="w-3 h-3" /> {copiedField === 'pollBundle' ? 'Copied!' : ''}
                </Button>
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(pollResult.pollBundle, null, 2)}
                </pre>
              </div>
            )}

            {showResponseBundle && pollResult.responseBundle && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(pollResult.responseBundle, 'responseBundle')}
                >
                  <Copy className="w-3 h-3" /> {copiedField === 'responseBundle' ? 'Copied!' : ''}
                </Button>
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(pollResult.responseBundle, null, 2)}
                </pre>
              </div>
            )}

            {/* Errors */}
            {pollResult.errors && pollResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Errors</p>
                {pollResult.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-red-600">
                    {err.diagnostics || err.message || err.details || JSON.stringify(err)}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Poll History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Poll History</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { loadLogs(pagination.page); loadStats(); }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Inbox className="w-10 h-10 mx-auto mb-2" />
              <p>No poll history yet. Trigger a poll to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const StatusIcon = statusIcons[log.status] || HelpCircle;
                const isExpanded = expandedLog === log.id;

                return (
                  <div key={log.id} className="border rounded-lg overflow-hidden">
                    {/* Log row */}
                    <div
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleExpandLog(log.id)}
                    >
                      <StatusIcon className={`w-4 h-4 flex-shrink-0 ${
                        log.status === 'success' ? 'text-green-500' :
                        log.status === 'error' ? 'text-red-500' :
                        log.status === 'no_messages' ? 'text-gray-400' :
                        'text-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[log.status] || 'bg-gray-100'}>
                            {log.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {log.trigger_type}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span title="Received">{log.messages_received || 0} msg</span>
                        <span title="Matched" className="text-green-600">{log.messages_matched || 0} matched</span>
                        <span title="Unmatched" className="text-orange-500">{log.messages_unmatched || 0} unmatched</span>
                        {log.duration_ms && <span className="text-gray-400">{log.duration_ms}ms</span>}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && expandedLogData && (
                      <div className="border-t bg-gray-50 p-4 space-y-4">
                        {/* Processing summary */}
                        {expandedLogData.processing_summary && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Processing Summary</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(expandedLogData.processing_summary).map(([type, counts]) => (
                                <div key={type} className="bg-white border rounded p-2 text-xs">
                                  <span className="font-medium">{type}</span>
                                  <div className="flex gap-2 mt-1 text-gray-500">
                                    {counts.matched > 0 && <span className="text-green-600">{counts.matched} matched</span>}
                                    {counts.newRecords > 0 && <span className="text-indigo-600">{counts.newRecords} new</span>}
                                    {counts.unmatched > 0 && <span className="text-orange-500">{counts.unmatched} unmatched</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Messages table */}
                        {expandedLogData.messages && expandedLogData.messages.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Messages ({expandedLogData.messages.length})</p>
                            <div className="bg-white border rounded overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="text-left p-2">Type</th>
                                    <th className="text-left p-2">Resource</th>
                                    <th className="text-left p-2">Event</th>
                                    <th className="text-left p-2">Classification</th>
                                    <th className="text-left p-2">Status</th>
                                    <th className="text-left p-2">Match</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedLogData.messages.map((msg) => (
                                    <tr key={msg.id} className="border-t hover:bg-gray-50">
                                      <td className="p-2">
                                        <Badge className={messageTypeColors[msg.message_type] || 'bg-gray-100'}>
                                          {msg.message_type}
                                        </Badge>
                                      </td>
                                      <td className="p-2 font-medium">{msg.resource_type}</td>
                                      <td className="p-2 text-gray-500">{msg.event_code || '-'}</td>
                                      <td className="p-2">
                                        {msg.response_identifier ? (
                                          <span className="text-blue-600" title={msg.response_identifier}>
                                            Response to: {msg.response_identifier.substring(0, 16)}...
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">Payer-initiated</span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        <Badge className={processingStatusColors[msg.processing_status] || 'bg-gray-100'}>
                                          {msg.processing_status}
                                        </Badge>
                                      </td>
                                      <td className="p-2">
                                        {msg.matched ? (
                                          <span className="text-green-600">
                                            <RecordLink table={msg.matched_table} recordId={msg.matched_record_id}>
                                              {tableDisplayName[msg.matched_table] || msg.matched_table}#{msg.matched_record_id}
                                            </RecordLink>
                                            <span className="text-gray-400 ml-1 block">via {msg.match_strategy}</span>
                                          </span>
                                        ) : (
                                          <span className="text-orange-500">{msg.processing_error || 'Unmatched'}</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* JSON viewers */}
                        <div className="flex gap-2">
                          {expandedLogData.poll_bundle && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => copyToClipboard(expandedLogData.poll_bundle, `log-${log.id}-req`)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              {copiedField === `log-${log.id}-req` ? 'Copied!' : 'Copy Request Bundle'}
                            </Button>
                          )}
                          {expandedLogData.response_bundle && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => copyToClipboard(expandedLogData.response_bundle, `log-${log.id}-res`)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              {copiedField === `log-${log.id}-res` ? 'Copied!' : 'Copy Response Bundle'}
                            </Button>
                          )}
                        </div>

                        {/* Errors */}
                        {expandedLogData.errors && expandedLogData.errors.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <p className="text-xs font-medium text-red-700 mb-1">Errors</p>
                            {expandedLogData.errors.map((err, idx) => (
                              <p key={idx} className="text-xs text-red-600">
                                {typeof err === 'string' ? err : (err.message || err.details || JSON.stringify(err))}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-gray-500">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => loadLogs(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadLogs(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SystemPoll;
