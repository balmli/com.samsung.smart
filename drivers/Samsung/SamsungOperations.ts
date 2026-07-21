import {UPnPClient} from '../../lib/UPnPClient';
import {SamsungClientImpl} from './SamsungClient';

export class SamsungOperations {
    constructor(
        readonly samsungClient: SamsungClientImpl,
        readonly upnpClient: UPnPClient,
    ) {}

    getInfo(ipAddress?: string, timeout?: number): Promise<any> {
        return this.samsungClient.getInfo(ipAddress, timeout);
    }

    isOnline(timeout?: number): Promise<boolean> {
        return this.samsungClient.apiActive(timeout);
    }

    pair(timeout?: number): Promise<string> {
        return this.samsungClient.pair(timeout);
    }

    connect(): Promise<void> {
        return this.samsungClient.connect();
    }

    wake(): Promise<void> {
        return this.samsungClient.wake();
    }

    turnOff(): Promise<void> {
        return this.samsungClient.turnOff();
    }

    sendKey(key: string): Promise<void> {
        return this.samsungClient.sendKey(key);
    }

    sendKeys(keys: string | string[], delay?: number): Promise<any> {
        return this.samsungClient.sendKeys(keys, delay);
    }

    setChannel(channel: number): Promise<any> {
        return this.samsungClient.setChannel(channel);
    }

    volumeUp(): Promise<void> {
        return this.sendKey('KEY_VOLUP');
    }

    volumeDown(): Promise<void> {
        return this.sendKey('KEY_VOLDOWN');
    }

    toggleMute(): Promise<void> {
        return this.sendKey('KEY_MUTE');
    }

    channelUp(): Promise<void> {
        return this.sendKey('KEY_CHUP');
    }

    channelDown(): Promise<void> {
        return this.sendKey('KEY_CHDOWN');
    }

    async getVolume(): Promise<number | undefined> {
        await this.upnpClient.search();
        await new Promise(resolve => setTimeout(resolve, 1500));
        return this.upnpClient.getVolume();
    }

    async setVolume(volume: number): Promise<void> {
        await this.upnpClient.search();
        return this.upnpClient.setVolume(volume);
    }

    getApps(): any {
        return this.samsungClient.getApps();
    }

    refreshApps(): Promise<any> {
        return this.samsungClient.getListOfApps();
    }

    isAppRunning(app: any): Promise<boolean> {
        return this.samsungClient.isAppRunning(app);
    }

    launchApp(app: any, launchData?: any): Promise<any> {
        return this.samsungClient.launchApp(app, launchData);
    }

    closeApp(app: any): Promise<any> {
        return this.samsungClient.closeApp(app);
    }

    launchYouTube(videoId: string): Promise<void> {
        return this.samsungClient.launchYouTube(videoId);
    }

    launchBrowser(url: string): Promise<any> {
        return this.samsungClient.launchBrowser(url);
    }

    artMode(enabled: boolean): Promise<any> {
        return this.samsungClient.artMode(enabled);
    }

    close(): void {
        this.samsungClient.disconnect();
    }
}
