# Lhama Chat Client

A modern real-time chat application built with SvelteKit and TypeScript.

## Configuration

Create a `.env` file in the root directory to configure the chat API endpoint:

```bash
cp .env.example .env
```

Edit `.env` to set your API server URLs:

```bash
PUBLIC_CHAT_API_URL=http://localhost:8080
PUBLIC_AUTH_API_URL=http://localhost:8080
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev
```

## Building

To create a production version of your app:

```sh
npm run build
```

## Shortcuts

#### Main page
- Arrow Up/Down: navigate between chats
- Enter: enter selected chat
- j key: join a chat
- c key: create a chat

#### Chat
- Ctrl + q: remove focus message input
- Arrow Up/Down (when no focus): navigate between messages
- Esc: leave chat
- i key: focus message input
- r key: reply to selected message
