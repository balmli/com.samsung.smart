'use strict';

const Homey = require('homey');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

class SamsungSmartApp extends Homey.App {
	
	onInit() {
		this.log('SamsungSmartApp is running...');
	}
	
}

module.exports = SamsungSmartApp;