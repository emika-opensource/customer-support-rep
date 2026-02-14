---
name: customer-support-rep
description: AI customer support with RAG knowledge base, ticket management, behavior prompts, multi-channel support, and human escalation
---

## ⛔ NEVER write data as files. ALWAYS use the API.

## CRITICAL: Port 3000 Only
You MUST deploy ONLY on port 3000. Nginx ONLY proxies port 3000 — any other port will NOT be accessible.
If port 3000 is busy: `pm2 delete all` then `pm2 start your-app.js --name app` on port 3000.

## 🚨 Your App is ALREADY RUNNING
Your **Customer Support Hub** web application is ALREADY RUNNING on port 3000.
- **DO NOT** kill anything on port 3000
- **DO NOT** try to start a new server
- All API endpoints below are served by this app at `http://localhost:3000`

## 📁 File Uploads
Upload knowledge base documents (PDF, MD, TXT, HTML — max 50MB):
```bash
curl -X POST http://localhost:3000/api/documents \
  -F "file=@guide.pdf" \
  -F "name=Product Guide" \
  -F "category=product" \
  -F "tags=onboarding,setup"
```

## API Endpoints Summary

| Category | Endpoints |
|----------|-----------|
| Documents | `GET/POST /api/documents`, `GET/DELETE /api/documents/:id`, `GET /api/documents/:id/chunks` |
| Search | `GET /api/search?q=...` |
| Prompts | `GET/POST /api/prompts`, `GET /api/prompts/active`, `PUT/DELETE /api/prompts/:id` |
| Channels | `GET/POST /api/channels`, `GET /api/channels/guides`, `PUT/DELETE /api/channels/:id` |
| Tickets | `GET/POST /api/tickets`, `GET /api/tickets/escalated`, `GET/PUT /api/tickets/:id`, `POST /api/tickets/:id/escalate`, `POST /api/tickets/:id/resolve` |
| Config | `GET/PUT /api/config` |
| Analytics | `GET /api/analytics` |

## Detailed API Reference

### Documents (Knowledge Base)

**List all documents**:
```bash
curl http://localhost:3000/api/documents
```
Response: Array of document objects with `id`, `name`, `filename`, `type`, `category`, `tags`, `chunkCount`, `uploadedAt`, `size`.

**Get document with content**:
```bash
curl http://localhost:3000/api/documents/DOC_ID
```
Response: Document object with reassembled `content` from chunks.

**Get document chunks**:
```bash
curl http://localhost:3000/api/documents/DOC_ID/chunks
```
Response: Array of chunk objects sorted by position.

**Upload a document**:
```bash
curl -X POST http://localhost:3000/api/documents \
  -F "file=@knowledge-base.pdf" \
  -F "name=Product FAQ" \
  -F "category=faq" \
  -F "tags=product,billing,faq"
```
- Supported types: `.pdf`, `.md`, `.txt`, `.html`, `.htm`
- Max size: 50MB
- Auto-extracts text and creates searchable chunks

Response: Document object with `chunkCount`.

**Delete a document**:
```bash
curl -X DELETE http://localhost:3000/api/documents/DOC_ID
```
Also removes associated chunks. Response: `{ "success": true }`

### Search (BM25 Knowledge Base Search)

**Search knowledge base**:
```bash
curl "http://localhost:3000/api/search?q=how+to+reset+password&limit=5"
```
Response:
```json
[
  {
    "chunkId": "...",
    "documentId": "...",
    "documentName": "Product FAQ",
    "content": "To reset your password...",
    "score": 4.52,
    "position": 3
  }
]
```

### Prompts (Behavior Rules)

**List all prompts**:
```bash
curl http://localhost:3000/api/prompts
```

**Get active prompts** (enabled, sorted by priority):
```bash
curl http://localhost:3000/api/prompts/active
```

**Create a prompt**:
```bash
curl -X POST http://localhost:3000/api/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Friendly Tone",
    "type": "tone",
    "content": "Always be warm and professional...",
    "enabled": true,
    "priority": 1
  }'
```
- `type`: `tone` | `escalation` | `rules` | `template`
- `enabled`: boolean
- `priority`: number (lower = higher priority)

