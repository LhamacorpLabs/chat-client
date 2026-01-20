// Simple authentication types
export interface AuthRequest {
	username: string;
	password: string;
	email?: string; // Optional for registration
}

export interface AuthResponse {
	email: string;
	expirationDate: string;
	id: string;
	roles: string[];
	token: string;
	username: string;
}

export interface User {
	id: string;
	username: string;
	email: string;
	roles: string[];
}