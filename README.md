# Lhama Chat

[![Deploy](https://github.com/LhamacorpLabs/chat-client/actions/workflows/deploy.yml/badge.svg)](https://github.com/LhamacorpLabs/chat-client/actions/workflows/deploy.yml)
[![Release](https://github.com/LhamacorpLabs/chat-client/actions/workflows/release.yml/badge.svg)](https://github.com/LhamacorpLabs/chat-client/actions/workflows/release.yml)

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

## Chat Commands

Type these in a chat's message input. Anything else starting with `/` is sent as a normal message.

| Command | Description |
|---------|-------------|
| `/help` | List the available commands |
| `/version` | Show the app version |
| `/update` | Check for a new desktop app version |
| `/mute`, `/unmute` | Mute or unmute notifications for the current chat |
| `/theme [name]` | Switch theme, or list the themes |
| `/clear-cache` | Clear cached display data and reload (stays signed in) |

Debug mode is hidden until you turn it on with `/debug on` (`/debug off` turns it back off, and `/debug` toggles). While it is on, the debug panel is available from the menu or with `Ctrl/⌘ + Shift + D`.
