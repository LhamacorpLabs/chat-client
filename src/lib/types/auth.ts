export interface AuthResponse {
	email: string;
	expirationDate: string;
	id: string;
	roles: string[];
	token: string;
	username: string;
	/** Only present on responses from the server; never persisted next to the access token. */
	refreshToken?: string;
	refreshExpirationDate?: string;
}

export interface User {
	id: string;
	username: string;
	email: string;
	roles: string[];
}
