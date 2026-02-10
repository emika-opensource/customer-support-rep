const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Data directory
const DATA_DIR = fs.existsSync('/home/node/emika') 
  ? '/home/node/emika/support-hub' 
  : path.join(__dirname, 'data');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(path.join(DATA_DIR, 'uploads'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer config
const storage = multer.diskStorage({
  destination: path.join(DATA_DIR, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ============ Data helpers ============
function loadJSON(name, fallback = []) {
  const p = path.join(DATA_DIR, name);
  try { return fs.readJsonSync(p); } catch { return fallback; }
}
function saveJSON(name, data) {
  fs.writeJsonSync(path.join(DATA_DIR, name), data, { spaces: 2 });
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ============ BM25 Search Engine ============
const STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can','need',
  'to','of','in','for','on','with','at','by','from','as','into','through','during','before',
  'after','above','below','between','out','off','over','under','again','further','then','once',
  'here','there','when','where','why','how','all','both','each','few','more','most','other',
  'some','such','no','nor','not','only','own','same','so','than','too','very','and','but',
  'or','if','while','about','it','its','this','that','these','those','i','me','my','we','our',
  'you','your','he','him','his','she','her','they','them','their','what','which','who','whom']);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function extractKeywords(text) {
  const tokens = tokenize(text);
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50).map(e => e[0]);
}

function bm25Search(query, chunks, limit = 5) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];
  
  const N = chunks.length;
  const avgDl = chunks.reduce((s, c) => s + tokenize(c.content).length, 0) / (N || 1);
  const k1 = 1.5, b = 0.75;
  
  // Document frequency
  const df = {};
  chunks.forEach(chunk => {
    const unique = new Set(tokenize(chunk.content));
    unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
  });
  
  const scored = chunks.map(chunk => {
    const tokens = tokenize(chunk.content);
    const dl = tokens.length;
    const tf = {};
    tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    
    let score = 0;
    queryTokens.forEach(qt => {
      if (!tf[qt]) return;
      const idf = Math.log((N - (df[qt] || 0) + 0.5) / ((df[qt] || 0) + 0.5) + 1);
      const tfNorm = (tf[qt] * (k1 + 1)) / (tf[qt] + k1 * (1 - b + b * dl / avgDl));
      score += idf * tfNorm;
    });
    
    return { ...chunk, score };
  }).filter(c => c.score > 0);
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ============ Text extraction ============
async function extractText(filePath, mimetype, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  
  if (ext === '.pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const buf = await fs.readFile(filePath);
      const data = await pdfParse(buf);
      return data.text;
    } catch (e) {
      return `[PDF extraction failed: ${e.message}]`;
    }
  }
  
  if (['.md', '.txt', '.html', '.htm', '.docx'].includes(ext)) {
    return await fs.readFile(filePath, 'utf-8');
  }
  
  return await fs.readFile(filePath, 'utf-8');
}

function chunkText(text, chunkSize = 500) {
  const sentences = text.replace(/\r\n/g, '\n').split(/(?<=[.!?\n])\s+/);
  const chunks = [];
  let current = '';
  let pos = 0;
  
  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push({ content: current.trim(), position: pos++ });
      current = '';
    }
    current += sentence + ' ';
  }
  if (current.trim()) {
    chunks.push({ content: current.trim(), position: pos });
  }
  return chunks;
}

function getDocType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = { '.pdf': 'pdf', '.md': 'markdown', '.txt': 'text', '.html': 'html', '.htm': 'html', '.docx': 'docx' };
  return map[ext] || 'text';
}

