# Improvement Backlog

Working list from a full-repo review. Meant to be worked through incrementally,
one item (or small related group) per session/PR — not all at once.

## How to use this doc

1. Pick one unchecked item, starting from the top of its section (sections are
   already in rough priority order).
2. Read the referenced file/lines before changing anything — line numbers will
   drift as the file changes, treat them as "look near here."
3. Make the change, then verify:
   ```
   npm run check
   npm test
   ```
   **Known baseline noise:** `npm test` currently fails 29/74 tests with
   `TypeError: Cannot read properties of undefined (reading 'clear')` on
   `localStorage.clear()` — a pre-existing jsdom/vitest environment issue,
   unrelated to this backlog. `npm run check` also has 11 pre-existing errors
   in `vite.config.ts` and `electron/mac-update/*.cjs`. Neither is something
   to fix as a side effect of an unrelated item — only worry about *new*
   failures your change introduces.
4. Check the box below and commit.
5. Leave a one-line note under the item if the actual fix ended up differing
   from what's described here (future-you or another session reads this
   before touching the item again).

---

## Bugs

- [x] `localStorageCleanup.ts` `cleanupChatMutes` read the wrong localStorage
      key (`chat_mutes` instead of `chat-mute-settings`) and the wrong shape —
      was a silent no-op. Fixed.
- [x] `memberColors.ts` mutated the live store object in place before
      `.set()`-ing the same reference, breaking Svelte's immutability
      contract. Fixed (all three exported functions now build a new object).
- [x] `ImageUpload.svelte` created a new blob URL on every render via
      `getFilePreviewUrl()` in the template, then revoked a *different* freshly
      created URL on cleanup — net leak. Fixed with a `Map<File,string>` cache.
- [x] `+page.ts` `isOwner` compared `chat.createdBy` (a userId) against
      `auth.user?.id`, which isn't a stable identifier across resets in this
      environment. Fixed by resolving `createdBy` through `chat.members` to a
      username and comparing that instead.
- [x] Message/reaction "is this mine" checks were `userId === user.id`,
      switched to `username === user.username` throughout
      `chat/[chatId]/+page.svelte`, `MessageReactions.svelte`, and
      `reactionUtils.ts` per the same instability issue. Fixed. **Caveat**:
      this assumes usernames are unique per account — if that's ever not
      true, two accounts sharing a username would render as the same person.
- [x] No `AbortController`/timeout on any `fetch` call in `api/chat.ts` or
      `api/auth.ts`. Fixed on `refactor/api-fetch-helper`: `api/chat.ts` now
      routes every call through a shared `apiFetch<T>()` helper (15s default
      timeout via `AbortController`), and `api/auth.ts`'s `refreshToken`
      gets the same treatment, with an aborted request folded into the
      existing "transient/network failure" path so it doesn't force a
      logout.

## Security

- [x] `stores/websocket.ts:52,56` — auth token was passed as a SockJS URL
      query param (`/ws?token=...`). Fixed on `fix/realtime-token-exposure`:
      moved to the STOMP CONNECT frame via `connectHeaders`
      (`Authorization: Bearer <token>`), refreshed on every (re)connect
      attempt through the existing `beforeConnect` hook. **Needs backend
      verification before merging**: this assumes the backend's STOMP
      CONNECT handling reads the `Authorization` native header (the standard
      approach for JWT-over-STOMP, since SockJS's handshake itself can't
      carry custom headers) — if it currently only checks the URL query
      param, this change will break realtime auth until the backend is
      updated to match.
- [ ] `stores/mqtt.ts:36-37` — token used as both MQTT username *and*
      password. Unusual and doubles exposure if the broker logs auth
      attempts. **Not done** — genuinely needs backend/broker-config
      confirmation of which field is actually validated before touching
      this; guessing wrong risks breaking MQTT auth silently in a way I
      can't test from here.
- [x] `stores/mqtt.ts:56-65` — on `reconnect`, mqtt.js can send that
      attempt's CONNECT packet before the async `getValidToken()` call
      resolves, so a just-rotated token went out stale on the first retry
      (fixed itself on the next automatic reconnect 5s later, but still a
      real gap). Fixed on `fix/realtime-token-exposure`: apply whatever
      token is already in `authStore` synchronously first, then upgrade to
      the freshly-validated one — no backend dependency, purely a client-
      side timing fix.
- [x] `electron/main.cjs:141` — `ipcMain.handle('shell:open-external', ...)`
      had no scheme check and was dead code (no call sites in `src` —
      `LinkPreview.svelte` uses `window.open` instead, already intercepted by
      `will-navigate`/`setWindowOpenHandler`). Fixed on
      `fix/electron-dead-open-external-ipc`: removed the channel and its
      `preload.cjs`/`app.d.ts` entries rather than adding an allowlist to
      code nothing calls.
