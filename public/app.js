// ============ Support Hub SPA ============
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

let currentPage = 'dashboard';
let state = { tickets: [], documents: [], prompts: [], channels: [], analytics: {}, config: {}, guides: [] };

// ============ API (with error handling) ============
async function api(url, opts = {}) {
  try {
    const res = await fetch('/api' + url, {
      headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
      ...opts,
      body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  } catch (e) {
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your connection.');
    }
    throw e;
  }
}

// ============ Toast ============
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============ Loading ============
function showLoading(el, message = 'Loading...') {
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${message}</p></div>`;
}

// ============ Modal ============
function showModal(title, contentHtml, footerHtml = '') {
  const overlay = $('#modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `<div class="modal">
    <div class="modal-header"><h2>${title}</h2><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">${contentHtml}</div>
    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
  </div>`;
}
function closeModal() { $('#modal-overlay').classList.add('hidden'); $('#modal-overlay').innerHTML = ''; }

// ============ Navigation ============
$$('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigate(item.dataset.page);
  });
});

function navigate(page) {
  currentPage = page;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  render();
}

async function render() {
  const el = $('#page-content');
  try {
    switch (currentPage) {
      case 'dashboard': return await renderDashboard(el);
      case 'knowledge': return await renderKnowledge(el);
      case 'prompts': return await renderPrompts(el);
      case 'channels': return await renderChannels(el);
      case 'tickets': return await renderTickets(el);
      case 'analytics': return await renderAnalytics(el);
      case 'settings': return await renderSettings(el);
    }
  } catch (e) {
    el.innerHTML = `<div class="error-state"><h2>Something went wrong</h2><p>${escHtml(e.message)}</p><button class="btn btn-primary" onclick="render()">Retry</button></div>`;
  }
}

// ============ Helpers ============
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function badgeClass(status) { return 'badge badge-' + (status || 'open'); }
function priorityClass(p) { return 'priority-dot priority-' + (p || 'medium'); }

function docIcon(type) {
  const map = { pdf: 'PDF', markdown: 'MD', text: 'TXT', html: 'HTM' };
  return `<div class="doc-icon doc-icon-${type}">${map[type] || 'DOC'}</div>`;
}

function promptTypeClass(type) { return 'prompt-card-type type-' + (type || 'rules'); }

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confidenceColor(c) {
  if (c >= 80) return 'var(--green)';
  if (c >= 50) return 'var(--amber)';
  return 'var(--red)';
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.md', '.txt', '.html', '.htm'];

function validateFile(file) {
  if (!file) return 'No file selected';
  if (file.size > MAX_FILE_SIZE) return `File too large (${formatBytes(file.size)}). Maximum is 50MB.`;
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Unsupported file type (${ext}). Supported: PDF, Markdown, Text, HTML.`;
  return null;
}

// ============ Onboarding Check ============
function getOnboardingProgress() {
  const steps = [
    { id: 'settings', label: 'Configure company info', done: !!(state.config.companyName && state.config.supportEmail), page: 'settings' },
    { id: 'docs', label: 'Upload first document', done: (state.analytics.totalDocuments || 0) > 0, page: 'knowledge' },
    { id: 'prompts', label: 'Review behavior prompts', done: (state.prompts || []).length > 0, page: 'prompts' },
    { id: 'test', label: 'Test a question', done: false, action: 'openTestChat' },
    { id: 'channels', label: 'Connect a channel', done: (state.channels || []).length > 0, page: 'channels' },
  ];
  // Mark "test" as done if there's ticket data or docs have been searched (we approximate)
  if ((state.analytics.totalTickets || 0) > 0) steps[3].done = true;
  return steps;
}

function isFirstRun() {
  return !state.config.onboardingComplete && 
    !(state.config.companyName && state.config.supportEmail) && 
    (state.analytics.totalDocuments || 0) === 0;
}

// ============ DASHBOARD ============
async function renderDashboard(el) {
  showLoading(el);

  const [tickets, docs, analytics, escalated, prompts, channels, config] = await Promise.all([
    api('/tickets?limit=10'),
    api('/documents'),
    api('/analytics'),
    api('/tickets/escalated'),
    api('/prompts'),
    api('/channels'),
    api('/config')
  ]);
  state.tickets = tickets; state.documents = docs; state.analytics = analytics;
  state.prompts = prompts; state.channels = channels; state.config = config;

  const open = analytics.statusBreakdown?.open || 0;
  const esc = analytics.statusBreakdown?.escalated || 0;
  const avgTime = analytics.avgResolutionTimeMs ? Math.round(analytics.avgResolutionTimeMs / 60000) + ' min' : '--';

  const onboarding = getOnboardingProgress();
  const completedSteps = onboarding.filter(s => s.done).length;
  const allDone = completedSteps === onboarding.length;
  const showOnboarding = !allDone && !state.config.onboardingComplete;

  el.innerHTML = `
    <h1>Dashboard</h1>
    <p class="page-subtitle">Support operations overview</p>

    ${showOnboarding ? `
    <div class="onboarding-card">
      <div class="onboarding-header">
        <div>
          <h2 style="margin-bottom:4px">👋 Welcome to Support Hub!</h2>
          <p style="color:var(--text-dim);font-size:13px;margin:0">Complete these steps to get your AI support agent up and running.</p>
        </div>
        <div class="onboarding-progress-ring">
          <span>${completedSteps}/${onboarding.length}</span>
        </div>
      </div>
      <div class="onboarding-steps">
        ${onboarding.map((s, i) => `
          <div class="onboarding-step ${s.done ? 'done' : ''}" onclick="${s.action ? s.action + '()' : `navigate('${s.page}')`}">
            <div class="onboarding-check">${s.done ? '✓' : i + 1}</div>
            <span>${s.label}</span>
            ${!s.done ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;opacity:0.5"><polyline points="9 18 15 12 9 6"/></svg>' : ''}
          </div>
        `).join('')}
      </div>
      ${allDone ? '' : `<p style="font-size:11px;color:var(--text-muted);margin-top:12px;text-align:right"><a href="#" onclick="dismissOnboarding();return false" style="color:var(--text-muted);text-decoration:underline">Dismiss checklist</a></p>`}
    </div>` : ''}
    
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Open Tickets</div><div class="stat-value" style="color:var(--accent)">${open}</div></div>
      <div class="stat-card"><div class="stat-label">Resolution Rate</div><div class="stat-value" style="color:var(--green)">${analytics.resolutionRate || 0}%</div></div>
      <div class="stat-card"><div class="stat-label">Escalation Rate</div><div class="stat-value" style="color:${esc ? 'var(--amber)' : 'var(--text)'}">${analytics.escalationRate || 0}%</div></div>
      <div class="stat-card"><div class="stat-label">Avg Resolution</div><div class="stat-value">${avgTime}</div></div>
      <div class="stat-card"><div class="stat-label">Knowledge Docs</div><div class="stat-value">${analytics.totalDocuments || 0}</div><div class="stat-sub">${analytics.totalChunks || 0} searchable chunks</div></div>
    </div>

    ${escalated.length ? `
    <div class="escalation-banner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${escalated.length} ticket${escalated.length > 1 ? 's' : ''} need${escalated.length === 1 ? 's' : ''} human attention</span>
      <button class="btn btn-sm btn-amber" onclick="navigate('tickets')">View Escalated</button>
    </div>` : ''}

    <div class="section-header">
      <h2>Recent Tickets</h2>
      <div class="quick-actions">
        <button class="btn btn-accent btn-sm" onclick="openTestChat()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Test AI
        </button>
        <button class="btn btn-primary btn-sm" onclick="navigate('knowledge')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Document
        </button>
        <button class="btn btn-sm" onclick="navigate('prompts')">Create Prompt</button>
        <button class="btn btn-sm" onclick="navigate('channels')">View Channels</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Subject</th><th>Customer</th><th>Status</th><th>Assigned</th><th>Time</th></tr></thead>
          <tbody>
            ${tickets.length ? tickets.map(t => `
              <tr onclick="viewTicket('${t.id}')">
                <td><span class="${priorityClass(t.priority)}"></span></td>
                <td>${escHtml(t.subject)}</td>
                <td>${escHtml(t.customerName)}</td>
                <td><span class="${badgeClass(t.status)}">${t.status}</span></td>
                <td>${t.assignedTo === 'ai' ? 'AI' : 'Human'}</td>
                <td style="color:var(--text-muted)">${timeAgo(t.createdAt)}</td>
              </tr>
            `).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px">
              No tickets yet. Tickets appear here when customers reach out through connected channels, or you can 
              <a href="#" onclick="createTicket();return false" style="color:var(--accent)">create one manually</a> to test.
            </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function dismissOnboarding() {
  await api('/config', { method: 'PUT', body: { onboardingComplete: true } });
  state.config.onboardingComplete = true;
  renderDashboard($('#page-content'));
}

// ============ TEST CHAT WIDGET ============
function openTestChat() {
  showModal('Test Your AI', `
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
      Ask a question to see what your AI would reference from the knowledge base. 
      ${(state.analytics?.totalDocuments || 0) === 0 ? '<strong style="color:var(--amber)">⚠ No documents uploaded yet — upload docs first for meaningful results.</strong>' : `<span style="color:var(--green)">✓ ${state.analytics.totalDocuments} document(s) loaded with ${state.analytics.totalChunks} searchable chunks.</span>`}
    </p>
    <div class="test-chat-container">
      <div id="test-chat-messages" class="test-chat-messages">
        <div class="chat-msg chat-msg-ai">
          <div>Hi! I'm your AI support agent. Ask me anything about your knowledge base and I'll show you what I'd reference to answer.</div>
        </div>
      </div>
      <div class="test-chat-input">
        <input type="text" id="test-chat-input" placeholder="Ask a customer question..." onkeydown="if(event.key==='Enter')sendTestChat()">
        <button class="btn btn-primary btn-sm" onclick="sendTestChat()">Send</button>
      </div>
    </div>
  `);
  setTimeout(() => $('#test-chat-input')?.focus(), 100);
}

async function sendTestChat() {
  const input = $('#test-chat-input');
  const q = input.value.trim();
  if (!q) return;
  
  const messages = $('#test-chat-messages');
  messages.innerHTML += `<div class="chat-msg chat-msg-customer"><div>${escHtml(q)}</div></div>`;
  input.value = '';
  messages.innerHTML += `<div class="chat-msg chat-msg-ai" id="test-thinking"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  messages.scrollTop = messages.scrollHeight;

  try {
    const results = await api(`/search?q=${encodeURIComponent(q)}&limit=5`);
    const thinkingEl = $('#test-thinking');
    
    if (results.length > 0) {
      let responseHtml = `<div><strong>I found ${results.length} relevant result${results.length > 1 ? 's' : ''} in your knowledge base:</strong></div>`;
      results.forEach((r, i) => {
        responseHtml += `
          <div class="test-result-item">
            <div class="test-result-header">
              <span class="test-result-doc">${escHtml(r.documentName)}</span>
              <span class="test-result-score">relevance: ${r.score}</span>
            </div>
            <div class="test-result-content">${escHtml(r.content.slice(0, 200))}${r.content.length > 200 ? '...' : ''}</div>
          </div>`;
      });
      responseHtml += `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">The AI agent would use these chunks to compose a natural response to the customer.</div>`;
      thinkingEl.innerHTML = `<div>${responseHtml}</div>`;
    } else {
      thinkingEl.innerHTML = `<div>
        <strong style="color:var(--amber)">No relevant results found.</strong><br>
        <span style="font-size:12px;color:var(--text-dim)">This means the AI wouldn't have knowledge base context for this question. It would either give a generic response or escalate to a human agent. Try uploading documents that cover this topic.</span>
      </div>`;
    }
  } catch (e) {
    const thinkingEl = $('#test-thinking');
    if (thinkingEl) thinkingEl.innerHTML = `<div style="color:var(--red)">Error: ${escHtml(e.message)}</div>`;
  }
  messages.scrollTop = messages.scrollHeight;
}

// ============ KNOWLEDGE BASE ============
let kbTab = 'documents';
let searchDebounce = null;

async function renderKnowledge(el) {
  showLoading(el);
  const docs = await api('/documents');
  state.documents = docs;

  el.innerHTML = `
    <h1>Knowledge Base</h1>
    <p class="page-subtitle">Upload documents, search your knowledge, manage content</p>

    <div class="tabs">
      <div class="tab ${kbTab === 'documents' ? 'active' : ''}" onclick="kbTab='documents';renderKnowledge($('#page-content'))">Documents</div>
      <div class="tab ${kbTab === 'search' ? 'active' : ''}" onclick="kbTab='search';renderKnowledge($('#page-content'))">Search</div>
      <div class="tab ${kbTab === 'upload' ? 'active' : ''}" onclick="kbTab='upload';renderKnowledge($('#page-content'))">Upload</div>
    </div>

    <div id="kb-content"></div>
  `;

  const content = $('#kb-content');
  if (kbTab === 'documents') renderDocList(content, docs);
  else if (kbTab === 'search') renderSearch(content);
  else renderUpload(content);
}

function renderDocList(el, docs) {
  el.innerHTML = `
    <div class="filter-bar mb-16">
      <div class="search-input">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Filter documents..." oninput="filterDocs(this.value)">
      </div>
    </div>
    <div class="doc-grid" id="doc-grid">
      ${docs.length ? docs.map(d => `
        <div class="doc-card" onclick="viewDocument('${d.id}')">
          <div class="doc-card-header">
            ${docIcon(d.type)}
            <span class="doc-card-name">${escHtml(d.name)}</span>
          </div>
          <div class="doc-card-meta">
            <span>${d.chunkCount} chunks</span>
            <span>${formatBytes(d.size)}</span>
            <span>${timeAgo(d.uploadedAt)}</span>
          </div>
        </div>
      `).join('') : `<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:12px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        <p style="margin-bottom:8px">No documents uploaded yet.</p>
        <p style="font-size:12px;margin-bottom:12px">Upload your first document to build your AI's knowledge base.</p>
        <button class="btn btn-primary btn-sm" onclick="kbTab='upload';renderKnowledge($('#page-content'))">Upload Document →</button>
      </div>`}
    </div>
  `;
}

function filterDocs(q) {
  const cards = $$('.doc-card');
  const ql = q.toLowerCase();
  cards.forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(ql) ? '' : 'none';
  });
}

