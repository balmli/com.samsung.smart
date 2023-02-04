import Device from "homey/lib/Device";
import Homey from "homey/lib/Homey";

const http = require('http.min');
const {default: PQueue} = require("p-queue");
const isPortReachable = require("is-port-reachable");
const wol = require("wake_on_lan");

import { appCodes} from "./apps";
import { keycodes } from "./keys";
import {DeviceSettings} from "./types";
import {SamsungConfig} from "./SamsungConfig";
import {HomeyIpUtil} from "./HomeyIpUtil";

export interface SamsungClient {
    /**
     *
     * @param ipAddress
     */
    getUri(ipAddress?: string): string;

    /**
     * Check if the TV is online.
     * @param timeout
     */
    apiActive(timeout?: number): Promise<boolean>;

    /**
     * Check if the TV is online.
     *
     * @param ipaddress
     * @param port
     * @param timeout
     */
    pingPort(ipaddress?: string, port?: number, timeout?: number): Promise<boolean>;

    /**
     * Fetch the device info from the TV.
     *
     * @param ipAddress
     * @param timeout default 2000ms
     */
    getInfo(ipAddress?: string, timeout?: number): Promise<any>

    /**
     * Initiate a pairing session with the TV.
     */
    pair(): Promise<string>;

    /**
     * Return list of cached apps.
     */
    getApps(): any;

    /**
     * Fetch apps from the TV.
     */
    getListOfApps(): Promise<any>;

    /**
     * Wake the TV.
     */
    wake(): Promise<void>

    /**
     * Turn the TV on.
     */
    turnOn(): Promise<void>;

    /**
     * Turn the TV off.
     */
    turnOff(): Promise<void>;

    /**
     * Send a key / command to the TV.
     * @param aKey
     * @param aCmd
     */
    sendKey(aKey: string, aCmd?: string): Promise<void>;

    /**
     * Send and hold a key / command to the TV.
     * @param aKey
     * @param aDelay
     */
    holdKey(aKey: string, aDelay: number): Promise<void>;

    /**
     * Send a list of keys to the TV.
     *
     * @param commands
     * @param delay
     */
    sendKeys(commands: any, delay?: number): Promise<any>;

    /**
     * Set the channel on the TV.
     *
     * @param channel
     */
    setChannel(channel: number): Promise<any>;

    /**
     * Check if an app is running on the TV.
     *
     * @param app
     */
    isAppRunning(app: any): Promise<boolean>;

    /**
     * Launch an app on the TV.
     *
     * @param app
     * @param launchData
     */
    launchApp(app: any, launchData: any): Promise<any>;

    /**
     * Launch the YouTube app on the TV, with a specific video.
     *
     * @param videoId
     */
    launchYouTube(videoId: string): Promise<void>;

    /**
     * Launch the browser app on the TV, with a specific URL.
     *
     * @param url
     */
    launchBrowser(url: string): Promise<any>;
}


export class SamsungBase implements SamsungClient {

    device?: Device;
    i18n?: Homey;
    config: SamsungConfig;
    port: number;
    connectionTimeout: number;
    homeyIpUtil!: HomeyIpUtil;
    logger: any;
    _apps: any;
    _commandQueue: any;
    stopSearch?: boolean;
    searchTimeout?: NodeJS.Timeout;
    socket: any;
    socketTimeout?: NodeJS.Timeout;

    constructor({device, config, port, connectionTimeout, homeyIpUtil, logger}: {
        device?: Device,
        config: SamsungConfig,
        port: number,
        connectionTimeout?: number,
        homeyIpUtil: HomeyIpUtil,
        logger: any
    }) {
        this.device = device;
        // @ts-ignore
        this.i18n = device?.homey;
        this.config = config;
        this.port = port;
        this.connectionTimeout = connectionTimeout || 2 * 60 * 1000;
        this.homeyIpUtil = homeyIpUtil;
        this.logger = logger;
        this._apps = appCodes;
        this._commandQueue = new PQueue({concurrency: 1});
    }

    getId() {
        let id = this.device?.getData().id;
        return id ? (id.indexOf(':') >= 0 && id.split(':').length > 1 ? id.split(':')[1] : id) : undefined;
    }

    getUri(ipAddress?: string): string {
        throw new Error('unimplemented');
    }

    async apiActive(timeout?: number): Promise<boolean> {
        try {
            const result = await http.get({
                uri: this.getUri(),
                timeout: (timeout || 2000)
            });
            let ret = result.response && result.response.statusCode === 200;
            if (ret) {
                try {
                    const data = JSON.parse(result.data);
                    if (data.device && data.device.PowerState) {
                        ret = data.device.PowerState.toLowerCase() === 'on';
                    }
                } catch (jsonErr) {
                    this.logger.verbose('apiActive JSON error', jsonErr);
                }
            }
            this.logger.verbose(`Samsung apiActive: ${ret}`);
            return ret;
        } catch (err: any) {
        }
        return false;
    }

