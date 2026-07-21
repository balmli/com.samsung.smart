const expect = require('chai').expect;

import {SamsungOperations} from '../drivers/Samsung/SamsungOperations';

describe('Samsung maintained-driver operations', function () {
    it('delegates Homey and integration operations to the same clients', async function () {
        const calls: any[] = [];
        const samsungClient = {
            connect: async () => calls.push(['connect']),
            sendKey: async (key: string) => calls.push(['sendKey', key]),
            sendKeys: async (keys: string, delay?: number) => calls.push(['sendKeys', keys, delay]),
            disconnect: () => calls.push(['disconnect']),
        };
        const upnpClient = {
            search: async () => calls.push(['search']),
            setVolume: async (volume: number) => calls.push(['setVolume', volume]),
        };
        const operations = new SamsungOperations(samsungClient as any, upnpClient as any);

        await (operations as any).connect();
        await operations.volumeUp();
        await operations.sendKeys('KEY_HOME,KEY_ENTER', 250);
        await operations.setVolume(20);
        operations.close();

        expect(calls).to.eql([
            ['connect'],
            ['sendKey', 'KEY_VOLUP'],
            ['sendKeys', 'KEY_HOME,KEY_ENTER', 250],
            ['search'],
            ['setVolume', 20],
            ['disconnect'],
        ]);
    });
});
