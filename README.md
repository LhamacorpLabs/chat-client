# 🦙 Lhama Chat Client

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

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.