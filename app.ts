import Homey from 'homey';

import {Logger} from "./lib/Logger";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

class SamsungSmartApp extends Homey.App {

    logger: any;

    async onInit() {
        try {
            // @ts-ignore
            this.logger = new Logger({
                homey: this.homey,
                logFunc: this.log,
                errorFunc: this.error,
            }, Homey.env);

            await this.initFlows();

            this.logger.verbose('SamsungSmartApp is running...');
        } catch (err) {
            this.logger.error('App onInit', err);
        }
    }

    async initFlows() {
        this.homey.flow.getConditionCard('is_power_onoff')
            .registerRunListener(args => args.device.turning_onoff_process !== undefined);

        this.homey.flow.getActionCard('send_key')
            .registerRunListener(args => args.device.samsungClient.sendKey(args.key.id))
            .getArgument('key')
            .registerAutocompleteListener((query, args) => args.device.onKeyAutocomplete(query, args));

        this.homey.flow.getActionCard('send_keys')
            .registerRunListener(args => args.device.samsungClient.sendKeys([args.keys1]));

        this.homey.flow.getActionCard('change_channel')
            .registerRunListener(args => args.device.samsungClient.setChannel(args.channel));

        this.homey.flow.getConditionCard('is_app_running')
            .registerRunListener(args => args.device.samsungClient.isAppRunning(args.app_id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        this.homey.flow.getActionCard('launch_app')
            .registerRunListener(args => args.device.samsungClient.launchApp(args.app_id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        this.homey.flow.getActionCard('close_app')
            .registerRunListener(args => args.device.samsungClient.closeApp(args.app_id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        this.homey.flow.getActionCard('youtube')
            .registerRunListener(args => {
                if (!args.videoId || args.videoId.length !== 11) {
                    return Promise.reject(this.homey.__('errors.invalid_video_id'));
                }
                return args.device.samsungClient.launchYouTube(args.videoId);
            });

        this.homey.flow.getActionCard('browse')
            .registerRunListener(args => {
                if (!args.url || args.url.length === 0) {
                    return Promise.reject(this.homey.__('errors.invalid_browse_url'));
                }
                return args.device.samsungClient.launchBrowser(args.url);
            });

        this.homey.flow.getActionCard('set_input_source')
            .registerRunListener(args => args.device.setStInputSource(args.input_source.id))
            .getArgument('input_source')
            .registerAutocompleteListener((query, args) => args.device.onInputSourceAutocomplete(query, args));

        this.homey.flow.getActionCard('set_power_state')
            .registerRunListener(args => args.device.setPowerState(args.power_state === 'on'));
    }

}

module.exports = SamsungSmartApp;
