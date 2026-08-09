# Data Flow

## Sleeper context

1. The content script parses only the supported page origin and path.
2. A versioned, size-bounded message sends a sanitized URL plus league/draft
   identifiers to the background.
3. The background validates extension ID, sender context, host, message age,
   schema, size, and absence of credential-like values.
4. The read-only Sleeper provider fetches public data and validates JSON with
   Zod. A shared request boundary rejects any non-GET method, credential mode,
   body, redirect, private host, or non-public path before network access.
5. TTL metadata and normalized records are stored locally in Dexie.
6. The side panel receives product data or typed safe errors.

## OpenAI research

1. The user explicitly requests analysis or enables automatic analysis.
2. The UI sends player/format context—never a key—to the background.
3. The background reads the key from trusted Chrome storage.
4. A local queue applies concurrency, per-minute limits, deduplication,
   timeout, abort, and bounded retry.
5. The Responses API receives strict instructions, input, JSON Schema,
   `store: false`, and current `web_search` only when research needs current
   facts.
6. Zod validates the structured response. Citation URLs must also appear in
   provider annotations and pass HTTPS validation.
7. Bounded research adjustments and safe usage metadata return to the UI.

## Storage map

| Data                                         | Storage                  | Default lifetime             |
| -------------------------------------------- | ------------------------ | ---------------------------- |
| OpenAI key, session mode                     | `chrome.storage.session` | Browser session              |
| OpenAI key, remembered mode                  | `chrome.storage.local`   | Until removal                |
| Settings                                     | `chrome.storage.local`   | Until reset                  |
| Local mock state (account/league/draft key)  | `chrome.storage.local`   | Reset or configuration drift |
| Current page context                         | `chrome.storage.session` | Browser session              |
| Players, imports, research, watchlist, usage | IndexedDB via Dexie      | TTL/user action              |
| In-memory logs                               | Service worker memory    | Worker lifetime, 200 entries |

Chrome storage access levels are restricted to trusted extension contexts.
Content scripts do not receive storage access or secret-bearing messages.

Local mock picks are never sent through the runtime protocol to Sleeper. A
validated configuration fingerprint prevents recovery into a different league,
draft, player pool, or ownership map.
