import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Button } from './button'

interface JsonDisplayProps {
  data: any
  title?: string
  className?: string
}

export function JsonDisplay({ data, title = "JSON Response", className = "" }: JsonDisplayProps) {
  const [copied, setCopied] = useState(false)

  const formatJson = (obj: any): string => {
    if (typeof obj === 'string') {
      try {
        return JSON.stringify(JSON.parse(obj), null, 2)
      } catch {
        return obj
      }
    }
    return JSON.stringify(obj, null, 2)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatJson(data))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const jsonString = formatJson(data)

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="text-xs"
          >
            {copied ? '✓ Copied' : 'Copy JSON'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="json-display bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-mono overflow-auto max-h-96">
            <pre className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
              <code>{jsonString}</code>
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Enhanced JSON display with syntax highlighting
export function JsonDisplayHighlighted({ data, title = "JSON Response", className = "" }: JsonDisplayProps) {
  const [copied, setCopied] = useState(false)

  const formatJson = (obj: any): string => {
    if (typeof obj === 'string') {
      try {
        return JSON.stringify(JSON.parse(obj), null, 2)
      } catch {
        return obj
      }
    }
    return JSON.stringify(obj, null, 2)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatJson(data))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const jsonString = formatJson(data)

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
      <CardContent>
        <div className="relative">
          <div className="json-display bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-mono overflow-auto max-h-96">
            <div 
              className="whitespace-pre-wrap text-slate-800 dark:text-slate-200"
              children={jsonString}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
