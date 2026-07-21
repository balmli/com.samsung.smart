import {randomUUID} from 'crypto';
import {createReadStream} from 'fs';
import {createServer, IncomingMessage, Server, ServerResponse} from 'http';
import {isIP} from 'net';
import {join} from 'path';

import {
    ensureUniqueIntegrationIdentity,
    IntegrationProfile,
    integrationClientName,
    IntegrationProfileStore,
    toPublicProfile,
} from './core/IntegrationProfileStore';
import {HumanCheckpointBroker, HumanOutcome, IntegrationRunner, RunSnapshot} from './core/IntegrationRunner';
import {IntegrationLogEntry, SamsungIntegrationSession} from './SamsungIntegrationSession';
import {samsungApplicationKey} from '../drivers/Samsung/SamsungOperations';
import {createSamsungIntegrationSuite} from './suite';

const CONTENT_TYPES: Record<string, string> = {
    '/': 'text/html; charset=utf-8',
    '/app.js': 'text/javascript; charset=utf-8',
    '/form.js': 'text/javascript; charset=utf-8',
    '/styles.css': 'text/css; charset=utf-8',
};

function sendJson(response: ServerResponse, status: number, value: unknown): void {
    response.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
    response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<any> {
    let body = '';
    for await (const chunk of request) {
        body += chunk;
        if (body.length > 65536) {
            throw new Error('Request body is too large');
        }
    }
    return body ? JSON.parse(body) : {};
}

export class IntegrationWebServer {
    private readonly server: Server;
    private readonly checkpoints = new HumanCheckpointBroker();
    private readonly events = new Set<ServerResponse>();
    private readonly logs: IntegrationLogEntry[] = [];
    private session?: SamsungIntegrationSession;
    private runner?: IntegrationRunner;
    private latestRun?: RunSnapshot;

    constructor(private readonly profiles = new IntegrationProfileStore()) {
        this.server = createServer((request, response) => {
            this.handle(request, response).catch(error => {
                sendJson(response, 500, {error: error instanceof Error ? error.message : String(error)});
            });
        });
    }

    async listen(port = 8765, host = '127.0.0.1'): Promise<{host: string; port: number}> {
        await new Promise<void>((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(port, host, () => resolve());
        });
        const address = this.server.address();
        return {host, port: typeof address === 'object' && address ? address.port : port};
    }

    async close(): Promise<void> {
        this.session?.close();
        for (const event of this.events) event.end();
        await new Promise<void>((resolve, reject) => this.server.close(error => (error ? reject(error) : resolve())));
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const method = request.method || 'GET';
        const url = new URL(request.url || '/', 'http://127.0.0.1');

        if (method === 'GET' && url.pathname === '/api/events') {
            response.writeHead(200, {
                'cache-control': 'no-cache',
                connection: 'keep-alive',
                'content-type': 'text/event-stream',
            });
            response.write(`data: ${JSON.stringify(await this.state())}\n\n`);
            this.events.add(response);
            request.on('close', () => this.events.delete(response));
            return;
        }
        if (method === 'GET' && url.pathname === '/api/state') {
            sendJson(response, 200, await this.state());
            return;
        }
        if (method === 'GET' && url.pathname === '/api/results') {
            if (!this.latestRun) {
                sendJson(response, 404, {error: 'No test run is available'});
                return;
            }
            response.writeHead(200, {
                'content-disposition': `attachment; filename="samsung-integration-${this.latestRun.id}.json"`,
                'content-type': 'application/json; charset=utf-8',
            });
            response.end(`${JSON.stringify(this.latestRun, null, 2)}\n`);
            return;
        }
        if (method === 'POST' && url.pathname === '/api/profiles') {
            const input = await readJson(request);
            if (isIP(input.ipAddress) !== 4) {
                sendJson(response, 400, {error: 'Enter a valid IPv4 address'});
                return;
            }
            const id = String(input.id || input.ipAddress).replace(/[^a-zA-Z0-9_-]/g, '-');
            const existing = await this.profiles.get(id);
            const clientName = input.clientName || existing?.clientName || integrationClientName(id);
            const profile: IntegrationProfile = ensureUniqueIntegrationIdentity({
                ...existing,
                id,
                clientId: input.clientId || existing?.clientId || `integration-${randomUUID()}`,
                clientName,
                ipAddress: input.ipAddress,
                localIpAddress: input.localIpAddress || undefined,
                macAddress: input.macAddress || undefined,
                token: existing && existing.clientName === clientName ? existing.token : undefined,
            });
            await this.profiles.save(profile);
            sendJson(response, 201, toPublicProfile((await this.profiles.get(profile.id))!));
            this.broadcast();
            return;
        }

        const profileAction = url.pathname.match(/^\/api\/profiles\/([^/]+)\/(connect|run)$/);
        if (method === 'POST' && profileAction) {
            const [, profileId, action] = profileAction;
            if (action === 'connect') {
                await this.connect(decodeURIComponent(profileId));
                sendJson(response, 200, {profile: this.session!.getProfile()});
                return;
            }
            if (!this.session || this.session.getProfile().id !== decodeURIComponent(profileId)) {
                sendJson(response, 409, {error: 'Connect this profile first'});
                return;
            }
            const input = await readJson(request);
            if (this.runner && ['running', 'awaiting-human'].includes(this.runner.getSnapshot().status)) {
                sendJson(response, 409, {error: 'A test run is already active'});
                return;
            }
            const selectedApp = this.session
                .getInstalledApps()
                .find(app => samsungApplicationKey(app) === input.appKey);
            this.runner = new IntegrationRunner(
                createSamsungIntegrationSuite(this.session, {
                    app: selectedApp,
                    browserUrl: input.browserUrl || undefined,
                    channel: input.channel ? Number(input.channel) : undefined,
                    includeDisruptive: true,
                    restoreChannel: input.restoreChannel ? Number(input.restoreChannel) : undefined,
                }),
                this.checkpoints,
            );
            this.runner.on('change', snapshot => {
                this.latestRun = snapshot;
                this.broadcast();
            });
            const run = this.runner.run();
            run.catch(() => undefined);
            sendJson(response, 202, this.runner.getSnapshot());
            return;
        }

        if (method === 'POST' && url.pathname === '/api/answer') {
            const input = await readJson(request);
            const pending = this.checkpoints.getPending();
            if (!pending || pending.id !== input.checkpointId) {
                sendJson(response, 409, {error: 'That checkpoint is no longer pending'});
                return;
            }
            if (!['yes', 'no', 'skip'].includes(input.outcome)) {
                sendJson(response, 400, {error: 'Outcome must be yes, no, or skip'});
                return;
            }
            this.checkpoints.answer({outcome: input.outcome as HumanOutcome, note: input.note || undefined});
            sendJson(response, 202, {accepted: true});
            return;
        }

        if (method === 'GET' && CONTENT_TYPES[url.pathname]) {
            const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
            response.writeHead(200, {'content-type': CONTENT_TYPES[url.pathname]});
            createReadStream(join(__dirname, 'web', filename)).pipe(response);
            return;
        }

        sendJson(response, 404, {error: 'Not found'});
    }

    private async connect(profileId: string): Promise<void> {
        const savedProfile = await this.profiles.get(profileId);
        if (!savedProfile) throw new Error(`Profile ${profileId} was not found`);
        const profile = ensureUniqueIntegrationIdentity(savedProfile);
        if (profile.clientName !== savedProfile.clientName) await this.profiles.save(profile);
        this.session?.close();
        this.logs.length = 0;
        this.session = new SamsungIntegrationSession(profile, this.profiles);
        this.session.on('log', entry => {
            this.logs.push(entry);
            if (this.logs.length > 250) this.logs.shift();
            this.broadcast();
        });
        try {
            await this.session.connectAndAuthorize();
            await this.session.refreshInstalledApps();
            this.broadcast();
        } catch (error) {
            this.session.close();
            this.session = undefined;
            throw error;
        }
    }

    private async state() {
        return {
            profiles: (await this.profiles.list()).map(toPublicProfile),
            activeProfile: this.session?.getProfile(),
            apps: this.session?.getInstalledApps().map(app => ({...app, key: samsungApplicationKey(app)})),
            run: this.runner?.getSnapshot() || this.latestRun,
            logs: this.logs,
        };
    }

    private broadcast(): void {
        this.state()
            .then(state => {
                const event = `data: ${JSON.stringify(state)}\n\n`;
                for (const response of this.events) response.write(event);
            })
            .catch(() => undefined);
    }
}
