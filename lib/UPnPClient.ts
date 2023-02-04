import EventEmitter from "events";

const Client = require('node-ssdp-lite');
const xmlParser = require('xml2json-light');
const http = require('http.min');

import {DeviceSettings} from "./types";
import {SamsungConfig} from "./SamsungConfig";

const INTERVAL_SSDP_SEARCH = 60 * 60 * 1000;
const ST_RENDERINGCONTROL = 'urn:schemas-upnp-org:service:RenderingControl:1';
const SERVICE_TYPES = [ST_RENDERINGCONTROL];

export interface UPnPClient extends  EventEmitter {
    /**
     * Check if the TV is online.
     * @param timeout
     */
    apiActive(timeout?: number): Promise<boolean>

    /**
     * Get the TV's current volume.
     */
    getVolume(): Promise<number | undefined>;

    /**
     * Set the volume of the TV.
     * @param volume
     */
    setVolume(volume: number): Promise<void>;

    /**
     * Get the TV's current mute state.
     */
    getMute(): Promise<boolean | undefined>;

    /**
     * Set the mute state of the TV.
     * @param muted
     */
    setMute(muted: boolean): Promise<void>;

    /**
     *
     */
    search(): Promise<void>;

}

export class UPnPClientImpl extends EventEmitter implements UPnPClient {

    config: SamsungConfig;
    logger: any;
    _ssdpClient: any;
    _services: any;
    _lastSearch: any;

    constructor({config, logger}: {
        config: SamsungConfig,
        logger: any
    }) {
        super();

        this.config = config;
        this.logger = logger;

        this._ssdpClient = new Client();
        this._ssdpClient.on('response', (msg: any, rinfo: any) => {
            this._onResponse(msg, rinfo);
        });

        this._services = new Map();
        this._lastSearch = undefined;
    }

    async apiActive(timeout?: number): Promise<boolean> {
        const service = this._services.get(ST_RENDERINGCONTROL);
        if (service) {
            try {
                const result = await http.get({
                    uri: service.location,
                    timeout: (timeout || 5000)
                });
                const ret = result.response && result.response.statusCode === 200;
                this.logger.verbose(`UPnP apiActive: ${ret}`);
                return ret;
            } catch (err: any) {
            }
        }
        return false;
    }

    async getVolume(): Promise<number | undefined> {
        try {
            const result = await this.soapRequest(ST_RENDERINGCONTROL, 'GetVolume', '<Channel>Master</Channel>');
            const volumeField = this.getXmlField(result.data, 'CurrentVolume');
            if (volumeField) {
                const volume = parseInt(volumeField);
                this.logger.verbose(`Get volume: ${volume}`);
                return volume;
            }
        } catch (err: any) {
            this.logger.verbose(`Get volume failed:`, err.message);
        }
    }

    async setVolume(volume: number): Promise<void> {
        if (!(volume >= 0 && volume <= 100)) {
            throw new Error(`Invalid parameter for volume: ${volume}`);
        }
        try {
            await this.soapRequest(ST_RENDERINGCONTROL, 'SetVolume', `<Channel>Master</Channel><DesiredVolume>${volume}</DesiredVolume>`);
            this.logger.info(`Set volume: ${volume}`);
        } catch (err: any) {
            this.logger.info(`Set volume failed:`, err.message);
        }
    }

    async getMute(): Promise<boolean | undefined> {
        try {
            const result = await this.soapRequest(ST_RENDERINGCONTROL, 'GetMute', '<Channel>Master</Channel>');
            const muteState = this.getXmlField(result.data, 'CurrentMute') === '1';
            this.logger.verbose(`Get mute state: ${muteState}`);
            return muteState;
        } catch (err: any) {
            this.logger.verbose(`Get mute state failed:`, err.message);
        }
    }

    async setMute(muted: boolean): Promise<void> {
        try {
            await this.soapRequest(ST_RENDERINGCONTROL, 'SetMute', `<Channel>Master</Channel><DesiredMute>${muted ? '1' : '0'}</DesiredMute>`);
            this.logger.info(`Set mute: ${muted}`);
        } catch (err: any) {
            this.logger.info(`Set mute failed:`, err.message);
        }
    }

    async search() {
        if (!this._lastSearch || (Date.now() - this._lastSearch > INTERVAL_SSDP_SEARCH)) {
            this._lastSearch = Date.now();
            SERVICE_TYPES.map(st => {
                this.logger.info('UPnP search start, type: ', st);
                this._ssdpClient.search(st)
            });
        }
    }

    private async _onResponse(msg: any, rinfo: any) {
        if (rinfo.address && rinfo.address === this.config.getSetting(DeviceSettings.ipaddress)) {
            this.logger.debug('SSDP', msg, rinfo);
            this.emit('available', {});
            const location = this.getLine(msg, 'LOCATION: ');
            const st = this.getLine(msg, 'ST: ');
            if (!this._services.has(st)) {
                this.logger.info(`SSDP: ${location} ${st}`);
                this._services.set(st, {});
                await this._fetchServicesFromLocation(location, st);
            }
        }
        this.emit('device', {
            ip_address: rinfo.address,
        });
    }

    private async _fetchServicesFromLocation(location: any, st: any) {
        try {
            const result = await http.get({
                uri: location,
                timeout: 10000
            });
            if (result.response && result.response.statusCode === 200) {
                const json = xmlParser.xml2json(result.data);
                if (json && json.root &&
                    json.root.device &&
                    json.root.device.serviceList &&
                    json.root.device.serviceList.service) {
                    json.root.device.serviceList.service
                        .filter((service: any) => service.serviceType === st)
                        .map((service: any) => {
                            const locUrl = new URL(location);
                            const data = {
                                location: location,
                                url: locUrl.origin,
                                ...service
                            };
                            this._services.set(st, data);
                            this.logger.info('_fetchServicesFromLocation', data);
                        });
                }
            }
        } catch (err) {
            this.logger.info('_fetchServicesFromLocation error', err);
        }
    }

    private getLine(msg: any, prefix: string) {
        const line = msg.split(/\r?\n/).filter((line: any) => line.startsWith(prefix));
        return line.length > 0 ? line[0].substr(prefix.length) : undefined;
    }


    private async soapRequest(serviceType: any, action: any, args: any): Promise<any> {
        const service = this._services.get(serviceType);
        if (!service) {
            throw new Error(`Missing service type: ${serviceType}`);
        }
        const uri = `${service.url}${service.controlURL}`;
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
        <s:Body><u:${action} xmlns:u="${service.serviceType}"><InstanceID>0</InstanceID>${args ? args : ''}</u:${action}></s:Body>
        </s:Envelope>`;
        this.logger.debug(`soapRequest: ${serviceType} -> ${uri} ${action}`, body);

        const result = await http.post({
                uri: uri,
                headers: {
                    'SOAPAction': `"${service.serviceType}#${action}"`,
                    'content-type': `text/xml`
                }
            },
            body
        );

        if (result && result.response.statusCode === 200) {
            this.logger.debug(`soapRequest: ${action}: OK: ${result.data}`);
        } else {
            const msg = `UPnP command "${action}" failed: ${result ? result.response.statusCode : ''} ${result ? result.response.statusMessage : ''}`;
            this.logger.verbose(msg, result.data);
            throw new Error(msg);
        }

        return result;
    }

    private getXmlField(data: string, tag: string): string | undefined {
        const startTag = `<${tag}>`;
        const endTag = `</${tag}>`;
        if (data.indexOf(startTag) >= 0) {
            const state = data.substr(data.indexOf(startTag) + startTag.length);
            return state.substr(0, state.indexOf(endTag));
        }
    }

}
