// Unified normalized event shape emitted to clients over SSE.
// Every provider adapter converts its raw stream into these.

export const EventType = Object.freeze({
  START: 'start',
  TOKEN: 'token',
  ERROR: 'error',
  DONE: 'done',
});

export const startEvent = (chatId, messageId, model) => ({
  type: EventType.START, chatId, messageId, model,
});

export const tokenEvent = (delta) => ({ type: EventType.TOKEN, delta });

export const errorEvent = (message, fatal = false) => ({
  type: EventType.ERROR, message, fatal,
});

export const doneEvent = (finishReason = 'stop', usage = null) => ({
  type: EventType.DONE, finishReason, usage,
});

// Serialize a StreamEvent as an SSE frame.
export function sseFrame(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}
