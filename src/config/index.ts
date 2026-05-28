import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppConfig } from '../models/types';

// Load environment variables from .env file
dotenv.config();

// Default values to avoid hardcoding in standard typescript code
const DEFAULTS = {
	GEMINI_MODEL: 'gemini-2.5-flash',
	GUIDELINES_PATH: './guidelines.md',
	DRY_RUN: 'false',
	COMMENT_OFFSET: '1',
};

export function loadConfig(): AppConfig {
	const azurePat = process.env.AZURE_PERSONAL_ACCESS_TOKEN || '';
	const azureOrgUrl = process.env.AZURE_ORG_URL || '';
	const azureProjectName = process.env.AZURE_PROJECT_NAME || '';
	const azureRepositoryId = process.env.AZURE_REPOSITORY_ID || '';
	const geminiApiKey = process.env.GEMINI_API_KEY || '';

	// Read with defaults
	const geminiModel = process.env.GEMINI_MODEL || DEFAULTS.GEMINI_MODEL;
	const guidelinesPath = process.env.GUIDELINES_PATH || DEFAULTS.GUIDELINES_PATH;
	const dryRunStr = process.env.DRY_RUN || DEFAULTS.DRY_RUN;
	const dryRun = dryRunStr.toLowerCase() === 'true';

	const commentOffsetStr = process.env.COMMENT_OFFSET || DEFAULTS.COMMENT_OFFSET;
	const commentOffset = parseInt(commentOffsetStr, 10) || 1;

	const missing: string[] = [];
	if (!azurePat || azurePat === 'your_azure_personal_access_token_here') {
		missing.push('AZURE_PERSONAL_ACCESS_TOKEN');
	}
	if (!azureOrgUrl || azureOrgUrl === 'https://dev.azure.com/your_organization_name') {
		missing.push('AZURE_ORG_URL');
	}
	if (!azureProjectName || azureProjectName === 'your_project_name') {
		missing.push('AZURE_PROJECT_NAME');
	}
	if (!azureRepositoryId || azureRepositoryId === 'your_repository_id_or_name') {
		missing.push('AZURE_REPOSITORY_ID');
	}
	if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here') {
		missing.push('GEMINI_API_KEY');
	}

	if (missing.length > 0) {
		console.error(`Error: Missing required environment variables: ${missing.join(', ')}`);
		console.error('Please configure your .env file with actual credentials.');
		process.exit(1);
	}

	return {
		azurePat,
		azureOrgUrl,
		azureProjectName,
		azureRepositoryId,
		geminiApiKey,
		geminiModel,
		guidelinesPath: path.resolve(guidelinesPath),
		dryRun,
		commentOffset,
	};
}
