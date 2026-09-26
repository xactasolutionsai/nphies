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
  const { message, mode = 'general', conversationHistory = [] } = req.body || {};

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

  // Only well-formed user/assistant turns are used as context (bounded)
  const history = Array.isArray(conversationHistory)
    ? conversationHistory
      .filter(msg => msg && ['user', 'assistant'].includes(msg.role) &&
        typeof msg.content === 'string' && msg.content.trim() !== '')
      .map(msg => ({ role: msg.role, content: msg.content }))
      .slice(-10)
    : [];

  // Register the disconnect handler BEFORE streaming so a client that goes away
  // stops generation instead of letting the model run to completion.
  let clientClosed = false;
  const clientDisconnected = new Error('Client disconnected');
  // Aborts the model stream itself (not just our consumption of it) when the client leaves
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
      console.log('🔌 Client disconnected from chat stream');
    }
  });
  const send = payload => {
    if (clientClosed || res.writableEnded) return false;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  };

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
      history,
      // onChunk callback: throwing stops consuming (and so generating) the model stream
      (chunk) => {
        if (!send({ type: 'chunk', content: chunk })) throw clientDisconnected;
      },
      // onComplete callback
      (fullResponse) => {
        if (send({ type: 'done', content: fullResponse })) res.end();
      },
      // onError callback
      (error) => {
        if (error === clientDisconnected) return;
        if (send({ type: 'error', error: error.message || 'An error occurred during streaming' })) res.end();
      },
      { signal: abortController.signal }
    );

  } catch (error) {
    console.error('❌ Error in streamChat controller:', error);
    
    // Send error event if we haven't closed the connection yet
    if (send({ type: 'error', error: 'Failed to process chat request' })) res.end();
  }
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

