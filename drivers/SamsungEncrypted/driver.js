'use strict';

const BaseDriver = require('../../lib/BaseDriver');
const SamsungEncrypted = require('./SamsungEncrypted');
const ip = require('ip');

module.exports = class SamsungEncryptedDriver extends BaseDriver {

    onInit() {
        super.onInit('Samsung Encrypted');

        this._samsung = new SamsungEncrypted({
            homey: this.homey,
            port: 8001,
            api_timeout: 125,
            appId: '721b6fce-4ee6-48ba-8045-955a539edadb',
            deviceId: undefined,
            userId: '654321',
            logger: this.logger
        });

        this._devices = [];
        this._identity = undefined;
    }

    getIdentity() {
        return this._identity;
    }

    async onPair(session) {
        let self = this;

        session.setHandler('list_devices', async (data) => {

            self._samsung.config()['api_timeout'] = 125;
            self.searchForTVs(ip.address(), session)
                .then(devices => {
                    if (devices.length === 0) {
                        session.showView('ip_address');
                    } else {
                        return devices;
                    }
                })
                .catch(err => {
                    throw new Error(this.homey.__('pair.no_tvs'));
                });

        });

        session.setHandler('pincode', async (pincode) => {
            try {
                await self.setPinCode(pincode);
                if (self._identity) {
                    return true;
                } else {
                    self.log('pincode error: no identify');
                    return false;
                }
            } catch (err) {
                self.log('pincode error:', err);
                return false;
            } finally {
                const hidePinPage = await self._samsung.hidePinPage();
                self.log('pincode hidePinPage:', hidePinPage);
            }
        });

        session.setHandler('manual_input', async (userdata) => {
            try {
                self._samsung.config()['api_timeout'] = 2000;
                let data = await self._samsung.getInfo(userdata.ipaddress);
                if (data) {
                    let devices = [];
                    await self.checkForTV(userdata.ipaddress, devices, session);
                    if (self._devices.length > 0) {
                        return self._devices[0];
                    } else {
                        throw new Error('error');
                    }
                } else {
                    throw new Error('error');
                }
            } catch (err) {
                throw new Error('error');
            }
        });

        session.setHandler('showView', async (viewId) => {
            if (viewId === 'pin_wait') {
                await self._samsung.showPinPage();
                await self._samsung.startPairing();
                session.showView('set_pin_code');
            }
        });

        session.setHandler('add_device', async (device) => {
            self.log('add_device:', device);
        });

        session.setHandler('disconnect', async () => {
            self.log('disconnect');
            self.clearSearchTimeout();
        });
    }

    async checkForTV(ipAddr, devices, session) {
        this.logger.info('checkForTV:', ipAddr);
        const info = await this._samsung.getInfo(ipAddr);
        if (info) {
            this.logger.info('checkForTV: found TV:', ipAddr, info);
            this.clearSearchTimeout();

            devices.push({
                name: info.DeviceName,
                data: {
                    id: info.ModelName
                },
                settings: {
                    ipaddress: ipAddr,
                    duid: this.getDuid(info),
                    modelName: info.ModelName,
                    modelClass: this._samsung.modelClass(info.ModelName)
                }
            });
            this._devices = devices;
            session.emit('list_devices', this._devices);
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

        this.logger.info('setPinCode:', pin, this._devices);

        let device = this._devices.length > 0 ? this._devices[0] : undefined;
        if (!device) {
            throw new Error(this.homey.__('pair.no_tvs'));
        }

        let requestId = await this._samsung.confirmPin(pin);
        this.logger.info('setPinCode requestId:', requestId);

        this._identity = await this._samsung.acknowledgeRequestId(requestId);
        this.logger.info('setPinCode identity:', this._identity);
    }

};
