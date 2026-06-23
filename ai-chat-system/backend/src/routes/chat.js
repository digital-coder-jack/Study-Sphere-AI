import { Router } from 'express';
import { routeStream } from '../router.js';
import { resolveChain } from '../providers/registry.js';
import { sseFrame, errorEvent } from '../streamEvent.js';

export const chatRouter = Router();

// OpenAI-compatible endpoint.
// Body: { model, messages, stream, chatId?, temperature? }
chatRouter.post('/chat/completions', async (req, res) => {
  const { model = 'auto', messages, stream = true, chatId = 'default', temperature } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: '`messages` array is required', type: 'invalid_request' } });
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Abort upstream when the client disconnects.
  const ac = new AbortController();
  req.on('close', () => ac.abort());

  if (!stream) {
    // Non-streaming path: return a single OpenAI-style response.
    try {
      const [provider] = resolveChain(model);
      const text = await provider.complete({ messages, signal: ac.signal, temperature });
      return res.json({
        id: messageId,
        object: 'chat.completion',
        model: provider.name,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      });
    } catch (err) {
      return res.status(502).json({ error: { message: err.message, type: 'provider_error' } });
    }
  }

  // Streaming path (SSE).
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  // Heartbeat so proxies don't close idle connections.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  try {
    for await (const ev of routeStream({
      model, messages, chatId, messageId, signal: ac.signal, temperature,
    })) {
      res.write(sseFrame(ev));
    }
  } catch (err) {
    res.write(sseFrame(errorEvent(err.message || 'stream failed', true)));
  } finally {
    clearInterval(heartbeat);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});
