/* =====================================================================
   Study Sphere AI  -  chat.js  (AI chat interface with streaming)
   ===================================================================== */



const state = { chats: [], currentId: null, streaming: false, model: 'auto', providers: [] };

const el = {
  list: document.getElementById('chatList'),
  messages: document.getElementById('messages'),
  input: document.getElementById('input'),
  send: document.getElementById('sendBtn'),
  title: document.getElementById('chatTitle'),
  newBtn: document.getElementById('newChatBtn'),
  delBtn: document.getElementById('deleteBtn'),
  dlBtn: document.getElementById('downloadBtn'),
  side: document.getElementById('chatSide'),
  burger: document.getElementById('chatBurger'),
  overlay: document.getElementById('chatOverlay'),
  modelSelect: document.getElementById('modelSelect'),
  modelDot: document.getElementById('modelDot'),
};

/* ---------- Model selector ---------- */
async function loadModels() {
  if (!el.modelSelect) return;
  try {
    const data = await SS.api('/api/ai/models');
    state.model = data.selected || 'auto';
    state.providers = data.providers || [];
    el.modelSelect.value = state.model;
    updateModelDot();
    // Disable options for providers that aren't configured (except Auto).
    state.providers.forEach((p) => {
      const opt = el.modelSelect.querySelector(`option[value="${p.id}"]`);
      if (opt && !p.configured) { opt.disabled = true; opt.textContent += ' (off)'; }
    });
  } catch { /* non-critical */ }
}

function updateModelDot() {
  if (!el.modelDot) return;
  const anyOn = state.model === 'auto'
    ? state.providers.some((p) => p.configured)
    : state.providers.some((p) => p.id === state.model && p.configured);
  el.modelDot.classList.toggle('off', !anyOn);
}

async function saveModel(model) {
  state.model = model;
  updateModelDot();
  try {
    await SS.api('/api/ai/model', { method: 'PUT', body: { model } });
    SS.toast('AI model set to ' + (model === 'auto' ? 'Auto (smart fallback)' : model));
  } catch (err) { SS.toast(err.message, 'error'); }
}

/* ---------- Markdown ---------- */
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight(code, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlightAuto(code).value;
    } catch { return code; }
  },
});

function renderMarkdown(text) {
  const html = DOMPurify.sanitize(marked.parse(text || ''));
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  // Enhance code blocks with a header + copy button.
  wrap.querySelectorAll('pre').forEach((pre) => {
    const codeEl = pre.querySelector('code');
    const lang = (codeEl && [...codeEl.classList].find((c) => c.startsWith('language-')) || '').replace('language-', '') || 'code';
    const block = document.createElement('div');
    block.className = 'code-block';
    const head = document.createElement('div');
    head.className = 'code-head';
    head.innerHTML = `<span>${lang}</span><button class="copy-btn"><i class="fas fa-copy"></i> Copy</button>`;
    pre.parentNode.insertBefore(block, pre);
    block.appendChild(head);
    block.appendChild(pre);
    head.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(codeEl ? codeEl.textContent : pre.textContent);
      head.querySelector('.copy-btn').innerHTML = '<i class="fas fa-check"></i> Copied';
      setTimeout(() => (head.querySelector('.copy-btn').innerHTML = '<i class="fas fa-copy"></i> Copy'), 1600);
    });
  });
  return wrap;
}

