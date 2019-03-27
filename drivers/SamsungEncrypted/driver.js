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

        socket.on('pincode', function (pincode, callback) {
            self.setPinCode(pincode)
                .then(result => {
                    callback(null, true);
                })
                .catch(err => {
                    callback(null, false);
                })
        });

        socket.on('disconnect', function () {
            self.clearSearchTimeout();
        });
    }

    async checkForTV(ipAddr, devices, socket) {
        this.log('searchForTVs', ipAddr);
        let data = await this._samsung.getInfo(ipAddr).catch(err => {
        });
        if (data && data.data) {
            this.log('Found TV', ipAddr, data.data);
            this.stopSearch = true;

            devices.push({
                name: data.data.DeviceName,
                data: {
                    /*id: data.data.DeviceID*/
                    id: data.data.ModelName
                },
                settings: {
                    ipaddress: ipAddr,
                    duid: data.data.DUID && data.data.DUID.split(':').length > 1 ? data.data.DUID.split(':')[1] : undefined,
                    modelName: data.data.ModelName,
                    modelClass: this._samsung.modelClass(data.data.ModelName)
                }
            });
            this._devices = devices;

            this._samsung.config()['ip_address'] = ipAddr;
            console.log('config', this._samsung.config());

            await this._samsung.showPinPage();
            await this._samsung.startPairing();

            socket.emit('list_devices', this._devices);
        }
    }

    async setPinCode(pincode) {
        const pin = pincode.join('');

        console.log('setPinCode', pin, this._devices);

        let device = this._devices.length > 0 ? this._devices[0] : undefined;
        if (!device) {
            console.log('setPinCode hidePinPage 1:', await this._samsung.hidePinPage());
            throw new Error('Found no Samsung TVs.');
        }

        try {
            let requestId = await this._samsung.confirmPin(pin);
            console.log('setPinCode requestId:', requestId);

            this._identity = await this._samsung.acknowledgeRequestId(requestId);
            console.log('setPinCode identity:', this._identity);
            //socket.emit('list_devices', this._devices);

        } catch (err) {
            console.log('setPinCode error', err);
            throw new Error('Pairing failed.');
        } finally {
            console.log('setPinCode hidePinPage 2:', await this._samsung.hidePinPage());
        }
    }

};