**Update a prompt**:
```bash
curl -X PUT http://localhost:3000/api/prompts/PROMPT_ID \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false, "content": "Updated content" }'
```

**Delete a prompt**:
```bash
curl -X DELETE http://localhost:3000/api/prompts/PROMPT_ID
```

### Channels

**List channels** (API keys masked):
```bash
curl http://localhost:3000/api/channels
```

**Get setup guides for supported platforms**:
```bash
curl http://localhost:3000/api/channels/guides
```
Returns setup guides for: Intercom, Zendesk, Crisp, Freshdesk, Help Scout, LiveChat, Drift, Tawk.to.

**Create a channel**:
```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "intercom",
    "name": "Main Intercom",
    "config": {
      "apiKey": "your-api-key",
      "webhookUrl": "https://your-domain.com/webhooks/intercom"
    },
    "enabled": true
  }'
```

**Update a channel**:
```bash
curl -X PUT http://localhost:3000/api/channels/CHANNEL_ID \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

**Delete a channel**:
```bash
curl -X DELETE http://localhost:3000/api/channels/CHANNEL_ID
```

### Tickets

**List tickets** (with filters):
```bash
curl http://localhost:3000/api/tickets
curl "http://localhost:3000/api/tickets?status=open&priority=high&limit=20"
curl "http://localhost:3000/api/tickets?platform=intercom&assignedTo=ai"
```
Filter params: `status`, `priority`, `assignedTo`, `platform`, `limit`.

**Get escalated tickets**:
```bash
curl http://localhost:3000/api/tickets/escalated
```

**Get a single ticket**:
```bash
curl http://localhost:3000/api/tickets/TICKET_ID
```

**Create a ticket**:
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Cannot login to my account",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "platform": "intercom",
    "priority": "high",
    "messages": [
      { "role": "customer", "content": "I cannot login...", "timestamp": "2025-01-01T10:00:00Z" }
    ],
    "tags": ["login", "authentication"]
  }'
```
- `subject` (required)
- `priority`: `low` | `medium` | `high` | `urgent` (default: `medium`)
- `assignedTo`: default `ai`

**Update a ticket**:
```bash
curl -X PUT http://localhost:3000/api/tickets/TICKET_ID \
  -H "Content-Type: application/json" \
  -d '{ "priority": "urgent", "tags": ["login", "critical"] }'
```

**Escalate a ticket** (to human agent):
```bash
curl -X POST http://localhost:3000/api/tickets/TICKET_ID/escalate \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Customer mentioned legal action" }'
```
Sets status to `escalated` and assignedTo to `human`.

**Resolve a ticket**:
```bash
curl -X POST http://localhost:3000/api/tickets/TICKET_ID/resolve \
  -H "Content-Type: application/json" \
  -d '{ "note": "Password reset link sent, customer confirmed access" }'
```
Sets status to `resolved` and records `resolvedAt`.

### Config

**Get config**:
```bash
curl http://localhost:3000/api/config
```
Response:
```json
{
  "companyName": "",
  "supportEmail": "",
  "workingHours": { "start": "09:00", "end": "17:00", "timezone": "UTC" },
  "escalationThreshold": 70,
  "autoGreet": true,
  "slaTargetMinutes": 60,
  "onboardingComplete": false
}
```

**Update config**:
```bash
curl -X PUT http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corp",
    "supportEmail": "support@acme.com",
    "onboardingComplete": true
  }'
```

### Analytics

**Get support analytics**:
```bash
curl http://localhost:3000/api/analytics
```
Response:
```json
{
  "totalTickets": 50,
  "statusBreakdown": { "open": 10, "resolved": 35, "escalated": 5 },
  "priorityBreakdown": { "low": 10, "medium": 25, "high": 12, "urgent": 3 },
  "platformBreakdown": { "intercom": 30, "manual": 20 },
  "topTopics": [["login", 8], ["billing", 6]],
  "avgResolutionTimeMs": 3600000,
  "escalationRate": 10,
  "resolutionRate": 70,
  "totalDocuments": 5,
  "totalChunks": 120
}
```
