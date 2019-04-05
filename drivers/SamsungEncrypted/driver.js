'use strict';

const SamDriver = require('../../lib/SamDriver');
const SamsungEncrypted = require('../../lib/samsung_encrypted');
const ip = require('ip');

module.exports = class SamsungEncryptedDriver extends SamDriver {

    onInit() {
        super.onInit('Samsung Encrypted');

        this._samsung = new SamsungEncrypted({
            port: 8001,
            api_timeout: 100,
            appId: '721b6fce-4ee6-48ba-8045-955a539edadb',
            deviceId: undefined,
            userId: '654321'
        });

        this._devices = [];
        this._identity = undefined;
    }

    getIdentity() {
        return this._identity;
    }

    onPair(socket) {
        let self = this;
        socket.on('list_devices', function (data, callback) {

            self.searchForTVs(ip.address(), socket)
                .then(devices => {
                    callback(null, devices);
                })
                .catch(err => {
                    callback(new Error('Found no Samsung TVs.'));
                });

        });

        socket.on('pincode', async (pincode, callback) => {
            try {
                await self.setPinCode(pincode);
                if (self._identity) {
                    callback(null, true);
                } else {
                    self.log('socket pincode error: no identify');
                    callback(null, false);
                }
            } catch (err) {
                self.log('socket pincode error:', err);
                callback(null, false);
            } finally {
                const hidePinPage = await self._samsung.hidePinPage();
                self.log('socket pincode hidePinPage:', hidePinPage);
            }
        });

        socket.on('showView', async (viewId, callback) => {
            if (viewId === 'pin_wait') {
                await self._samsung.showPinPage();
                await self._samsung.startPairing();
                socket.showView('set_pin_code');
            }
            callback();
        });

        socket.on('add_device', (device, callback) => {
            self.log('socket add_device:', device);
        });

        socket.on('disconnect', function () {
            self.log('socket disconnect');
            self.clearSearchTimeout();
        });
    }

    async checkForTV(ipAddr, devices, socket) {
        this.log('checkForTV:', ipAddr);
        let data = await this._samsung.getInfo(ipAddr).catch(err => {
        });
        if (data && data.data) {
            this.log('checkForTV: found TV:', ipAddr, data.data);
            this.clearSearchTimeout();

            devices.push({
                name: data.data.DeviceName,
                data: {
                    id: data.data.ModelName
                },
                settings: {
                    ipaddress: ipAddr,
                    duid: this.getDuid(data.data),
                    modelName: data.data.ModelName,
                    modelClass: this._samsung.modelClass(data.data.ModelName)
                }
            });
            this._devices = devices;
            socket.emit('list_devices', this._devices);
            this._samsung.config()['ip_address'] = ipAddr;
        }
    }

    getDuid(val) {
        return val && val.DUID ?
            (val.DUID.indexOf(':') >= 0 && val.DUID.split(':').length > 1 ? val.DUID.split(':')[1] : val.DUID) :
            undefined;
    }

    async setPinCode(pincode) {
        this._identity = undefined;
        const pin = pincode.join('');

        this.log('setPinCode:', pin, this._devices);

        let device = this._devices.length > 0 ? this._devices[0] : undefined;
        if (!device) {
            throw new Error('Found no Samsung TVs.');
        }

        let requestId = await this._samsung.confirmPin(pin);
        this.log('setPinCode requestId:', requestId);

        this._identity = await this._samsung.acknowledgeRequestId(requestId);
        this.log('setPinCode identity:', this._identity);
    }

};
