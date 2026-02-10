# Customer Support Rep — Emika AI Employee

AI-powered customer support agent with RAG knowledge base, configurable behavior prompts, multi-channel integration, ticket management, and human escalation.

## Features

- **RAG Knowledge Base** — Upload PDFs, Markdown, text files. Auto-chunked and searchable via BM25
- **Behavior Prompts** — Configure AI tone, rules, escalation triggers, templates
- **8 Channel Integrations** — Intercom, Zendesk, Crisp, Freshdesk, Help Scout, LiveChat, Drift, Tawk.to
- **Ticket Management** — Priority, status, chat threads, confidence scoring
- **Human Escalation** — Auto-escalate on low confidence, legal triggers, or manual override
- **Analytics** — Resolution rates, escalation rates, channel breakdown, top topics

## Quick Start

```bash
npm install
node server.js
```

Dashboard at `http://localhost:3000`

## Stack

- Express.js server with JSON file storage
- Static SPA frontend (vanilla JS, no framework)
- BM25 search engine (no external API dependencies)
- PDF text extraction via pdf-parse
