const expect = require('chai').expect;

import {mkdtemp, readFile, stat} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const {
    ensureUniqueIntegrationIdentity,
    IntegrationProfileStore,
    toPublicProfile,
} = require('../integration/core/IntegrationProfileStore');

describe('Samsung integration profile store', function () {
    it('persists profiles privately without exposing tokens in public state', async function () {
        const directory = await mkdtemp(join(tmpdir(), 'samsung-integration-'));
        const filename = join(directory, 'profiles.json');
        const store = new IntegrationProfileStore(filename);

        await store.save({
            id: 'living-room',
            clientId: 'integration-123',
            clientName: 'Homey Samsung Integration Tests',
            ipAddress: '192.0.2.1',
            token: 'secret-token',
            tokenAuthSupport: true,
        });

        const saved = await store.get('living-room');
        const publicProfile = toPublicProfile(saved!);
        const contents = JSON.parse(await readFile(filename, 'utf8'));

        expect(saved?.token).to.equal('secret-token');
        expect(publicProfile).to.not.have.property('token');
        expect(publicProfile.paired).to.equal(true);
        expect(contents.profiles[0].token).to.equal('secret-token');
        expect((await stat(filename)).mode & 0o777).to.equal(0o600);
    });

    it('migrates the shared legacy name to a profile-specific TV authorization identity', function () {
        const first = ensureUniqueIntegrationIdentity({
            id: 'living-room',
            clientId: 'integration-123',
            clientName: 'Homey Samsung Integration Tests',
            ipAddress: '192.0.2.1',
            macAddress: '00:11:22:33:44:55',
            token: 'old-shared-token',
        });
        const second = ensureUniqueIntegrationIdentity({
            ...first,
            id: 'bedroom',
            clientId: 'integration-456',
            clientName: 'Homey Samsung Integration Tests',
            token: 'old-shared-token',
        });

        expect(first.clientName).to.equal('Homey Samsung Integration Tests (living-room)');
        expect(second.clientName).to.equal('Homey Samsung Integration Tests (bedroom)');
        expect(first.clientName).to.not.equal(second.clientName);
        expect(first.token).to.equal(undefined);
        expect(second.token).to.equal(undefined);
    });
});
