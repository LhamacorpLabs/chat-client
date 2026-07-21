const path = require('node:path');

// execPath looks like /Applications/Chat.app/Contents/MacOS/Chat - walk up
// three levels (MacOS -> Contents -> Chat.app) to find the bundle root.
function resolveBundlePaths(execPath) {
	const appPath = path.posix.dirname(path.posix.dirname(path.posix.dirname(execPath)));
	const appsDir = path.posix.dirname(appPath);
	const appName = path.posix.basename(appPath);

	return { appPath, appsDir, appName };
}

module.exports = { resolveBundlePaths };
