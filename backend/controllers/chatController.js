import chatService from '../services/chatService.js';

/**
 * Chat Controller
 * Handles HTTP requests for AI chat functionality
 */

/**
 * Stream chat response using Server-Sent Events (SSE)
 * POST /api/chat/stream
 */
export const streamChat = async (req, res) => {
  const { message, mode = 'general', conversationHistory = [] } = req.body;

  // Validate request
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Message is required and must be a non-empty string'
    });
  }

  if (!['drug', 'general'].includes(mode)) {
    return res.status(400).json({
      error: 'Mode must be either "drug" or "general"'
    });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
  
  // Send initial connection confirmation
  res.write('data: {"type":"connected"}\n\n');

  try {
    await chatService.streamChat(
      message,
      mode,
      conversationHistory,
      // onChunk callback
      (chunk) => {
        const data = JSON.stringify({
          type: 'chunk',
          content: chunk
        });
        res.write(`data: ${data}\n\n`);
      },
      // onComplete callback
      (fullResponse) => {
        const data = JSON.stringify({
          type: 'done',
          content: fullResponse
        });
        res.write(`data: ${data}\n\n`);
        res.end();
      },
      // onError callback
      (error) => {
        const data = JSON.stringify({
          type: 'error',
          error: error.message || 'An error occurred during streaming'
        });
        res.write(`data: ${data}\n\n`);
        res.end();
      }
    );

  } catch (error) {
    console.error('❌ Error in streamChat controller:', error);
    
    // Send error event if we haven't closed the connection yet
    if (!res.writableEnded) {
      const data = JSON.stringify({
        type: 'error',
        error: error.message || 'Failed to process chat request'
      });
      res.write(`data: ${data}\n\n`);
      res.end();
    }
  }

  // Handle client disconnect
  req.on('close', () => {
    console.log('🔌 Client disconnected from chat stream');
  });
};

/**
 * Check health of chat service and models
 * GET /api/chat/health
 */
export const checkHealth = async (req, res) => {
  try {
    const health = await chatService.checkHealth();
    
    res.json({
      success: true,
      ...health
    });

  } catch (error) {
    console.error('❌ Error checking chat health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

