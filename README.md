# Lhama Chat

[![Build and Release](https://github.com/LhamacorpLabs/chat-client/actions/workflows/buildAndRelease.yml/badge.svg)](https://github.com/LhamacorpLabs/chat-client/actions/workflows/buildAndRelease.yml)
[![Tauri Release](https://github.com/LhamacorpLabs/chat-client/actions/workflows/tauri-release.yml/badge.svg)](https://github.com/LhamacorpLabs/chat-client/actions/workflows/tauri-release.yml)

Real-time chat app built with SvelteKit. Available as web app and native desktop client (macOS, Windows, Linux).

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Desktop Client (Tauri)

```bash
npm run tauri:dev     # dev with hot reload
npm run tauri:build   # production build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run tauri:dev` | Desktop dev mode |
| `npm run tauri:build` | Desktop production build |

## Keyboard Shortcuts

**Main page:** `↑↓` navigate chats, `Enter` open, `c` create, `j` join

**Chat:** `i` focus input, `r` reply, `↑↓` navigate messages, `Esc` leave, `Ctrl+q` unfocus input
