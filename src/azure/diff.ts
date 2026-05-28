import { IGitApi } from 'azure-devops-node-api/GitApi';
import { GitPullRequest, GitVersionDescriptor, GitVersionType, VersionControlChangeType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { FileDiff, PRFileDiffs } from '../models/types';
import { generateFileDiff } from '../utils/diffHelper';

/**
 * Helper to convert NodeJS.ReadableStream to string.
 */
function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
	});
}

/**
 * Checks if a file path is a text file that should be reviewed.
 */
export function isTextFile(filePath: string): boolean {
	const binaryExtensions = new Set([
		'png',
		'jpg',
		'jpeg',
		'gif',
		'bmp',
		'ico',
		'webp',
		'pdf',
		'zip',
		'tar',
		'gz',
		'rar',
		'7z',
		'mp3',
		'mp4',
		'wav',
		'avi',
		'mov',
		'flv',
		'exe',
		'dll',
		'so',
		'dylib',
		'bin',
		'woff',
		'woff2',
		'eot',
		'ttf',
	]);

	const ext = filePath.split('.').pop()?.toLowerCase();
	if (!ext) return true; // Default to true if no extension
	return !binaryExtensions.has(ext);
}

/**
 * Retrieves the changes and computes the line-level diffs for a pull request.
 */
export async function getPRDiffs(gitApi: IGitApi, repoId: string, projectName: string, pr: GitPullRequest): Promise<PRFileDiffs> {
	const prId = pr.pullRequestId;
	if (!prId) {
		throw new Error('Pull Request ID is missing.');
	}

	console.log(`[PR #${prId}] Fetching iterations...`);
	const iterations = await gitApi.getPullRequestIterations(repoId, prId, projectName);
	if (!iterations || iterations.length === 0) {
		throw new Error(`No iterations found for PR #${prId}`);
	}

	// Find the latest iteration
	const latestIteration = iterations[iterations.length - 1];
	const iterationId = latestIteration.id;
	if (iterationId === undefined) {
		throw new Error(`Latest iteration ID is undefined for PR #${prId}`);
	}

	console.log(`[PR #${prId}] Fetching changes for iteration ${iterationId}...`);
	const changesResponse = await gitApi.getPullRequestIterationChanges(repoId, prId, iterationId, projectName);

	if (!changesResponse || !changesResponse.changeEntries) {
		console.log(`[PR #${prId}] No changes found in iteration ${iterationId}.`);
		return { prId, files: [] };
	}

	// Set up version descriptors
	const sourceRefName = pr.sourceRefName || '';
	const targetRefName = pr.targetRefName || '';

	const sourceBranch = sourceRefName.startsWith('refs/heads/') ? sourceRefName.substring('refs/heads/'.length) : sourceRefName;
	const targetBranch = targetRefName.startsWith('refs/heads/') ? targetRefName.substring('refs/heads/'.length) : targetRefName;

	const sourceVersion: GitVersionDescriptor = {
		version: sourceBranch,
		versionType: GitVersionType.Branch,
	};

	const targetVersion: GitVersionDescriptor = {
		version: targetBranch,
		versionType: GitVersionType.Branch,
	};

	const files: FileDiff[] = [];

	for (const entry of changesResponse.changeEntries) {
		const item = entry.item;
		if (!item) continue;

		const filePath = item.path;
		if (!filePath) continue;

		// Filter out non-text/binary files or folder objects
		if (item.isFolder || !isTextFile(filePath)) {
			continue;
		}

		const changeType = entry.changeType; // VersionControlChangeType enum
		console.log(`[PR #${prId}] Processing change: ${filePath}`);

		let baseContent = '';
		let targetContent = '';

		// Check if the change type is add (meaning no base content exists)
		const isAdded = changeType !== undefined && (changeType & VersionControlChangeType.Add) !== 0;

		// Check if the change type is delete (meaning no target content exists anymore)
		const isDeleted = changeType !== undefined && (changeType & VersionControlChangeType.Delete) !== 0;

		// Fetch base content (target branch) unless it is a completely new file
		if (!isAdded) {
			try {
				const baseStream = await gitApi.getItemContent(repoId, filePath, projectName, undefined, undefined, undefined, undefined, true, targetVersion);
				baseContent = await streamToString(baseStream);
			} catch (err) {
				// If file doesn't exist in base, default to empty
				console.warn(`[PR #${prId}] Could not fetch base content for ${filePath}, assuming empty.`);
			}
		}

		// Fetch target content (source branch / latest PR branch) unless it was deleted
		if (!isDeleted) {
			try {
				const targetStream = await gitApi.getItemContent(repoId, filePath, projectName, undefined, undefined, undefined, undefined, true, sourceVersion);
				targetContent = await streamToString(targetStream);
			} catch (err) {
				console.warn(`[PR #${prId}] Could not fetch source content for ${filePath}, assuming empty.`);
			}
		}

		// Generate line-by-line structured diff
		const fileDiff = generateFileDiff(filePath, baseContent, targetContent);
		files.push(fileDiff);
	}

	return { prId, files };
}
