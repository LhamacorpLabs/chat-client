export interface LinkPreview {
	platform: 'youtube' | 'instagram' | 'spotify' | 'twitter' | 'github' | 'amazon' | 'lhamacorp' | 'unknown';
	url: string;
	id?: string;
	title: string;
	description?: string;
	contentType?: string;
	icon: string;
	color: string;
}

/**
 * Checks if hostname matches a legitimate domain or its subdomains
 */
function isLegitimateHostname(hostname: string, legitimateDomains: string[]): boolean {
	const lowerHostname = hostname.toLowerCase();

	return legitimateDomains.some(domain => {
		const lowerDomain = domain.toLowerCase();

		// Exact match
		if (lowerHostname === lowerDomain) {
			return true;
		}

		// Subdomain match (must end with .domain)
		return lowerHostname.endsWith('.' + lowerDomain);
	});
}

/**
 * Detects platform type from URL and extracts basic information
 */
export function detectLinkPreview(url: string): LinkPreview | null {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();

		// YouTube detection
		if (isLegitimateHostname(hostname, ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com', 'www.youtube.com'])) {
			return detectYoutube(url, urlObj);
		}

		// Instagram detection
		if (isLegitimateHostname(hostname, ['instagram.com', 'instagr.am', 'www.instagram.com'])) {
			return detectInstagram(url, urlObj);
		}

		// Spotify detection
		if (isLegitimateHostname(hostname, ['spotify.com', 'open.spotify.com', 'play.spotify.com'])) {
			return detectSpotify(url, urlObj);
		}

		// Twitter/X detection
		if (isLegitimateHostname(hostname, ['twitter.com', 'x.com', 't.co', 'www.twitter.com', 'mobile.twitter.com'])) {
			return detectTwitter(url, urlObj);
		}

		// GitHub detection
		if (isLegitimateHostname(hostname, ['github.com', 'gist.github.com', 'www.github.com'])) {
			return detectGitHub(url, urlObj);
		}

		// Amazon detection - more comprehensive list of legitimate Amazon domains
		if (isLegitimateHostname(hostname, [
			'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
			'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.in', 'amazon.com.br',
			'amazon.com.mx', 'amazon.nl', 'amazon.se', 'amazon.com.tr', 'amazon.ae',
			'amzn.to', 'amzn.com', 'www.amazon.com', 'smile.amazon.com'
		])) {
			return detectAmazon(url, urlObj);
		}

		// LhamaCorp detection
		if (isLegitimateHostname(hostname, ['lhamacorp.com', 'www.lhamacorp.com'])) {
			return detectLhamacorp(url, urlObj);
		}

		return null;
	} catch {
		return null;
	}
}

function detectYoutube(url: string, urlObj: URL): LinkPreview {
	let videoId = '';
	let contentType = 'Video';
	let title = 'YouTube Video';
	let description;

	// Extract video ID from various YouTube URL formats
	if (urlObj.hostname.includes('youtu.be')) {
		// https://youtu.be/dQw4w9WgXcQ
		videoId = urlObj.pathname.slice(1);
		// Remove any additional parameters from video ID
		videoId = videoId.split('?')[0];
	} else if (urlObj.hostname.includes('youtube.com')) {
		const pathParts = urlObj.pathname.split('/');

		if (urlObj.searchParams.get('v')) {
			// https://www.youtube.com/watch?v=dQw4w9WgXcQ
			videoId = urlObj.searchParams.get('v') || '';
		} else if (pathParts.includes('embed')) {
			// https://www.youtube.com/embed/dQw4w9WgXcQ
			const embedIndex = pathParts.indexOf('embed');
			videoId = pathParts[embedIndex + 1] || '';
		} else if (pathParts.includes('shorts')) {
			// https://www.youtube.com/shorts/dQw4w9WgXcQ
			const shortsIndex = pathParts.indexOf('shorts');
			videoId = pathParts[shortsIndex + 1] || '';
			contentType = 'Short';
		} else if (pathParts.includes('playlist')) {
			// https://www.youtube.com/playlist?list=PLx...
			const playlistId = urlObj.searchParams.get('list');
			if (playlistId) {
				title = 'YouTube Playlist';
				contentType = 'Playlist';
				description = `Playlist ID: ${playlistId.substring(0, 8)}...`;
			}
		} else if (pathParts.includes('channel') || pathParts.includes('c') || pathParts.includes('user')) {
			// Channel URLs
			title = 'YouTube Channel';
			contentType = 'Channel';
		}
	}

	// Extract timestamp if present
	const timestamp = urlObj.searchParams.get('t');
	if (timestamp && videoId) {
		description = `Starting at ${timestamp}`;
	}

	// Create a more descriptive title
	if (videoId) {
		title = contentType === 'Short' ? 'YouTube Short' : 'YouTube Video';
		if (!description) {
			description = `Video ID: ${videoId}`;
		}
	}

	return {
		platform: 'youtube',
		url,
		id: videoId,
		title,
		description,
		contentType,
		icon: '🎥',
		color: '#FF0000'
	};
}

