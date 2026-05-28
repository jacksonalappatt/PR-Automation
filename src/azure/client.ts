import * as azdev from 'azure-devops-node-api';
import { IGitApi } from 'azure-devops-node-api/GitApi';
import { AppConfig, UserIdentity } from '../models/types';

export class AzureClient {
	private connection: azdev.WebApi;

	constructor(config: AppConfig) {
		const authHandler = azdev.getPersonalAccessTokenHandler(config.azurePat);
		this.connection = new azdev.WebApi(config.azureOrgUrl, authHandler);
	}

	/**
	 * Returns initialized Git API client.
	 */
	public async getGitApi(): Promise<IGitApi> {
		return await this.connection.getGitApi();
	}

	/**
	 * Retrieves the current user's profile details based on the PAT used.
	 */
	public async getCurrentUser(): Promise<UserIdentity> {
		const locationsApi = await this.connection.getLocationsApi();
		const connectionData = await locationsApi.getConnectionData();

		if (!connectionData.authenticatedUser) {
			throw new Error('Failed to retrieve authenticated user from Azure DevOps connection.');
		}

		const user = connectionData.authenticatedUser as any;
		return {
			id: user.id || '',
			displayName: user.customDisplayName || user.providerDisplayName || user.displayName || 'Azure DevOps User',
			uniqueName: user.uniqueName || user.id || '',
		};
	}
}
