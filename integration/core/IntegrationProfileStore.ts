import {chmod, mkdir, readFile, writeFile} from 'fs/promises';
import {homedir} from 'os';
import {dirname, join} from 'path';

export interface IntegrationProfile {
    id: string;
    clientId: string;
    clientName: string;
    ipAddress: string;
    localIpAddress?: string;
    macAddress?: string;
    modelName?: string;
    frameTVSupport?: boolean;
    tokenAuthSupport?: boolean;
    token?: string;
}

export type PublicIntegrationProfile = Omit<IntegrationProfile, 'token'> & {paired: boolean};

interface ProfileFile {
    profiles: IntegrationProfile[];
}

export const LEGACY_INTEGRATION_CLIENT_NAME = 'Homey Samsung Integration Tests';

export function integrationClientName(profileId: string): string {
    return `${LEGACY_INTEGRATION_CLIENT_NAME} (${profileId})`;
}

export function ensureUniqueIntegrationIdentity(profile: IntegrationProfile): IntegrationProfile {
    if (profile.clientName !== LEGACY_INTEGRATION_CLIENT_NAME) return profile;
    return {
        ...profile,
        clientName: integrationClientName(profile.id),
        token: undefined,
    };
}

export function defaultIntegrationProfilePath(): string {
    return join(homedir(), '.com.samsung.smart-integration', 'profiles.json');
}

export function toPublicProfile(profile: IntegrationProfile): PublicIntegrationProfile {
    const {token, ...publicProfile} = profile;
    return {...publicProfile, paired: !!token || profile.tokenAuthSupport === false};
}

export class IntegrationProfileStore {
    constructor(private readonly filename = defaultIntegrationProfilePath()) {}

    async list(): Promise<IntegrationProfile[]> {
        const file = await this.read();
        return structuredClone(file.profiles);
    }

    async get(id: string): Promise<IntegrationProfile | undefined> {
        const profile = (await this.list()).find(candidate => candidate.id === id);
        return profile ? structuredClone(profile) : undefined;
    }

    async save(profile: IntegrationProfile): Promise<void> {
        const file = await this.read();
        const index = file.profiles.findIndex(candidate => candidate.id === profile.id);
        if (index >= 0) {
            file.profiles[index] = structuredClone(profile);
        } else {
            file.profiles.push(structuredClone(profile));
        }

        await mkdir(dirname(this.filename), {recursive: true, mode: 0o700});
        await writeFile(this.filename, `${JSON.stringify(file, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
        await chmod(this.filename, 0o600);
    }

    private async read(): Promise<ProfileFile> {
        try {
            const contents = await readFile(this.filename, 'utf8');
            const file = JSON.parse(contents);
            return {profiles: Array.isArray(file.profiles) ? file.profiles : []};
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return {profiles: []};
            }
            throw error;
        }
    }
}
