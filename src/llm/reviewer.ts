import { GoogleGenAI } from '@google/genai';
import OpenAI, { AzureOpenAI } from 'openai';
import * as fs from 'fs';
import { AppConfig, FileDiff, ReviewComment } from '../models/types';
import { formatDiffForLlm } from '../utils/diffHelper';

export class LlmReviewer {
	private geminiClient?: GoogleGenAI;
	private openaiClient?: OpenAI;
	private azureOpenaiClient?: AzureOpenAI;

	private guidelines: string;
	private config: AppConfig;

	constructor(config: AppConfig) {
		this.config = config;

		// Initialize the appropriate client based on the configured provider
		if (config.llmProvider === 'gemini') {
			this.geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
		} else if (config.llmProvider === 'openai') {
			this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
		} else if (config.llmProvider === 'azure-openai') {
			this.azureOpenaiClient = new AzureOpenAI({
				apiKey: config.azureOpenaiApiKey,
				endpoint: config.azureOpenaiEndpoint,
				deployment: config.azureOpenaiDeployment,
				apiVersion: config.azureOpenaiApiVersion,
			});
		}

		// Load the guidelines file
		try {
			this.guidelines = fs.readFileSync(config.guidelinesPath, 'utf8');
		} catch (err) {
			console.warn(`Warning: Could not read guidelines file at ${config.guidelinesPath}. Using standard code review standards.`);
			this.guidelines = `
        - Keep code clean, readable, and well-structured.
        - Ensure proper error handling.
        - Avoid repeating calculations or using generic types when possible.
      `;
		}
	}

	/**
	 * Reviews file diffs using the configured LLM API against the guidelines.
	 */
	public async reviewDiffs(fileDiffs: FileDiff[]): Promise<ReviewComment[]> {
		if (fileDiffs.length === 0) {
			console.log('No files to review.');
			return [];
		}

		// Prepare files diff representation for the LLM
		let diffsText = '';
		for (const fileDiff of fileDiffs) {
			diffsText += formatDiffForLlm(fileDiff) + '\n---\n';
		}

		const systemInstruction = `
You are an expert AI code reviewer. Your task is to review the provided git diffs against the specified guidelines.

Here are the PR Review Guidelines:
${this.guidelines}

Instructions:
1. ONLY comment on lines that were ADDED or MODIFIED. These lines are marked in the diff with a plus sign and the actual 1-indexed target line number, like this:
   "+Line <number>: <content>"
2. Your comment must correspond to that EXACT line number. Do NOT comment on deleted lines (marked with "-Line <number>:") or unchanged lines.
3. Be specific, constructive, and precise. Offer actual code suggestions if appropriate, but keep the comments concise.
4. Output your response as a valid JSON array of objects. Do NOT include any explanations, introduction, or markdown code blocks (e.g. do not wrap in \`\`\`json). Just the raw JSON array.
5. If no issues are found, return an empty array: []

JSON Schema:
[
  {
    "filePath": "relative/path/to/file.ts",
    "line": 42,
    "comment": "Your review comment here."
  }
]
`;

		console.log(`Sending changes to ${this.config.llmProvider.toUpperCase()} for review...`);

		try {
			let responseText = '';

			if (this.config.llmProvider === 'gemini') {
				responseText = await this.reviewWithGemini(diffsText, systemInstruction);
			} else if (this.config.llmProvider === 'openai' && this.openaiClient) {
				responseText = await this.reviewWithOpenAi(diffsText, systemInstruction);
			} else if (this.config.llmProvider === 'azure-openai' && this.azureOpenaiClient) {
				responseText = await this.reviewWithAzureOpenAi(diffsText, systemInstruction);
			} else {
				throw new Error(`LLM Client for provider '${this.config.llmProvider}' is not initialized.`);
			}

			// Clean up markdown block styling if the model ignored the raw output instruction
			let cleanedJson = responseText.trim();
			if (cleanedJson.startsWith('```json')) {
				cleanedJson = cleanedJson.substring(7);
			} else if (cleanedJson.startsWith('```')) {
				cleanedJson = cleanedJson.substring(3);
			}
			if (cleanedJson.endsWith('```')) {
				cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
			}
			cleanedJson = cleanedJson.trim();

			if (!cleanedJson) {
				console.log('LLM returned empty response.');
				return [];
			}

			const comments: ReviewComment[] = JSON.parse(cleanedJson);

			if (!Array.isArray(comments)) {
				console.error('Expected JSON array from LLM, got:', cleanedJson);
				return [];
			}

			console.log(`Successfully received ${comments.length} review suggestions from LLM.`);
			return comments;
		} catch (error) {
			console.error(`Error during LLM API review execution (${this.config.llmProvider}):`, error);
			return [];
		}
	}

	/**
	 * Private helper to execute reviews via Google Gemini with fallback handling.
	 */
	private async reviewWithGemini(diffsText: string, systemInstruction: string): Promise<string> {
		if (!this.geminiClient) throw new Error('Gemini client not initialized.');

		const fallbackModels = [this.config.geminiModel, 'gemini-2.0-flash', 'gemini-1.5-flash'];

		const uniqueModels = Array.from(new Set(fallbackModels));
		let lastError: any = null;

		for (const model of uniqueModels) {
			try {
				if (model !== this.config.geminiModel) {
					console.warn(`[Gemini API] Primary model '${this.config.geminiModel}' failed or overloaded. Falling back to alternative model '${model}'...`);
				}

				const response = await this.geminiClient.models.generateContent({
					model: model,
					contents: [{ role: 'user', parts: [{ text: diffsText }] }],
					config: {
						systemInstruction: systemInstruction,
						responseMimeType: 'application/json',
					},
				});

				return response.text || '';
			} catch (err: any) {
				lastError = err;
				const errString = String(err).toLowerCase();

				const is503OrUnavailable =
					errString.includes('503') ||
					errString.includes('unavailable') ||
					errString.includes('high demand') ||
					errString.includes('resource_exhausted') ||
					errString.includes('exhausted');

				if (is503OrUnavailable) {
					console.warn(`[Gemini API] Model '${model}' experienced high demand or 503 unavailable status.`);
					continue;
				} else {
					throw err;
				}
			}
		}

		throw lastError;
	}

	/**
	 * Private helper to execute reviews via OpenAI.
	 */
	private async reviewWithOpenAi(diffsText: string, systemInstruction: string): Promise<string> {
		if (!this.openaiClient) throw new Error('OpenAI client not initialized.');

		const response = await this.openaiClient.chat.completions.create({
			model: this.config.openaiModel,
			messages: [
				{ role: 'system', content: systemInstruction },
				{ role: 'user', content: diffsText },
			],
			response_format: { type: 'json_object' },
		});

		return response.choices[0].message.content || '';
	}

	/**
	 * Private helper to execute reviews via Azure OpenAI.
	 */
	private async reviewWithAzureOpenAi(diffsText: string, systemInstruction: string): Promise<string> {
		if (!this.azureOpenaiClient) throw new Error('Azure OpenAI client not initialized.');

		const response = await this.azureOpenaiClient.chat.completions.create({
			messages: [
				{ role: 'system', content: systemInstruction },
				{ role: 'user', content: diffsText },
			],
			model: '', // Determined by your Azure deployment
			response_format: { type: 'json_object' },
		});

		return response.choices[0].message.content || '';
	}
}
