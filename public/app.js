// ============ Support Hub SPA ============
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

let currentPage = 'dashboard';
let state = { tickets: [], documents: [], prompts: [], channels: [], analytics: {}, config: {}, guides: [] };

// ============ API ============
async function api(url, opts = {}) {
  const res = await fetch('/api' + url, {
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined
  });
  return res.json();
}

// ============ Toast ============
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
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
  switch (currentPage) {
    case 'dashboard': return renderDashboard(el);
    case 'knowledge': return renderKnowledge(el);
    case 'prompts': return renderPrompts(el);
    case 'channels': return renderChannels(el);
    case 'tickets': return renderTickets(el);
    case 'analytics': return renderAnalytics(el);
    case 'settings': return renderSettings(el);
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

function badgeClass(status) {
  return 'badge badge-' + (status || 'open');
}

function priorityClass(p) {
  return 'priority-dot priority-' + (p || 'medium');
}

function docIcon(type) {
  const map = { pdf: 'PDF', markdown: 'MD', text: 'TXT', html: 'HTM', docx: 'DOC' };
  return `<div class="doc-icon doc-icon-${type}">${map[type] || 'DOC'}</div>`;
}

function promptTypeClass(type) {
  return 'prompt-card-type type-' + (type || 'rules');
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confidenceColor(c) {
  if (c >= 80) return 'var(--green)';
  if (c >= 50) return 'var(--amber)';
  return 'var(--red)';
}

// ============ DASHBOARD ============
async function renderDashboard(el) {
  const [tickets, docs, analytics, escalated] = await Promise.all([
    api('/tickets?limit=10'),
    api('/documents'),
    api('/analytics'),
    api('/tickets/escalated')
  ]);
  state.tickets = tickets; state.documents = docs; state.analytics = analytics;

  const open = analytics.statusBreakdown?.open || 0;
  const esc = analytics.statusBreakdown?.escalated || 0;
  const avgTime = analytics.avgResolutionTimeMs ? Math.round(analytics.avgResolutionTimeMs / 60000) + ' min' : '--';

  el.innerHTML = `
    <h1>Dashboard</h1>
    <p class="page-subtitle">Support operations overview</p>
    
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
            `).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px">No tickets yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============ KNOWLEDGE BASE ============
let kbTab = 'documents';

async function renderKnowledge(el) {
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
      `).join('') : '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px">No documents uploaded yet. Upload your first document to build your knowledge base.</p>'}
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
}

async function deleteDocument(id) {
  if (!confirm('Delete this document and all its chunks?')) return;
  await api(`/documents/${id}`, { method: 'DELETE' });
  closeModal();
  toast('Document deleted', 'success');
  renderKnowledge($('#page-content'));
}

function renderSearch(el) {
  el.innerHTML = `
    <div class="search-input mb-16" style="max-width:500px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="kb-search" placeholder="Search your knowledge base..." onkeydown="if(event.key==='Enter')doSearch()">
    </div>
    <div id="search-results"></div>
  `;
}

async function doSearch() {
  const q = $('#kb-search').value.trim();
  if (!q) return;
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
  `).join('') : '<p style="color:var(--text-muted);padding:20px;text-align:center">No results found</p>';
}

function renderUpload(el) {
  el.innerHTML = `
    <div class="upload-zone" id="upload-zone" onclick="$('#file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleDrop(event)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>Drop files here or click to upload</p>
      <p class="upload-hint">Supports PDF, Markdown, Text, HTML files (max 50MB)</p>
    </div>
    <input type="file" id="file-input" hidden accept=".pdf,.md,.txt,.html,.htm,.docx" onchange="uploadFile(this.files[0])">
    
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
    toast('Upload failed', 'error');
  }
}

// ============ PROMPTS ============
let promptFilter = 'all';

async function renderPrompts(el) {
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
      ${filtered.map(p => `
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
      `).join('')}
    </div>
  `;
}

async function togglePrompt(id, enabled) {
  await api(`/prompts/${id}`, { method: 'PUT', body: { enabled } });
  toast(enabled ? 'Prompt enabled' : 'Prompt disabled', 'info');
}

async function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  await api(`/prompts/${id}`, { method: 'DELETE' });
  toast('Prompt deleted', 'success');
  renderPrompts($('#page-content'));
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
  
  if (id) {
    await api(`/prompts/${id}`, { method: 'PUT', body: data });
  } else {
    await api('/prompts', { method: 'POST', body: data });
  }
  closeModal();
  toast('Prompt saved', 'success');
  renderPrompts($('#page-content'));
}

