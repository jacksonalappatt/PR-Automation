import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppConfig } from '../models/types';

// Load environment variables from .env file
dotenv.config();

// Default values to avoid hardcoding in standard typescript code
const DEFAULTS = {
	LLM_PROVIDER: 'gemini',
	GEMINI_MODEL: 'gemini-2.5-flash',
	OPENAI_MODEL: 'gpt-4o',
	AZURE_OPENAI_API_VERSION: '2024-05-01-preview',
	GUIDELINES_PATH: './guidelines.md',
	DRY_RUN: 'false',
	COMMENT_OFFSET: '1',
};

export function loadConfig(): AppConfig {
	// Azure DevOps Connection Settings
	const azurePat = process.env.AZURE_PERSONAL_ACCESS_TOKEN || '';
	const azureOrgUrl = process.env.AZURE_ORG_URL || '';
	const azureProjectName = process.env.AZURE_PROJECT_NAME || '';
	const azureRepositoryId = process.env.AZURE_REPOSITORY_ID || '';

	// LLM Provider Setup
	const llmProvider = (process.env.LLM_PROVIDER || DEFAULTS.LLM_PROVIDER).toLowerCase();

	// Gemini settings
	const geminiApiKey = process.env.GEMINI_API_KEY || '';
	const geminiModel = process.env.GEMINI_MODEL || DEFAULTS.GEMINI_MODEL;

	// OpenAI settings
	const openaiApiKey = process.env.OPENAI_API_KEY || '';
	const openaiModel = process.env.OPENAI_MODEL || DEFAULTS.OPENAI_MODEL;

	// Azure OpenAI settings
	const azureOpenaiApiKey = process.env.AZURE_OPENAI_API_KEY || '';
	const azureOpenaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
	const azureOpenaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || '';
	const azureOpenaiApiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULTS.AZURE_OPENAI_API_VERSION;

	// Custom Settings
	const guidelinesPath = process.env.GUIDELINES_PATH || DEFAULTS.GUIDELINES_PATH;
	const dryRunStr = process.env.DRY_RUN || DEFAULTS.DRY_RUN;
	const dryRun = dryRunStr.toLowerCase() === 'true';
	const commentOffsetStr = process.env.COMMENT_OFFSET || DEFAULTS.COMMENT_OFFSET;
	const commentOffset = parseInt(commentOffsetStr, 10) || 1;

	const missing: string[] = [];

	// Validate Azure DevOps settings
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

	// Validate LLM settings conditionally based on provider
	if (llmProvider === 'gemini') {
		if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here') {
			missing.push('GEMINI_API_KEY');
		}
	} else if (llmProvider === 'openai') {
		if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
			missing.push('OPENAI_API_KEY');
		}
	} else if (llmProvider === 'azure-openai') {
		if (!azureOpenaiApiKey || azureOpenaiApiKey === 'your_azure_api_key_here') {
			missing.push('AZURE_OPENAI_API_KEY');
		}
		if (!azureOpenaiEndpoint || azureOpenaiEndpoint.includes('your-resource')) {
			missing.push('AZURE_OPENAI_ENDPOINT');
		}
		if (!azureOpenaiDeployment || azureOpenaiDeployment === 'your-deployment-name') {
			missing.push('AZURE_OPENAI_DEPLOYMENT');
		}
	} else {
		console.error(`Error: Unsupported LLM_PROVIDER value '${llmProvider}'. Supported values: gemini, openai, azure-openai`);
		process.exit(1);
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
		llmProvider,
		geminiApiKey,
		geminiModel,
		openaiApiKey,
		openaiModel,
		azureOpenaiApiKey,
		azureOpenaiEndpoint,
		azureOpenaiDeployment,
		azureOpenaiApiVersion,
		guidelinesPath: path.resolve(guidelinesPath),
		dryRun,
		commentOffset,
	};
}
