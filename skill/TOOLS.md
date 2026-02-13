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


## Browser & Screenshots (Playwright)

Playwright and Chromium are pre-installed. Use them for browsing websites, taking screenshots, scraping content, and testing.

```bash
# Quick screenshot
npx playwright screenshot --full-page https://example.com screenshot.png

# In Node.js
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://example.com");
await page.screenshot({ path: "screenshot.png", fullPage: true });
await browser.close();
```

Do NOT install Puppeteer or download Chromium — Playwright is already here and ready to use.


## File & Image Sharing (Upload API)

To share files or images with the user, upload them to the Emika API and include the URL in your response.

```bash
# Upload a file (use your gateway token from openclaw.json)
TOKEN=$(cat /home/node/.openclaw/openclaw.json | grep -o "\"token\":\"[^\"]*" | head -1 | cut -d\" -f4)

curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/path/to/file.png" | jq -r .full_url
```

The response includes `full_url` — a public URL you can send to the user. Example:
- `https://api.emika.ai/uploads/seats/f231-27bd_abc123def456.png`

### Common workflow: Screenshot → Upload → Share
```bash
# Take screenshot with Playwright
npx playwright screenshot --full-page https://example.com /tmp/screenshot.png

# Upload to API
TOKEN=$(cat /home/node/.openclaw/openclaw.json | grep -o "\"token\":\"[^\"]*" | head -1 | cut -d\" -f4)
URL=$(curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/tmp/screenshot.png" | jq -r .full_url)

echo "Screenshot: $URL"
# Then include $URL in your response to the user
```

Supported: images (png, jpg, gif, webp), documents (pdf, doc, xlsx), code files, archives. Max 50MB.
