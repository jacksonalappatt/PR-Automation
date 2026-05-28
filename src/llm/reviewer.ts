import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import { AppConfig, FileDiff, ReviewComment } from '../models/types';
import { formatDiffForLlm } from '../utils/diffHelper';

export class GeminiReviewer {
	private ai: GoogleGenAI;
	private guidelines: string;
	private config: AppConfig;

	constructor(config: AppConfig) {
		this.config = config;
		this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

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
	 * Helper to execute generateContent with fallback models if a 503/high-demand error occurs.
	 */
	private async executeGenerateContent(contents: any, config: any, primaryModel: string): Promise<any> {
		const fallbackModels = [primaryModel, 'gemini-2.0-flash', 'gemini-1.5-flash'];

		// Filter out duplicates in case the configured model is already one of the fallbacks
		const uniqueModels = Array.from(new Set(fallbackModels));

		let lastError: any = null;

		for (const model of uniqueModels) {
			try {
				if (model !== primaryModel) {
					console.warn(`[Gemini API] Primary model '${primaryModel}' failed or overloaded. Falling back to alternative model '${model}'...`);
				}

				const response = await this.ai.models.generateContent({
					model: model,
					contents: contents,
					config: config,
				});

				return response;
			} catch (err: any) {
				lastError = err;
				const errString = String(err).toLowerCase();

				// Match 503, unavailable, high demand, or resource exhausted errors
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
					// Propagate immediately if it's not a service capacity error (e.g. auth, api key invalid, bad request)
					throw err;
				}
			}
		}

		// If all models failed, throw the last capacity error
		throw lastError;
	}

	/**
	 * Reviews file diffs using the Gemini API against the guidelines.
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

		console.log('Sending changes to Gemini for review...');

		try {
			const response = await this.executeGenerateContent(
				[{ role: 'user', parts: [{ text: diffsText }] }],
				{
					systemInstruction: systemInstruction,
					responseMimeType: 'application/json',
				},
				this.config.geminiModel,
			);

			const responseText = response.text || '';

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
				console.log('Gemini returned empty response.');
				return [];
			}

			const comments: ReviewComment[] = JSON.parse(cleanedJson);

			if (!Array.isArray(comments)) {
				console.error('Expected JSON array from Gemini, got:', cleanedJson);
				return [];
			}

			console.log(`Successfully received ${comments.length} review suggestions from Gemini.`);
			return comments;
		} catch (error) {
			console.error('Error during Gemini API review execution:', error);
			return [];
		}
	}
}
