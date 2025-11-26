import React, { useState } from 'react';
import ChatButton from './ChatButton';
import ChatWindow from './ChatWindow';
import { useChatStream } from '../../hooks/useChatStream';

/**
 * ChatAssistant Component
 * Main wrapper component for the AI chat assistant
 * Manages chat window visibility and coordinates all chat functionality
 */
const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    messages,
    isStreaming,
    currentMode,
    error,
    sendMessage,
    changeMode,
    clearMessages
  } = useChatStream();

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <ChatButton isOpen={isOpen} onClick={handleToggle} />
      <ChatWindow
        isOpen={isOpen}
        onClose={handleClose}
        messages={messages}
        isStreaming={isStreaming}
        currentMode={currentMode}
        onModeChange={changeMode}
        onSendMessage={sendMessage}
        onClearMessages={clearMessages}
        error={error}
      />
    </>
  );
};

export default ChatAssistant;

