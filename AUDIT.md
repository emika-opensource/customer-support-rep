# AUDIT.md — Customer Support Rep

**Date:** 2026-02-11  
**Verdict:** Solid foundation, but the first-run experience is a ghost town. A new user opens the dashboard and sees a bunch of zeros and empty tables. There's no guided setup, no sample data, and no clear "do this first" call-to-action. Time-to-first-value is poor.

---

## 1. First-Run Experience

**Rating: 3/10**

When a new user opens the dashboard for the first time:

1. They see a dashboard with all-zero stats (0 tickets, 0% resolution, 0 docs)
2. An empty "Recent Tickets" table saying "No tickets yet"
3. Three small buttons in the corner: "Upload Document", "Create Prompt", "View Channels"

**Problems:**
- No onboarding wizard, welcome modal, or guided flow
- No indication of what to do first or why
- The BOOTSTRAP.md has a great conversational onboarding flow, but it only fires when the AI agent starts a chat session — the **dashboard itself** gives zero guidance
- The pre-seeded behavior prompts (5 defaults) are invisible on the dashboard; user has to navigate to Prompts to discover them
- There's no "Getting Started" checklist or progress indicator
- A new user must independently figure out: upload docs → configure prompts → connect a channel → wait for tickets
- **Clicks to first value:** Minimum 4-5 (navigate to KB → click Upload tab → select file → fill form → upload). But "value" here is just a document sitting in a list — there's no way to actually test the AI's responses from the dashboard

**The fundamental problem:** The dashboard is a management console for an AI agent, but there's no way to interact with the AI agent from the dashboard. You can't ask it a test question, simulate a customer conversation, or preview how it would respond. The only way to get value is to connect an external channel and wait for real traffic.

---

## 2. UI/UX Issues

**Rating: 6/10 — The UI is clean and well-designed, but has functional gaps.**

- **No test/preview mode.** You can upload docs and configure prompts, but can't test the AI. This is the single biggest UX gap.
- **Channel setup is aspirational.** The guides are detailed but the webhook endpoints (`/webhooks/intercom`, etc.) don't actually exist in `server.js`. Saving channel config stores credentials but nothing actually connects. A user could complete the entire setup flow and think they're connected when they're not.
- **Ticket creation is manual-only.** The "New Ticket" button creates tickets but there's no inbound webhook handler to create them automatically. The AI agent would need to call the API, but there's no demonstration of this flow.
- **Priority change uses `prompt()`.** The "Change Priority" button uses a browser `prompt()` dialog asking the user to type "low/medium/high/urgent" — fragile, ugly, and error-prone.
- **Escalation uses `prompt()` too.** Same problem for escalation reason.
- **No confirmation on delete.** Document delete has a `confirm()` but channel delete does not.
- **Empty states are minimal.** The "No tickets yet" and "No documents" messages exist but don't include actionable CTAs (e.g., "Upload your first document →").
- **Search requires Enter key.** No search-as-you-type, no search button. User must know to press Enter.
- **Analytics is all zeros on first run.** No explanation that data will appear after tickets flow through.
- **Mobile responsive but cramped.** Sidebar collapses to icons but nav labels disappear — icons alone aren't enough for a complex app.
- **Settings page has no defaults filled in.** Company name, email, etc. are blank. The AI can't personalize anything until these are set, but nothing tells the user this matters.

---

## 3. Feature Completeness

**Rating: 5/10 — Core features exist but critical integration layer is missing.**