// ============ CHANNELS ============
async function renderChannels(el) {
  const [channels, guides] = await Promise.all([api('/channels'), api('/channels/guides')]);
  state.channels = channels;
  state.guides = guides;
  
  const channelMap = {};
  channels.forEach(c => { channelMap[c.platform] = c; });

  el.innerHTML = `
    <h1>Support Channels</h1>
    <p class="page-subtitle">Connect your support platforms to route conversations to the AI</p>

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
              ${status.charAt(0).toUpperCase() + status.slice(1)}
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
      <input type="text" id="ch-apikey" value="${escHtml(existing?.config?.apiKey || '')}" placeholder="Enter your ${guide.name} API key">
    </div>
    <div class="form-group">
      <label>Webhook Secret</label>
      <input type="text" id="ch-secret" value="${escHtml(existing?.config?.secret || '')}" placeholder="Webhook verification secret">
    </div>
    <div class="form-group">
      <label>Additional Config (subdomain, property ID, etc.)</label>
      <input type="text" id="ch-extra" value="${escHtml(existing?.config?.extra || '')}" placeholder="Platform-specific configuration">
    </div>
  `, `
    ${existing ? `<button class="btn btn-danger" onclick="deleteChannel('${existing.id}')">Disconnect</button>` : ''}
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveChannel('${platform}', '${existing?.id || ''}')">${existing ? 'Update' : 'Connect'}</button>
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
  
  if (existingId) {
    await api(`/channels/${existingId}`, { method: 'PUT', body: data });
  } else {
    await api('/channels', { method: 'POST', body: data });
  }
  closeModal();
  toast(`${platform} connected`, 'success');
  renderChannels($('#page-content'));
}

async function deleteChannel(id) {
  await api(`/channels/${id}`, { method: 'DELETE' });
  closeModal();
  toast('Channel disconnected', 'success');
  renderChannels($('#page-content'));
}

// ============ TICKETS ============
let ticketFilter = {};

async function renderTickets(el) {
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
        <option value="open">Open</option>
        <option value="pending">Pending</option>
        <option value="escalated">Escalated</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
      <select onchange="ticketFilter.priority=this.value;renderTickets($('#page-content'))">
        <option value="">All Priority</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <select onchange="ticketFilter.assignedTo=this.value;renderTickets($('#page-content'))">
        <option value="">All Assignees</option>
        <option value="ai">AI</option>
        <option value="human">Human</option>
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
            `).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px">No tickets found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function viewTicket(id) {
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
}

async function addMessage(ticketId) {
  const input = $('#msg-input');
  if (!input.value.trim()) return;
  const ticket = await api(`/tickets/${ticketId}`);
  ticket.messages.push({ role: 'system', content: input.value, timestamp: new Date().toISOString() });
  await api(`/tickets/${ticketId}`, { method: 'PUT', body: { messages: ticket.messages } });
  toast('Note added', 'success');
  viewTicket(ticketId);
}

async function escalateTicket(id) {
  const reason = prompt('Escalation reason:');
  if (reason === null) return;
  await api(`/tickets/${id}/escalate`, { method: 'POST', body: { reason } });
  toast('Ticket escalated', 'info');
  viewTicket(id);
}

async function resolveTicket(id) {
  await api(`/tickets/${id}/resolve`, { method: 'POST', body: {} });
  toast('Ticket resolved', 'success');
  viewTicket(id);
}

async function updateTicketPriority(id) {
  const p = prompt('Priority (low/medium/high/urgent):');
  if (!p || !['low', 'medium', 'high', 'urgent'].includes(p)) return;
  await api(`/tickets/${id}`, { method: 'PUT', body: { priority: p } });
  toast('Priority updated', 'success');
  viewTicket(id);
}

function createTicket() {
  showModal('New Ticket', `
    <div class="form-group"><label>Subject</label><input type="text" id="new-subject" placeholder="Ticket subject"></div>
    <div class="form-group"><label>Customer Name</label><input type="text" id="new-name" placeholder="Customer name"></div>
    <div class="form-group"><label>Customer Email</label><input type="text" id="new-email" placeholder="customer@example.com"></div>
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
  await api('/tickets', { method: 'POST', body: data });
  closeModal();
  toast('Ticket created', 'success');
  renderTickets($('#page-content'));
}

// ============ ANALYTICS ============
async function renderAnalytics(el) {
  const analytics = await api('/analytics');

  const statusColors = { open: 'var(--accent)', pending: 'var(--amber)', escalated: 'var(--red)', resolved: 'var(--green)', closed: 'var(--text-muted)' };
  const statusData = Object.entries(analytics.statusBreakdown || {});
  const maxStatus = Math.max(...statusData.map(([,v]) => v), 1);
  
  const priorityColors = { low: 'var(--green)', medium: 'var(--accent)', high: 'var(--amber)', urgent: 'var(--red)' };
  const priorityData = Object.entries(analytics.priorityBreakdown || {});
  const maxPriority = Math.max(...priorityData.map(([,v]) => v), 1);

  const platformData = Object.entries(analytics.platformBreakdown || {});
  const maxPlatform = Math.max(...platformData.map(([,v]) => v), 1);

  el.innerHTML = `
    <h1>Analytics</h1>
    <p class="page-subtitle">Support performance metrics</p>

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
          `).join('') : '<p style="color:var(--text-muted);width:100%;text-align:center">No data</p>'}
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
          `).join('') : '<p style="color:var(--text-muted);width:100%;text-align:center">No data</p>'}
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
          `).join('') : '<p style="color:var(--text-muted);width:100%;text-align:center">No data</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Top Topics</h3>
        ${analytics.topTopics?.length ? analytics.topTopics.map(([tag, count]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="badge badge-open">${escHtml(tag)}</span>
            <span style="font-size:13px;font-weight:600">${count}</span>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">No topics yet. Tags on tickets will appear here.</p>'}
      </div>
    </div>
  `;
}

// ============ SETTINGS ============
async function renderSettings(el) {
  const config = await api('/config');
  state.config = config;

  el.innerHTML = `
    <h1>Settings</h1>
    <p class="page-subtitle">General support configuration</p>

    <div class="card" style="max-width:600px">
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
  await api('/config', { method: 'PUT', body: data });
  toast('Settings saved', 'success');
}

// ============ Init ============
render();