function detectInstagram(url: string, urlObj: URL): LinkPreview {
	let postId = '';
	let contentType = 'Post';
	let title = 'Instagram Post';
	let description;

	// Extract post ID and type from Instagram URLs
	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('p')) {
		// https://instagram.com/p/ABC123/
		const pIndex = pathParts.indexOf('p');
		postId = pathParts[pIndex + 1] || '';
		contentType = 'Post';
		title = 'Instagram Post';
	} else if (pathParts.includes('reel')) {
		// https://instagram.com/reel/ABC123/
		const reelIndex = pathParts.indexOf('reel');
		postId = pathParts[reelIndex + 1] || '';
		contentType = 'Reel';
		title = 'Instagram Reel';
	} else if (pathParts.includes('stories')) {
		// https://instagram.com/stories/username/123456/
		const storiesIndex = pathParts.indexOf('stories');
		const username = pathParts[storiesIndex + 1];
		postId = pathParts[storiesIndex + 2] || '';
		contentType = 'Story';
		title = 'Instagram Story';
		if (username) {
			description = `@${username}'s story`;
		}
	} else if (pathParts.includes('tv')) {
		// https://instagram.com/tv/ABC123/
		const tvIndex = pathParts.indexOf('tv');
		postId = pathParts[tvIndex + 1] || '';
		contentType = 'IGTV';
		title = 'Instagram TV';
	} else if (pathParts.length === 1 && pathParts[0]) {
		// https://instagram.com/username
		const username = pathParts[0];
		contentType = 'Profile';
		title = 'Instagram Profile';
		description = `@${username}`;
	}

	// Add post ID to description if we have one
	if (postId && !description) {
		description = `Post ID: ${postId}`;
	}

	return {
		platform: 'instagram',
		url,
		id: postId,
		title,
		description,
		contentType,
		icon: '📸',
		color: '#E4405F'
	};
}

function detectSpotify(url: string, urlObj: URL): LinkPreview {
	let spotifyId = '';
	let contentType = 'Track';
	let title = 'Spotify Track';
	let description;

	// Extract Spotify content from URLs
	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('track')) {
		const trackIndex = pathParts.indexOf('track');
		spotifyId = pathParts[trackIndex + 1] || '';
		contentType = 'Track';
		title = 'Spotify Track';
	} else if (pathParts.includes('album')) {
		const albumIndex = pathParts.indexOf('album');
		spotifyId = pathParts[albumIndex + 1] || '';
		contentType = 'Album';
		title = 'Spotify Album';
	} else if (pathParts.includes('playlist')) {
		const playlistIndex = pathParts.indexOf('playlist');
		spotifyId = pathParts[playlistIndex + 1] || '';
		contentType = 'Playlist';
		title = 'Spotify Playlist';
	} else if (pathParts.includes('artist')) {
		const artistIndex = pathParts.indexOf('artist');
		spotifyId = pathParts[artistIndex + 1] || '';
		contentType = 'Artist';
		title = 'Spotify Artist';
	} else if (pathParts.includes('show')) {
		const showIndex = pathParts.indexOf('show');
		spotifyId = pathParts[showIndex + 1] || '';
		contentType = 'Podcast';
		title = 'Spotify Podcast';
	} else if (pathParts.includes('episode')) {
		const episodeIndex = pathParts.indexOf('episode');
		spotifyId = pathParts[episodeIndex + 1] || '';
		contentType = 'Episode';
		title = 'Spotify Episode';
	}

	// Add ID to description
	if (spotifyId) {
		description = `${contentType} ID: ${spotifyId.substring(0, 12)}...`;
	}

	// Extract timestamp if present
	const timestamp = urlObj.searchParams.get('t');
	if (timestamp) {
		const timeInSeconds = parseInt(timestamp);
		if (!isNaN(timeInSeconds)) {
			const minutes = Math.floor(timeInSeconds / 60);
			const seconds = timeInSeconds % 60;
			const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
			description = description ? `${description} • Starting at ${timeStr}` : `Starting at ${timeStr}`;
		}
	}

	return {
		platform: 'spotify',
		url,
		id: spotifyId,
		title,
		description,
		contentType,
		icon: '🎵',
		color: '#1DB954'
	};
}

