import React, { useState, useRef, useEffect } from 'react';
import { X, Minimize2, Send, Trash2, AlertCircle } from 'lucide-react';
import MessageBubble from './MessageBubble';
import ModeSelector from './ModeSelector';

/**
 * ChatWindow Component
 * Main chat interface window
 */
const ChatWindow = ({ 
  isOpen, 
  onClose, 
  messages, 
  isStreaming, 
  currentMode, 
  onModeChange, 
  onSendMessage,
  onClearMessages,
  error 
}) => {
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !isStreaming) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 transition-all duration-300 ${
      isMinimized ? 'w-80 h-14' : 'w-[400px] h-[600px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-white">AI Medical Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
            aria-label={isMinimized ? 'Maximize' : 'Minimize'}
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Mode Selector */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <ModeSelector 
              currentMode={currentMode} 
              onModeChange={onModeChange}
              disabled={isStreaming}
            />
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 h-[420px] bg-gradient-to-b from-white to-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">How can I help you today?</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Ask me about {currentMode === 'drug' ? 'medications, dosages, and drug interactions' : 'medical conditions, symptoms, and health advice'}.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {currentMode === 'drug' ? (
                    <>
                      <button 
                        onClick={() => onSendMessage("What are the side effects of aspirin?")}
                        className="text-sm text-left p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                      >
                        What are the side effects of aspirin?
                      </button>
                      <button 
                        onClick={() => onSendMessage("Tell me about drug interactions with ibuprofen")}
                        className="text-sm text-left p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                      >
                        Drug interactions with ibuprofen?
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => onSendMessage("What are the symptoms of dehydration?")}
                        className="text-sm text-left p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                      >
                        What are symptoms of dehydration?
                      </button>
                      <button 
                        onClick={() => onSendMessage("When should I see a doctor for a fever?")}
                        className="text-sm text-left p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                      >
                        When to see a doctor for fever?
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200">
              <div className="flex items-center gap-2 text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isStreaming ? "Please wait..." : "Type your message..."}
                  disabled={isStreaming}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  rows="2"
                  maxLength="500"
                />
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearMessages}
                    disabled={isStreaming}
                    className="absolute right-2 top-2 text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || isStreaming}
                className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              AI responses are for information only. Consult a healthcare professional.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatWindow;

