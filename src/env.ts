import { defineEnvVars } from '@sveltejs/kit/env';

// Build-time public variables, inlined into the bundle.
// Unset variables resolve to an empty string so callers can apply their own defaults.
const publicStatic = { public: true, static: true, schema: (value: string | undefined) => value ?? '' };

export const variables = defineEnvVars({
	PUBLIC_CHAT_API_URL: publicStatic,
	PUBLIC_AUTH_API_URL: publicStatic,
	PUBLIC_AUTH_UI_URL: publicStatic,
	PUBLIC_MQTT_BROKER_URL: publicStatic,
	PUBLIC_REALTIME_MODE: publicStatic
});
