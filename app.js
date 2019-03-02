'use strict';

const Homey = require('homey');

class SamsungSmartApp extends Homey.App {
	
	onInit() {
		this.log('SamsungSmartApp is running...');
	}
	
}

module.exports = SamsungSmartApp;