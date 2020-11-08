'use strict';

const Logger = require('./lib/Logger');
const Homey = require('homey');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

module.exports = class SamsungSmartApp extends Homey.App {

    async onInit() {
        try {
            this.logger = new Logger({
                logFunc: this.log,
                errorFunc: this.error,
            }, Homey.env);

            process.on('unhandledRejection', (reason, p) => {
                this.logger.error('Unhandled rejection', reason, p);
            }).on('uncaughtException', err => {
                this.logger.error('Uncaught exception', err);
            });

            await this.initFlows();

            this.logger.verbose('SamsungSmartApp is running...');
        } catch (err) {
            this.logger.error('App onInit', err);
        }
    }

    async initFlows() {
        new Homey.FlowCardCondition('on')
            .register()
            .registerRunListener(args => args.device.isDeviceOnline());

        new Homey.FlowCardCondition('is_power_onoff')
            .register()
            .registerRunListener(args => args.device._is_powering_onoff !== undefined);

        new Homey.FlowCardAction('on')
            .register()
            .registerRunListener(args => args.device.turnOnOff(true));

        new Homey.FlowCardAction('off')
            .register()
            .registerRunListener(args => args.device.turnOnOff(false));

        new Homey.FlowCardAction('send_key')
            .register()
            .registerRunListener(args => args.device._samsung.sendKey(args.key.id))
            .getArgument('key')
            .registerAutocompleteListener((query, args) => args.device.onKeyAutocomplete(query, args));

        new Homey.FlowCardAction('send_keys')
            .register()
            .registerRunListener(args => args.device._samsung.sendKeys([args.keys1]));

        new Homey.FlowCardAction('change_channel')
            .register()
            .registerRunListener(args => args.device._samsung.setChannel(args.channel));

        new Homey.FlowCardCondition('is_app_running')
            .register()
            .registerRunListener(args => args.device._samsung.isAppRunning(args.app_id.id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        new Homey.FlowCardAction('launch_app')
            .register()
            .registerRunListener(args => args.device._samsung.launchApp(args.app_id.id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        new Homey.FlowCardAction('youtube')
            .register()
            .registerRunListener(args => {
                if (!args.videoId || args.videoId.length !== 11) {
                    return Promise.reject(Homey.__('errors.invalid_video_id'));
                }
                return args.device._samsung.launchYouTube(args.videoId);
            });

        new Homey.FlowCardAction('browse')
            .register()
            .registerRunListener(args => {
                if (!args.url || args.url.length === 0) {
                    return Promise.reject(Homey.__('errors.invalid_browse_url'));
                }
                return args.device._samsung.launchBrowser(args.url);
            });

        new Homey.FlowCardAction('set_input_source')
            .register()
            .registerRunListener(args => args.device._samsung.setInputSource(args.input_source.id))
            .getArgument('input_source')
            .registerAutocompleteListener((query, args) => args.device.onInputSourceAutocomplete(query, args));
    }

};
