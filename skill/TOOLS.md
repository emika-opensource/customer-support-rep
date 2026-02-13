# Support Hub API Reference

Base URL: `http://localhost:3000`

## Knowledge Base

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/:id` | Get document with content |
| GET | `/api/documents/:id/chunks` | Get document chunks |
| POST | `/api/documents` | Upload document (multipart: file, name, category, tags) |
| DELETE | `/api/documents/:id` | Delete document and chunks |
| GET | `/api/search?q=query&limit=5` | BM25 search across all chunks |

Search returns: `[{ chunkId, documentId, documentName, content, score, position }]`

## Behavior Prompts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prompts` | List all prompts |
| GET | `/api/prompts/active` | Get enabled prompts (sorted by priority) |
| POST | `/api/prompts` | Create prompt `{ name, type, content, enabled, priority }` |
| PUT | `/api/prompts/:id` | Update prompt |
| DELETE | `/api/prompts/:id` | Delete prompt |

Types: `tone`, `rules`, `escalation`, `template`, `product`

## Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/channels` | List configured channels |
| GET | `/api/channels/guides` | Get setup guides for all platforms |
| POST | `/api/channels` | Add channel `{ platform, status, config }` |
| PUT | `/api/channels/:id` | Update channel |
| DELETE | `/api/channels/:id` | Remove channel |

Platforms: `intercom`, `zendesk`, `crisp`, `freshdesk`, `helpscout`, `livechat`, `drift`, `tawk`

## Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (filter: ?status, ?priority, ?assignedTo, ?platform, ?limit) |
| GET | `/api/tickets/:id` | Get ticket detail |
| GET | `/api/tickets/escalated` | Get escalated tickets |
| POST | `/api/tickets` | Create ticket `{ subject, customerName, customerEmail, priority, messages, tags }` |
| PUT | `/api/tickets/:id` | Update ticket |
| POST | `/api/tickets/:id/escalate` | Escalate `{ reason }` |
| POST | `/api/tickets/:id/resolve` | Resolve `{ note }` |

## Config & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get settings |
| PUT | `/api/config` | Update settings |
| GET | `/api/analytics` | Get support stats |

## Screenshots & File Sharing

### Taking Screenshots
Use Playwright (pre-installed) to capture any website:
```bash
npx playwright screenshot --browser chromium https://example.com /tmp/screenshot.png
```

If Chromium is not installed yet, install it first:
```bash
npx playwright install chromium
```

### Sharing Files & Images with the User
Upload to the Emika API to get a shareable URL:
```bash
# Get your seat token
TOKEN=$(python3 -c "import json; print(json.load(open('/home/node/.openclaw/openclaw.json'))['gateway']['auth']['token'])")

# Upload any file
URL=$(curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/tmp/screenshot.png" | python3 -c "import sys,json; print(json.load(sys.stdin)['full_url'])")

# Include the URL in your response as markdown image
echo "![Screenshot]($URL)"
```

**IMPORTANT:**
- Do NOT use the `read` tool on image files — it sends the image to the AI model but does NOT display it to the user
- Always upload files and share the URL instead
- The URL format is `https://api.emika.ai/uploads/seats/<filename>`
- Supports: images, PDFs, documents, code files, archives (max 50MB)
