# 🦙 Lhama Chat Client

A modern real-time chat application built with SvelteKit, TypeScript, and a beautiful light/dark theme system.

## Features

- 🔐 **Authentication** - Secure login with JWT tokens
- 💬 **Real-time Messaging** - Automatic message polling every second
- 🎨 **Theme Support** - Beautiful light/dark mode with localStorage persistence
- 👥 **Chat Management** - Create chats and invite others with invitation codes
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- ⚡ **Modern Stack** - SvelteKit, TypeScript, and Vite

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Configuration

Create a `.env` file in the root directory to configure the chat API endpoint:

```bash
cp .env.example .env
```

Edit `.env` to set your API server URLs:

```bash
# Chat API Configuration (server URL only)
PUBLIC_CHAT_API_URL=http://localhost:8080

# Authentication API Configuration (server URL only)
PUBLIC_AUTH_API_URL=https://auth.lhamacorp.com
```

**Default Server URLs:**
- Chat API Server: `http://localhost:8080` (endpoints: `/api/chats/*`)
- Auth API Server: `https://auth.lhamacorp.com` (endpoints: `/api/*`)

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