// ============ Initialize defaults ============
function initDefaults() {
  // Default prompts
  if (!loadJSON('prompts.json').length) {
    saveJSON('prompts.json', [
      { id: genId(), name: 'Friendly and Professional Tone', type: 'tone', content: 'Always maintain a friendly, warm, and professional tone. Use the customer\'s name when available. Be empathetic and understanding. Avoid jargon unless the customer uses it first. Keep responses concise but thorough.', enabled: true, priority: 1, createdAt: new Date().toISOString() },
      { id: genId(), name: 'Always Greet by Name', type: 'tone', content: 'When the customer\'s name is known, always greet them by name at the start of the conversation. Example: "Hi Sarah, thanks for reaching out!" For follow-ups: "Thanks for getting back to us, Sarah."', enabled: true, priority: 2, createdAt: new Date().toISOString() },
      { id: genId(), name: 'Legal Escalation Trigger', type: 'escalation', content: 'IMMEDIATELY escalate to a human agent if the customer mentions any of the following: lawyer, attorney, legal action, lawsuit, sue, litigation, court, regulatory complaint, BBB complaint, consumer protection. Do NOT attempt to resolve legal matters. Respond with: "I want to make sure you get the best possible help. Let me connect you with a senior team member right away."', enabled: true, priority: 1, createdAt: new Date().toISOString() },
      { id: genId(), name: 'No Competitor Pricing Discussion', type: 'rules', content: 'Never discuss competitor pricing, compare our product to competitors by price, or acknowledge specific competitor prices. If asked, redirect: "I\'d love to focus on how our product can help you. Let me walk you through what we offer and the value you\'ll get."', enabled: true, priority: 3, createdAt: new Date().toISOString() },
      { id: genId(), name: 'Refund Policy — 48hr Wait', type: 'template', content: 'If a customer has been waiting more than 48 hours for a resolution or delivery, proactively offer a refund or compensation. Template: "I sincerely apologize for the wait. Since it\'s been over 48 hours, I\'d like to offer you [refund/credit/compensation]. Would that work for you?"', enabled: false, priority: 4, createdAt: new Date().toISOString() },
    ]);
  }
  
  // Default config
  const cfg = loadJSON('config.json', null);
  if (!cfg) {
    saveJSON('config.json', {
      companyName: '',
      supportEmail: '',
      workingHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
      escalationThreshold: 70,
      autoGreet: true,
      slaTargetMinutes: 60
    });
  }
}
initDefaults();

// ============ ROUTES: Documents ============
app.get('/api/documents', (req, res) => {
  res.json(loadJSON('documents.json'));
});

app.get('/api/documents/:id', (req, res) => {
  const docs = loadJSON('documents.json');
  const doc = docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  
  // Include content
  const chunks = loadJSON('knowledge-chunks.json').filter(c => c.documentId === doc.id);
  const content = chunks.sort((a, b) => a.position - b.position).map(c => c.content).join('\n\n');
  res.json({ ...doc, content });
});

app.get('/api/documents/:id/chunks', (req, res) => {
  const chunks = loadJSON('knowledge-chunks.json').filter(c => c.documentId === req.params.id);
  res.json(chunks.sort((a, b) => a.position - b.position));
});

app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
    const textChunks = chunkText(text);
    
    const docId = genId();
    const doc = {
      id: docId,
      name: req.body.name || req.file.originalname.replace(/\.[^.]+$/, ''),
      filename: req.file.originalname,
      type: getDocType(req.file.originalname),
      category: req.body.category || 'general',
      tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
      chunkCount: textChunks.length,
      uploadedAt: new Date().toISOString(),
      size: req.file.size
    };
    
    const docs = loadJSON('documents.json');
    docs.push(doc);
    saveJSON('documents.json', docs);
    
    // Save chunks with keywords
    const allChunks = loadJSON('knowledge-chunks.json');
    textChunks.forEach(chunk => {
      allChunks.push({
        id: genId(),
        documentId: docId,
        content: chunk.content,
        keywords: extractKeywords(chunk.content),
        position: chunk.position
      });
    });
    saveJSON('knowledge-chunks.json', allChunks);
    
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/documents/:id', (req, res) => {
  let docs = loadJSON('documents.json');
  docs = docs.filter(d => d.id !== req.params.id);
  saveJSON('documents.json', docs);
  
  let chunks = loadJSON('knowledge-chunks.json');
  chunks = chunks.filter(c => c.documentId !== req.params.id);
  saveJSON('knowledge-chunks.json', chunks);
  
  res.json({ success: true });
});

// ============ ROUTES: Search ============
app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  const limit = parseInt(req.query.limit) || 5;
  if (!q.trim()) return res.json([]);
  
  const chunks = loadJSON('knowledge-chunks.json');
  const docs = loadJSON('documents.json');
  const docMap = {};
  docs.forEach(d => { docMap[d.id] = d.name; });
  
  const results = bm25Search(q, chunks, limit).map(r => ({
    chunkId: r.id,
    documentId: r.documentId,
    documentName: docMap[r.documentId] || 'Unknown',
    content: r.content,
    score: Math.round(r.score * 100) / 100,
    position: r.position
  }));
  
  res.json(results);
});

