import { IGitApi } from 'azure-devops-node-api/GitApi';
import { GitPullRequest, PullRequestStatus, GitPullRequestCommentThread, CommentThreadStatus, Comment, CommentType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { AppConfig, ReviewComment } from '../models/types';

/**
 * Normalizes file paths to have a leading slash, which is the standard in Azure DevOps iteration item paths.
 */
export function normalizePath(filePath: string): string {
	const trimmed = filePath.trim();
	return trimmed.startsWith('/') ? trimmed : '/' + trimmed;
}

/**
 * Resolves active non-draft PRs assigned to the current user in the repository.
 */
export async function getAssignedPRs(gitApi: IGitApi, repoId: string, projectName: string, userUniqueName: string): Promise<GitPullRequest[]> {
	console.log(`Fetching active PRs for repo '${repoId}'...`);

	// Fetch active PRs in the repository
	const prs = await gitApi.getPullRequests(repoId, { status: PullRequestStatus.Active }, projectName);

	if (!prs || prs.length === 0) {
		console.log('No active PRs found in the repository.');
		return [];
	}

	// Filter PRs that are:
	// 1. Not draft (isDraft is false/undefined)
	// 2. Assigned to the current user (user is listed as a reviewer)
	const filteredPrs = prs.filter((pr) => {
		if (pr.isDraft) return false;

		// Check if current user is in the reviewers list
		const isReviewer = pr.reviewers?.some((reviewer) => {
			const uniqueName = reviewer.uniqueName || '';
			const id = reviewer.id || '';
			return uniqueName.toLowerCase() === userUniqueName.toLowerCase() || id.toLowerCase() === userUniqueName.toLowerCase();
		});

		return isReviewer;
	});

	console.log(`Found ${filteredPrs.length} active, non-draft PRs assigned to user '${userUniqueName}'.`);
	return filteredPrs;
}

/**
 * Posts review comments to the PR after filtering out duplicate or existing comments on the same file and line.
 */
export async function postPRReviews(gitApi: IGitApi, repoId: string, projectName: string, pr: GitPullRequest, proposedComments: ReviewComment[], config: AppConfig): Promise<void> {
	const prId = pr.pullRequestId;
	if (!prId) return;

	if (proposedComments.length === 0) {
		console.log(`[PR #${prId}] No review comments to process.`);
		return;
	}

	console.log(`[PR #${prId}] Fetching existing comment threads to prevent duplicates...`);
	// node-api method is getThreads
	const existingThreads = await gitApi.getThreads(repoId, prId, projectName);

	// Process and filter proposed comments
	for (const proposed of proposedComments) {
		const normPath = normalizePath(proposed.filePath);

		// Check if we already have an identical comment on the exact same file and line
		const isDuplicate = existingThreads.some((thread: GitPullRequestCommentThread) => {
			const threadPath = thread.threadContext?.filePath ? normalizePath(thread.threadContext.filePath) : '';
			const threadLine = thread.threadContext?.rightFileStart?.line;

			// Path and line must match
			if (threadPath !== normPath || threadLine !== proposed.line) {
				return false;
			}

			// Check if any comment in this thread has similar text
			return (
				thread.comments?.some((comment: Comment) => {
					const existingText = (comment.content || '').trim().toLowerCase();
					const newText = proposed.comment.trim().toLowerCase();
					return existingText.includes(newText) || newText.includes(existingText);
				}) || false
			);
		});

		if (isDuplicate) {
			console.log(`[PR #${prId}] Skipping duplicate comment on ${proposed.filePath}:${proposed.line}: "${proposed.comment.substring(0, 30)}..."`);
			continue;
		}

		if (config.dryRun) {
			console.log(`[PR #${prId}] [DRY RUN] Would post comment to ${proposed.filePath}:${proposed.line}: "${proposed.comment}"`);
			continue;
		}

		console.log(`[PR #${prId}] Posting comment to ${proposed.filePath}:${proposed.line}...`);

		const newThread: GitPullRequestCommentThread = {
			comments: [
				{
					parentCommentId: 0,
					content: proposed.comment,
					commentType: CommentType.Text, // Use enum instead of hardcoded 1
				} as Comment,
			],
			status: CommentThreadStatus.Active,
			threadContext: {
				filePath: normPath,
				rightFileStart: {
					line: proposed.line,
					offset: config.commentOffset, // De-hardcoded: read from configuration offset
				},
				rightFileEnd: {
					line: proposed.line,
					offset: config.commentOffset, // De-hardcoded: read from configuration offset
				},
			},
		};

		try {
			await gitApi.createThread(newThread, repoId, prId, projectName);
		} catch (err) {
			console.error(`[PR #${prId}] Failed to post comment on ${proposed.filePath}:${proposed.line}:`, err);
		}
	}

	console.log(`[PR #${prId}] Completed reviews processing.`);
}