function detectTwitter(url: string, urlObj: URL): LinkPreview {
	let tweetId = '';
	let contentType = 'Tweet';
	let title = 'X Post';
	let description;

	// Extract tweet ID and type from Twitter/X URLs
	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('status')) {
		// https://twitter.com/username/status/123456789
		// https://x.com/username/status/123456789
		const statusIndex = pathParts.indexOf('status');
		const username = pathParts[statusIndex - 1];
		tweetId = pathParts[statusIndex + 1] || '';
		contentType = 'Tweet';
		title = 'Post';

		if (username) {
			description = `@${username}`;
		}

		if (tweetId) {
			description = description ? `${description} • Tweet ID: ${tweetId.substring(0, 8)}...` : `Tweet ID: ${tweetId.substring(0, 8)}...`;
		}
	} else if (pathParts.includes('i') && pathParts.includes('spaces')) {
		// https://twitter.com/i/spaces/1234567890
		// https://x.com/i/spaces/1234567890
		const spacesIndex = pathParts.indexOf('spaces');
		tweetId = pathParts[spacesIndex + 1] || '';
		contentType = 'Space';
		title = 'X Space';

		if (tweetId) {
			description = `Space ID: ${tweetId.substring(0, 8)}...`;
		}
	} else if (pathParts.includes('lists')) {
		// https://twitter.com/username/lists/listname
		// https://x.com/username/lists/listname
		const listsIndex = pathParts.indexOf('lists');
		const username = pathParts[listsIndex - 1];
		const listName = pathParts[listsIndex + 1];
		contentType = 'List';
		title = 'X List';

		if (username && listName) {
			description = `@${username}/${listName}`;
		}
	} else if (pathParts.length === 1 && pathParts[0] && !pathParts[0].startsWith('i')) {
		// https://twitter.com/username
		// https://x.com/username
		const username = pathParts[0];
		contentType = 'Profile';
		title = 'X Profile';
		description = `@${username}`;
	}

	return {
		platform: 'twitter',
		url,
		id: tweetId,
		title,
		description,
		contentType,
		icon: '🐦',
		color: '#1DA1F2'
	};
}

