import Device from "homey/lib/Device";

const http = require('http.min');

import {DeviceSettings} from "./types";
import {SamsungConfig} from "./SamsungConfig";

const SMARTTHINGS_API = 'https://api.smartthings.com/v1';

export interface SmartThingsClient {
    /**
     * Clear the SmartThings token, to ensure that it is re-initilized.
     */
    clearStClient(): void;

    /**
     * Fetch list of input sources.
     */
    getStInputSources(): Promise<any>;

    /**
     * Update input source.
     *
     * @param inputSource
     */
    setStInputSource(inputSource: string): Promise<void>;
}

export class SmartThingsClientImpl implements SmartThingsClient {

    device: Device;
    config: SamsungConfig;
    logger: any;
    stTvDeviceId: string | undefined = undefined;

    constructor({device, config, logger}: {
        device: Device,
        config: SamsungConfig,
        logger: any
    }) {
        this.device = device;
        this.config = config;
        this.logger = logger;
    }

    clearStClient(): void {
        this.stTvDeviceId = undefined;
    }

    async getStInputSources(): Promise<any> {
        try {
            const deviceId = await this.getStTvDevice();
            const response = await this.stDevice(deviceId, '/status');
            this.logger.verbose('getStInputSources', JSON.stringify(response.data), response.response.statusCode, response.response.statusMessage);
            return response.data.components.main.mediaInputSource.supportedInputSources.value;
        } catch (err) {
            this.logger.info('getStInputSources failed', err);
            return [];
        }
    }

    async setStInputSource(input_source: any): Promise<void> {
        const deviceId = await this.getStTvDevice();
        const response = await this.stCommand(deviceId, [{
            component: 'main',
            capability: 'mediaInputSource',
            command: 'setInputSource',
            arguments: [input_source]
        }]);
        if (response.response.statusCode !== 200) {
            this.logger.info('Changing input source failed', response.data, response.response.statusCode, response.response.statusMessage);
            throw new Error(this.device.homey.__('errors.smartthings.failed_changing_input_source', {
                message: response.data.error.message,
                statusCode: response.response.statusCode,
                statusMessage: response.response.statusMessage
            }));
        }
    }

    private async getStTvDevice(): Promise<string> {
        if (this.stTvDeviceId) {
            return this.stTvDeviceId;
        }

        const devices = await this.stDevices();
        const tvDevices = devices
            .filter((d: any) => d.components.filter((c: any) => c.capabilities.filter((cap: any) => cap.id === 'tvChannel') > 0))
            .map((d: any) => d.deviceId);

        if (tvDevices.length === 0) {
            throw new Error(this.device.homey.__('errors.smartthings.no_tvs'));
        }

        // TODO support multiple TVs
        this.stTvDeviceId = tvDevices[0];
        return this.stTvDeviceId!!;
    }

    private async stDevices() {
        const token = await this.getStToken();
        const response = await http({
            uri: `${SMARTTHINGS_API}/devices`,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.response.statusCode === 200) {
            const json = JSON.parse(response.data);
            return json.items;
        }
        this.logger.info('stDevices error', response.response.statusCode, response.response.statusMessage);
        if (response.response.statusCode === 401) {
            throw new Error(this.device.homey.__('errors.smartthings.incorrect_token'));
        }
        throw new Error(this.device.homey.__('errors.smartthings.failed_fetching_devices', {
            statusCode: response.response.statusCode,
            statusMessage: response.response.statusMessage
        }));
    }

    private async getStToken(): Promise<string> {
        if (this.config.getSetting(DeviceSettings.smartthings) !== true) {
            throw new Error(this.device.homey.__('errors.smartthings.not_enabled'));
        }
        const token = this.config.getSetting(DeviceSettings.smartthings_token);
        if (!token) {
            throw new Error(this.device.homey.__('errors.smartthings.no_token'));
        }
        return token;
    }

    private async stDevice(deviceId: string, path = '') {
        const token = await this.getStToken();
        return http({
            uri: `${SMARTTHINGS_API}/devices/${deviceId}${path}`,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            json: true
        });
    };

    private async stCommand(deviceId: string, commands: any) {
        const token = await this.getStToken();
        this.logger.info('stCommand', commands);
        return http.post({
                uri: `${SMARTTHINGS_API}/devices/${deviceId}/commands`,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                json: true
            },
            {"commands": commands}
        );
    };



}
