# Samsung SmartTV

Samsung SmartTV app.

### Install

To install the device, the TV(s) must be turned on and on the same network as the Homey.

Searching for the TV(s) might take up to 30 seconds.  If the TV is not found, the IP address can be set manually.

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
- Launch app
- Launch video on YouTube
- Launch browser
- Send key

##### Launch video on YouTube

To use the 'Launch video on YouTube' action, the YouTube _video id_ must be provided, which is a 11 character long string.  The video id for this link on YouTube:

https://www.youtube.com/watch?v=aqz-KE-bpKQ

is ```aqz-KE-bpKQ```


## Device: SamsungLegacy

For older TVs, that respond to http://TV-IP-ADDRESS:55000

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
- Send key


### Acknowledgements:

Thanks to https://github.com/natalan/samsung-remote for solution to support older Samsung TVs.

### Feedback:

Please report issues at the [issues section on Github](https://github.com/balmli/com.samsung.smart/issues).

### Disclaimer

Use at your own risk. I accept no responsibility for any damages caused by using this app.

### Release Notes:

#### 1.0.4 

- Separate device for older Samsung TVs

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
