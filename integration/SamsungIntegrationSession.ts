import {EventEmitter} from 'events';
import {networkInterfaces} from 'os';

import {SamsungConfigImpl} from '../lib/SamsungConfig';
import {
    IntegrationProfile,
    IntegrationProfileStore,
    PublicIntegrationProfile,
    toPublicProfile,
} from './core/IntegrationProfileStore';
import {HomeyIpUtil} from '../lib/HomeyIpUtil';
import {DeviceSettings} from '../lib/types';
import {UPnPClientImpl} from '../lib/UPnPClient';
import {SamsungClientImpl} from '../drivers/Samsung/SamsungClient';
import {SamsungOperations} from '../drivers/Samsung/SamsungOperations';

const translations = require('../locales/en.json');

export interface IntegrationLogEntry {
    timestamp: string;
    level: 'debug' | 'error' | 'info' | 'verbose';
    message: string;
}

function translate(key: string, variables?: Record<string, unknown>): string {
    let value: any = key.split('.').reduce((current: any, part) => current?.[part], translations);
    if (typeof value !== 'string') {
        value = key;
    }
    return Object.entries(variables || {}).reduce(
        (message, [name, replacement]) => message.replace(`__${name}__`, String(replacement)),
        value,
    );
}

function findLocalIpAddress(): string {
    for (const addresses of Object.values(networkInterfaces())) {
        const address = addresses?.find(candidate => candidate.family === 'IPv4' && !candidate.internal);
        if (address) {
            return address.address;
        }
    }
    return '127.0.0.1';
}

class IntegrationLogger {
    constructor(private readonly sink: (entry: IntegrationLogEntry) => void) {}

    debug(...args: any[]) {
        this.write('debug', args);
    }

    error(...args: any[]) {
        this.write('error', args);
    }

    info(...args: any[]) {
        this.write('info', args);
    }

    verbose(...args: any[]) {
        this.write('verbose', args);
    }

    private write(level: IntegrationLogEntry['level'], args: any[]) {
        if (args[0] === 'getInfo' && args[2]?.device?.modelName) {
            args = [`getInfo succeeded (${args[2].device.modelName})`];
        }
        const message = args
            .map(value =>
                value instanceof Error ? value.message : typeof value === 'string' ? value : JSON.stringify(value),
            )
            .join(' ')
            .replace(/([?&]token=)[^&\s]+/gi, '$1[redacted]')
            .replace(/\buuid:[a-f0-9-]+\b/gi, '[device-id]')
            .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[tv-address]');
        this.sink({timestamp: new Date().toISOString(), level, message});
    }
}

class IntegrationDeviceAdapter {
    readonly homey: any;
    private readonly settings = new Map<string, any>();

    constructor(
        private readonly profile: IntegrationProfile,
        private readonly onSettingsChanged: (settings: Record<string, any>) => Promise<void>,
        logger: IntegrationLogger,
    ) {
        this.settings.set(DeviceSettings.ipaddress, profile.ipAddress);
        this.settings.set(DeviceSettings.mac_address, profile.macAddress);
        this.settings.set(DeviceSettings.modelName, profile.modelName);
        this.settings.set(DeviceSettings.frameTVSupport, profile.frameTVSupport || false);
        this.settings.set(DeviceSettings.tokenAuthSupport, profile.tokenAuthSupport || false);
        this.settings.set(DeviceSettings.token, profile.token);
        this.settings.set(DeviceSettings.delay_keys, 100);
        this.settings.set(DeviceSettings.delay_channel_keys, 500);
        this.settings.set(DeviceSettings.max_volume, 100);

        this.homey = {
            __: translate,
            arp: {
                getMAC: async () => {
                    const macAddress = this.settings.get(DeviceSettings.mac_address);
                    if (!macAddress) {
                        throw new Error('A MAC address is required for Wake-on-LAN tests');
                    }
                    return macAddress;
                },
            },
            clearTimeout,
            cloud: {
                getLocalAddress: async () => `${profile.localIpAddress || findLocalIpAddress()}:0`,
            },
            setTimeout,
        };
        Object.assign(this, {logger});
    }

    getData() {
        return {id: this.profile.clientId};
    }

    getSetting(key: string): any {
        return this.settings.get(key);
    }

