import { loadConfig } from './config';
import { AzureClient } from './azure/client';
import { getAssignedPRs, postPRReviews, normalizePath } from './azure/pr';
import { getPRDiffs } from './azure/diff';
import { GeminiReviewer } from './llm/reviewer';
import { getModifiedLinesMap } from './utils/diffHelper';

async function main() {
	console.log('==================================================');
	console.log('      Starting Azure DevOps PR Reviewer Bot       ');
	console.log('==================================================');

	// 1. Load config
	const config = loadConfig();
	console.log(`Organization URL: ${config.azureOrgUrl}`);
	console.log(`Project Name:     ${config.azureProjectName}`);
	console.log(`Repository:       ${config.azureRepositoryId}`);
	console.log(`Gemini Model:     ${config.geminiModel}`);
	console.log(`Dry Run Mode:     ${config.dryRun ? 'ENABLED' : 'DISABLED'}`);
	console.log(`Guidelines File:  ${config.guidelinesPath}`);

	try {
		// 2. Initialize Azure Client & resolve current user
		const client = new AzureClient(config);
		const gitApi = await client.getGitApi();

		console.log('Authenticating and resolving user identity...');
		const currentUser = await client.getCurrentUser();
		console.log(`Authenticated User: ${currentUser.displayName} (${currentUser.uniqueName})`);

		console.log('Resolving user team memberships...');
		const userTeams = await client.getUserTeams(config.azureProjectName);
		console.log(`User belongs to ${userTeams.length} teams: ${userTeams.map((t) => t.name).join(', ') || 'None'}`);
		const userTeamIds = userTeams.map((t) => t.id);

		// 3. Find PRs assigned to user or their teams
		const assignedPrs = await getAssignedPRs(gitApi, config.azureRepositoryId, config.azureProjectName, currentUser.uniqueName, userTeamIds);

		if (assignedPrs.length === 0) {
			console.log('No PRs require review from this user or their teams. Exiting.');
			return;
		}

		// 4. Initialize Gemini Reviewer
		console.log('Initializing Google Gemini AI Reviewer...');
		const reviewer = new GeminiReviewer(config);

		// 5. Review each PR
		for (const pr of assignedPrs) {
			const prId = pr.pullRequestId;
			const title = pr.title || 'Untitled';
			console.log('\n--------------------------------------------------');
			console.log(`Reviewing PR #${prId}: "${title}"`);
			console.log(`Source Branch: ${pr.sourceRefName}`);
			console.log(`Target Branch: ${pr.targetRefName}`);
			console.log('--------------------------------------------------');

			try {
				// Retrieve file changes and compute diffs
				const prDiffs = await getPRDiffs(gitApi, config.azureRepositoryId, config.azureProjectName, pr);

				if (prDiffs.files.length === 0) {
					console.log(`[PR #${prId}] No text changes detected in this pull request.`);
					continue;
				}

				console.log(`[PR #${prId}] Found ${prDiffs.files.length} changed files to review.`);

				// Ask Gemini to review the diffs against the guidelines
				const suggestedReviews = await reviewer.reviewDiffs(prDiffs.files);

				// STRICT FILTER: Only keep comments that strictly target lines added/modified in this PR
				const modifiedLinesMap = getModifiedLinesMap(prDiffs.files);
				const filteredReviews = suggestedReviews.filter((suggested) => {
					const normPath = normalizePath(suggested.filePath);
					const modifiedLinesSet = modifiedLinesMap.get(normPath);

					if (!modifiedLinesSet) {
						console.log(`[PR #${prId}] Discarded AI suggestion on ${suggested.filePath} (file has no changes in this PR).`);
						return false;
					}

					const isModified = modifiedLinesSet.has(suggested.line);
					if (!isModified) {
						console.log(`[PR #${prId}] Discarded AI suggestion on ${suggested.filePath}:${suggested.line} (line was not modified in this PR).`);
					}
					return isModified;
				});

				console.log(`[PR #${prId}] Retained ${filteredReviews.length} of ${suggestedReviews.length} AI suggestions after strict line-modification filtering.`);

				// Post review comments to PR, avoiding duplicates
				await postPRReviews(gitApi, config.azureRepositoryId, config.azureProjectName, pr, filteredReviews, config);
			} catch (err) {
				console.error(`Error reviewing PR #${prId}:`, err);
			}
		}

		console.log('\n==================================================');
		console.log('            PR Review Run Completed!              ');
		console.log('==================================================');
	} catch (error) {
		console.error('Fatal Error during application execution:', error);
		process.exit(1);
	}
}

// Run the script
main().catch((error) => {
	console.error('Fatal Error in main thread:', error);
	process.exit(1);
});
