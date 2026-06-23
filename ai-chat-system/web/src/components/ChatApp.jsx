import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChatStream } from '../lib/useChatStream';

const MODELS = [
  { id: 'auto', label: 'Auto' },
  { id: 'groq', label: 'Groq' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'kimi', label: 'Kimi' },
];

export default function ChatApp() {
  const { messages, isStreaming, model, setModel, error, send, regenerate, stop } = useChatStream();
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  // Auto-scroll to latest message / latest token.
  const lastSig = messages.at(-1) && messages.at(-1).id + messages.at(-1).content.length;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lastSig]);

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
    setInput('');
  };

  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <h3 style={{ margin: '8px 0' }}>AI Chat</h3>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={S.select}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <p style={S.hint}>Model switching is live; the next message uses the selected provider.</p>
      </aside>

      <main style={S.main}>
        {error && <div style={S.error}>{error}</div>}
        <div style={S.messages}>
          {messages.map((m) => (
            <div key={m.id} style={{ ...S.row, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ ...S.bubble, ...(m.role === 'user' ? S.user : S.assistant) }}>
                {m.content === '' && m.streaming
                  ? <TypingDots />
                  : <ReactMarkdown>{m.content}</ReactMarkdown>}
                {!m.streaming && (
                  <div style={S.actions}>
                    <button style={S.act} onClick={() => navigator.clipboard.writeText(m.content)}>Copy</button>
                    {m.role === 'assistant'
                      ? <button style={S.act} onClick={regenerate}>Regenerate</button>
                      : null}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} style={S.inputBar}>
          <input
            style={S.input}
            value={input}
            disabled={isStreaming}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message AI Chat…"
          />
          {isStreaming
            ? <button type="button" style={S.stop} onClick={stop}>Stop</button>
            : <button type="submit" style={S.send} disabled={!input.trim()}>Send</button>}
        </form>
      </main>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="dots">
      <span>•</span><span>•</span><span>•</span>
      <style>{`
        .dots span { animation: blink 1.2s infinite; font-size: 20px; }
        .dots span:nth-child(2){ animation-delay:.2s } .dots span:nth-child(3){ animation-delay:.4s }
        @keyframes blink { 0%,100%{opacity:.2} 50%{opacity:1} }
      `}</style>
    </span>
  );
}

const S = {
  shell: { display: 'flex', height: '100vh', fontFamily: 'system-ui' },
  sidebar: { width: 240, padding: 16, borderRight: '1px solid #eee', background: '#fafafa' },
  select: { width: '100%', padding: 8 },
  hint: { fontSize: 12, color: '#777' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  messages: { flex: 1, overflowY: 'auto', padding: 16 },
  row: { display: 'flex', margin: '8px 0' },
  bubble: { maxWidth: '70%', padding: '10px 14px', borderRadius: 16 },
  user: { background: '#10A37F', color: 'white' },
  assistant: { background: '#f1f1f1', color: '#111' },
  actions: { marginTop: 6, display: 'flex', gap: 8 },
  act: { fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: '#555' },
  inputBar: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #eee' },
  input: { flex: 1, padding: 12, borderRadius: 8, border: '1px solid #ddd' },
  send: { padding: '12px 20px', background: '#10A37F', color: '#fff', border: 'none', borderRadius: 8 },
  stop: { padding: '12px 20px', background: '#b00', color: '#fff', border: 'none', borderRadius: 8 },
  error: { background: '#fdecea', color: '#b00', padding: 10 },
};