// ============ ROUTES: Prompts ============
app.get('/api/prompts', (req, res) => res.json(loadJSON('prompts.json')));

app.get('/api/prompts/active', (req, res) => {
  res.json(loadJSON('prompts.json').filter(p => p.enabled).sort((a, b) => a.priority - b.priority));
});

app.post('/api/prompts', (req, res) => {
  const prompts = loadJSON('prompts.json');
  const prompt = { id: genId(), ...req.body, createdAt: new Date().toISOString() };
  prompts.push(prompt);
  saveJSON('prompts.json', prompts);
  res.json(prompt);
});

app.put('/api/prompts/:id', (req, res) => {
  const prompts = loadJSON('prompts.json');
  const idx = prompts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  prompts[idx] = { ...prompts[idx], ...req.body };
  saveJSON('prompts.json', prompts);
  res.json(prompts[idx]);
});

app.delete('/api/prompts/:id', (req, res) => {
  let prompts = loadJSON('prompts.json');
  prompts = prompts.filter(p => p.id !== req.params.id);
  saveJSON('prompts.json', prompts);
  res.json({ success: true });
});

// ============ ROUTES: Channels ============
app.get('/api/channels', (req, res) => res.json(loadJSON('channels.json')));

app.get('/api/channels/guides', (req, res) => {
  res.json([
    {
      platform: 'intercom', name: 'Intercom', description: 'Modern customer messaging platform with live chat, bots, and help center.',
      logoPlaceholder: 'IC',
      setupSteps: [
        'Go to Intercom Settings > Developers > Webhooks',
        'Add a new webhook with your Support Hub URL: https://your-domain.com/webhooks/intercom',
        'Select events: conversation.created, conversation.user.replied, conversation.admin.replied',
        'Copy the webhook secret and paste it in the API Secret field below',
        'Go to Settings > Developers > Access Token and create a new token with read/write conversations scope',
        'Paste the access token in the API Token field below',
        'Test the connection to verify everything works'
      ],
      webhookConfig: { url: '/webhooks/intercom', events: ['conversation.created', 'conversation.user.replied', 'conversation.admin.replied', 'conversation.admin.closed'], secret: 'Required' },
      apiEndpoints: ['https://api.intercom.io/conversations', 'https://api.intercom.io/conversations/{id}/reply', 'https://api.intercom.io/contacts'],
      authType: 'Bearer Token',
      features: ['Live Chat', 'Chatbots', 'Help Center', 'Product Tours', 'Custom Bots']
    },
    {
      platform: 'zendesk', name: 'Zendesk', description: 'Enterprise customer service and engagement platform with ticketing, chat, and knowledge base.',
      logoPlaceholder: 'ZD',
      setupSteps: [
        'Go to Zendesk Admin Center > Apps and Integrations > Webhooks',
        'Create a new webhook pointing to: https://your-domain.com/webhooks/zendesk',
        'Set authentication to Bearer Token and generate a token',
        'Go to Business Rules > Triggers and create triggers for: Ticket Created, Ticket Updated, Comment Added',
        'In each trigger, add action "Notify webhook" and select your webhook',
        'Go to Admin > Channels > API and generate an API token',
        'Enter your subdomain (yourcompany.zendesk.com) and API token below'
      ],
      webhookConfig: { url: '/webhooks/zendesk', events: ['ticket.created', 'ticket.updated', 'comment.added'], secret: 'Required' },
      apiEndpoints: ['https://{subdomain}.zendesk.com/api/v2/tickets', 'https://{subdomain}.zendesk.com/api/v2/tickets/{id}/comments', 'https://{subdomain}.zendesk.com/api/v2/users'],
      authType: 'API Token (email/token)',
      features: ['Ticketing', 'Live Chat', 'Knowledge Base', 'Community Forums', 'Automations']
    },
    {
      platform: 'crisp', name: 'Crisp', description: 'All-in-one business messaging platform with live chat, chatbot, and CRM.',
      logoPlaceholder: 'CR',
      setupSteps: [
        'Go to Crisp Dashboard > Settings > Plugins',
        'Install the "Webhook" plugin from the marketplace',
        'Configure the webhook URL: https://your-domain.com/webhooks/crisp',
        'Select events: message:send, message:received, session:set_data',
        'Go to Settings > Website Settings and copy your Website ID',
        'Generate a REST API token pair (Identifier + Key) from the API console at https://app.crisp.chat/settings/token/',
        'Enter the Website ID, Token ID, and Token Key below'
      ],
      webhookConfig: { url: '/webhooks/crisp', events: ['message:send', 'message:received', 'session:set_data', 'session:removed'], secret: 'Token pair' },
      apiEndpoints: ['https://api.crisp.chat/v1/website/{website_id}/conversation', 'https://api.crisp.chat/v1/website/{website_id}/conversation/{session_id}/message', 'https://api.crisp.chat/v1/website/{website_id}/conversation/{session_id}/meta'],
      authType: 'Token ID + Token Key (Basic Auth)',
      features: ['Live Chat', 'Chatbot', 'CRM', 'Knowledge Base', 'Status Page']
    },
    {
      platform: 'freshdesk', name: 'Freshdesk', description: 'Cloud-based customer support software with ticketing, automations, and self-service portal.',
      logoPlaceholder: 'FD',
      setupSteps: [
        'Go to Freshdesk Admin > Automations > Webhook',
        'Create new automation rules for: Ticket Created, Ticket Updated, Reply Added',
        'Set the webhook URL to: https://your-domain.com/webhooks/freshdesk',
        'Go to your Profile > API Key and copy your personal API key',
        'Enter your Freshdesk domain (yourcompany.freshdesk.com) and API key below',
        'Optionally configure ticket field mappings for priority and status sync'
      ],
      webhookConfig: { url: '/webhooks/freshdesk', events: ['ticket.created', 'ticket.updated', 'note.added'], secret: 'API Key' },
      apiEndpoints: ['https://{domain}.freshdesk.com/api/v2/tickets', 'https://{domain}.freshdesk.com/api/v2/tickets/{id}/reply', 'https://{domain}.freshdesk.com/api/v2/tickets/{id}/notes'],
      authType: 'API Key (Basic Auth)',
      features: ['Ticketing', 'Automations', 'Self-Service Portal', 'SLA Management', 'Canned Responses']
    },
    {
      platform: 'helpscout', name: 'Help Scout', description: 'Customer service platform focused on email-based support with shared inboxes and docs.',
      logoPlaceholder: 'HS',
      setupSteps: [
        'Go to Help Scout > Manage > Apps > Webhooks',
        'Create a new webhook with URL: https://your-domain.com/webhooks/helpscout',
        'Select events: convo.created, convo.customer.reply.created, convo.agent.reply.created, convo.note.created',
        'Copy the webhook secret key for verification',
        'Go to Manage > Apps > My Apps and create a new OAuth2 application (or use API Keys)',
        'Generate an API key from your Profile > Authentication > API Keys',
        'Enter the API key and webhook secret below'
      ],
      webhookConfig: { url: '/webhooks/helpscout', events: ['convo.created', 'convo.customer.reply.created', 'convo.agent.reply.created', 'convo.assigned'], secret: 'Webhook secret' },
      apiEndpoints: ['https://api.helpscout.net/v2/conversations', 'https://api.helpscout.net/v2/conversations/{id}/threads', 'https://api.helpscout.net/v2/customers'],
      authType: 'API Key or OAuth2',
      features: ['Shared Inbox', 'Knowledge Base (Docs)', 'Customer Profiles', 'Workflows', 'Reporting']
    },
    {
      platform: 'livechat', name: 'LiveChat', description: 'Live chat and help desk software for online sales and customer support.',
      logoPlaceholder: 'LC',
      setupSteps: [
        'Go to LiveChat Developer Console at https://developers.livechat.com/console/',
        'Create a new server-side app and enable Bot Agents',
        'Register a webhook with URL: https://your-domain.com/webhooks/livechat',
        'Subscribe to events: incoming_chat, incoming_event, chat_deactivated',
        'Configure the bot agent to handle initial conversations',
        'Set up agent takeover rules for escalation (transfer chat to human agent)',
        'Enter your API access token and organization ID below'
      ],
      webhookConfig: { url: '/webhooks/livechat', events: ['incoming_chat', 'incoming_event', 'chat_deactivated', 'agent_added'], secret: 'Client Secret' },
      apiEndpoints: ['https://api.livechatinc.com/v3.5/agent/action/send_event', 'https://api.livechatinc.com/v3.5/agent/action/transfer_chat', 'https://api.livechatinc.com/v3.5/agent/action/list_chats'],
      authType: 'Personal Access Token or OAuth2',
      features: ['Live Chat', 'Bot Agents', 'Ticketing', 'Chat Transfers', 'Canned Responses']
    },
    {
      platform: 'drift', name: 'Drift', description: 'Conversational marketing and sales platform with chatbots, live chat, and meetings.',
      logoPlaceholder: 'DR',
      setupSteps: [
        'Go to Drift Settings > App Settings > Developer',
        'Create a new custom app or use the API token',
        'Set up a webhook endpoint: https://your-domain.com/webhooks/drift',
        'Subscribe to events: new_message, new_conversation, conversation_status_updated',
        'Create a bot playbook that routes conversations to your webhook',
        'Configure the bot to collect initial information before handoff',
        'Enter your API token and verification token below'
      ],
      webhookConfig: { url: '/webhooks/drift', events: ['new_message', 'new_conversation', 'conversation_status_updated', 'contact_identified'], secret: 'Verification token' },
      apiEndpoints: ['https://driftapi.com/conversations', 'https://driftapi.com/conversations/{id}/messages', 'https://driftapi.com/contacts'],
      authType: 'OAuth2 Bearer Token',
      features: ['Live Chat', 'Chatbots', 'Playbooks', 'Meeting Scheduling', 'Account-Based Marketing']
    },
    {
      platform: 'tawk', name: 'Tawk.to', description: 'Free live chat and customer communication platform with ticketing and knowledge base.',
      logoPlaceholder: 'TW',
      setupSteps: [
        'Go to Tawk.to Dashboard > Administration > Settings > Webhooks',
        'Add a new webhook URL: https://your-domain.com/webhooks/tawk',
        'Enable events: chat:start, chat:end, ticket:create, chat:transcript',
        'Go to Administration > Settings > REST API and generate an API key',
        'Note your Property ID and Widget ID from the dashboard URL',
        'Enter the API key, Property ID, and webhook settings below',
        'Test by starting a chat on your website'
      ],
      webhookConfig: { url: '/webhooks/tawk', events: ['chat:start', 'chat:end', 'ticket:create', 'chat:transcript'], secret: 'None (IP whitelist recommended)' },
      apiEndpoints: ['https://api.tawk.to/v3/property/{propertyId}/chat', 'https://api.tawk.to/v3/property/{propertyId}/ticket', 'https://api.tawk.to/v3/property/{propertyId}/visitor'],
      authType: 'REST API Key',
      features: ['Live Chat', 'Ticketing', 'Knowledge Base', 'Video + Voice Chat', 'Visitor Monitoring']
    }
  ]);
});

