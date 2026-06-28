FROM node:22-alpine AS build

# Build arguments for environment variables
ARG PUBLIC_CHAT_API_URL=https://chat-be.lhamacorp.com
ARG PUBLIC_AUTH_API_URL=https://auth.lhamacorp.com
ARG PUBLIC_AUTH_UI_URL=https://login.lhamacorp.com
ARG PUBLIC_MQTT_BROKER_URL=wss://mqtt.lhamacorp.com
ARG PUBLIC_REALTIME_MODE=mqtt
ARG APP_VERSION=unknown

# Set environment variables for the build
ENV PUBLIC_CHAT_API_URL=$PUBLIC_CHAT_API_URL
ENV PUBLIC_AUTH_API_URL=$PUBLIC_AUTH_API_URL
ENV PUBLIC_AUTH_UI_URL=$PUBLIC_AUTH_UI_URL
ENV PUBLIC_REALTIME_MODE=$PUBLIC_REALTIME_MODE
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html