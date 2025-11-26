import express from 'express';
import { streamChat, checkHealth } from '../controllers/chatController.js';

const router = express.Router();

/**
 * Chat Routes
 * Handles AI chat functionality
 */

// Stream chat response
router.post('/stream', streamChat);

// Check health of chat service
router.get('/health', checkHealth);

export default router;

