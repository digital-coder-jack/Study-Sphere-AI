import { resolveChain } from './providers/registry.js';
import { errorEvent, doneEvent, startEvent, tokenEvent } from './streamEvent.js';

// ModelRouter: turns a request into a normalized StreamEvent async-iterable,
// applying the critical stability rules at the gateway level:
//  - retry the stream ONCE on transient upstream failure
//  - if streaming fails again -> fall back to non-streaming complete()
//  - "auto" cascades across providers
export async function* routeStream({ model, messages, chatId, messageId, signal, temperature }) {
  const chain = resolveChain(model);
  let lastErr;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const isLastProvider = i === chain.length - 1;

    // Attempt streaming with one retry on the same provider.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let started = false;
        for await (const ev of provider.stream({ model: providerModel(model, provider), messages, chatId, messageId, signal, temperature })) {
          if (ev.type === 'start') started = true;
          yield ev;
        }
        return; // success
      } catch (err) {
        if (signal?.aborted) return; // client cancelled — stop silently
        lastErr = err;
        const transient = isTransient(err);
        // retry once on transient error
        if (attempt === 0 && transient) continue;
        break; // give up on this provider's streaming
      }
    }

    // Streaming failed for this provider -> try non-streaming fallback.
    try {
      const text = await provider.complete({ model: providerModel(model, provider), messages, signal, temperature });
      yield startEvent(chatId, messageId, provider.name);
      if (text) yield tokenEvent(text);
      yield doneEvent('fallback');
      return;
    } catch (err) {
      if (signal?.aborted) return;
      lastErr = err;
      // continue to next provider in chain (auto), or fail if single provider
      if (isLastProvider) break;
    }
  }

  yield errorEvent(lastErr?.message || 'All providers failed', true);
}

function providerModel(requestedModel, provider) {
  // If user requested a concrete provider, let provider use its default unless
  // they passed a provider-specific model id (advanced). Keep simple here.
  return undefined;
}

function isTransient(err) {
  const msg = String(err?.message || '');
  return /HTTP 5\d\d|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg);
}
