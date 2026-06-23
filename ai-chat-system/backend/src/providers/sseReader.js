// Robust line-based SSE reader for upstream provider responses.
// Handles partial chunks, CRLF/LF, and multi-line `data:` frames.
// Yields raw `data:` payload strings (without the "data: " prefix).

export async function* readSse(webStream) {
  const reader = webStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      let sep;
      while ((sep = indexOfDoubleNewline(buffer)) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '');

        const dataLines = rawEvent
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).replace(/^\s/, ''));

        if (dataLines.length) yield dataLines.join('\n');
      }
    }
    // flush trailing data without terminating blank line
    const tail = buffer
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^\s/, ''));
    if (tail.length) yield tail.join('\n');
  } finally {
    reader.releaseLock?.();
  }
}

function indexOfDoubleNewline(s) {
  const a = s.indexOf('\n\n');
  const b = s.indexOf('\r\n\r\n');
  if (a === -1) return b === -1 ? -1 : b + 4;
  if (b === -1) return a + 2;
  return Math.min(a + 2, b + 4);
}
