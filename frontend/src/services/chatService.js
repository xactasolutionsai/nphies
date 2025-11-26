const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

/**
 * Chat Service
 * Handles API communication for chat functionality with SSE streaming
 */

/**
 * Stream chat response from the backend
 * @param {string} message - User message
 * @param {string} mode - 'drug' or 'general'
 * @param {Array} conversationHistory - Previous messages
 * @param {Function} onChunk - Callback for each chunk
 * @param {Function} onComplete - Callback when complete
 * @param {Function} onError - Callback for errors
 * @returns {Function} - Cleanup function to abort the request
 */
export const streamChatMessage = async (
  message,
  mode,
  conversationHistory,
  onChunk,
  onComplete,
  onError
) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        mode,
        conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const readStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            break;
          }

          // Decode the chunk
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete SSE messages (separated by \n\n)
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message in buffer

          for (const message of messages) {
            if (message.startsWith('data: ')) {
              const dataStr = message.substring(6); // Remove 'data: ' prefix
              
              try {
                const data = JSON.parse(dataStr);
                
                if (data.type === 'connected') {
                  console.log('Connected to chat stream');
                } else if (data.type === 'chunk') {
                  onChunk(data.content);
                } else if (data.type === 'done') {
                  onComplete(data.content);
                  return; // Exit the loop
                } else if (data.type === 'error') {
                  onError(new Error(data.error));
                  return;
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error reading stream:', error);
        onError(error);
      }
    };

    readStream();

    // Return cleanup function
    return () => {
      reader.cancel();
    };

  } catch (error) {
    console.error('Error initiating chat stream:', error);
    onError(error);
    return () => {}; // No-op cleanup
  }
};

/**
 * Check health of chat service
 * @returns {Promise<object>} - Health status
 */
export const checkChatHealth = async () => {
  try {
    const response = await fetch(`${API_URL}/api/chat/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error checking chat health:', error);
    throw error;
  }
};

