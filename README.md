# Lhama Chat

[![Deploy](https://github.com/LhamacorpLabs/chat-client/actions/workflows/deploy.yml/badge.svg)](https://github.com/LhamacorpLabs/chat-client/actions/workflows/deploy.yml)

Real-time chat app built with SvelteKit. Available as web app and native desktop client (macOS, Windows, Linux).

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Desktop Client (Electron)

```bash
npm run electron:dev     # dev with hot reload
npm run electron:build   # production build (electron-builder)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run electron:dev` | Desktop dev mode |
| `npm run electron:build` | Desktop production build |

## Keyboard Shortcuts

**Main page:** `↑↓` navigate chats, `Enter` open, `c` create, `j` join

**Chat:** `i` focus input, `r` reply, `↑↓` navigate messages, `Esc` leave, `Ctrl+q` unfocus input
