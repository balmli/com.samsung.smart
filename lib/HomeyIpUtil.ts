import Homey from "homey/lib/Homey";

export interface HomeyIpUtil {
    /**
     * Get the IP address of the Homey
     *
     * @param homey
     */
    getHomeyIpAddress(homey: Homey): Promise<string>;
}

export class HomeyIpUtilImpl implements HomeyIpUtil {

    async getHomeyIpAddress(homey: Homey): Promise<string> {
        const ipAddressResponse = await homey.cloud.getLocalAddress();
        return ipAddressResponse.split(':')[0];
    }

}