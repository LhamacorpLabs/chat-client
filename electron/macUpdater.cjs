const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { compareVersions } = require('./mac-update/version-compare.cjs');
const { sha512Hex, buildSignedMessage, verifySignature } = require('./mac-update/verify.cjs');
const { resolveBundlePaths } = require('./mac-update/bundle-path.cjs');

const MANIFEST_URL =
	'https://github.com/LhamacorpLabs/chat-client/releases/latest/download/latest-mac.json';

// Non-secret - pairs with the MAC_UPDATE_SIGNING_KEY GitHub secret used to
// sign releases in scripts/publish-mac-manifest.cjs.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAfYEaczj9e7hv9vnkpGOOmmiwR3sRu1ZimVdmlsUYesI=
-----END PUBLIC KEY-----
`;

const state = {
	checking: false,
	stagedVersion: null,
	stagedAppPath: null,
	oldAppPath: null
};

function logFile() {
	return path.join(app.getPath('userData'), 'updater.log');
}

function log(message) {
	const line = `[${new Date().toISOString()}] ${message}\n`;
	console.log(message);
	try {
		fs.appendFileSync(logFile(), line);
	} catch {
		// best effort only
	}
}

function shQuote(str) {
	return `'${str.replace(/'/g, `'\\''`)}'`;
}

function archManifestKey() {
	return process.arch === 'arm64' ? 'arm64' : 'x64';
}

async function checkForUpdate(mainWindow) {
	if (!app.isPackaged) return false;
	if (state.checking) return false;
	state.checking = true;

	try {
		const response = await fetch(MANIFEST_URL);
		if (!response.ok) {
			log(`Manifest fetch failed: HTTP ${response.status}`);
			return false;
		}

		const manifest = await response.json();
		const entry = manifest[archManifestKey()];
		if (!entry) {
			log(`No manifest entry for arch ${archManifestKey()}`);
			return false;
		}

		const currentVersion = app.getVersion();
		if (compareVersions(currentVersion, manifest.version) >= 0) {
			return false;
		}

		if (state.stagedVersion === manifest.version && state.stagedAppPath) {
			mainWindow?.webContents.send('updater:ready');
			return true;
		}

		const { appPath, appsDir, appName } = resolveBundlePaths(process.execPath);

		const writabilityProbe = path.join(appsDir, `.chat-update-wtest-${Date.now()}`);
		try {
			fs.mkdirSync(writabilityProbe);
			fs.rmSync(writabilityProbe, { recursive: true, force: true });
		} catch (error) {
			log(`Install location not writable, skipping update: ${error.message}`);
			return false;
		}

		const zipResponse = await fetch(entry.url);
		if (!zipResponse.ok) {
			log(`Update download failed: HTTP ${zipResponse.status}`);
			return false;
		}
		const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());

		const actualSha512 = sha512Hex(zipBuffer);
		if (actualSha512.toLowerCase() !== String(entry.sha512).toLowerCase()) {
			log('Update download failed checksum verification');
			return false;
		}

		const message = buildSignedMessage({
			version: manifest.version,
			arch: archManifestKey(),
			sha512: actualSha512
		});
		if (
			!verifySignature({
				publicKeyPem: PUBLIC_KEY_PEM,
				message,
				signatureBase64: entry.signature
			})
		) {
			log('Update signature verification failed - refusing to install');
			return false;
		}

		const stagingRoot = path.join(appsDir, '.chat-update-staging');
		fs.rmSync(stagingRoot, { recursive: true, force: true });
		fs.mkdirSync(stagingRoot, { recursive: true });

		const zipPath = path.join(stagingRoot, 'update.zip');
		fs.writeFileSync(zipPath, zipBuffer);

		const extract = spawnSync('/usr/bin/ditto', ['-xk', zipPath, stagingRoot]);
		if (extract.status !== 0) {
			log(`ditto extraction failed: ${extract.stderr?.toString() ?? extract.status}`);
			fs.rmSync(stagingRoot, { recursive: true, force: true });
			return false;
		}

		const stagedAppPath = path.join(stagingRoot, appName);
		if (!fs.existsSync(stagedAppPath)) {
			log(`Extracted bundle not found at ${stagedAppPath}`);
			fs.rmSync(stagingRoot, { recursive: true, force: true });
			return false;
		}

		state.stagedVersion = manifest.version;
		state.stagedAppPath = stagedAppPath;
		state.oldAppPath = appPath;

		log(`Update ${manifest.version} staged and verified, ready to install`);
		mainWindow?.webContents.send('updater:ready');
		return true;
	} catch (error) {
		log(`Update check failed: ${error.message}`);
		return false;
	} finally {
		state.checking = false;
	}
}

function quitAndInstall() {
	if (!state.stagedAppPath || !state.oldAppPath) {
		log('quitAndInstall called with no staged update - ignoring');
		return;
	}

	const oldApp = state.oldAppPath;
	const newApp = state.stagedAppPath;
	const log_ = logFile();

	const script = `#!/bin/sh
OLD_APP=${shQuote(oldApp)}
NEW_APP=${shQuote(newApp)}
LOG=${shQuote(log_)}

i=0
while pgrep -f "$OLD_APP/Contents" >/dev/null 2>&1; do
  i=$((i+1))
  [ "$i" -gt 30 ] && break
  sleep 0.5
done

BACKUP="$OLD_APP.bak-$$"
if mv "$OLD_APP" "$BACKUP" 2>>"$LOG" && mv "$NEW_APP" "$OLD_APP" 2>>"$LOG"; then
  rm -rf "$BACKUP" 2>>"$LOG"
  open "$OLD_APP"
elif [ -d "$BACKUP" ]; then
  mv "$BACKUP" "$OLD_APP" 2>>"$LOG"
  open "$OLD_APP" 2>>"$LOG"
fi
rm -f "$0"
`;

	const scriptPath = path.join(app.getPath('temp'), `chat-update-swap-${Date.now()}.sh`);
	fs.writeFileSync(scriptPath, script, { mode: 0o755 });

	log(`Quitting to install update ${state.stagedVersion}`);
	spawn('/bin/sh', [scriptPath], { detached: true, stdio: 'ignore' }).unref();
	app.quit();
}

module.exports = { checkForUpdate, quitAndInstall };
