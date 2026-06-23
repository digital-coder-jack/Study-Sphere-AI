import { Router } from 'express';
import { listModels } from '../providers/registry.js';

export const miscRouter = Router();

miscRouter.get('/models', (_req, res) => {
  res.json({ object: 'list', data: listModels() });
});

// Auto-title generation helper. Clients can call this after first exchange.
miscRouter.post('/title', async (req, res) => {
  const { messages = [] } = req.body || {};
  const firstUser = messages.find((m) => m.role === 'user')?.content || 'New chat';
  // Cheap local heuristic title (no extra API cost). Trim to ~6 words.
  const title = firstUser.split(/\s+/).slice(0, 6).join(' ').slice(0, 48) || 'New chat';
  res.json({ title });
});
