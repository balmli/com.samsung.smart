This app supports smart TVs made by Samsung.

You can create flows with the following actions:

- Power on or off
- Set volume and mute
- Set a TV channel
- Send keys or list of keys
- Launch an app
- Launch a video from YouTube
- Launch browser


To install the device, the TV(s) must be turned on and on the same network as the Homey.

To be able to turn the TV on, it must support wake-on-lan / wake-on-wireless.

For more information, click on the community link.


Device: Samsung:

For newer TVs, that respond to http://TV-IP-ADDRESS:8001/api/v2/

Device: Samsung (encrypted):

For H, HU, J, JU and JS models from 2014 and 2015, that respond to http://TV-IP-ADDRESS:8001/ms/1.0/

Device: Samsung (legacy):

For TVs from 2013 or before, that respond to port 55000.


Acknowledgements:

Thanks to https://github.com/natalan/samsung-remote for solution to support older Samsung TVs.

Thanks to https://github.com/tavicu/homebridge-samsung-tizen for solution to pair with newer Samsung TVs.

Thanks to https://github.com/tdudek/samsung-remote-models-2014-and-newer and https://github.com/kkapitan/homebridge-homesung for solution to pair with H, HU, J, JU and JS models. 


Disclaimer:

Use at your own risk. I accept no responsibility for any damages caused by using this app.

Some TVs use a different type of pairing, and are therefore not supported at the moment.