| Feature | Status | Notes |
|---------|--------|-------|
| Document upload & chunking | ✅ Working | BM25 search, PDF extraction, good chunking |
| Behavior prompts CRUD | ✅ Working | Good defaults, toggle, priority system |
| Ticket CRUD | ✅ Working | Create, escalate, resolve, filter |
| Channel guides | ⚠️ Display only | Setup guides render but webhook endpoints don't exist |
| Webhook handlers | ❌ Missing | No `/webhooks/*` routes in server.js |
| AI response generation | ❌ Missing | No actual AI inference — the server is a data layer only |
| Knowledge search | ✅ Working | BM25 works well for keyword search |
| Analytics | ✅ Working | Derived from ticket data, shows useful breakdowns |
| Settings | ✅ Working | Persists config |
| Test/Preview mode | ❌ Missing | Can't test the AI from the dashboard |
| `.docx` extraction | ❌ Broken | Listed as supported but just does `readFile(path, 'utf-8')` on binary docx files |
| `marked` dependency | ⚠️ Unused | Imported but never called |

**Key insight:** The server is a CRUD API + static file server. The AI agent (via SKILL.md) is expected to call these APIs to do the actual work. This is a valid architecture, but the dashboard gives no visibility into whether the AI is actually connected and working.

---

## 4. Error Handling

**Rating: 4/10**

- **Server-side:** Minimal. The upload endpoint has a try/catch, but most routes have none. A malformed JSON body would crash the request.
- **Client-side:** API calls don't have error handling. `api()` always calls `res.json()` even on error responses, but doesn't check `res.ok`. Network failures will throw uncaught promise rejections.
- **No loading states.** Page transitions call `render()` which fires async API calls, but the content area goes blank or shows stale data until the response arrives. No spinners, no skeleton screens.
- **No offline handling.** If the server is down, every page silently fails.
- **`pdf-parse` failure is caught** but returns a string `[PDF extraction failed: ...]` that gets chunked and indexed as if it were real content.
- **File size limit exists** (50MB via multer) but no client-side validation — user uploads a 100MB file and gets a cryptic error.
- **No input validation on ticket creation.** Subject is checked client-side but not server-side. Customer email isn't validated anywhere.

---

## 5. Code Quality

**Rating: 6/10 — Clean and readable, some issues.**

**Good:**
- Clean vanilla JS SPA, no framework bloat
- Well-organized route structure
- BM25 implementation is solid
- Consistent coding style
- Good use of CSS custom properties

**Issues:**
- **JSON file storage with no locking.** Concurrent writes will cause data loss. `loadJSON` → modify → `saveJSON` is a classic race condition.
- **No authentication.** The dashboard and all APIs are completely open. Anyone with the URL can delete all documents, read all tickets, and extract stored API keys (channel configs store plaintext API keys).
- **Stored API keys in plain JSON.** Channel configs with API keys are stored in `channels.json` and served via `GET /api/channels` to anyone.
- **No rate limiting.** Upload endpoint accepts unlimited requests.
- **`genId()` is not collision-safe.** `Date.now().toString(36)` + 6 random chars is fine for low volume but not guaranteed unique.
- **SPA fallback catches everything.** `app.get('*', ...)` means API 404s for typos like `/api/typo` return the HTML page instead of a JSON error.
- **`marked` is imported but unused.** Dead dependency.
- **Hardcoded data path.** `/home/node/emika` is hardcoded as first choice, which is an Emika infra assumption leaked into the product.

---

## 6. BOOTSTRAP.md Quality

**Rating: 7/10 — Good conversational flow, but depends on the AI being smart enough to drive it.**

**Strengths:**
- Asks the right questions (company info, channels, common questions, tone, rules, escalation, SLA)
- Clear "Once you answer, I will" section sets expectations
- References the dashboard naturally

