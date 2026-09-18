import { writable, get } from 'svelte/store';
import type { ChatMember } from '../types/chat';
import { loadPersisted, savePersisted } from '../utils/localJsonStore.js';

const STORAGE_KEY = 'member_colors';

// Member color interfaces
export interface MemberColors {
	[memberId: string]: string;
}

export interface MemberColorsState {
	[chatId: string]: MemberColors;
}

// Theme-optimized color palette with excellent visibility in both light and dark modes
// Each color tested for contrast against white (#ffffff) and dark gray (#1a1a1a) backgrounds
const MEMBER_COLORS = [
	'#E74C3C', '#3498DB', '#27AE60', '#E67E22', '#9B59B6', '#1ABC9C',
	'#E91E63', '#D35400', '#2980B9', '#8BC34A', '#AD1457', '#FF9800',
	'#795548', '#673AB7', '#009688', '#F44336', '#607D8B', '#4CAF50'
];

// Initial state
const initialState: MemberColorsState = {};

// Main member colors store
export const memberColorsStore = writable<MemberColorsState>(initialState);

// Hash function for consistent color assignment
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash);
}

// Get color for a specific member
function getColorForMember(memberId: string): string {
	const hash = hashString(memberId);
	const colorIndex = hash % MEMBER_COLORS.length;
	return MEMBER_COLORS[colorIndex];
}

// Load member colors from localStorage on app start
export function loadMemberColors() {
	const colors = loadPersisted<MemberColorsState | null>(STORAGE_KEY, null, () => {
		if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
	});
	if (colors) memberColorsStore.set(colors);
}

// Save member colors to localStorage
function saveMemberColors(colors: MemberColorsState) {
	savePersisted(STORAGE_KEY, colors);
}

// Get assigned color for a member, or assign a new one if needed
export function getMemberColor(chatId: string, memberId: string): string {
	const currentState = get(memberColorsStore);
	const chatColors = currentState[chatId] ?? {};

	// Check if member already has a color
	if (chatColors[memberId]) {
		return chatColors[memberId];
	}

	// Assign new color
	const color = getColorForMember(memberId);
	const newState: MemberColorsState = {
		...currentState,
		[chatId]: { ...chatColors, [memberId]: color }
	};

	// Update store and save to localStorage
	memberColorsStore.set(newState);
	saveMemberColors(newState);

	return color;
}

// Assign colors to all members in a chat
export function assignColorsForChat(chatId: string, members: ChatMember[]): void {
	// Skip color assignment for 2-person chats
	if (members.length <= 2) {
		return;
	}

	const currentState = get(memberColorsStore);
	const chatColors = { ...(currentState[chatId] ?? {}) };

	let hasNewColors = false;

	// Assign colors to members that don't have them
	members.forEach(member => {
		if (!chatColors[member.id]) {
			chatColors[member.id] = getColorForMember(member.id);
			hasNewColors = true;
		}
	});

	// Update store and save if there were new colors assigned
	if (hasNewColors) {
		const newState: MemberColorsState = { ...currentState, [chatId]: chatColors };
		memberColorsStore.set(newState);
		saveMemberColors(newState);
	}
}

// Assign color to a single new member
export function addMemberColor(chatId: string, memberId: string): string {
	const currentState = get(memberColorsStore);
	const chatColors = currentState[chatId] ?? {};

	// Check if member already has a color
	if (Object.prototype.hasOwnProperty.call(chatColors, memberId)) {
		return chatColors[memberId];
	}

	// Get the chat's existing member count to determine if colors should be used
	const memberCount = Object.keys(chatColors).length + 1; // +1 for the new member

	// Skip color assignment for 2-person chats
	if (memberCount <= 2) {
		return '';
	}

	// Assign new color
	const color = getColorForMember(memberId);
	const newState: MemberColorsState = {
		...currentState,
		[chatId]: { ...chatColors, [memberId]: color }
	};

	// Update store and save
	memberColorsStore.set(newState);
	saveMemberColors(newState);

	return color;
}

// Check if a chat should use member colors (more than 2 people)
export function shouldUseMemberColors(members: ChatMember[]): boolean {
	return members.length > 2;
}