app.post('/api/channels', (req, res) => {
  const channels = loadJSON('channels.json');
  const channel = { id: genId(), ...req.body, connectedAt: new Date().toISOString(), lastActivity: null };
  channels.push(channel);
  saveJSON('channels.json', channels);
  res.json(channel);
});

app.put('/api/channels/:id', (req, res) => {
  const channels = loadJSON('channels.json');
  const idx = channels.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  channels[idx] = { ...channels[idx], ...req.body };
  saveJSON('channels.json', channels);
  res.json(channels[idx]);
});

app.delete('/api/channels/:id', (req, res) => {
  let channels = loadJSON('channels.json');
  channels = channels.filter(c => c.id !== req.params.id);
  saveJSON('channels.json', channels);
  res.json({ success: true });
});

// ============ ROUTES: Tickets ============
app.get('/api/tickets', (req, res) => {
  let tickets = loadJSON('tickets.json');
  if (req.query.status) tickets = tickets.filter(t => t.status === req.query.status);
  if (req.query.priority) tickets = tickets.filter(t => t.priority === req.query.priority);
  if (req.query.assignedTo) tickets = tickets.filter(t => t.assignedTo === req.query.assignedTo);
  if (req.query.platform) tickets = tickets.filter(t => t.platform === req.query.platform);
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (req.query.limit) tickets = tickets.slice(0, parseInt(req.query.limit));
  res.json(tickets);
});

