import React from 'react';
import { Bot, X } from 'lucide-react';

/**
 * ChatButton Component
 * Floating button to toggle chat window
 */
const ChatButton = ({ isOpen, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
        isOpen
          ? 'bg-gray-600 hover:bg-gray-700'
          : 'bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
      }`}
      aria-label={isOpen ? 'Close chat' : 'Open AI assistant'}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <Bot className="w-6 h-6 text-white" />
      )}
      
      {!isOpen && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
    </button>
  );
};

export default ChatButton;