- [ ] `utils/linkify.ts:108` builds a raw HTML string with an inline
      `onclick="window.showLinkConfirmation(...)"`, bridged via a global
      `(window as any).showLinkConfirmation` set/deleted per-mount in the
      chat page. Safe today (escaping happens before URL substitution) but
      fragile — CSP-incompatible, and the escaping logic that prevents stored
      XSS in chat messages has zero test coverage (see Testing section).
      Preferred fix: render links via a Svelte `{#each}` over parsed segments
      with a real `onclick` handler, drop `{@html}` for this path entirely.
- [x] `nginx.conf:11-14` marked every `*.png|*.ico|*.svg|...` as
      `Cache-Control: public, immutable` with `expires 1y` — fine for
      content-hashed build assets, but `logo.png`/`favicon.ico`/etc keep a
      stable filename, so a redeployed icon would never reach a returning
      visitor. Fixed on `fix/nginx-immutable-cache-headers`: added a
      `location ^~ /_app/` block (SvelteKit's content-hashed build output)
      that keeps the 1y immutable cache, checked before the general
      extension-matching rule, which now gives everything else (the
      stable-name files actually under `static/`) `expires 1h` +
      `must-revalidate` instead. Verified both syntax (`nginx -t`) and actual
      response headers against a real build using the `nginx:1.27-alpine`
      image locally.

## Architecture

- [ ] `routes/(app)/chat/[chatId]/+page.svelte` is a 3060-line god-component:
      WS/MQTT/polling transport selection, message CRUD, image upload
      orchestration, reactions, emoji autocomplete, keyboard shortcuts,
      notifications, and all the markup, in one file. This is the highest-
      value refactor in the repo but also the riskiest — don't attempt it as
      a single session. Suggested breakdown, each extractable independently:
  - [ ] Extract realtime transport selection/connect/disconnect into a
        composable (`useRealtimeConnection` or similar), covering the
        websocket/mqtt/polling three-way branch currently inline.
  - [ ] Extract the "refetch chat + markChatAsRead" logic duplicated ~6x
        (search `markChatAsRead` in the file) into one `refreshReadStatus(token)`
        helper.
  - [ ] Extract emoji autocomplete state/handlers into their own component
        (there's already `EmojiAutocomplete.svelte` — move the matching logic
        there instead of splitting it between the two files; unify the two
        drifted regexes `/:([a-zA-Z]{1,})$/` vs `/:([a-zA-Z]*)$/` while at it).
  - [ ] Extract a single message-row into its own component (currently the
        `{#each messages as message}` body inline in the page).
- [x] `api/chat.ts` — every one of ~15 functions repeated identical
      fetch + auth-header + `handleUnauthorized` + error-throw boilerplate.
      Fixed on `refactor/api-fetch-helper` (same branch as the timeout fix
      above, since it's the same code): extracted `apiFetch<T>()`, every
      exported function is now a thin call to it. Error message strings are
      unchanged (`"<action>: <status>"`, preserved via a per-call
      `errorMessage` prefix) since both a test suite and the chat page's
      413-detection logic match on the exact string.
- [ ] `stores/websocket.ts` and `stores/mqtt.ts` are near-duplicate transport
      classes (connect/disconnect/subscribeToChat), and both are always
      bundled (stompjs + sockjs-client + mqtt.js shipped regardless of which
      mode is active at runtime). Extract a shared transport interface.
      **Confirmed**: `PUBLIC_REALTIME_MODE` is in fact fixed per deployment —
      it's a Dockerfile `ARG`/`ENV` baked in at image build time (`Dockerfile`,
      also hardcoded to `mqtt` in both `.github/workflows/*.yml`), never
      changed at runtime. So the "make it a build-time choice" option is
      viable, not just theoretical — the unused transport really could be
      excluded from the bundle entirely for a given deployment.
- [ ] `stores/chatNotifications.ts`, `stores/chatMute.ts`, and
      `stores/memberColors.ts` each hand-roll the same
      try/catch-JSON-load/save-to-localStorage pattern instead of reusing
      `utils/persistentStore.ts`. Consolidate.

## Tooling / CI

- [x] `eslint` + `@typescript-eslint/*` + `prettier` were devDependencies with
      no config file and no `lint`/`format` script. Fixed on
      `chore/lint-and-ci`: added `eslint.config.js` (flat config; also added
      `eslint-plugin-svelte` + `svelte-eslint-parser`, which weren't
      installed — without them ESLint can't parse `.svelte` files at all)
      and `.prettierrc.json` matching the codebase's actual style (tabs,
      single quotes, no trailing comma, `arrowParens: avoid` — added that
      last one specifically because Prettier's default wraps single-arg
      arrows in parens, which isn't this codebase's convention, and doing so
      repo-wide would've been a huge unrelated diff). Added `lint`,
      `format`, `format:check` npm scripts.
      **Note**: `npm run lint` currently reports 79 real findings (35
      errors, 44 warnings) — several overlap with backlog items already
      tracked above (the `{@html}` XSS spots). `npm run format:check`
      reports 54 files with style drift. Neither was auto-fixed here — both
      are their own separate, reviewable changes (see the two new items
      right below), not something to bundle silently into "add the config."
      `electron/**/*.cjs` and `electron/mac-update/**` are excluded from
      ESLint: the former because `eslint-plugin-svelte`'s recommended flat
      config applies some rules with no file restriction, and
      `svelte/no-inner-declarations` crashes on plain CommonJS files
      (`TypeError: Cannot read properties of null (reading 'isStrict')`) -
      an eslint-plugin-svelte bug, not something to work around by touching
      those files.
- [ ] **New**: run `npm run lint`, triage the 35 errors / 44 warnings, fix or
      explicitly suppress each. Don't do this as a drive-by — several
      (`svelte/no-navigation-without-resolve`, `svelte/prefer-svelte-
      reactivity`) touch actual runtime behavior (SvelteKit's `resolve()`
      API, Svelte 5 reactivity primitives) and deserve real testing, not a
      blanket `--fix`.
- [ ] **New**: run `npm run format:check`, then `npm run format` once
      reviewed — 54 files currently drift from the new `.prettierrc.json`.
      This will be a large, purely-cosmetic diff; do it as its own commit
      with nothing else in it; so `git blame` isn't muddied.
- [x] `.github/workflows/build.yml` ran `npm test` + `npm run build` but
      never `npm run check`/`npm run lint`. Fixed on `chore/lint-and-ci`:
      added both as steps in the `test` job, but with
      `continue-on-error: true` — both commands currently fail on this repo
      as-is (11 pre-existing check errors, 79 lint findings, see above), and
      making them hard gates right now would turn every future PR red
      regardless of what it touches. Remove `continue-on-error` once the two
      items above are cleared.
- [ ] `package.json` pins `@lhamacorplabs/design-tokens` to
      `github:LhamacorpLabs/design-system#claude/design-system-evolution-25shdd`
      — a mutable feature branch, not a tag/SHA/npm release. If that branch
      is ever deleted or force-pushed, fresh installs break. Pin to a commit
      SHA, or get it published as a versioned package.
- [x] CI used `npm install` instead of `npm ci`. Fixed on
      `chore/lint-and-ci`: swapped every `npm install` for `npm ci` across
      `build.yml` and `deploy.yml` (all install steps, including the
      electron-release matrix job).

## Testing

- [ ] Zero component tests exist in the repo — not even a smoke render for
      any `.svelte` file. Highest-value target: `linkify.ts`'s escaping logic
      (see Security section above) since it's the one thing standing between
      chat messages and stored XSS, and a future refactor could silently
      break it with no test to catch it.
- [ ] Also untested: `linkPreview.ts` (500+ lines of platform-detection
      parsing), `fileValidation.ts`, `reactionUtils.ts`, `imageMessages.ts`,
      `replyMessages.ts`.
- [ ] Good existing coverage worth knowing about (don't duplicate): auth
      store, chat store/API, theme, chat-mute, daily-refresh,
      localStorage-cleanup, login/download pages, notifications,
      updater/mac-updater (~70 tests in `src/tests/`).

## Minor / polish

- [ ] `routes/(app)/+layout.svelte` embeds a raw `<script>` +
      `document.getElementById('year').textContent = ...` in the template
      for a footer year. Replace with `{new Date().getFullYear()}`.
- [ ] Mobile action-menu backdrop (`chat/[chatId]/+page.svelte`, search for
      the mobile action-menu `<div>`) is a plain `onclick` div — no
      role/keydown/focus-trap. Reaction buttons nearby are bare emoji with no
      `aria-label`.
- [ ] `ThemeToggle.svelte` still uses Svelte 4 `on:click` while the rest of
      the codebase is on Svelte 5 `onclick={}`.
- [ ] `linkPreview.ts` has 6 near-identical `detectX()` platform functions —
      collapsible into one table-driven matcher (keyword → path-segment →
      description builder).
- [ ] `fileValidation.ts` only checks the client-supplied `file.type`
      (trivially spoofable) — fine as a UX nicety since the server presumably
      re-validates, just don't rely on it as a security boundary.

## Explicitly not changing

- `api/chat.ts`'s `handleUnauthorized` only treats `401` as unauthorized,
  while `stores/auth.ts`'s refresh-token path treats both `401` and `403` as
  an invalid token. **This is intentional, not a bug** — chat-API `403`
  means a permission/membership issue (you're not in that chat), not an
  invalid session; see the comment at `api/chat.ts:11-19`. Don't "fix" this
  without backend confirmation that `403` semantics have changed.
- Electron hardening (`contextIsolation`, `nodeIntegration: false`,
  `sandbox: true`, nav-origin allowlist, mac updater signature+checksum
  verification) is already solid. Nothing to do here — noted so a future
  security pass doesn't re-flag it.