/* ---------- Render helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function userInitial() {
  return (SS.getUser().name || 'U').trim().charAt(0).toUpperCase();
}

function showEmptyState() {
  el.title.textContent = 'Study Sphere AI';
  el.messages.innerHTML = `
    <div class="chat-empty">
      <div>
        <div class="big"><img src="/assets/logo.png" alt="Study Sphere AI Logo" class="logo-img" /></div>
        <h2>How can I help you study today?</h2>
        <p>Ask a question, request an explanation, or pick a starter below.</p>
        <div class="suggest-grid">
          <button class="suggest" data-q="Explain photosynthesis in simple terms with an analogy."><b>📘 Explain a concept</b><span>Photosynthesis</span></button>
          <button class="suggest" data-q="Give me 5 practice questions on the Pythagorean theorem with answers."><b>✍️ Practice questions</b><span>Pythagorean theorem</span></button>
          <button class="suggest" data-q="Write a Python function that checks if a string is a palindrome, with comments."><b>💻 Help me code</b><span>Palindrome checker in Python</span></button>
          <button class="suggest" data-q="Summarise the causes of World War 1 in bullet points."><b>📝 Summarise</b><span>Causes of World War 1</span></button>
        </div>
      </div>
    </div>`;
  el.messages.querySelectorAll('.suggest').forEach((b) => {
    b.addEventListener('click', () => {
      el.input.value = b.dataset.q;
      sendMessage();
    });
  });
}

function ensureStream() {
  let stream = el.messages.querySelector('.msg-stream');
  if (!stream) {
    el.messages.innerHTML = '<div class="msg-stream"></div>';
    stream = el.messages.querySelector('.msg-stream');
  }
  return stream;
}

function appendMessage(role, content) {
  const stream = ensureStream();
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  const avatar = role === 'user' ? userInitial() : '<img src="/assets/logo.png" alt="Study Sphere AI Logo" class="logo-img" />';
  msg.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div class="bubble"><div class="role">${role === 'user' ? 'You' : 'Study Sphere AI'}</div><div class="body"></div></div>`;
  const body = msg.querySelector('.body');
  if (role === 'assistant') body.appendChild(renderMarkdown(content));
  else body.textContent = content;
  stream.appendChild(msg);
  scrollToBottom();
  return body;
}

function scrollToBottom() {
  el.messages.scrollTop = el.messages.scrollHeight;
}

/* ---------- Chat list ---------- */
async function loadChats() {
  try {
    const data = await SS.api('/api/chats');
    state.chats = data.chats || [];
    renderChatList();
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

function renderChatList() {
  if (!state.chats.length) {
    el.list.innerHTML = '<div class="empty" style="padding:1.5rem 1rem;color:var(--text-dim);font-size:.88rem;text-align:center;">No chats yet.<br>Start a new one above.</div>';
    return;
  }
  el.list.innerHTML = state.chats.map((c) => `
    <div class="chat-list-item ${c.id === state.currentId ? 'active' : ''}" data-id="${c.id}">
      <i class="fas fa-comment ci"></i>
      <span class="t">${escapeHtml(c.title)}</span>
      <button class="del" data-del="${c.id}" title="Delete"><i class="fas fa-trash"></i></button>
    </div>`).join('');

  el.list.querySelectorAll('.chat-list-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      openChat(parseInt(item.dataset.id, 10));
      closeMobileSidebar();
    });
  });
  el.list.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(parseInt(b.dataset.del, 10));
    });
  });
}

