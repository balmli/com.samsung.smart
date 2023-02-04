# Samsung SmartTV CLI

## Install and compile

```
npm install
npm run build
```


## Usage

#### Search for TVs

`./build/cmd/cli.js search` 

#### Pair

`./build/cmd/cli.js pair --ip <xxx.xxx.xxx.xxx>`

And accept the pairing request on the TV.


#### Turn on

`./build/cmd/cli.js turnon`

#### Turn off

`./build/cmd/cli.js turnoff`

#### Send key

`./build/cmd/cli.js sendkey -k <key>`

eg. mute:

`./build/cmd/cli.js sendkey -k KEY_MUTE`

#### Launch app

To launch an app, use the app id or dialId.

`./build/cmd/cli.js launchapp -a <app id>`

eg. Netflix:

`./build/cmd/cli.js launchapp -a Netflix`

`./build/cmd/cli.js launchapp -a 11101200001`

#### Launch YouTube with video

`./build/cmd/cli.js youtube -v <YouTube video id>`

eg. https://www.youtube.com/watch?v=QH2-TGUlwu4

`./build/cmd/cli.js youtube -v QH2-TGUlwu4`

#### Launch browser

To start the browser app with a specific url:

`./build/cmd/cli.js browser -u <url>`

eg.

`./build/cmd/cli.js browser -u https://www.bbc.com/`
