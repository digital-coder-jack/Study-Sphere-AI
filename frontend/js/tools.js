/* =====================================================================
   Study Sphere AI  -  tools.js  (notes, quiz, flashcards, planner,
   summarizer, homework helper)
   ===================================================================== */

if (!SS.requireAuth()) { /* redirected */ }

marked.setOptions({ breaks: true, gfm: true });
function md(text) { return DOMPurify.sanitize(marked.parse(text || '')); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- Tabs ---------- */
function initTabs() {
  const tabs = document.querySelectorAll('#toolsTabs button');
  function activate(name) {
    tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tool-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
    history.replaceState(null, '', `/tools#${name}`);
  }
  tabs.forEach((b) => b.addEventListener('click', () => activate(b.dataset.tab)));
  const hash = location.hash.replace('#', '');
  if (hash && document.getElementById(`panel-${hash}`)) activate(hash);
}

function setLoading(id, on) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('show', on);
}
function showResult(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
  el.classList.add('show');
}
function busyBtn(btn, on, label) {
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${label}`; }
  else { btn.disabled = false; btn.innerHTML = btn.dataset.html; }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* =========================================================
   NOTES
   ========================================================= */
async function genNotes() {
  const topic = document.getElementById('notesTopic').value.trim();
  if (!topic) return SS.toast('Enter a topic first.', 'error');
  const btn = document.getElementById('notesBtn');
  busyBtn(btn, true, 'Generating…');
  setLoading('notesLoading', true);
  try {
    const data = await SS.api('/api/tools/notes', { method: 'POST', body: { topic } });
    showResult('notesResult', `${md(data.content)}
      <div class="result-actions">
        <button class="btn ghost" onclick='downloadText("notes_${data.id}.md", ${JSON.stringify(data.content)})'><i class="fas fa-download"></i> Download</button>
      </div>`);
    SS.toast('Notes generated & saved!');
    loadSavedNotes();
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('notesLoading', false); }
}

async function loadSavedNotes() {
  try {
    const data = await SS.api('/api/tools/notes');
    const box = document.getElementById('notesSaved');
    if (!data.notes.length) { box.innerHTML = '<div class="empty"><i class="fas fa-note-sticky"></i>No saved notes yet.</div>'; return; }
    box.innerHTML = data.notes.map((n) => `
      <div class="saved-item" data-id="${n.id}">
        <div class="info"><b>${esc(n.topic)}</b><small>${n.created_at}</small></div>
        <div class="row-actions">
          <button class="icon-btn" data-view="${n.id}" title="View"><i class="fas fa-eye"></i></button>
          <button class="icon-btn" data-del="${n.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      const note = data.notes.find((x) => x.id == b.dataset.view);
      showResult('notesResult', `<h3>${esc(note.topic)}</h3>${md(note.content)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this note?')) return;
      await SS.api(`/api/tools/notes/${b.dataset.del}`, { method: 'DELETE' });
      SS.toast('Note deleted.'); loadSavedNotes();
    }));
  } catch (err) { /* ignore */ }
}

/* =========================================================
   QUIZ
   ========================================================= */
let quizState = { questions: [], answered: 0, correct: 0 };

async function genQuiz() {
  const topic = document.getElementById('quizTopic').value.trim();
  const num = parseInt(document.getElementById('quizNum').value, 10) || 5;
  if (!topic) return SS.toast('Enter a topic first.', 'error');
  const btn = document.getElementById('quizBtn');
  busyBtn(btn, true, 'Generating…');
  setLoading('quizLoading', true);
  document.getElementById('quizScore').classList.remove('show');
  try {
    const data = await SS.api('/api/tools/quiz', { method: 'POST', body: { topic, num_questions: num } });
    quizState = { questions: data.questions, answered: 0, correct: 0 };
    renderQuiz();
    SS.toast('Quiz ready!');
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('quizLoading', false); }
}

function renderQuiz() {
  const area = document.getElementById('quizArea');
  area.innerHTML = quizState.questions.map((q, i) => `
    <div class="quiz-q" data-q="${i}">
      <div class="q">${i + 1}. ${esc(q.question)}</div>
      ${q.options.map((opt, j) => `<button class="quiz-opt" data-q="${i}" data-opt="${j}">${esc(opt)}</button>`).join('')}
      <div class="quiz-explain" data-explain="${i}">${esc(q.explanation || '')}</div>
    </div>`).join('');

  area.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qi = parseInt(btn.dataset.q, 10);
      const oi = parseInt(btn.dataset.opt, 10);
      const q = quizState.questions[qi];
      const block = area.querySelector(`.quiz-q[data-q="${qi}"]`);
      if (block.dataset.done) return;
      block.dataset.done = '1';
      quizState.answered++;
      block.querySelectorAll('.quiz-opt').forEach((b) => {
        b.disabled = true;
        if (parseInt(b.dataset.opt, 10) === q.answer) b.classList.add('correct');
      });
      if (oi === q.answer) quizState.correct++;
      else btn.classList.add('wrong');
      const ex = block.querySelector('.quiz-explain');
      if (ex && ex.textContent.trim()) ex.classList.add('show');
      if (quizState.answered === quizState.questions.length) {
        const score = document.getElementById('quizScore');
        score.textContent = `🎉 You scored ${quizState.correct} / ${quizState.questions.length}`;
        score.classList.add('show');
        score.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

/* =========================================================
   FLASHCARDS
   ========================================================= */
async function genFlashcards() {
  const topic = document.getElementById('flashTopic').value.trim();
  const num = parseInt(document.getElementById('flashNum').value, 10) || 8;
  if (!topic) return SS.toast('Enter a topic first.', 'error');
  const btn = document.getElementById('flashBtn');
  busyBtn(btn, true, 'Generating…');
  setLoading('flashLoading', true);
  try {
    const data = await SS.api('/api/tools/flashcards', { method: 'POST', body: { topic, num_cards: num } });
    const grid = document.getElementById('flashGrid');
    grid.innerHTML = data.cards.map((c) => `
      <div class="flashcard">
        <div class="flashcard-inner">
          <div class="flashcard-face flashcard-front"><span class="label">Question</span><div>${esc(c.front)}</div></div>
          <div class="flashcard-face flashcard-back"><span class="label">Answer</span><div>${esc(c.back)}</div></div>
        </div>
      </div>`).join('');
    grid.querySelectorAll('.flashcard').forEach((card) => card.addEventListener('click', () => card.classList.toggle('flipped')));
    SS.toast(`${data.cards.length} flashcards created!`);
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('flashLoading', false); }
}

/* =========================================================
   PLANNER
   ========================================================= */
async function genPlan() {
  const goal = document.getElementById('planGoal').value.trim();
  const days = parseInt(document.getElementById('planDays').value, 10) || 7;
  if (!goal) return SS.toast('Enter your goal first.', 'error');
  const btn = document.getElementById('planBtn');
  busyBtn(btn, true, 'Planning…');
  setLoading('planLoading', true);
  try {
    const data = await SS.api('/api/tools/plan', { method: 'POST', body: { goal, days } });
    showResult('planResult', `${md(data.content)}
      <div class="result-actions"><button class="btn ghost" onclick='downloadText("study_plan.md", ${JSON.stringify(data.content)})'><i class="fas fa-download"></i> Download</button></div>`);
    SS.toast('Study plan ready!');
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('planLoading', false); }
}

/* =========================================================
   SUMMARIZER (upload + paste)
   ========================================================= */
let uploadedFile = { id: null, name: null };

function initDropzone() {
  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  if (!dz) return;
  dz.addEventListener('click', () => input.click());
  ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) uploadFile(input.files[0]); });
}

async function uploadFile(file) {
  const wrap = document.getElementById('fileChipWrap');
  wrap.innerHTML = `<div class="file-chip"><span class="spinner"></span> Uploading ${esc(file.name)}…</div>`;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const data = await SS.api('/api/files/upload', { method: 'POST', body: fd });
    uploadedFile = { id: data.id, name: data.filename };
    wrap.innerHTML = `<div class="file-chip"><i class="fas fa-file-circle-check" style="color:var(--success)"></i> ${esc(data.filename)} (${(data.size_bytes / 1024).toFixed(0)} KB)${data.has_text ? ` · ${data.char_count} chars` : ' · no text'}</div>`;
    if (!data.has_text) SS.toast('Uploaded, but no text could be extracted (images aren\'t summarised).', 'error');
    else SS.toast('File uploaded. Click Summarise to continue.');
  } catch (err) {
    wrap.innerHTML = '';
    SS.toast(err.message, 'error');
  }
}

async function summarize() {
  const text = document.getElementById('sumText').value.trim();
  const btn = document.getElementById('sumBtn');
  busyBtn(btn, true, 'Summarising…');
  setLoading('sumLoading', true);
  try {
    let data;
    if (uploadedFile.id) {
      data = await SS.api(`/api/files/${uploadedFile.id}/summarize`, { method: 'POST' });
      showResult('sumResult', `<h3>Summary of ${esc(data.filename)}</h3>${md(data.summary)}`);
    } else if (text) {
      data = await SS.api('/api/tools/summarize', { method: 'POST', body: { text } });
      showResult('sumResult', md(data.summary));
    } else {
      SS.toast('Upload a file or paste some text first.', 'error');
      return;
    }
    SS.toast('Summary ready!');
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('sumLoading', false); }
}

/* =========================================================
   HOMEWORK HELPER
   ========================================================= */
async function homework() {
  const question = document.getElementById('hwQ').value.trim();
  if (!question) return SS.toast('Enter your question first.', 'error');
  const btn = document.getElementById('hwBtn');
  busyBtn(btn, true, 'Thinking…');
  setLoading('hwLoading', true);
  try {
    const data = await SS.api('/api/tools/homework', { method: 'POST', body: { question } });
    showResult('hwResult', md(data.answer));
    SS.toast('Done!');
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('hwLoading', false); }
}

/* =========================================================
   MINDMAP
   ========================================================= */
async function genMindmap() {
  const topic = document.getElementById('mmTopic').value.trim();
  if (!topic) return SS.toast('Enter a topic first.', 'error');
  const btn = document.getElementById('mmBtn');
  busyBtn(btn, true, 'Visualizing…');
  setLoading('mmLoading', true);
  try {
    const data = await SS.api('/api/tools/mindmap', { method: 'POST', body: { topic } });
    renderMindmap(data.mindmap);
    SS.toast('Mindmap generated!');
  } catch (err) { SS.toast(err.message, 'error'); }
  finally { busyBtn(btn, false); setLoading('mmLoading', false); }
}

function renderMindmap(data) {
  const container = document.getElementById('mmResult');
  container.innerHTML = '';
  container.classList.add('show');
  
  const root = document.createElement('div');
  root.className = 'mm-node mm-root';
  root.innerHTML = `<span>${esc(data.name)}</span>`;
  container.appendChild(root);
  
  if (data.children && data.children.length) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'mm-children';
    data.children.forEach(child => childrenContainer.appendChild(createNode(child)));
    container.appendChild(childrenContainer);
  }
}

function createNode(node) {
  const wrap = document.createElement('div');
  wrap.className = 'mm-wrap';
  
  const el = document.createElement('div');
  el.className = 'mm-node';
  el.innerHTML = `<span>${esc(node.name)}</span>`;
  wrap.appendChild(el);
  
  if (node.children && node.children.length) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'mm-children';
    node.children.forEach(child => childrenContainer.appendChild(createNode(child)));
    wrap.appendChild(childrenContainer);
  }
  
  return wrap;
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDropzone();
  loadSavedNotes();

  document.getElementById('notesBtn').addEventListener('click', genNotes);
  document.getElementById('quizBtn').addEventListener('click', genQuiz);
  document.getElementById('flashBtn').addEventListener('click', genFlashcards);
  document.getElementById('planBtn').addEventListener('click', genPlan);
  document.getElementById('sumBtn').addEventListener('click', summarize);
  document.getElementById('hwBtn').addEventListener('click', homework);
  document.getElementById('mmBtn').addEventListener('click', genMindmap);
});

// expose for inline download buttons
window.downloadText = downloadText;
