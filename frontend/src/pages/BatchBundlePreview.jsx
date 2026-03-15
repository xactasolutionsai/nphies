import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Package, CheckCircle2, Copy, Download, 
  FileText, Info, AlertCircle, Loader2
} from 'lucide-react';
import api from '@/services/api';

export default function BatchBundlePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [bundlePreview, setBundlePreview] = useState(null);
  const [batchBundle, setBatchBundle] = useState(null);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copiedBundleIndex, setCopiedBundleIndex] = useState(null);
  const [viewMode, setViewMode] = useState('batch'); // 'batch', 'individual', or 'full'

  useEffect(() => {
    loadBundlePreview();
  }, [id]);

  const loadBundlePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const batchResponse = await api.getClaimBatch(id);
      const batchData = batchResponse.data;
      setBatch(batchData);
      
      if (batchData && batchData.status !== 'Draft' && batchData.request_bundle) {
        const storedBundle = typeof batchData.request_bundle === 'string' 
          ? JSON.parse(batchData.request_bundle) 
          : batchData.request_bundle;
        
        if (storedBundle.batchBundle) {
          setBatchBundle(storedBundle.batchBundle);
        }

        let bundles = [];
        if (storedBundle.bundles && Array.isArray(storedBundle.bundles)) {
          bundles = storedBundle.bundles;
        } else if (Array.isArray(storedBundle)) {
          bundles = storedBundle;
        } else if (storedBundle.resourceType === 'Bundle') {
          bundles = [storedBundle];
        } else if (storedBundle.batchBundle?.entry) {
          bundles = storedBundle.batchBundle.entry
            .filter(e => e.resource?.resourceType === 'Bundle')
            .map(e => e.resource);
        }
        
        setBundlePreview({ data: bundles });
        return;
      }
      
      const previewResponse = await api.previewBatchBundle(id);
      if (previewResponse.batchBundle) {
        setBatchBundle(previewResponse.batchBundle);
      }
      setBundlePreview(previewResponse);
    } catch (err) {
      console.error('Error loading bundle preview:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load bundle preview');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to clean bundle for NPHIES (remove internal metadata)
  const cleanBundleForNphies = (bundle) => {
    if (!bundle) return bundle;
    const { _batchMetadata, ...cleanBundle } = bundle;
    return cleanBundle;
  };

  // Copy all bundles as formatted text showing each HTTP request
  const copyAllBundlesFormatted = async () => {
    try {
      const rawData = bundlePreview?.data || bundlePreview;
      const cleanBundles = Array.isArray(rawData) 
        ? rawData.map(cleanBundleForNphies)
        : [cleanBundleForNphies(rawData)];
      
      let formattedOutput = `// ==========================================\n`;
      formattedOutput += `// Batch Claim: ${batch?.batch_identifier}\n`;
      formattedOutput += `// Total HTTP Requests: ${cleanBundles.length}\n`;
      formattedOutput += `// Each bundle below is sent as a SEPARATE HTTP POST request\n`;
      formattedOutput += `// ==========================================\n\n`;
      
      cleanBundles.forEach((bundle, index) => {
        const batchNumber = bundle.entry?.find(e => e.resource?.resourceType === 'Claim')
          ?.resource?.extension?.find(ext => ext.url?.includes('extension-batch-number'))
          ?.valuePositiveInt || (index + 1);
        
        formattedOutput += `// ------------------------------------------\n`;
        formattedOutput += `// HTTP Request #${index + 1} (batch-number: ${batchNumber})\n`;
        formattedOutput += `// POST to NPHIES API\n`;
        formattedOutput += `// ------------------------------------------\n`;
        formattedOutput += JSON.stringify(bundle, null, 2);
        formattedOutput += `\n\n`;
      });
      
      await navigator.clipboard.writeText(formattedOutput);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const copyBundleToClipboard = async () => {
    try {
      const rawData = bundlePreview?.data || bundlePreview;
      const dataToCopy = Array.isArray(rawData) 
        ? rawData.map(cleanBundleForNphies)
        : cleanBundleForNphies(rawData);
      const jsonString = JSON.stringify(dataToCopy, null, 2);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = jsonString;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard. Please try the Download option instead.');
    }
  };

  const copySingleBundleToClipboard = async (bundle, index) => {
    try {
      const cleanBundle = cleanBundleForNphies(bundle);
      const jsonString = JSON.stringify(cleanBundle, null, 2);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = jsonString;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopiedBundleIndex(index);
      setTimeout(() => setCopiedBundleIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard.');
    }
  };

  const downloadBundle = () => {
    const rawData = bundlePreview?.data || bundlePreview;
    const dataToDownload = Array.isArray(rawData) 
      ? rawData.map(cleanBundleForNphies)
      : cleanBundleForNphies(rawData);
    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batch?.batch_identifier || id}-bundles.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingleBundle = (bundle, index) => {
    const cleanBundle = cleanBundleForNphies(bundle);
    const blob = new Blob([JSON.stringify(cleanBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batch?.batch_identifier || id}-bundle-${index + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-purple mx-auto mb-4" />
          <p className="text-gray-600">Loading bundle preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/claim-batches/${id}`)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batch Details
          </Button>
          
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Error Loading Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{error}</p>
              <Button 
                variant="outline" 
                onClick={loadBundlePreview}
                className="mt-4"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-purple to-accent-purple text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/claim-batches/${id}`)}
            className="mb-4 text-white/80 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batch Details
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8" />
                <h1 className="text-3xl font-bold">FHIR Bundles Preview</h1>
              </div>
              <p className="text-white/80 mt-2">
                Batch: {batch?.batch_identifier || id}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white/20 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('batch')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'batch' 
                      ? 'bg-white text-primary-purple shadow-sm' 
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Batch Bundle
                </button>
                <button
                  onClick={() => setViewMode('individual')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'individual' 
                      ? 'bg-white text-primary-purple shadow-sm' 
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Individual
                </button>
                <button
                  onClick={() => setViewMode('full')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'full' 
                      ? 'bg-white text-primary-purple shadow-sm' 
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Full View
                </button>
              </div>
              
              {viewMode === 'full' && (
                <Button 
                  variant={copySuccess ? "default" : "secondary"}
                  onClick={copyAllBundlesFormatted}
                  className={copySuccess ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy All (Formatted)
                    </>
                  )}
                </Button>
              )}
              
              <Button variant="secondary" onClick={downloadBundle}>
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="h-5 w-5 mr-2 text-blue-500" />
              Bundle Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-primary-purple">
                  {bundlePreview?.bundleCount || bundlePreview?.data?.length || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Total Bundles</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">
                  {bundlePreview?.claimCount || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">Claims</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {Number(bundlePreview?.totalAmount || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mt-1">Total Amount (SAR)</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-3xl font-bold text-amber-600">
                  {(JSON.stringify(bundlePreview?.data || bundlePreview).length / 1024).toFixed(1)}
                </p>
                <p className="text-sm text-gray-600 mt-1">Size (KB)</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-800 text-base mb-2">
                    How Batch Claims are sent to NPHIES
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>The <strong>"Batch Bundle"</strong> tab shows the <strong>single JSON</strong> sent to NPHIES as one HTTP POST</li>
                    <li>It is an outer bundle (event=<code className="bg-blue-200 px-1 rounded">batch-request</code>) containing nested claim bundles</li>
                    <li>NPHIES validates all claims in real-time, then queues valid ones for the insurer</li>
                    <li>The <strong>"Individual"</strong> tab shows each nested claim bundle separately for easier inspection</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {bundlePreview?.note && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> {bundlePreview.note}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch Bundle Mode - the actual JSON sent to NPHIES */}
        {viewMode === 'batch' && (
          <Card className="overflow-hidden border-2 border-primary-purple/30">
            <CardHeader className="bg-gradient-to-r from-primary-purple to-accent-purple text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-white">Batch Request Bundle</CardTitle>
                  <p className="text-white/80 text-sm mt-1">
                    This is the single JSON payload sent to NPHIES via HTTP POST
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const json = JSON.stringify(batchBundle || {}, null, 2);
                      await navigator.clipboard.writeText(json);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className={copySuccess ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  >
                    {copySuccess ? (
                      <><CheckCircle2 className="h-4 w-4 mr-1" /> Copied!</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copy</>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(batchBundle || {}, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `batch-${batch?.batch_identifier || id}-nphies-payload.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            {batchBundle ? (
              <>
                <div className="bg-gray-100 border-b px-4 py-2 flex items-center justify-between text-sm text-gray-600">
                  <span>
                    event: <code className="bg-gray-200 px-1 rounded">{batchBundle.entry?.[0]?.resource?.eventCoding?.code || 'batch-request'}</code>
                    {' | '}
                    nested claims: <code className="bg-gray-200 px-1 rounded">{(batchBundle.entry?.length || 1) - 1}</code>
                    {' | '}
                    size: <code className="bg-gray-200 px-1 rounded">{(JSON.stringify(batchBundle).length / 1024).toFixed(1)} KB</code>
                  </span>
                </div>
                <CardContent className="p-0">
                  <pre className="bg-gray-900 text-green-400 p-6 overflow-x-auto text-sm font-mono leading-relaxed max-h-[700px] overflow-y-auto whitespace-pre-wrap break-all select-all">
                    {JSON.stringify(batchBundle, null, 2)}
                  </pre>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-12 text-center text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>Batch bundle not available. This may be a draft batch that hasn't been previewed yet.</p>
                <p className="text-sm mt-1">Try the "Individual" view instead, or submit the batch to see the full bundle.</p>
              </CardContent>
            )}
          </Card>
        )}

        {/* Full View Mode */}
        {viewMode === 'full' && Array.isArray(bundlePreview?.data) && (
          <Card className="overflow-hidden border-2 border-primary-purple/30">
            <CardHeader className="bg-gradient-to-r from-primary-purple to-accent-purple text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-white">Complete Batch Request</CardTitle>
                  <p className="text-white/80 text-sm mt-1">
                    {bundlePreview.data.length} HTTP Requests - Batch: {batch?.batch_identifier}
                  </p>
                </div>
                <Badge className="bg-white/20 text-white">
                  {(JSON.stringify(bundlePreview.data.map(cleanBundleForNphies)).length / 1024).toFixed(1)} KB
                </Badge>
              </div>
            </CardHeader>
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
              <p className="text-sm text-amber-800">
                <strong>⚠️ ملاحظة:</strong> كل Bundle يُرسل في HTTP POST منفصل لـ NPHIES. الـ Comments تُظهر ترتيب الإرسال.
              </p>
            </div>
            <CardContent className="p-0">
              <pre className="bg-gray-900 text-green-400 p-6 overflow-x-auto text-sm font-mono leading-relaxed max-h-[700px] overflow-y-auto whitespace-pre-wrap break-all select-all">
{(() => {
  const cleanBundles = bundlePreview.data.map(cleanBundleForNphies);
  let output = `// ==========================================\n`;
  output += `// Batch Claim: ${batch?.batch_identifier}\n`;
  output += `// Total HTTP Requests: ${cleanBundles.length}\n`;
  output += `// Each bundle below is sent as a SEPARATE HTTP POST request\n`;
  output += `// ==========================================\n\n`;
  
  cleanBundles.forEach((bundle, index) => {
    const batchNumber = bundle.entry?.find(e => e.resource?.resourceType === 'Claim')
      ?.resource?.extension?.find(ext => ext.url?.includes('extension-batch-number'))
      ?.valuePositiveInt || (index + 1);
    
    output += `// ------------------------------------------\n`;
    output += `// HTTP Request #${index + 1} (batch-number: ${batchNumber})\n`;
    output += `// POST to NPHIES API\n`;
    output += `// ------------------------------------------\n`;
    output += JSON.stringify(bundle, null, 2);
    output += `\n\n`;
  });
  
  return output;
})()}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Individual View - Bundles List */}
        {viewMode === 'individual' && (
          <div className="space-y-6">
            {Array.isArray(bundlePreview?.data) ? (
              bundlePreview.data.map((bundle, index) => {
                const cleanBundle = cleanBundleForNphies(bundle);
                const batchNumber = cleanBundle.entry?.find(e => e.resource?.resourceType === 'Claim')
                  ?.resource?.extension?.find(ext => ext.url?.includes('extension-batch-number'))
                  ?.valuePositiveInt || (index + 1);
                
                return (
                  <Card key={index} className="overflow-hidden border-2 hover:border-primary-purple/50 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary-purple text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              HTTP Request #{index + 1}
                            </CardTitle>
                            <p className="text-sm text-gray-500">
                              batch-number: {batchNumber}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {cleanBundle.entry?.length || 0} resources
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant={copiedBundleIndex === index ? "default" : "default"}
                            size="sm"
                            onClick={() => copySingleBundleToClipboard(bundle, index)}
                            className={copiedBundleIndex === index 
                              ? "bg-green-600 hover:bg-green-700 text-white" 
                              : "bg-primary-purple hover:bg-primary-purple/90 text-white"}
                          >
                            {copiedBundleIndex === index ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                ✓ Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copy This Bundle
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadSingleBundle(bundle, index)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <pre className="bg-gray-900 text-green-400 p-6 overflow-x-auto text-sm font-mono leading-relaxed max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all select-all">
                        {JSON.stringify(cleanBundle, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Bundle Data</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <pre className="bg-gray-900 text-green-400 p-6 rounded-b-lg overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap break-all select-all">
                    {JSON.stringify(cleanBundleForNphies(bundlePreview?.data || bundlePreview), null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between p-6 bg-white rounded-lg shadow-sm border">
          <Button 
            variant="outline"
            onClick={() => navigate(`/claim-batches/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batch Details
          </Button>
          
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Info className="h-4 w-4" />
            Use "Batch Bundle" tab to see the exact JSON sent to NPHIES
          </div>
        </div>
      </div>
    </div>
  );
}