**Weaknesses:**
- It's a wall of text. The AI needs to parse this and drive a conversation, which means the quality of the onboarding depends entirely on the AI model's ability to follow instructions
- No progressive disclosure — all 8 questions hit at once
- Doesn't mention that channel integrations aren't actually functional (webhooks don't exist)
- Says "I will create initial behavior prompts" but defaults are already pre-seeded — the AI might create duplicates
- No mention of testing or verifying the setup works

---

## 7. SKILL.md Quality

**Rating: 8/10 — Best file in the repo.**

**Strengths:**
- Comprehensive workflow with clear steps
- Escalation triggers are specific and actionable
- Channel-specific integration details
- Clear "never do" list
- Priority assessment rubric
- Ticket lifecycle documentation

**Weaknesses:**
- References webhook endpoints that don't exist in the server
- Assumes the AI can make outbound API calls to Intercom/Zendesk/etc., but there's no auth proxy or helper for this
- Knowledge base search threshold (score > 2.0, < 1.0) is arbitrary — BM25 scores vary wildly by corpus size
- No guidance on handling concurrent conversations
- TOOLS.md is complete and well-formatted — no issues there

---

## 8. Specific Improvements (Ranked by Impact)

### Critical — Must Have for First Value

1. **Add a "Test Chat" widget to the dashboard.** Let users simulate a customer conversation right from the UI. This is the #1 blocker to time-to-first-value. Even a simple text box that calls `/api/search` and shows what the AI would reference is 10x better than nothing.

2. **Add a Getting Started checklist to the dashboard.** Show: ☐ Configure company info → ☐ Upload first document → ☐ Review behavior prompts → ☐ Test a question → ☐ Connect a channel. Persist progress. Make the empty dashboard useful.

3. **Add basic authentication.** At minimum, a shared password or token. The dashboard exposes stored API keys and all customer ticket data with zero auth. This is a security incident waiting to happen.

4. **Fix the channel integration gap.** Either implement webhook handlers for at least one platform (Intercom is the most common), or clearly label channels as "Setup Guide Only — webhook handling via AI agent" so users don't think they're connected when they're not.

### High Impact

5. **Add loading states.** Show a spinner or skeleton when fetching data. The blank flash on navigation is jarring.

6. **Replace `prompt()` dialogs with proper modals.** Priority change and escalation reason should use the existing modal system, not browser `prompt()`.

7. **Add client-side error handling.** Wrap `api()` calls with try/catch, show toast on failure, handle non-200 responses.

8. **Pre-populate Settings with BOOTSTRAP.md answers.** When the AI completes onboarding, it should auto-fill company name, support email, working hours, and escalation threshold via `PUT /api/config`.

9. **Fix `.docx` extraction.** Either use a proper library (like `mammoth`) or remove `.docx` from the supported formats list. Currently it indexes binary garbage.

### Medium Impact

10. **Add sample/demo data option.** A "Load demo data" button that creates 5-10 sample tickets and a sample document so new users can see what a working system looks like immediately.

11. **Improve empty states with CTAs.** "No tickets yet" → "No tickets yet. Tickets appear here when customers reach out through connected channels, or you can [create one manually] to test."

12. **Add search-as-you-type to knowledge base search.** Debounced search on input, not just on Enter.

13. **Remove unused `marked` dependency.** Dead code.

14. **Add file size validation client-side.** Check before upload, show friendly error.

15. **Fix SPA fallback for API routes.** Return 404 JSON for `/api/*` paths that don't match a route, before the `*` catch-all.

### Low Impact / Polish

16. **Add keyboard shortcut for navigation.** e.g., `Cmd+K` for quick search across the app.

17. **Add document re-upload / versioning.** Currently you delete and re-upload. Allow updating a document's content.

18. **Add bulk operations for tickets.** Select multiple → resolve, escalate, change priority.

19. **Add JSON file locking or switch to SQLite.** Prevent race conditions on concurrent writes.

20. **Add export for analytics.** CSV download of ticket data.

---

## Summary

The codebase is clean and well-structured for a v1. The SKILL.md is excellent — the AI agent has good instructions. But the **dashboard is a management console with no way to experience the AI**, which means time-to-first-value requires connecting an external platform and waiting for real traffic. That's days, not minutes.

**The single highest-impact change:** Add a test chat widget. Let users upload a doc, then immediately ask it a question and see the AI reference it. That turns time-to-first-value from "days" to "5 minutes."
