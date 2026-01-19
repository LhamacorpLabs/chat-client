import { writable, get } from 'svelte/store';
import type { ChatMember } from '../types/chat';

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
	'#E74C3C', // Bright Red - excellent contrast both themes
	'#3498DB', // Sky Blue - excellent contrast both themes
	'#27AE60', // Emerald Green - excellent contrast both themes
	'#E67E22', // Pumpkin Orange - good contrast both themes (darker than previous)
	'#9B59B6', // Amethyst Purple - excellent contrast both themes
	'#1ABC9C', // Turquoise - excellent contrast both themes
	'#E91E63', // Pink - excellent contrast both themes
	'#D35400', // Burnt Orange - good contrast both themes
	'#2980B9', // Belize Blue - good contrast both themes (lighter than deep blue)
	'#8BC34A', // Light Green - excellent contrast both themes
	'#AD1457', // Dark Pink - excellent contrast both themes
	'#FF9800', // Orange - good contrast both themes
	'#795548', // Medium Brown - good contrast both themes (lighter than deep brown)
	'#673AB7', // Deep Purple - good contrast both themes (lighter than indigo)
	'#009688', // Teal - good contrast both themes (brighter than dark teal)
	'#F44336', // Material Red - excellent contrast both themes
	'#607D8B', // Blue Grey - good contrast both themes
	'#4CAF50'  // Material Green - excellent contrast both themes
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
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('member_colors');
		if (saved) {
			try {
				const colors: MemberColorsState = JSON.parse(saved);
				memberColorsStore.set(colors);
			} catch (e) {
				console.warn('Failed to load member colors from localStorage:', e);
				localStorage.removeItem('member_colors');
			}
		}
	}
}

// Save member colors to localStorage
function saveMemberColors(colors: MemberColorsState) {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem('member_colors', JSON.stringify(colors));
		} catch (e) {
			console.warn('Failed to save member colors to localStorage:', e);
		}
	}
}

// Get assigned color for a member, or assign a new one if needed
export function getMemberColor(chatId: string, memberId: string): string {
	const currentState = get(memberColorsStore);

	// Check if chat colors exist
	if (!currentState[chatId]) {
		currentState[chatId] = {};
	}

	// Check if member already has a color
	if (currentState[chatId][memberId]) {
		return currentState[chatId][memberId];
	}

	// Assign new color
	const color = getColorForMember(memberId);
	currentState[chatId][memberId] = color;

	// Update store and save to localStorage
	memberColorsStore.set(currentState);
	saveMemberColors(currentState);

	return color;
}

// Assign colors to all members in a chat
export function assignColorsForChat(chatId: string, members: ChatMember[]): void {
	// Skip color assignment for 2-person chats
	if (members.length <= 2) {
		return;
	}

	const currentState = get(memberColorsStore);

	// Initialize chat colors if not exists
	if (!currentState[chatId]) {
		currentState[chatId] = {};
	}

	let hasNewColors = false;

	// Assign colors to members that don't have them
	members.forEach(member => {
		if (!currentState[chatId][member.id]) {
			currentState[chatId][member.id] = getColorForMember(member.id);
			hasNewColors = true;
		}
	});

	// Update store and save if there were new colors assigned
	if (hasNewColors) {
		memberColorsStore.set(currentState);
		saveMemberColors(currentState);
	}
}

// Assign color to a single new member
export function addMemberColor(chatId: string, memberId: string): string {
	const currentState = get(memberColorsStore);

	// Check if member already has a color
	if (currentState[chatId]?.hasOwnProperty(memberId)) {
		return currentState[chatId][memberId];
	}

	// Get the chat's existing member count to determine if colors should be used
	const chatColors = currentState[chatId] || {};
	const memberCount = Object.keys(chatColors).length + 1; // +1 for the new member

	// Skip color assignment for 2-person chats
	if (memberCount <= 2) {
		return '';
	}

	// Assign new color
	const color = getColorForMember(memberId);

	// Initialize chat colors if not exists
	if (!currentState[chatId]) {
		currentState[chatId] = {};
	}

	currentState[chatId][memberId] = color;

	// Update store and save
	memberColorsStore.set(currentState);
	saveMemberColors(currentState);

	return color;
}

// Clear colors for a specific chat
export function clearChatColors(chatId: string): void {
	const currentState = get(memberColorsStore);

	if (currentState[chatId]) {
		delete currentState[chatId];
		memberColorsStore.set(currentState);
		saveMemberColors(currentState);
	}
}

// Check if a chat should use member colors (more than 2 people)
export function shouldUseMemberColors(members: ChatMember[]): boolean {
	return members.length > 2;
}

// Get all colors assigned to a chat
export function getChatColors(chatId: string): MemberColors {
	const currentState = get(memberColorsStore);
	return currentState[chatId] || {};
}

// Cleanup old chat colors (optional utility for maintenance)
export function cleanupOldColors(activeChatIds: string[]): void {
	const currentState = get(memberColorsStore);
	let hasChanges = false;

	// Remove colors for chats that are no longer active
	Object.keys(currentState).forEach(chatId => {
		if (!activeChatIds.includes(chatId)) {
			delete currentState[chatId];
			hasChanges = true;
		}
	});

	if (hasChanges) {
		memberColorsStore.set(currentState);
		saveMemberColors(currentState);
	}
}