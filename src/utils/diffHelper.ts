import * as diff from 'diff';
import { FileDiff, HunkLine } from '../models/types';

/**
 * Computes a structured line-by-line diff between two file contents.
 */
export function generateFileDiff(filePath: string, baseContent: string, targetContent: string): FileDiff {
	const patch = diff.structuredPatch(filePath, filePath, baseContent, targetContent, '', '');

	const hunks = patch.hunks.map((hunk) => {
		let oldLinePtr = hunk.oldStart;
		let newLinePtr = hunk.newStart;

		const lines: HunkLine[] = hunk.lines.map((lineStr) => {
			const typeIndicator = lineStr[0];
			const content = lineStr.slice(1);

			if (typeIndicator === '+') {
				const line: HunkLine = {
					type: 'added',
					content,
					newLineNumber: newLinePtr,
				};
				newLinePtr++;
				return line;
			} else if (typeIndicator === '-') {
				const line: HunkLine = {
					type: 'deleted',
					content,
					oldLineNumber: oldLinePtr,
				};
				oldLinePtr++;
				return line;
			} else {
				const line: HunkLine = {
					type: 'unchanged',
					content,
					oldLineNumber: oldLinePtr,
					newLineNumber: newLinePtr,
				};
				oldLinePtr++;
				newLinePtr++;
				return line;
			}
		});

		return {
			oldStart: hunk.oldStart,
			oldLines: hunk.oldLines,
			newStart: hunk.newStart,
			newLines: hunk.newLines,
			lines,
		};
	});

	return {
		filePath,
		hunks,
	};
}

/**
 * Formats a FileDiff into a clean readable string with line numbers that can be passed to Gemini.
 */
export function formatDiffForLlm(fileDiff: FileDiff): string {
	if (fileDiff.hunks.length === 0) {
		return `File: ${fileDiff.filePath} (No changes)\n`;
	}

	let output = `File: ${fileDiff.filePath}\n`;

	for (const hunk of fileDiff.hunks) {
		output += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
		for (const line of hunk.lines) {
			if (line.type === 'added') {
				output += `+Line ${line.newLineNumber}: ${line.content}\n`;
			} else if (line.type === 'deleted') {
				output += `-Line ${line.oldLineNumber}: ${line.content}\n`;
			} else {
				output += ` Line ${line.newLineNumber}: ${line.content}\n`;
			}
		}
	}

	return output;
}

/**
 * Normalizes file paths to have a leading slash for consistent mapping.
 */
function normalizePath(filePath: string): string {
	const trimmed = filePath.trim();
	return trimmed.startsWith('/') ? trimmed : '/' + trimmed;
}

/**
 * Returns a Map of normalized file paths to a Set of line numbers that were actually added/modified in the diffs.
 */
export function getModifiedLinesMap(fileDiffs: FileDiff[]): Map<string, Set<number>> {
	const map = new Map<string, Set<number>>();

	for (const fileDiff of fileDiffs) {
		const normPath = normalizePath(fileDiff.filePath);
		const modifiedLines = new Set<number>();

		for (const hunk of fileDiff.hunks) {
			for (const line of hunk.lines) {
				if (line.type === 'added' && line.newLineNumber !== undefined) {
					modifiedLines.add(line.newLineNumber);
				}
			}
		}

		map.set(normPath, modifiedLines);
	}

	return map;
}
