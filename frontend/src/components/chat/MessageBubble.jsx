import React from 'react';
import { User, Bot, Info } from 'lucide-react';

/**
 * MessageBubble Component
 * Displays individual chat messages with appropriate styling
 */
const MessageBubble = ({ message }) => {
  const { role, content, timestamp, isStreaming, error: hasError } = message;

  // Format timestamp
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // System messages (mode changes)
  if (role === 'system') {
    return (
      <div className="flex items-center justify-center my-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs">
          <Info className="w-3 h-3" />
          <span>{content}</span>
        </div>
      </div>
    );
  }

  // User messages (right-aligned, blue)
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="flex flex-col items-end">
            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
              <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
            </div>
            <span className="text-xs text-gray-500 mt-1">{timeStr}</span>
          </div>
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // AI messages (left-aligned, gray)
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-2 max-w-[80%]">
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm ${
            hasError 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            {content ? (
              <div className="text-sm whitespace-pre-wrap break-words">
                {content}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-gray-500 ml-1 animate-pulse"></span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs">Thinking...</span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 mt-1">{timeStr}</span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;

