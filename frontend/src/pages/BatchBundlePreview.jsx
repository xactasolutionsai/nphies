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
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copiedBundleIndex, setCopiedBundleIndex] = useState(null);

  useEffect(() => {
    loadBundlePreview();
  }, [id]);

  const loadBundlePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load both batch details and bundle preview
      const [batchResponse, previewResponse] = await Promise.all([
        api.getClaimBatch(id),
        api.previewBatchBundle(id)
      ]);
      
      setBatch(batchResponse.data);
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
              <Button 
                variant={copySuccess ? "default" : "secondary"}
                onClick={copyBundleToClipboard}
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
                    Copy All JSON
                  </>
                )}
              </Button>
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
            
            {bundlePreview?.note && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> {bundlePreview.note}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bundles List */}
        <div className="space-y-6">
          {Array.isArray(bundlePreview?.data) ? (
            bundlePreview.data.map((bundle, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-primary-purple/10 text-primary-purple border-primary-purple/20">
                        Bundle {index + 1}
                      </Badge>
                      <CardTitle className="text-lg">
                        Claim #{bundle._batchMetadata?.batchNumber || index + 1}
                      </CardTitle>
                      <Badge variant="secondary">
                        {bundle.entry?.length || 0} entries
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant={copiedBundleIndex === index ? "default" : "outline"}
                        size="sm"
                        onClick={() => copySingleBundleToClipboard(bundle, index)}
                        className={copiedBundleIndex === index ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                      >
                        {copiedBundleIndex === index ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadSingleBundle(bundle, index)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <pre className="bg-gray-900 text-green-400 p-6 overflow-x-auto text-sm font-mono leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all select-all">
                    {JSON.stringify(cleanBundleForNphies(bundle), null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))
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

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between p-6 bg-white rounded-lg shadow-sm border">
          <Button 
            variant="outline"
            onClick={() => navigate(`/claim-batches/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batch Details
          </Button>
          
          <div className="flex items-center gap-3">
            <Button 
              variant={copySuccess ? "default" : "outline"}
              onClick={copyBundleToClipboard}
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
                  Copy All JSON
                </>
              )}
            </Button>
            <Button variant="outline" onClick={downloadBundle}>
              <Download className="h-4 w-4 mr-2" />
              Download All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

