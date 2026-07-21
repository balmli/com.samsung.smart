const expect = require('chai').expect;

import {SamsungClientImpl} from '../drivers/Samsung/SamsungClient';
import {SamsungConfigImpl} from '../lib/SamsungConfig';
import {DeviceSettings} from '../lib/types';

const logger = {
    debug: () => undefined,
    error: () => undefined,
    info: () => undefined,
    verbose: () => undefined,
};

function createClient(clientName?: string) {
    const config = new SamsungConfigImpl({logger});
    config.setSetting(DeviceSettings.ipaddress, '192.0.2.1');

    return new SamsungClientImpl({
        clientName,
        config,
        port: 8001,
        homeyIpUtil: {getHomeyIpAddress: async () => '192.0.2.2'},
        logger,
    } as any);
}

describe('SamsungClient identity', function () {
    it('keeps the Homey connection identity by default', function () {
        const client = createClient();

        expect((client as any).getWsUri(true)).to.include(`name=${Buffer.from('homey').toString('base64')}`);
    });

    it('uses a separate connection identity when configured', function () {
        const client = createClient('Homey Samsung Integration Tests');

        expect((client as any).getWsUri(true)).to.include(
            `name=${Buffer.from('Homey Samsung Integration Tests').toString('base64')}`,
        );
    });
});