/* ---------- Open / create / delete ---------- */
async function openChat(id) {
  try {
    const data = await SS.api(`/api/chats/${id}`);
    state.currentId = id;
    el.title.textContent = data.chat.title;
    renderChatList();
    if (!data.messages.length) { showEmptyState(); return; }
    el.messages.innerHTML = '<div class="msg-stream"></div>';
    data.messages.forEach((m) => appendMessage(m.role, m.content));
    scrollToBottom();
    history.replaceState(null, '', `/chat?id=${id}`);
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

async function newChat() {
  try {
    const data = await SS.api('/api/chats', { method: 'POST', body: {} });
    state.chats.unshift(data.chat);
    state.currentId = data.chat.id;
    el.title.textContent = data.chat.title;
    showEmptyState();
    renderChatList();
    history.replaceState(null, '', `/chat?id=${data.chat.id}`);
    el.input.focus();
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

async function deleteChat(id) {
  if (!confirm('Delete this chat permanently?')) return;
  try {
    await SS.api(`/api/chats/${id}`, { method: 'DELETE' });
    state.chats = state.chats.filter((c) => c.id !== id);
    if (state.currentId === id) {
      state.currentId = null;
      if (state.chats.length) openChat(state.chats[0].id);
      else { showEmptyState(); history.replaceState(null, '', '/chat.html'); }
    }
    renderChatList();
    SS.toast('Chat deleted.');
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

/* ---------- Send + stream ---------- */
async function sendMessage() {
  const text = el.input.value.trim();
  if (!text || state.streaming) return;

  // Track AI chat usage
  if (window.trackAIChat) window.trackAIChat();

  // Make sure we have a chat.
  if (!state.currentId) {
    await newChat();
    if (!state.currentId) return;
  }

  el.input.value = '';
  autoGrow();
  appendMessage('user', text);

  // Assistant placeholder with typing dots.
  const body = appendMessage('assistant', '');
  body.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';

  state.streaming = true;
  el.send.disabled = true;

  let full = '';
  try {
    const res = await SS.api(`/api/chats/${state.currentId}/stream`, {
      method: 'POST',
      body: { content: text, model: state.model },
      raw: true,
    });
    if (!res.ok || !res.body) throw new Error('Streaming failed.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        try {
          const obj = JSON.parse(payload);
          if (obj.provider) {
            // Show which provider actually served the response.
            const msgEl = body.closest('.msg');
            const r = msgEl && msgEl.querySelector('.role');
            if (r && obj.provider !== 'auto' && obj.provider !== 'cache') {
              r.innerHTML = `Study Sphere AI <span class="model-badge">${obj.provider}</span>`;
            }
          }
          if (obj.token) {
            full += obj.token;
            body.innerHTML = '';
            body.appendChild(renderMarkdown(full));
            scrollToBottom();
          }
          if (obj.done) { /* persisted server-side */ }
        } catch { /* ignore partial */ }
      }
    }

    if (!full.trim()) {
      body.innerHTML = '';
      body.appendChild(renderMarkdown('⚠️ No response was generated. Please try again.'));
    }

    // Refresh the chat list so the auto-title appears.
    refreshTitle();
  } catch (err) {
    body.innerHTML = '';
    body.appendChild(renderMarkdown('⚠️ ' + err.message));
  } finally {
    state.streaming = false;
    el.send.disabled = false;
    el.input.focus();
  }
}

async function refreshTitle() {
  try {
    const data = await SS.api('/api/chats');
    state.chats = data.chats || [];
    const cur = state.chats.find((c) => c.id === state.currentId);
    if (cur) el.title.textContent = cur.title;
    renderChatList();
  } catch { /* non-critical */ }
}

/* ---------- Download chat ---------- */
async function downloadChat() {
  if (!state.currentId) return SS.toast('Open a chat first.', 'error');
  try {
    const data = await SS.api(`/api/chats/${state.currentId}`);
    let md = `# ${data.chat.title}\n\n_Exported from Study Sphere AI_\n\n`;
    data.messages.forEach((m) => {
      md += `## ${m.role === 'user' ? '🧑 You' : '<img src="/assets/logo.png" alt="Study Sphere AI Logo" class="logo-img" /> Study Sphere AI'}\n\n${m.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.chat.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'chat'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    SS.toast('Chat downloaded.');
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

/* ---------- textarea auto-grow ---------- */
function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 180) + 'px';
}

function closeMobileSidebar() {
  el.side.classList.remove('open');
  el.overlay.classList.remove('show');
}

/* ---------- Events ---------- */
el.send.addEventListener('click', sendMessage);
el.input.addEventListener('input', autoGrow);
el.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
el.newBtn.addEventListener('click', newChat);
el.delBtn.addEventListener('click', () => state.currentId && deleteChat(state.currentId));
el.dlBtn.addEventListener('click', downloadChat);
el.burger.addEventListener('click', () => { el.side.classList.toggle('open'); el.overlay.classList.toggle('show'); });
el.overlay.addEventListener('click', closeMobileSidebar);
if (el.modelSelect) el.modelSelect.addEventListener('change', (e) => saveModel(e.target.value));

/* ---------- Boot ---------- */
(async function boot() {
  await loadModels();
  await loadChats();
  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get('id'), 10);
  if (id && state.chats.some((c) => c.id === id)) openChat(id);
  else if (state.chats.length) openChat(state.chats[0].id);
  else showEmptyState();
})();