async function viewDocument(id) {
  try {
    const doc = await api(`/documents/${id}`);
    const chunks = await api(`/documents/${id}/chunks`);
    
    showModal(escHtml(doc.name), `
      <div class="flex-between mb-16">
        <div>
          <span class="${badgeClass('open')}" style="margin-right:8px">${doc.type.toUpperCase()}</span>
          <span style="color:var(--text-muted);font-size:12px">${formatBytes(doc.size)} &middot; ${doc.chunkCount} chunks &middot; Uploaded ${timeAgo(doc.uploadedAt)}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteDocument('${id}')">Delete</button>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius);padding:16px;max-height:300px;overflow-y:auto;font-size:13px;line-height:1.6;color:var(--text-dim);white-space:pre-wrap">${escHtml(doc.content)}</div>
      <h3 class="mt-16" style="margin-bottom:8px">Chunks (${chunks.length})</h3>
      <div style="max-height:200px;overflow-y:auto">
        ${chunks.map((c, i) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-dim)">
            <span style="color:var(--text-muted);font-weight:600">Chunk ${i + 1}</span> &mdash; ${c.keywords.slice(0, 5).join(', ')}
            <div style="margin-top:4px">${escHtml(c.content.slice(0, 150))}${c.content.length > 150 ? '...' : ''}</div>
          </div>
        `).join('')}
      </div>
    `);
  } catch (e) {
    toast('Failed to load document: ' + e.message, 'error');
  }
}

async function deleteDocument(id) {
  if (!confirm('Delete this document and all its chunks?')) return;
  try {
    await api(`/documents/${id}`, { method: 'DELETE' });
    closeModal();
    toast('Document deleted', 'success');
    renderKnowledge($('#page-content'));
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

function renderSearch(el) {
  el.innerHTML = `
    <div class="search-input mb-16" style="max-width:500px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="kb-search" placeholder="Search your knowledge base..." oninput="debouncedSearch()" onkeydown="if(event.key==='Enter')doSearch()">
    </div>
    <div id="search-results"><p style="color:var(--text-muted);padding:20px;text-align:center">Type to search across all documents.</p></div>
  `;
}

function debouncedSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(doSearch, 300);
}

async function doSearch() {
  const q = $('#kb-search').value.trim();
  if (!q) {
    $('#search-results').innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">Type to search across all documents.</p>';
    return;
  }
  
  $('#search-results').innerHTML = '<div class="loading-state" style="padding:20px"><div class="spinner"></div></div>';
  
  try {
    const results = await api(`/search?q=${encodeURIComponent(q)}&limit=10`);
    const maxScore = results.length ? results[0].score : 1;
    
    $('#search-results').innerHTML = results.length ? results.map(r => `
      <div class="search-result">
        <div class="search-result-header">
          <span class="search-result-doc">${escHtml(r.documentName)}</span>
          <span class="search-result-score">
            Score: ${r.score}
            <span class="relevance-bar"><span class="relevance-fill" style="width:${Math.round(r.score / maxScore * 100)}%"></span></span>
          </span>
        </div>
        <div class="search-result-content">${escHtml(r.content.slice(0, 300))}${r.content.length > 300 ? '...' : ''}</div>
      </div>
    `).join('') : '<p style="color:var(--text-muted);padding:20px;text-align:center">No results found for "' + escHtml(q) + '"</p>';
  } catch (e) {
    $('#search-results').innerHTML = `<p style="color:var(--red);padding:20px;text-align:center">Search failed: ${escHtml(e.message)}</p>`;
  }
}

function renderUpload(el) {
  el.innerHTML = `
    <div class="upload-zone" id="upload-zone" onclick="$('#file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleDrop(event)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>Drop files here or click to upload</p>
      <p class="upload-hint">Supports PDF, Markdown, Text, HTML files (max 50MB)</p>
    </div>
    <input type="file" id="file-input" hidden accept=".pdf,.md,.txt,.html,.htm" onchange="uploadFile(this.files[0])">
    
    <div class="form-group mt-16">
      <label>Document Name (optional)</label>
      <input type="text" id="upload-name" placeholder="Auto-detected from filename">
    </div>
    <div class="form-group">
      <label>Category</label>
      <select id="upload-category">
        <option value="general">General</option>
        <option value="product">Product</option>
        <option value="faq">FAQ</option>
        <option value="policy">Policy</option>
        <option value="technical">Technical</option>
        <option value="billing">Billing</option>
      </select>
    </div>
    <div class="form-group">
      <label>Tags (comma-separated)</label>
      <input type="text" id="upload-tags" placeholder="e.g. pricing, onboarding, api">
    </div>
    
    <div id="upload-progress" style="display:none" class="mt-16">
      <p id="upload-status" style="font-size:13px;margin-bottom:8px">Uploading...</p>
      <div class="progress"><div class="progress-bar" id="upload-bar" style="width:0%"></div></div>
    </div>
  `;
}

function handleDrop(e) {
  e.preventDefault();
  $('#upload-zone').classList.remove('dragover');
  if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
}

async function uploadFile(file) {
  if (!file) return;
  
  const validationError = validateFile(file);
  if (validationError) {
    toast(validationError, 'error');
    return;
  }
  
  const prog = $('#upload-progress');
  const bar = $('#upload-bar');
  const status = $('#upload-status');
  prog.style.display = 'block';
  status.textContent = 'Uploading ' + file.name + '...';
  bar.style.width = '30%';

  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', $('#upload-name').value || '');
  fd.append('category', $('#upload-category').value);
  fd.append('tags', $('#upload-tags').value);

  try {
    bar.style.width = '60%';
    const doc = await api('/documents', { method: 'POST', body: fd });
    bar.style.width = '100%';
    status.textContent = `Uploaded! ${doc.chunkCount} chunks created.`;
    toast('Document uploaded: ' + doc.name, 'success');
    setTimeout(() => { kbTab = 'documents'; renderKnowledge($('#page-content')); }, 1500);
  } catch (e) {
    status.textContent = 'Upload failed: ' + e.message;
    bar.style.width = '0%';
    toast('Upload failed: ' + e.message, 'error');
  }
}

// ============ PROMPTS ============
let promptFilter = 'all';

async function renderPrompts(el) {
  showLoading(el);
  const prompts = await api('/prompts');
  state.prompts = prompts;
  const types = ['all', 'tone', 'rules', 'escalation', 'template', 'product'];
  const filtered = promptFilter === 'all' ? prompts : prompts.filter(p => p.type === promptFilter);

  el.innerHTML = `
    <div class="flex-between mb-16">
      <div><h1>Behavior Prompts</h1><p class="page-subtitle" style="margin-bottom:0">Configure how your AI support agent behaves</p></div>
      <button class="btn btn-primary" onclick="editPrompt()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Prompt
      </button>
    </div>

    <div class="tabs">
      ${types.map(t => `<div class="tab ${promptFilter === t ? 'active' : ''}" onclick="promptFilter='${t}';renderPrompts($('#page-content'))">${t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}</div>`).join('')}
    </div>

    <div class="prompt-grid">
      ${filtered.length ? filtered.map(p => `
        <div class="prompt-card ${p.enabled ? '' : 'disabled'}">
          <div class="prompt-card-header">
            <span class="prompt-card-name">${escHtml(p.name)}</span>
            <span class="${promptTypeClass(p.type)}">${p.type}</span>
          </div>
          <div class="prompt-card-content">${escHtml(p.content)}</div>
          <div class="prompt-card-footer">
            <label class="toggle">
              <input type="checkbox" ${p.enabled ? 'checked' : ''} onchange="togglePrompt('${p.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <div class="flex gap-8">
              <button class="btn btn-sm" onclick="editPrompt('${p.id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deletePrompt('${p.id}')">Delete</button>
            </div>
          </div>
        </div>
      `).join('') : '<p style="color:var(--text-muted);padding:30px;text-align:center">No prompts in this category.</p>'}
    </div>
  `;
}

async function togglePrompt(id, enabled) {
  try {
    await api(`/prompts/${id}`, { method: 'PUT', body: { enabled } });
    toast(enabled ? 'Prompt enabled' : 'Prompt disabled', 'info');
  } catch (e) {
    toast('Failed to update prompt: ' + e.message, 'error');
  }
}

async function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  try {
    await api(`/prompts/${id}`, { method: 'DELETE' });
    toast('Prompt deleted', 'success');
    renderPrompts($('#page-content'));
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

function editPrompt(id) {
  const existing = id ? state.prompts.find(p => p.id === id) : null;
  showModal(existing ? 'Edit Prompt' : 'New Prompt', `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="prompt-name" value="${escHtml(existing?.name || '')}" placeholder="e.g., Friendly Tone">
    </div>
    <div class="form-group">
      <label>Type</label>
      <select id="prompt-type">
        ${['tone', 'rules', 'escalation', 'template', 'product'].map(t => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Content</label>
      <textarea id="prompt-content" rows="8" placeholder="Write the prompt instructions...">${escHtml(existing?.content || '')}</textarea>
    </div>
    <div class="form-group">
      <label>Priority (lower = higher priority)</label>
      <input type="number" id="prompt-priority" value="${existing?.priority || 5}" min="1" max="100">
    </div>
    <div class="form-group flex gap-8" style="align-items:center">
      <label class="toggle" style="margin-bottom:0">
        <input type="checkbox" id="prompt-enabled" ${existing?.enabled !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span style="font-size:13px">Enabled</span>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="savePrompt('${id || ''}')">Save</button>
  `);
}

async function savePrompt(id) {
  const data = {
    name: $('#prompt-name').value,
    type: $('#prompt-type').value,
    content: $('#prompt-content').value,
    priority: parseInt($('#prompt-priority').value) || 5,
    enabled: $('#prompt-enabled').checked
  };
  if (!data.name || !data.content) return toast('Name and content are required', 'error');
  
  try {
    if (id) {
      await api(`/prompts/${id}`, { method: 'PUT', body: data });
    } else {
      await api('/prompts', { method: 'POST', body: data });
    }
    closeModal();
    toast('Prompt saved', 'success');
    renderPrompts($('#page-content'));
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

// ============ CHANNELS ============
async function renderChannels(el) {
  showLoading(el);
  const [channels, guides] = await Promise.all([api('/channels'), api('/channels/guides')]);
  state.channels = channels;
  state.guides = guides;
  
  const channelMap = {};
  channels.forEach(c => { channelMap[c.platform] = c; });

  el.innerHTML = `
    <h1>Support Channels</h1>
    <p class="page-subtitle">Connect your support platforms to route conversations to the AI</p>

    <div class="info-banner mb-16">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>These are setup guides. Webhook handling is managed by the AI agent — configure your external platform to send webhooks to the URLs shown in each guide.</span>
    </div>

    <div class="channel-grid">
      ${guides.map(g => {
        const ch = channelMap[g.platform];
        const status = ch ? ch.status : 'disconnected';
        return `
          <div class="channel-card" onclick="showChannelSetup('${g.platform}')">
            <div class="channel-logo">${g.logoPlaceholder}</div>
            <div class="channel-name">${g.name}</div>
            <div class="channel-desc">${g.description}</div>
            <div style="font-size:12px">
              <span class="status-dot status-${status}"></span>
              ${status === 'disconnected' ? 'Not configured' : status.charAt(0).toUpperCase() + status.slice(1)}
              ${ch?.lastActivity ? ' &middot; Active ' + timeAgo(ch.lastActivity) : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function showChannelSetup(platform) {
  const guide = state.guides.find(g => g.platform === platform);
  const existing = state.channels.find(c => c.platform === platform);
  if (!guide) return;

  showModal(`${guide.name} Setup`, `
    <div class="info-banner mb-16" style="font-size:12px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>${guide.integrationNote || 'Setup guide — webhook handling is managed by the AI agent.'}</span>
    </div>

    <div style="margin-bottom:16px">
      <span style="font-size:12px;color:var(--text-muted)">Auth: ${guide.authType}</span>
      <span style="font-size:12px;color:var(--text-muted);margin-left:12px">Features: ${guide.features.join(', ')}</span>
    </div>

    <h3 style="margin-bottom:12px">Setup Steps</h3>
    <div class="setup-steps">
      ${guide.setupSteps.map(s => `<div class="setup-step">${s}</div>`).join('')}
    </div>

    <h3 style="margin:16px 0 8px">Webhook Configuration</h3>
    <div style="background:var(--bg);padding:12px;border-radius:var(--radius);font-size:12px;font-family:monospace;color:var(--accent)">
      URL: ${guide.webhookConfig.url}<br>
      Events: ${guide.webhookConfig.events.join(', ')}<br>
      Secret: ${guide.webhookConfig.secret}
    </div>

    <h3 style="margin:16px 0 8px">API Endpoints</h3>
    <div style="font-size:12px;color:var(--text-dim)">
      ${guide.apiEndpoints.map(e => `<div style="padding:3px 0;font-family:monospace">${e}</div>`).join('')}
    </div>

    <h3 style="margin:16px 0 8px">Configuration</h3>
    <div class="form-group">
      <label>API Key / Token</label>
      <input type="password" id="ch-apikey" value="${escHtml(existing?.config?.apiKey || '')}" placeholder="Enter your ${guide.name} API key">
    </div>
    <div class="form-group">
      <label>Webhook Secret</label>
      <input type="password" id="ch-secret" value="${escHtml(existing?.config?.secret || '')}" placeholder="Webhook verification secret">
    </div>
    <div class="form-group">
      <label>Additional Config (subdomain, property ID, etc.)</label>
      <input type="text" id="ch-extra" value="${escHtml(existing?.config?.extra || '')}" placeholder="Platform-specific configuration">
    </div>
  `, `
    ${existing ? `<button class="btn btn-danger" onclick="deleteChannel('${existing.id}')">Disconnect</button>` : ''}
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveChannel('${platform}', '${existing?.id || ''}')">${existing ? 'Update' : 'Save Configuration'}</button>
  `);
}

async function saveChannel(platform, existingId) {
  const data = {
    platform,
    status: 'connected',
    config: {
      apiKey: $('#ch-apikey').value,
      secret: $('#ch-secret').value,
      extra: $('#ch-extra').value
    }
  };
  
  try {
    if (existingId) {
      await api(`/channels/${existingId}`, { method: 'PUT', body: data });
    } else {
      await api('/channels', { method: 'POST', body: data });
    }
    closeModal();
    toast(`${platform} configuration saved`, 'success');
    renderChannels($('#page-content'));
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

async function deleteChannel(id) {
  if (!confirm('Disconnect this channel? This will remove the saved configuration.')) return;
  try {
    await api(`/channels/${id}`, { method: 'DELETE' });
    closeModal();
    toast('Channel disconnected', 'success');
    renderChannels($('#page-content'));
  } catch (e) {
    toast('Failed to disconnect: ' + e.message, 'error');
  }
}

// ============ TICKETS ============
let ticketFilter = {};

async function renderTickets(el) {
  showLoading(el);
  const qs = Object.entries(ticketFilter).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&');
  const tickets = await api('/tickets' + (qs ? '?' + qs : ''));
  state.tickets = tickets;

  el.innerHTML = `
    <div class="flex-between mb-16">
      <div><h1>Tickets</h1><p class="page-subtitle" style="margin-bottom:0">Manage support conversations</p></div>
      <button class="btn btn-primary" onclick="createTicket()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Ticket
      </button>
    </div>

    <div class="filter-bar">
      <select onchange="ticketFilter.status=this.value;renderTickets($('#page-content'))">
        <option value="">All Status</option>
        <option value="open" ${ticketFilter.status==='open'?'selected':''}>Open</option>
        <option value="pending" ${ticketFilter.status==='pending'?'selected':''}>Pending</option>
        <option value="escalated" ${ticketFilter.status==='escalated'?'selected':''}>Escalated</option>
        <option value="resolved" ${ticketFilter.status==='resolved'?'selected':''}>Resolved</option>
        <option value="closed" ${ticketFilter.status==='closed'?'selected':''}>Closed</option>
      </select>
      <select onchange="ticketFilter.priority=this.value;renderTickets($('#page-content'))">
        <option value="">All Priority</option>
        <option value="low" ${ticketFilter.priority==='low'?'selected':''}>Low</option>
        <option value="medium" ${ticketFilter.priority==='medium'?'selected':''}>Medium</option>
        <option value="high" ${ticketFilter.priority==='high'?'selected':''}>High</option>
        <option value="urgent" ${ticketFilter.priority==='urgent'?'selected':''}>Urgent</option>
      </select>
      <select onchange="ticketFilter.assignedTo=this.value;renderTickets($('#page-content'))">
        <option value="">All Assignees</option>
        <option value="ai" ${ticketFilter.assignedTo==='ai'?'selected':''}>AI</option>
        <option value="human" ${ticketFilter.assignedTo==='human'?'selected':''}>Human</option>
      </select>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Subject</th><th>Customer</th><th>Channel</th><th>Status</th><th>Assignee</th><th>Confidence</th><th>Time</th></tr></thead>
          <tbody>
            ${tickets.length ? tickets.map(t => `
              <tr onclick="viewTicket('${t.id}')">
                <td><span class="${priorityClass(t.priority)}"></span></td>
                <td>${escHtml(t.subject)}</td>
                <td>${escHtml(t.customerName)}</td>
                <td>${t.platform}</td>
                <td><span class="${badgeClass(t.status)}">${t.status}</span></td>
                <td>${t.assignedTo === 'ai' ? 'AI' : 'Human'}</td>
                <td>
                  <div class="confidence">
                    <span style="font-size:12px">${t.confidence}%</span>
                    <div class="confidence-bar"><div class="confidence-fill" style="width:${t.confidence}%;background:${confidenceColor(t.confidence)}"></div></div>
                  </div>
                </td>
                <td style="color:var(--text-muted);white-space:nowrap">${timeAgo(t.createdAt)}</td>
              </tr>
            `).join('') : `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px">
              No tickets found. ${!Object.values(ticketFilter).some(v=>v) ? 'Tickets appear here when customers reach out, or <a href="#" onclick="createTicket();return false" style="color:var(--accent)">create one manually</a>.' : 'Try adjusting filters.'}
            </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function viewTicket(id) {
  try {
    const ticket = await api(`/tickets/${id}`);
    currentPage = 'ticket-detail';
    
    const el = $('#page-content');
    el.innerHTML = `
      <button class="btn btn-sm mb-16" onclick="navigate('tickets')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Tickets
      </button>

      ${ticket.status === 'escalated' ? `
      <div class="escalation-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        This ticket has been escalated and needs human attention
      </div>` : ''}

      <div class="ticket-detail">
        <div class="ticket-detail-main">
          <div class="card">
            <h2 style="margin-bottom:4px">${escHtml(ticket.subject)}</h2>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${ticket.customerName} &middot; ${ticket.customerEmail || 'No email'} &middot; via ${ticket.platform}</p>
            
            <div class="chat-thread" id="chat-thread">
              ${(ticket.messages || []).map(m => `
                <div class="chat-msg chat-msg-${m.role}">
                  <div>${escHtml(m.content)}</div>
                  <div class="chat-msg-time">${m.timestamp ? timeAgo(m.timestamp) : ''}</div>
                </div>
              `).join('') || '<p style="text-align:center;color:var(--text-muted);padding:20px">No messages yet</p>'}
            </div>

            <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;display:flex;gap:8px">
              <input type="text" id="msg-input" placeholder="Add an internal note..." style="flex:1" onkeydown="if(event.key==='Enter')addMessage('${ticket.id}')">
              <button class="btn btn-primary btn-sm" onclick="addMessage('${ticket.id}')">Send</button>
            </div>
          </div>
        </div>

        <div class="ticket-detail-sidebar">
          <div class="card">
            <h3>Details</h3>
            <div class="meta-row"><span class="meta-label">Status</span><span class="${badgeClass(ticket.status)}">${ticket.status}</span></div>
            <div class="meta-row"><span class="meta-label">Priority</span><span><span class="${priorityClass(ticket.priority)}"></span> ${ticket.priority}</span></div>
            <div class="meta-row"><span class="meta-label">Assigned</span><span>${ticket.assignedTo === 'ai' ? 'AI Agent' : 'Human'}</span></div>
            <div class="meta-row"><span class="meta-label">Confidence</span><span style="color:${confidenceColor(ticket.confidence)}">${ticket.confidence}%</span></div>
            <div class="meta-row"><span class="meta-label">Created</span><span>${timeAgo(ticket.createdAt)}</span></div>
            ${ticket.resolvedAt ? `<div class="meta-row"><span class="meta-label">Resolved</span><span>${timeAgo(ticket.resolvedAt)}</span></div>` : ''}
          </div>

          <div class="card">
            <h3>Actions</h3>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
              ${ticket.status !== 'escalated' ? `<button class="btn btn-amber" onclick="escalateTicket('${ticket.id}')">Escalate to Human</button>` : ''}
              ${ticket.status !== 'resolved' ? `<button class="btn btn-green" onclick="resolveTicket('${ticket.id}')">Mark Resolved</button>` : ''}
              <button class="btn" onclick="updateTicketPriority('${ticket.id}')">Change Priority</button>
            </div>
          </div>

          ${ticket.tags?.length ? `
          <div class="card">
            <h3>Tags</h3>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
              ${ticket.tags.map(t => `<span class="badge badge-open">${escHtml(t)}</span>`).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
    `;
  } catch (e) {
    toast('Failed to load ticket: ' + e.message, 'error');
    navigate('tickets');
  }
}

async function addMessage(ticketId) {
  const input = $('#msg-input');
  if (!input.value.trim()) return;
  try {
    const ticket = await api(`/tickets/${ticketId}`);
    ticket.messages.push({ role: 'system', content: input.value, timestamp: new Date().toISOString() });
    await api(`/tickets/${ticketId}`, { method: 'PUT', body: { messages: ticket.messages } });
    toast('Note added', 'success');
    viewTicket(ticketId);
  } catch (e) {
    toast('Failed to add note: ' + e.message, 'error');
  }
}

async function escalateTicket(id) {
  showModal('Escalate Ticket', `
    <div class="form-group">
      <label>Escalation Reason</label>
      <textarea id="escalation-reason" rows="3" placeholder="Why is this being escalated?"></textarea>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-amber" onclick="doEscalate('${id}')">Escalate</button>
  `);
}

async function doEscalate(id) {
  const reason = $('#escalation-reason').value.trim();
  try {
    await api(`/tickets/${id}/escalate`, { method: 'POST', body: { reason: reason || 'Manual escalation' } });
    closeModal();
    toast('Ticket escalated', 'info');
    viewTicket(id);
  } catch (e) {
    toast('Escalation failed: ' + e.message, 'error');
  }
}

async function resolveTicket(id) {
  try {
    await api(`/tickets/${id}/resolve`, { method: 'POST', body: {} });
    toast('Ticket resolved', 'success');
    viewTicket(id);
  } catch (e) {
    toast('Failed to resolve: ' + e.message, 'error');
  }
}

async function updateTicketPriority(id) {
  showModal('Change Priority', `
    <div class="form-group">
      <label>New Priority</label>
      <select id="new-ticket-priority">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="doUpdatePriority('${id}')">Update</button>
  `);
}

async function doUpdatePriority(id) {
  const p = $('#new-ticket-priority').value;
  try {
    await api(`/tickets/${id}`, { method: 'PUT', body: { priority: p } });
    closeModal();
    toast('Priority updated', 'success');
    viewTicket(id);
  } catch (e) {
    toast('Update failed: ' + e.message, 'error');
  }
}

function createTicket() {
  showModal('New Ticket', `
    <div class="form-group"><label>Subject</label><input type="text" id="new-subject" placeholder="Ticket subject"></div>
    <div class="form-group"><label>Customer Name</label><input type="text" id="new-name" placeholder="Customer name"></div>
    <div class="form-group"><label>Customer Email</label><input type="email" id="new-email" placeholder="customer@example.com"></div>
    <div class="form-group"><label>Priority</label>
      <select id="new-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
    </div>
    <div class="form-group"><label>Initial Message</label><textarea id="new-message" placeholder="Customer's initial message..."></textarea></div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitNewTicket()">Create</button>
  `);
}

async function submitNewTicket() {
  const data = {
    subject: $('#new-subject').value,
    customerName: $('#new-name').value,
    customerEmail: $('#new-email').value,
    priority: $('#new-priority').value,
    messages: $('#new-message').value ? [{ role: 'customer', content: $('#new-message').value, timestamp: new Date().toISOString() }] : []
  };
  if (!data.subject) return toast('Subject is required', 'error');
  try {
    await api('/tickets', { method: 'POST', body: data });
    closeModal();
    toast('Ticket created', 'success');
    renderTickets($('#page-content'));
  } catch (e) {
    toast('Failed to create ticket: ' + e.message, 'error');
  }
}

// ============ ANALYTICS ============
async function renderAnalytics(el) {
  showLoading(el);
  const analytics = await api('/analytics');

  const statusColors = { open: 'var(--accent)', pending: 'var(--amber)', escalated: 'var(--red)', resolved: 'var(--green)', closed: 'var(--text-muted)' };
  const statusData = Object.entries(analytics.statusBreakdown || {});
  const maxStatus = Math.max(...statusData.map(([,v]) => v), 1);
  
  const priorityColors = { low: 'var(--green)', medium: 'var(--accent)', high: 'var(--amber)', urgent: 'var(--red)' };
  const priorityData = Object.entries(analytics.priorityBreakdown || {});
  const maxPriority = Math.max(...priorityData.map(([,v]) => v), 1);

  const platformData = Object.entries(analytics.platformBreakdown || {});
  const maxPlatform = Math.max(...platformData.map(([,v]) => v), 1);

  const hasData = analytics.totalTickets > 0;

  el.innerHTML = `
    <h1>Analytics</h1>
    <p class="page-subtitle">Support performance metrics</p>

    ${!hasData ? `<div class="info-banner mb-16">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>Analytics will populate as tickets flow through the system. Create a test ticket or connect a channel to get started.</span>
    </div>` : ''}

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total Tickets</div><div class="stat-value">${analytics.totalTickets || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Resolution Rate</div><div class="stat-value" style="color:var(--green)">${analytics.resolutionRate || 0}%</div></div>
      <div class="stat-card"><div class="stat-label">Escalation Rate</div><div class="stat-value" style="color:var(--amber)">${analytics.escalationRate || 0}%</div></div>
      <div class="stat-card"><div class="stat-label">Avg Resolution</div><div class="stat-value">${analytics.avgResolutionTimeMs ? Math.round(analytics.avgResolutionTimeMs / 60000) + 'm' : '--'}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <h3>Tickets by Status</h3>
        <div class="bar-chart">
          ${statusData.length ? statusData.map(([k, v]) => `
            <div class="bar-item">
              <div class="bar-value">${v}</div>
              <div class="bar" style="height:${Math.round(v / maxStatus * 120)}px;background:${statusColors[k] || 'var(--accent)'}"></div>
              <div class="bar-label">${k}</div>
            </div>
          `).join('') : '<p style="color:var(--text-muted);width:100%;text-align:center">No data yet</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Tickets by Priority</h3>
        <div class="bar-chart">
          ${priorityData.length ? priorityData.map(([k, v]) => `
            <div class="bar-item">
              <div class="bar-value">${v}</div>
              <div class="bar" style="height:${Math.round(v / maxPriority * 120)}px;background:${priorityColors[k] || 'var(--accent)'}"></div>
              <div class="bar-label">${k}</div>
            </div>
          `).join('') : '<p style="color:var(--text-muted);width:100%;text-align:center">No data yet</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Channel Breakdown</h3>
        <div class="bar-chart">
          ${platformData.length ? platformData.map(([k, v]) => `
            <div class="bar-item">
              <div class="bar-value">${v}</div>
              <div class="bar" style="height:${Math.round(v / maxPlatform * 120)}px;background:var(--accent)"></div>
              <div class="bar-label">${k}</div>
            </div>
          `).join('') : '<p style="color:var(--text-muted);width:100%;text-align:center">No data yet</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Top Topics</h3>
        ${analytics.topTopics?.length ? analytics.topTopics.map(([tag, count]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="badge badge-open">${escHtml(tag)}</span>
            <span style="font-size:13px;font-weight:600">${count}</span>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">No topics yet. Add tags to tickets and they\'ll appear here.</p>'}
      </div>
    </div>
  `;
}

// ============ SETTINGS ============
async function renderSettings(el) {
  showLoading(el);
  const config = await api('/config');
  state.config = config;

  el.innerHTML = `
    <h1>Settings</h1>
    <p class="page-subtitle">General support configuration</p>

    <div class="card" style="max-width:600px">
      <div class="info-banner mb-16" style="font-size:12px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>These settings help the AI personalize responses. Company name and email are used in customer-facing messages.</span>
      </div>
      <div class="form-group"><label>Company Name</label><input type="text" id="cfg-company" value="${escHtml(config.companyName || '')}" placeholder="Your Company"></div>
      <div class="form-group"><label>Support Email</label><input type="text" id="cfg-email" value="${escHtml(config.supportEmail || '')}" placeholder="support@company.com"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group"><label>Working Hours Start</label><input type="time" id="cfg-start" value="${config.workingHours?.start || '09:00'}"></div>
        <div class="form-group"><label>Working Hours End</label><input type="time" id="cfg-end" value="${config.workingHours?.end || '17:00'}"></div>
      </div>
      <div class="form-group"><label>Timezone</label><input type="text" id="cfg-tz" value="${escHtml(config.workingHours?.timezone || 'UTC')}" placeholder="UTC"></div>
      <div class="form-group"><label>Escalation Threshold (confidence %)</label><input type="number" id="cfg-threshold" value="${config.escalationThreshold || 70}" min="0" max="100"><p style="font-size:11px;color:var(--text-muted);margin-top:4px">Tickets with AI confidence below this will be escalated</p></div>
      <div class="form-group"><label>SLA Target (minutes)</label><input type="number" id="cfg-sla" value="${config.slaTargetMinutes || 60}" min="1"></div>
      <button class="btn btn-primary mt-16" onclick="saveSettings()">Save Settings</button>
    </div>
  `;
}

async function saveSettings() {
  const data = {
    companyName: $('#cfg-company').value,
    supportEmail: $('#cfg-email').value,
    workingHours: { start: $('#cfg-start').value, end: $('#cfg-end').value, timezone: $('#cfg-tz').value },
    escalationThreshold: parseInt($('#cfg-threshold').value),
    slaTargetMinutes: parseInt($('#cfg-sla').value)
  };
  try {
    await api('/config', { method: 'PUT', body: data });
    state.config = { ...state.config, ...data };
    toast('Settings saved', 'success');
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

// ============ Init ============
render();