    getSettings(): Record<string, any> {
        return Object.fromEntries(this.settings);
    }

    async setSettings(settings: Record<string, any>): Promise<void> {
        for (const [key, value] of Object.entries(settings)) {
            this.settings.set(key, value);
        }
        await this.onSettingsChanged(settings);
    }
}

class IntegrationHomeyIpUtil implements HomeyIpUtil {
    constructor(private readonly localIpAddress: string) {}

    async getHomeyIpAddress(): Promise<string> {
        return this.localIpAddress;
    }
}

export class SamsungIntegrationSession extends EventEmitter {
    readonly operations: SamsungOperations;
    private readonly adapter: IntegrationDeviceAdapter;
    private readonly client: SamsungClientImpl;
    private profile: IntegrationProfile;

    constructor(
        profile: IntegrationProfile,
        private readonly store: IntegrationProfileStore,
    ) {
        super();
        this.profile = structuredClone(profile);
        const logger = new IntegrationLogger(entry => this.emit('log', entry));
        this.adapter = new IntegrationDeviceAdapter(
            this.profile,
            async settings => {
                this.applySettingsToProfile(settings);
                await this.store.save(this.profile);
            },
            logger,
        );
        const config = new SamsungConfigImpl({device: this.adapter, logger});
        const homeyIpUtil = new IntegrationHomeyIpUtil(this.profile.localIpAddress || findLocalIpAddress());
        this.client = new SamsungClientImpl({
            clientName: this.profile.clientName,
            config,
            device: this.adapter as any,
            port: 8001,
            connectionTimeout: 2 * 60 * 1000,
            homeyIpUtil,
            logger,
        });
        this.operations = new SamsungOperations(this.client, new UPnPClientImpl({config, logger}));
    }

    getProfile(): PublicIntegrationProfile {
        return toPublicProfile(this.profile);
    }

    async inspect(): Promise<PublicIntegrationProfile> {
        const info = await this.operations.getInfo(this.profile.ipAddress, 2000);
        if (!info?.device?.modelName) {
            throw new Error('No supported Samsung TV responded at that IP address');
        }
        if (info.type === 'Samsung Speaker' || this.client.modelClass(info.device.modelName) !== undefined) {
            throw new Error(`Model ${info.device.modelName} is not supported by the maintained Samsung driver`);
        }

        await this.adapter.setSettings({
            [DeviceSettings.modelName]: info.device.modelName,
            [DeviceSettings.frameTVSupport]: info.device.FrameTVSupport === 'true',
            [DeviceSettings.tokenAuthSupport]: info.device.TokenAuthSupport === 'true',
        });
        return this.getProfile();
    }

    async pair(timeout = 60000): Promise<PublicIntegrationProfile> {
        if (this.profile.tokenAuthSupport === false) {
            return this.getProfile();
        }
        if (this.profile.token) {
            return this.getProfile();
        }
        const token = await this.operations.pair(timeout);
        await this.adapter.setSettings({[DeviceSettings.token]: token});
        return this.getProfile();
    }

    async connectAndAuthorize(timeout = 60000): Promise<PublicIntegrationProfile> {
        await this.inspect();
        if (this.profile.tokenAuthSupport && !this.profile.token) {
            await this.pair(timeout);
        }
        await this.operations.connect();
        return this.getProfile();
    }

    close(): void {
        this.operations.close();
    }

    private applySettingsToProfile(settings: Record<string, any>): void {
        if (DeviceSettings.ipaddress in settings) this.profile.ipAddress = settings[DeviceSettings.ipaddress];
        if (DeviceSettings.mac_address in settings) this.profile.macAddress = settings[DeviceSettings.mac_address];
        if (DeviceSettings.modelName in settings) this.profile.modelName = settings[DeviceSettings.modelName];
        if (DeviceSettings.frameTVSupport in settings)
            this.profile.frameTVSupport = settings[DeviceSettings.frameTVSupport];
        if (DeviceSettings.tokenAuthSupport in settings)
            this.profile.tokenAuthSupport = settings[DeviceSettings.tokenAuthSupport];
        if (DeviceSettings.token in settings) this.profile.token = settings[DeviceSettings.token];
    }
}
