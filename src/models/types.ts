export interface AppConfig {
	azurePat: string;
	azureOrgUrl: string;
	azureProjectName: string;
	azureRepositoryId: string;
	geminiApiKey: string;
	geminiModel: string;
	guidelinesPath: string;
	dryRun: boolean;
	commentOffset: number;
}

export interface HunkLine {
	type: 'added' | 'deleted' | 'unchanged';
	content: string;
	newLineNumber?: number; // 1-indexed line number in the modified (right) file
	oldLineNumber?: number; // 1-indexed line number in the base (left) file
}

export interface FileDiff {
	filePath: string;
	hunks: {
		oldStart: number;
		oldLines: number;
		newStart: number;
		newLines: number;
		lines: HunkLine[];
	}[];
}

export interface PRFileDiffs {
	prId: number;
	files: FileDiff[];
}

export interface ReviewComment {
	filePath: string;
	line: number;
	comment: string;
}

export interface UserIdentity {
	id: string;
	displayName: string;
	uniqueName: string;
}
