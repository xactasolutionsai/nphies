import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'

interface AIResponseDisplayProps {
  data: any
  title?: string
  className?: string
}

export function AIResponseDisplay({ data, title = "AI Response", className = "" }: AIResponseDisplayProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  // Extract the relevant data from the response
  const responseData = data?.data || data?.output || data
  const fitStatus = responseData?.fit
  
  // Handle diagnoses as both string and array
  let diagnoses: string[] = []
  if (Array.isArray(responseData?.diagnoses)) {
    diagnoses = responseData.diagnoses
  } else if (typeof responseData?.diagnoses === 'string' && responseData.diagnoses.trim()) {
    // Split string by common separators and clean up
    diagnoses = responseData.diagnoses
      .split(/[,;|]/)
      .map(d => d.trim())
      .filter(d => d.length > 0)
  }
  
  // Debug logging to help understand response structure
  console.log('AI Response Data:', data)
  console.log('Extracted Response Data:', responseData)
  console.log('Fit Status:', fitStatus)
  console.log('Diagnoses:', diagnoses)

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {title}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {copied ? '✓ Copied' : 'Copy JSON'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fit Status Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Fit Status
          </label>
          <div className="flex items-center gap-2">
            <Badge 
              variant={fitStatus ? "default" : "destructive"}
              className={`px-3 py-1 text-sm font-medium ${
                fitStatus 
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              }`}
            >
              {fitStatus ? "✓ Fits" : "✗ Does Not Fit"}
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {fitStatus ? "The request meets the criteria" : "The request does not meet the criteria"}
            </span>
          </div>
        </div>

        {/* Diagnoses Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Diagnosis Keywords
          </label>
          <div className="space-y-2">
            {diagnoses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {diagnoses.map((diagnosis: string, index: number) => (
                  <Badge 
                    key={index}
                    variant="secondary"
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {diagnosis}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                No diagnosis keywords provided
              </p>
            )}
          </div>
        </div>

        {/* Raw JSON (Collapsible) */}
        <details className="mt-4">
          <summary className="text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
            View Raw JSON
          </summary>
          <div className="mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(responseData, null, 2)}
            </pre>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