function detectGitHub(url: string, urlObj: URL): LinkPreview {
	let repoId = '';
	let contentType = 'Repository';
	let title = 'GitHub Repository';
	let description;

	// Extract information from GitHub URLs
	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (isLegitimateHostname(urlObj.hostname, ['gist.github.com'])) {
		// https://gist.github.com/username/gist-id
		const username = pathParts[0];
		const gistId = pathParts[1] || '';
		contentType = 'Gist';
		title = 'GitHub Gist';

		if (username) {
			description = `@${username}`;
		}

		if (gistId) {
			description = description ? `${description} • Gist: ${gistId.substring(0, 8)}...` : `Gist: ${gistId.substring(0, 8)}...`;
		}

		repoId = gistId;
	} else if (pathParts.length >= 2) {
		// https://github.com/owner/repo/...
		const owner = pathParts[0];
		const repo = pathParts[1];
		repoId = `${owner}/${repo}`;

		if (pathParts.length === 2) {
			// https://github.com/owner/repo
			contentType = 'Repository';
			title = 'GitHub Repository';
			description = `${owner}/${repo}`;
		} else if (pathParts.includes('issues')) {
			// https://github.com/owner/repo/issues/123
			const issuesIndex = pathParts.indexOf('issues');
			const issueNumber = pathParts[issuesIndex + 1];
			contentType = 'Issue';
			title = 'GitHub Issue';

			if (issueNumber) {
				description = `${owner}/${repo} #${issueNumber}`;
			} else {
				description = `${owner}/${repo} issues`;
			}
		} else if (pathParts.includes('pull')) {
			// https://github.com/owner/repo/pull/123
			const pullIndex = pathParts.indexOf('pull');
			const prNumber = pathParts[pullIndex + 1];
			contentType = 'Pull Request';
			title = 'GitHub Pull Request';

			if (prNumber) {
				description = `${owner}/${repo} #${prNumber}`;
			} else {
				description = `${owner}/${repo} pulls`;
			}
		} else if (pathParts.includes('commit')) {
			// https://github.com/owner/repo/commit/abc123def456
			const commitIndex = pathParts.indexOf('commit');
			const commitHash = pathParts[commitIndex + 1];
			contentType = 'Commit';
			title = 'GitHub Commit';

			if (commitHash) {
				description = `${owner}/${repo} ${commitHash.substring(0, 7)}`;
			} else {
				description = `${owner}/${repo}`;
			}
		} else if (pathParts.includes('releases')) {
			// https://github.com/owner/repo/releases/tag/v1.0.0
			const releasesIndex = pathParts.indexOf('releases');
			if (pathParts[releasesIndex + 1] === 'tag') {
				const tag = pathParts[releasesIndex + 2];
				contentType = 'Release';
				title = 'GitHub Release';
				description = tag ? `${owner}/${repo} ${tag}` : `${owner}/${repo}`;
			} else {
				contentType = 'Releases';
				title = 'GitHub Releases';
				description = `${owner}/${repo}`;
			}
		} else if (pathParts.includes('tree') || pathParts.includes('blob')) {
			// https://github.com/owner/repo/tree/main/src or /blob/main/file.js
			const type = pathParts.includes('tree') ? 'tree' : 'blob';
			const typeIndex = pathParts.indexOf(type);
			const branch = pathParts[typeIndex + 1];
			contentType = type === 'tree' ? 'Folder' : 'File';
			title = type === 'tree' ? 'GitHub Folder' : 'GitHub File';
			description = branch ? `${owner}/${repo}:${branch}` : `${owner}/${repo}`;
		} else {
			// Default to repository
			description = `${owner}/${repo}`;
		}
	} else if (pathParts.length === 1) {
		// https://github.com/username
		const username = pathParts[0];
		contentType = 'Profile';
		title = 'GitHub Profile';
		description = `@${username}`;
		repoId = username;
	}

	return {
		platform: 'github',
		url,
		id: repoId,
		title,
		description,
		contentType,
		icon: '🐙',
		color: '#24292f'
	};
}

