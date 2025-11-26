import { useState, useCallback, useRef } from 'react';
import { streamChatMessage } from '../services/chatService';

/**
 * Custom hook for managing chat state and streaming
 * Handles real-time message streaming from AI
 */
export const useChatStream = () => {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMode, setCurrentMode] = useState('general'); // 'drug' or 'general'
  const [error, setError] = useState(null);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  
  const cleanupRef = useRef(null);

  /**
   * Send a message and handle streaming response
   */
  const sendMessage = useCallback(async (messageText) => {
    if (!messageText.trim() || isStreaming) {
      return;
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setError(null);
    setIsStreaming(true);

    // Create placeholder for AI response
    const aiMessageId = Date.now() + 1;
    const aiMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setStreamingMessageId(aiMessageId);

    // Get conversation history (last 10 messages, excluding the current ones)
    const conversationHistory = messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      const cleanup = await streamChatMessage(
        messageText,
        currentMode,
        conversationHistory,
        // onChunk
        (chunk) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        // onComplete
        (fullResponse) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: fullResponse, isStreaming: false }
                : msg
            )
          );
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
        // onError
        (error) => {
          console.error('Streaming error:', error);
          setError(error.message || 'Failed to get response');
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    content: 'Sorry, I encountered an error. Please try again.',
                    isStreaming: false,
                    error: true 
                  }
                : msg
            )
          );
          setIsStreaming(false);
          setStreamingMessageId(null);
        }
      );

      cleanupRef.current = cleanup;

    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  }, [messages, currentMode, isStreaming]);

  /**
   * Change chat mode (drug or general)
   */
  const changeMode = useCallback((newMode) => {
    if (newMode !== currentMode && !isStreaming) {
      setCurrentMode(newMode);
      
      // Add a system message to indicate mode change
      const systemMessage = {
        id: Date.now(),
        role: 'system',
        content: `Switched to ${newMode === 'drug' ? 'Drug Information' : 'General Medical'} mode`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, systemMessage]);
    }
  }, [currentMode, isStreaming]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    if (!isStreaming) {
      setMessages([]);
      setError(null);
    }
  }, [isStreaming]);

  /**
   * Stop current streaming
   */
  const stopStreaming = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
  }, []);

  return {
    messages,
    isStreaming,
    currentMode,
    error,
    streamingMessageId,
    sendMessage,
    changeMode,
    clearMessages,
    stopStreaming
  };
};

