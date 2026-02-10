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