app.get('/api/tickets/escalated', (req, res) => {
  res.json(loadJSON('tickets.json').filter(t => t.status === 'escalated').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/tickets/:id', (req, res) => {
  const ticket = loadJSON('tickets.json').find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json(ticket);
});

app.post('/api/tickets', (req, res) => {
  const tickets = loadJSON('tickets.json');
  const ticket = {
    id: genId(),
    channelId: req.body.channelId || null,
    platform: req.body.platform || 'manual',
    externalId: req.body.externalId || null,
    customerName: req.body.customerName || 'Unknown',
    customerEmail: req.body.customerEmail || '',
    subject: req.body.subject || 'New Ticket',
    messages: req.body.messages || [],
    status: 'open',
    priority: req.body.priority || 'medium',
    assignedTo: req.body.assignedTo || 'ai',
    tags: req.body.tags || [],
    confidence: req.body.confidence || 100,
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };
  tickets.push(ticket);
  saveJSON('tickets.json', tickets);
  res.json(ticket);
});

app.put('/api/tickets/:id', (req, res) => {
  const tickets = loadJSON('tickets.json');
  const idx = tickets.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tickets[idx] = { ...tickets[idx], ...req.body };
  saveJSON('tickets.json', tickets);
  res.json(tickets[idx]);
});

app.post('/api/tickets/:id/escalate', (req, res) => {
  const tickets = loadJSON('tickets.json');
  const idx = tickets.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tickets[idx].status = 'escalated';
  tickets[idx].assignedTo = 'human';
  tickets[idx].messages.push({ role: 'system', content: 'Ticket escalated to human agent. Reason: ' + (req.body.reason || 'Manual escalation'), timestamp: new Date().toISOString() });
  saveJSON('tickets.json', tickets);
  res.json(tickets[idx]);
});

app.post('/api/tickets/:id/resolve', (req, res) => {
  const tickets = loadJSON('tickets.json');
  const idx = tickets.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tickets[idx].status = 'resolved';
  tickets[idx].resolvedAt = new Date().toISOString();
  tickets[idx].messages.push({ role: 'system', content: 'Ticket resolved' + (req.body.note ? ': ' + req.body.note : ''), timestamp: new Date().toISOString() });
  saveJSON('tickets.json', tickets);
  res.json(tickets[idx]);
});

// ============ ROUTES: Config ============
app.get('/api/config', (req, res) => res.json(loadJSON('config.json', {})));

app.put('/api/config', (req, res) => {
  const config = { ...loadJSON('config.json', {}), ...req.body };
  saveJSON('config.json', config);
  res.json(config);
});

// ============ ROUTES: Analytics ============
app.get('/api/analytics', (req, res) => {
  const tickets = loadJSON('tickets.json');
  const docs = loadJSON('documents.json');
  
  const statusCounts = {};
  const priorityCounts = {};
  const platformCounts = {};
  const tagCounts = {};
  let totalResolutionTime = 0;
  let resolvedCount = 0;
  
  tickets.forEach(t => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    platformCounts[t.platform] = (platformCounts[t.platform] || 0) + 1;
    (t.tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
    if (t.resolvedAt) {
      totalResolutionTime += new Date(t.resolvedAt) - new Date(t.createdAt);
      resolvedCount++;
    }
  });
  
  res.json({
    totalTickets: tickets.length,
    statusBreakdown: statusCounts,
    priorityBreakdown: priorityCounts,
    platformBreakdown: platformCounts,
    topTopics: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    avgResolutionTimeMs: resolvedCount ? Math.round(totalResolutionTime / resolvedCount) : 0,
    escalationRate: tickets.length ? Math.round((statusCounts.escalated || 0) / tickets.length * 100) : 0,
    resolutionRate: tickets.length ? Math.round(resolvedCount / tickets.length * 100) : 0,
    totalDocuments: docs.length,
    totalChunks: loadJSON('knowledge-chunks.json').length
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Support Hub running on port ${PORT}`));
