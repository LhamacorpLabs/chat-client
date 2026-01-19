FROM node:22-alpine AS build

# Build arguments for environment variables
ARG PUBLIC_CHAT_API_URL=https://chat-be.lhamacorp.com
ARG PUBLIC_AUTH_API_URL=https://auth.lhamacorp.com

# Set environment variables for the build
ENV PUBLIC_CHAT_API_URL=$PUBLIC_CHAT_API_URL
ENV PUBLIC_AUTH_API_URL=$PUBLIC_AUTH_API_URL

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM nginx:1.19-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/.svelte-kit/output/client /usr/share/nginx/html