function detectAmazon(url: string, urlObj: URL): LinkPreview {
	let productId = '';
	let contentType;
	let title;
	let description;

	// Extract country code from hostname for context
	const hostname = urlObj.hostname.toLowerCase();
	let countryCode = '';
	if (hostname.includes('amazon.de')) countryCode = 'DE';
	else if (hostname.includes('amazon.co.uk')) countryCode = 'UK';
	else if (hostname.includes('amazon.fr')) countryCode = 'FR';
	else if (hostname.includes('amazon.it')) countryCode = 'IT';
	else if (hostname.includes('amazon.es')) countryCode = 'ES';
	else if (hostname.includes('amazon.ca')) countryCode = 'CA';
	else if (hostname.includes('amazon.com.au')) countryCode = 'AU';
	else if (hostname.includes('amazon.co.jp')) countryCode = 'JP';
	else if (hostname.includes('amazon.com')) countryCode = 'US';

	// Extract information from Amazon URLs
	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('dp') && pathParts.length > pathParts.indexOf('dp')) {
		// https://amazon.com/product-name/dp/B08ABC123/
		const dpIndex = pathParts.indexOf('dp');
		productId = pathParts[dpIndex + 1] || '';
		contentType = 'Product';
		title = 'Amazon Product';

		if (productId) {
			description = countryCode ? `Product: ${productId} (${countryCode})` : `Product: ${productId}`;
		}
	} else if (pathParts.includes('gp') && pathParts.includes('product')) {
		// https://amazon.com/gp/product/B08ABC123/
		const productIndex = pathParts.indexOf('product');
		productId = pathParts[productIndex + 1] || '';
		contentType = 'Product';
		title = 'Amazon Product';

		if (productId) {
			description = countryCode ? `Product: ${productId} (${countryCode})` : `Product: ${productId}`;
		}
	} else if (pathParts.includes('s') || urlObj.searchParams.get('k')) {
		// https://amazon.com/s?k=search+terms
		const searchTerms = urlObj.searchParams.get('k');
		contentType = 'Search';
		title = 'Amazon Search';

		if (searchTerms) {
			description = countryCode ? `Search: "${decodeURIComponent(searchTerms.replace(/\+/g, ' '))}" (${countryCode})` : `Search: "${decodeURIComponent(searchTerms.replace(/\+/g, ' '))}"`;
		} else {
			description = countryCode ? `Search Results (${countryCode})` : 'Search Results';
		}
	} else if (pathParts.includes('stores')) {
		// https://amazon.com/stores/store-name/
		const storesIndex = pathParts.indexOf('stores');
		const storeName = pathParts[storesIndex + 1];
		contentType = 'Store';
		title = 'Amazon Store';

		if (storeName) {
			description = countryCode ? `Store: ${storeName} (${countryCode})` : `Store: ${storeName}`;
		}
	} else if (pathParts.includes('hz') && pathParts.includes('wishlist')) {
		// https://amazon.com/hz/wishlist/ls/WISHLIST_ID
		const wishlistIndex = pathParts.findIndex(part => part.startsWith('ls'));
		const wishlistId = wishlistIndex !== -1 ? pathParts[wishlistIndex].replace('ls/', '') : '';
		contentType = 'Wishlist';
		title = 'Amazon Wishlist';

		if (wishlistId) {
			description = countryCode ? `Wishlist: ${wishlistId.substring(0, 8)}... (${countryCode})` : `Wishlist: ${wishlistId.substring(0, 8)}...`;
		}
	} else if (pathParts.includes('gp') && pathParts.includes('bestsellers')) {
		// https://amazon.com/gp/bestsellers/category
		contentType = 'Bestsellers';
		title = 'Amazon Bestsellers';
		description = countryCode ? `Bestsellers (${countryCode})` : 'Bestsellers';
	} else if (pathParts.length >= 1 && pathParts[0] && !pathParts[0].includes('gp')) {
		// https://amazon.com/category-name or department pages
		const category = pathParts[0].replace(/-/g, ' ');
		contentType = 'Category';
		title = 'Amazon Category';
		description = countryCode ? `${category} (${countryCode})` : category;
	} else {
		// Default Amazon homepage or other pages
		contentType = 'Homepage';
		title = 'Amazon';
		description = countryCode ? `Amazon (${countryCode})` : 'Amazon';
	}

	return {
		platform: 'amazon',
		url,
		id: productId,
		title,
		description,
		contentType,
		icon: '📦',
		color: '#FF9900'
	};
}

function detectLhamacorp(url: string, urlObj: URL): LinkPreview {
	let contentType;
	let title;
	let description;

	// Extract information from LhamaCorp URLs
	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.length === 0) {
		// https://lhamacorp.com
		contentType = 'Homepage';
		title = 'LhamaCorp';
		description = 'LhamaCorp Homepage';
	} else {
		// https://lhamacorp.com/some/path
		const path = pathParts.join('/');
		contentType = 'Page';
		title = 'LhamaCorp';
		description = `/${path}`;
	}

	return {
		platform: 'lhamacorp',
		url,
		title,
		description,
		contentType,
		icon: '🦙',
		color: '#0066CC'
	};
}