    pingPort(ipaddress?: string, port?: number, timeout?: number): Promise<boolean> {
        return isPortReachable((port || this.port), {
            host: (ipaddress || this.config.getSetting(DeviceSettings.ipaddress)),
            timeout: timeout || 2000
        });
    }

    async getInfo(ipAddress?: string, timeout?: number): Promise<any> {
        try {
            const result = await http.get({
                uri: this.getUri(ipAddress),
                timeout: timeout || 2000,
            });
            if (result.response && result.response.statusCode === 200) {
                try {
                    const data = JSON.parse(result.data);
                    this.logger.debug('getInfo', ipAddress, data);
                    return data;
                } catch (jsonErr) {
                    this.logger.info('getInfo JSON error', ipAddress, result.data);
                }
            }
        } catch (err: any) {
            this.logger.verbose('getInfo error', err.message);
        }
    }

    async pair(): Promise<string> {
        throw new Error('unimplemented');
    }

    getApps(): any {
        return this._apps;
    }

    getListOfApps(): Promise<any> {
        throw new Error('unimplemented');
    }

    async wake(): Promise<void> {
        const self = this;
        let mac = this.config.getSetting(DeviceSettings.mac_address)
        if (!mac) {
            mac = await this.device?.homey.arp.getMAC(this.config.getSetting(DeviceSettings.ipaddress));
            if (!mac || mac.indexOf(':') < 0) {
                throw new Error(this.device?.homey.__('errors.missing_mac_address'));
            }
        }
        this.logger.info('wake:', mac);
        return new Promise((resolve, reject) => {
            wol.wake(mac, function (error: any) {
                if (error) {
                    self.logger.info('wake ERROR', error);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async turnOn(): Promise<void> {
        return this.sendKey('KEY_POWER');
    }

    async turnOff(): Promise<void> {
        return this.sendKey('KEY_POWER');
    }

    async sendKey(aKey: string, aCmd?: string): Promise<void> {
        throw new Error('unimplemented');
    }

    async holdKey(aKey: string, aDelay: number = 1000): Promise<void> {
        await this.sendKey(aKey, 'Press');
        await this._delay(aDelay);
        await this.sendKey(aKey, 'Release');
    }

    async sendKeys(commands: any, delay?: number): Promise<any> {
        const cmds = this._commandsWithDelays(commands, delay);
        //this.logger.info('sendKeys', cmds);
        const queue = new PQueue({concurrency: 1});
        return queue.addAll(cmds
            .map((cmd: any) => cmd.cmd ? [() => this.sendKey(cmd.cmd), () => this._delay(cmd.delay)] : [() => this._delay(cmd.delay)])
            .reduce((acc: any, val: any) => acc.concat(val), []));
    }

    async setChannel(channel: number): Promise<any> {
        return this.sendKeys(this._commandsChannel(channel), this.config.getSetting(DeviceSettings.delay_channel_keys));
    }

    async isAppRunning(app: any): Promise<boolean> {
        if (!!app.id) {
            app = this.findApp(app.id);
        }
        const notFoundError = this.device?.homey.__('errors.app_request_404');
        if (app.dialId) {
            try {
                const resp1 = await this._applicationCmd(`http://${this.config.getSetting(DeviceSettings.ipaddress)}:8080/ws/apps/${app.dialId}`, app.dialId, 'get', false);
                return resp1 && resp1.includes('<state>running</state>');
            } catch (err: any) {
                this.logger.info('isAppRunning DIAL app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        if (app.appId) {
            try {
                const resp2 = await this._applicationCmd(`${this.getUri()}applications/${app.appId}`, app.appId, 'get', true);
                return resp2 && resp2.visible;
            } catch (err: any) {
                this.logger.info('isAppRunning Samsung app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        throw new Error(notFoundError);
    }

    async launchApp(app: any, launchData: any): Promise<any> {
        if (!!app.id) {
            app = this.findApp(app.id);
        }
        return this.applicationCmd(app, 'post', launchData);
    }

    async launchYouTube(videoId: string): Promise<void> {
        try {
            await this.launchApp({"name": "YouTube", "appId": "", "dialId": "YouTube"}, 'v=' + videoId);
            this.logger.verbose(`launchYouTube: started YouTube with video ID: ${videoId}`);
        } catch (err: any) {
            this.logger.info(`launchYouTube: error starting Youtube for video ID: ${videoId}`, err);
            throw new Error(this.device?.homey.__('errors.app.start_youtube', {message: err.message}));
        }
    }

    launchBrowser(url: string): Promise<any> {
        throw new Error('unimplemented');
    }

    mergeApps(apps: any) {
        if (apps && apps.length > 0) {
            const curIds = new Set();
            this._apps.map((a: any) => curIds.add(a.appId));
            apps.filter((a: any) => !curIds.has(a.appId))
                .map((a: any) => this._apps.push({
                    name: a.name,
                    appId: a.appId,
                    dialId: ""
                }));
        }
    }

    _commandsChannel(channel: number) {
        const commands = [];
        commands.push(...String(channel).split('').map((num: string) => `KEY_${num}`));
        commands.push('KEY_ENTER');
        return commands;
    }

    _keyCodeMap() {
        return Object.assign({}, ...keycodes.map((s: any) => ({[s.id]: s.name})));
    }

    _commands(commands: any) {
        const keyCodeMap = this._keyCodeMap();
        const cmds = (!Array.isArray(commands) ? [commands] : commands)
            .map(cmd => cmd.toUpperCase().split(','))
            .reduce((acc, val) => acc.concat(val), [])
            .map((cmd: any) => {
                const times = cmd.split('*');
                if (times[1]) {
                    return Array(parseInt(times[1])).fill(times[0]);
                }
                return cmd;
            })
            .reduce((acc: any, val: any) => acc.concat(val), [])
            .map((cmd: any) => isNaN(cmd) ? cmd : parseFloat(cmd))
            .map((cmd: any) => {
                if (isNaN(cmd) && !(cmd in keyCodeMap)) {
                    throw new Error(this.device?.homey.__('errors.invalid_key', {key: cmd}));
                } else if (typeof cmd === 'number' && (cmd < 1.0 || cmd >= 10000)) {
                    throw new Error(this.device?.homey.__('errors.invalid_delay'));
                }
                return cmd;
            });
        if (cmds.length > 100) {
            throw new Error(this.device?.homey.__('errors.invalid_number_of_keys'));
        }
        return cmds;
    }

    _commandsWithDelays(commands: any, delay?: number) {
        const cmds = this._commands(commands);
        return cmds.map((cmd: any) => typeof cmd === 'number' ? {delay: cmd} :
            {cmd: cmd, delay: delay || this.config.getSetting(DeviceSettings.delay_keys)});
    }

    findApp(appId: string) {
        for (let app of appCodes) {
            if (app.appId === appId || app.dialId === appId) {
                return app;
            }
        }
        throw new Error(this.device?.homey.__('errors.app_request_404'));
    }

    async applicationCmd(app: any, cmd: any, launchData?: any): Promise<any> {
        this.logger.verbose('applicationCmd', app, cmd, launchData);
        const notFoundError = this.device?.homey.__('errors.app_request_404');
        if (app.dialId) {
            try {
                return await this._applicationCmd(`http://${this.config.getSetting(DeviceSettings.ipaddress)}:8080/ws/apps/${app.dialId}${cmd === 'delete' ? '/run' : ''}`, app.dialId, cmd, false, launchData);
            } catch (err: any) {
                this.logger.info('applicationCmd DIAL app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        if (app.appId) {
            try {
                return await this._applicationCmd(`${this.getUri()}applications/${app.appId}`, app.appId, cmd, true, launchData);
            } catch (err: any) {
                this.logger.info('applicationCmd Samsung app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        throw new Error(notFoundError);
    }

    _applicationCmd(url: string, appId: string, cmd: any, json: boolean, launchData?: any): Promise<any> {
        let lData = launchData || '';
        const self = this;
        this.logger.verbose('_applicationCmd', appId, cmd, url);

        return new Promise((resolve, reject) => {
            http[cmd]({
                uri: url,
                headers: {
                    'Content-Type': json ? 'application/json' : 'text/plain',
                    'Content-Length': Buffer.byteLength(lData)
                },
                json: json,
                timeout: 10000
            }, lData)
                .then(function (data: any) {
                    if (data.response && (data.response.statusCode === 200 || data.response.statusCode === 201)) {
                        self.logger.info(`Application command OK: ${cmd} ${appId}`);
                        resolve(data.data);
                    } else if (data.response && data.response.statusCode === 403) {
                        const msg = self.device?.homey.__('errors.app_request_403');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 404) {
                        const msg = self.device?.homey.__('errors.app_request_404');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 413) {
                        const msg = self.device?.homey.__('errors.app_request_413');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 501) {
                        const msg = self.device?.homey.__('errors.app_request_501');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 503) {
                        const msg = self.device?.homey.__('errors.app_request_503');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else {
                        self.logger.error('Application command', data.data, data.response.statusMessage, data.response.statusCode);
                        reject(self.device?.homey.__('errors.app_request_failed', {
                            statusCode: data.response.statusCode,
                            statusMessage: data.response.statusMessage
                        }));
                    }
                })
                .catch(function (err: any) {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.device?.homey.__('errors.connection_refused', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.device?.homey.__('errors.connection_hostunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.device?.homey.__('errors.connection_netunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (err.message === 'timeout') {
                        self.logger.info(`Application command timeout: ${cmd} ${appId}`);
                        reject(self.device?.homey.__('errors.connection_timeout'));
                    } else {
                        self.logger.error('Application command:', err);
                        reject(self.device?.homey.__('errors.connection_unknown', {message: err}));
                    }
                });
        });
    }

    base64Encode(aStr: string) {
        return Buffer.from(aStr).toString('base64');
    }

    _delay(ms: number) {
        return new Promise(resolve => {
            this.device?.homey.setTimeout(resolve, ms);
        });
    }

}
