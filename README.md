# Samsung SmartTV app

## Install

To install the device, the TV(s) must be turned on and on the same network as the Homey.

Searching for the TV(s) might take up to 30 seconds.  If the TV is not found, the IP address can be set manually.

To be able to turn the TV on, it must support wake-on-lan / wake-on-wireless.

## Device: Samsung

For newer TVs, that respond to http://TV-IP-ADDRESS:8001/api/v2/

#### Triggers

- TV turned on
- TV turned off

#### Conditions

- Is on / off
- Is app running

#### Actions

- Turn on
- Turn off
- Toggle on or off
- Mute the volume
- Unmute the volume
- Turn the volume up
- Turn the volume down
- One channel up
- One channel down
- Change channel
- Launch app
- Launch video on YouTube
- Launch browser
- Send key
- Send list of keys

## Device: Samsung (encrypted)

For H, HU, J, JU and JS models. 

#### Triggers

- TV turned on
- TV turned off

#### Conditions

- Is on / off

#### Actions

- Turn on
- Turn off
- Toggle on or off
- Mute the volume
- Unmute the volume
- Turn the volume up
- Turn the volume down
- One channel up
- One channel down
- Change channel
- Send key
- Send list of keys

## Device: Samsung (legacy)

For older TVs, that respond to port 55000.

#### Triggers

- TV turned on
- TV turned off

#### Conditions

- Is on / off

#### Actions

- Turn on
- Turn off
- Toggle on or off
- Mute the volume
- Unmute the volume
- Turn the volume up
- Turn the volume down
- One channel up
- One channel down
- Change channel
- Send key
- Send list of keys

## Details about actions:

#### Change channel

The 'Change channel' action will send a list of number-keys for the channel number, and finally the 'Enter'-key.  The default delay between each key is 1250 ms, but this can be changed in 'Advanced settings'.

*Example: switch to channel '123':*

Will send this list of keys: 'Key 1', 'Key 2', 'Key 3', 'Enter'.


#### Send list of keys

With the 'Send list of keys' action it is possible to send a list of keys, with a short delay between each key.  The default delay between each key is 100 ms, but this can be changed in 'Advanced settings'.  If the delay is too low, the TV might not respond.

For the list of keys, see [here](./keys.md). 

To send the same key several times, add a ```*X``` after the key, where X is the number of times for the key.  To add an extra delay before the next key, just add a number between 1 - 9999. The number is milliseconds.

*Example: Send 'Home', 'Left' and 'Enter':*

```KEY_HOME,KEY_LEFT,KEY_ENTER```

*Example: Set the aspect ratio, increase the volume 10 times, wait 2.5 seconds (2500 ms) and then press play:*

```KEY_16_9,KEY_VOLUP*10,2500,KEY_PLAY```


#### Launch video on YouTube (only Samsung)

To use the 'Launch video on YouTube' action, the YouTube _video id_ must be provided, which is a 11 character long string.  The video id for this link on YouTube:

https://www.youtube.com/watch?v=aqz-KE-bpKQ

is ```aqz-KE-bpKQ```


## Acknowledgements:

Thanks to https://github.com/natalan/samsung-remote for solution to support older Samsung TVs.

Thanks to https://github.com/tavicu/homebridge-samsung-tizen for solution to pair with newer Samsung TVs.

Thanks to https://github.com/tdudek/samsung-remote-models-2014-and-newer and https://github.com/kkapitan/homebridge-homesung for solution to pair with H, HU, J, JU and JS models. 

## Feedback:

Please report issues at the [issues section on Github](https://github.com/balmli/com.samsung.smart/issues).

## Disclaimer

Use at your own risk. I accept no responsibility for any damages caused by using this app.

Some TVs use a different type of pairing, and are therefore not supported at the moment.

## Release Notes:

#### 1.4.0

- Added 'Power on/off is in progress' condition (all devices)
- Changed the order of the volume and channel keys (all devices, need to reinstall the device for this to work)
- Added 'Polling interval for TV status (s)' in Advanced settings (all device)

#### 1.3.0

- Support for H, HU, J, JU and JS models.

#### 1.2.0

- Faster communication with the TV by keeping the socket open for a while (Samsung)
- Action to change channel (Samsung and Samsung legacy)
- Action to send a list of keys (Samsung and Samsung legacy)

#### 1.1.0

- Fixed 'Samsung (legacy)' device

#### 1.0.5 

- Minor bugfixes

#### 1.0.4 

- Separate device for older Samsung TVs
- Fixes for newer Samsung TVs

#### 1.0.3

- Improved logic for on / off
- Fixes for newer Samsung TVs

#### 1.0.2

- Added 'Launch video on YouTube' action
- Refresh list of applications every 5 minutes

#### 1.0.1 

- Autocomplete for keys

#### 1.0.0

- Initial version
