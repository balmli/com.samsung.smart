import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {Log} from "../index";
import {getConfig, initSmartThingsClient, setSetting} from "../api";
import {DeviceSettings} from "../../lib/types";

type Options = {
    token: string;
};

export const command: string = "stdevices";
export const desc: string = "List SmartThings devices";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        token: {
            alias: "t",
            desc: "token",
            type: "string",
            demand: true,
            demandOption: false,
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const {token} = argv;
        const client = await initSmartThingsClient();
        getConfig().setSetting(DeviceSettings.smartthings_token, token);

        const devices = await client.fetchSmartThingsDevices();
        if (devices) {
            Log(colors.green(`✓ Fetched SmartThings devices: `));
            //Log(colors.yellow(JSON.stringify(devices)));
            for (const device of devices) {
                Log(colors.cyan(`${device.deviceId} - ${device.name} - ${device.ocf.modelNumber}`));
            }
        }
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};

const devices = {
    "items": [{
        "deviceId": "5455c1ee-a44b-0ec8-7486-211cf5009003",
        "name": "Samsung QN95BA 65",
        "label": "Samsung QN95BA 65",
        "manufacturerName": "Samsung Electronics",
        "presentationId": "VD-STV-2022",
        "deviceManufacturerCode": "Samsung Electronics",
        "locationId": "b4dd2a57-ca92-4103-86d8-a98d7e4a2ad7",
        "ownerId": "3a9437f9-1b5f-64f2-d856-a64dedabba1e",
        "roomId": "387171fe-4684-4ad2-9df1-6c6ddac8862c",
        "deviceTypeName": "Samsung OCF TV",
        "components": [{
            "id": "main",
            "label": "main",
            "capabilities": [{"id": "ocf", "version": 1}, {"id": "switch", "version": 1}, {
                "id": "audioVolume",
                "version": 1
            }, {"id": "audioMute", "version": 1}, {"id": "tvChannel", "version": 1}, {
                "id": "mediaInputSource",
                "version": 1
            }, {"id": "mediaPlayback", "version": 1}, {
                "id": "mediaTrackControl",
                "version": 1
            }, {"id": "powerConsumptionReport", "version": 1}, {
                "id": "custom.error",
                "version": 1
            }, {"id": "custom.picturemode", "version": 1}, {
                "id": "custom.soundmode",
                "version": 1
            }, {"id": "custom.accessibility", "version": 1}, {
                "id": "custom.launchapp",
                "version": 1
            }, {"id": "custom.recording", "version": 1}, {
                "id": "custom.tvsearch",
                "version": 1
            }, {"id": "custom.disabledCapabilities", "version": 1}, {
                "id": "samsungvd.remoteControl",
                "version": 1
            }, {"id": "samsungvd.ambient", "version": 1}, {
                "id": "samsungvd.ambientContent",
                "version": 1
            }, {"id": "samsungvd.mediaInputSource", "version": 1}, {
                "id": "samsungvd.supportsFeatures",
                "version": 1
            }, {"id": "samsungim.fixedFindNode", "version": 1}, {
                "id": "sec.diagnosticsInformation",
                "version": 1
            }, {"id": "refresh", "version": 1}, {"id": "execute", "version": 1}, {
                "id": "samsungvd.firmwareVersion",
                "version": 1
            }, {"id": "samsungvd.supportsPowerOnByOcf", "version": 1}],
            "categories": [{"name": "Television", "categoryType": "manufacturer"}]
        }],
        "createTime": "2022-11-29T18:54:21.255Z",
        "profile": {"id": "a26a870d-b35c-39b1-877f-f441b02aab05"},
        "ocf": {
            "ocfDeviceType": "oic.d.tv",
            "name": "Samsung QN95BA 65",
            "specVersion": "core.1.1.0",
            "verticalDomainSpecVersion": "res.1.1.0,sh.1.1.0",
            "manufacturerName": "Samsung Electronics",
            "modelNumber": "QE65QN95BATXXC",
            "platformVersion": "6.5",
            "platformOS": "Tizen",
            "hwVersion": "",
            "firmwareVersion": "T-PTMDEUC-1310.1|ST_ENERGY",
            "vendorId": "VD-STV-2022",
            "vendorResourceClientServerVersion": "2.4.22",
            "locale": "nn_NO",
            "lastSignupTime": "2022-11-29T18:54:16.021489Z"
        },
        "type": "OCF",
        "restrictionTier": 0,
        "allowed": []
    }, {
        "deviceId": "a91910e0-8c6f-41bd-8662-3c8688f59407",
        "name": "[TV] Samsung 8 Series (55)",
        "label": "[TV] Samsung 8 Series (55)",
        "manufacturerName": "Samsung Electronics",
        "presentationId": "VD-STV_2017_K",
        "deviceManufacturerCode": "Samsung Electronics",
        "locationId": "b4dd2a57-ca92-4103-86d8-a98d7e4a2ad7",
        "ownerId": "3a9437f9-1b5f-64f2-d856-a64dedabba1e",
        "deviceTypeName": "Samsung OCF TV",
        "components": [{
            "id": "main",
            "label": "main",
            "capabilities": [{"id": "ocf", "version": 1}, {"id": "switch", "version": 1}, {
                "id": "audioVolume",
                "version": 1
            }, {"id": "audioMute", "version": 1}, {"id": "tvChannel", "version": 1}, {
                "id": "mediaInputSource",
                "version": 1
            }, {"id": "mediaPlayback", "version": 1}, {"id": "mediaTrackControl", "version": 1}, {
                "id": "custom.error",
                "version": 1
            }, {"id": "custom.picturemode", "version": 1}, {
                "id": "custom.soundmode",
                "version": 1
            }, {"id": "custom.accessibility", "version": 1}, {
                "id": "custom.launchapp",
                "version": 1
            }, {"id": "custom.recording", "version": 1}, {
                "id": "custom.tvsearch",
                "version": 1
            }, {"id": "custom.disabledCapabilities", "version": 1}, {
                "id": "samsungvd.remoteControl",
                "version": 1
            }, {"id": "samsungvd.ambient", "version": 1}, {
                "id": "samsungvd.ambientContent",
                "version": 1
            }, {"id": "samsungvd.mediaInputSource", "version": 1}, {"id": "refresh", "version": 1}, {
                "id": "execute",
                "version": 1
            }, {"id": "samsungvd.firmwareVersion", "version": 1}, {
                "id": "samsungvd.supportsPowerOnByOcf",
                "version": 1
            }],
            "categories": [{"name": "Television", "categoryType": "manufacturer"}]
        }],
        "createTime": "2020-03-19T09:13:00Z",
        "profile": {"id": "3b7f0f0c-912d-39e8-a8f9-adf6980c5ccd"},
        "ocf": {
            "ocfDeviceType": "oic.d.tv",
            "name": "[TV] Samsung 8 Series (55)",
            "specVersion": "core.1.1.0",
            "verticalDomainSpecVersion": "res.1.1.0,sh.1.1.0",
            "manufacturerName": "Samsung Electronics",
            "modelNumber": "UE55KS8005",
            "platformVersion": "Tizen 2.3",
            "platformOS": "3.10.30",
            "hwVersion": "0-0",
            "firmwareVersion": "T-JZMDEUC-1260.1",
            "vendorId": "VD-STV_2017_K",
            "locale": "nn_NO",
            "lastSignupTime": "2020-03-19T09:12:57.036Z"
        },
        "type": "OCF",
        "restrictionTier": 0,
        "allowed": []
    }], "_links": {}
};

const device0 = {
    "components": {
        "main": {
            "mediaPlayback": {
                "supportedPlaybackCommands": {
                    "value": ["play", "pause", "stop", "fastForward", "rewind"],
                    "timestamp": "2022-11-29T18:54:21.603Z"
                }, "playbackStatus": {"value": null}
            },
            "samsungim.fixedFindNode": {},
            "samsungvd.supportsPowerOnByOcf": {
                "supportsPowerOnByOcf": {
                    "value": "true",
                    "timestamp": "2022-11-29T18:54:30.658Z"
                }
            },
            "mediaInputSource": {
                "supportedInputSources": {
                    "value": ["digitalTv", "HDMI2", "HDMI3", "HDMI4"],
                    "timestamp": "2022-12-31T10:56:39.005Z"
                }, "inputSource": {"value": "HDMI3", "timestamp": "2022-12-30T16:55:36.972Z"}
            },
            "switch": {"switch": {"value": "off", "timestamp": "2022-12-31T10:56:45.809Z"}},
            "ocf": {
                "st": {"value": "2022-12-30T23:03:00Z", "timestamp": "2022-12-31T10:56:46.279Z"},
                "mndt": {"value": "2022-01-01", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnfv": {"value": "T-PTMDEUC-1310.1|ST_ENERGY", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnhw": {"value": "", "timestamp": "2022-11-29T18:54:30.969Z"},
                "di": {"value": "5455c1ee-a44b-0ec8-7486-211cf5009003", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnsl": {"value": null},
                "dmv": {"value": "res.1.1.0,sh.1.1.0", "timestamp": "2022-11-29T18:54:30.925Z"},
                "n": {"value": "Samsung QN95BA 65", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnmo": {"value": "QE65QN95BATXXC", "timestamp": "2022-11-29T18:54:30.925Z"},
                "vid": {"value": "VD-STV-2022", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnmn": {"value": "Samsung Electronics", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnml": {"value": null},
                "mnpv": {"value": "6.5", "timestamp": "2022-11-29T18:54:30.925Z"},
                "mnos": {"value": "Tizen", "timestamp": "2022-11-29T18:54:30.925Z"},
                "pi": {"value": "5455c1ee-a44b-0ec8-7486-211cf5009003", "timestamp": "2022-11-29T18:54:30.925Z"},
                "icv": {"value": "core.1.1.0", "timestamp": "2022-11-29T18:54:30.925Z"}
            },
            "samsungvd.supportsFeatures": {
                "imeAdvSupported": {"value": true, "timestamp": "2022-11-29T18:54:30.818Z"},
                "mobileCamSupported": {"value": true, "timestamp": "2022-11-29T18:54:30.818Z"}
            },
            "custom.accessibility": {},
            "custom.disabledCapabilities": {
                "disabledCapabilities": {
                    "value": ["samsungim.fixedFindNode", "powerConsumptionReport"],
                    "timestamp": "2022-12-31T10:56:46.024Z"
                }
            },
            "samsungvd.remoteControl": {},
            "sec.diagnosticsInformation": {
                "logType": {
                    "value": ["errCode", "dump"],
                    "timestamp": "2022-11-29T18:54:30.904Z"
                },
                "endpoint": {"value": "NONE", "timestamp": "2022-11-29T18:54:30.904Z"},
                "minVersion": {"value": "1.0", "timestamp": "2022-11-29T18:54:30.904Z"},
                "signinPermission": {"value": null},
                "setupId": {"value": "101", "timestamp": "2022-11-29T18:54:30.904Z"},
                "protocolType": {"value": "ble_ocf", "timestamp": "2022-11-29T18:54:30.904Z"},
                "mnId": {"value": "0AJK", "timestamp": "2022-11-29T18:54:30.904Z"},
                "dumpType": {"value": "id", "timestamp": "2022-11-29T18:54:30.904Z"}
            },
            "custom.launchapp": {},
            "samsungvd.firmwareVersion": {
                "firmwareVersion": {
                    "value": "3.5.0",
                    "timestamp": "2022-11-29T18:54:30.769Z"
                }
            },
            "audioVolume": {"volume": {"value": 0, "unit": "%", "timestamp": "2022-12-31T10:56:45.870Z"}},
            "powerConsumptionReport": {"powerConsumption": {"value": null}},
            "samsungvd.mediaInputSource": {
                "supportedInputSourcesMap": {
                    "value": [{
                        "id": "dtv",
                        "name": "TV"
                    }, {"id": "HDMI2", "name": "Telenor"}, {"id": "HDMI3", "name": "Apple-TV"}, {
                        "id": "HDMI4",
                        "name": "Chromecast"
                    }], "timestamp": "2022-11-29T18:54:21.576Z"
                }, "inputSource": {"value": "HDMI3", "timestamp": "2022-12-30T16:55:36.972Z"}
            },
            "custom.tvsearch": {},
            "samsungvd.ambient": {},
            "refresh": {},
            "custom.error": {"error": {"value": null}},
            "execute": {"data": {"value": null}},
            "tvChannel": {
                "tvChannel": {"value": "", "timestamp": "2022-11-29T18:54:30.676Z"},
                "tvChannelName": {"value": "com.samsung.tv.csfs", "timestamp": "2022-12-31T10:56:45.845Z"}
            },
            "custom.picturemode": {
                "pictureMode": {"value": "Film", "timestamp": "2022-12-04T12:13:09.774Z"},
                "supportedPictureModes": {"value": ["FILMMAKER MODE"], "timestamp": "2022-12-31T10:56:45.898Z"},
                "supportedPictureModesMap": {
                    "value": [{"id": "modeFilmmakerModeHDR", "name": "FILMMAKER MODE"}],
                    "timestamp": "2022-12-31T10:56:45.898Z"
                }
            },
            "samsungvd.ambientContent": {
                "supportedAmbientApps": {
                    "value": ["weather"],
                    "timestamp": "2022-12-31T10:56:46.024Z"
                }
            },
            "custom.recording": {},
            "custom.soundmode": {
                "supportedSoundModesMap": {
                    "value": [{
                        "id": "modeExternalStandard",
                        "name": "Standard"
                    }], "timestamp": "2022-12-30T13:37:20.644Z"
                },
                "soundMode": {"value": "Standard", "timestamp": "2022-11-30T17:15:38.385Z"},
                "supportedSoundModes": {"value": ["Standard"], "timestamp": "2022-12-30T13:37:20.644Z"}
            },
            "audioMute": {"mute": {"value": "unmuted", "timestamp": "2022-12-25T21:18:19.833Z"}},
            "mediaTrackControl": {"supportedTrackControlCommands": {"value": null}}
        }
    }
};

const hjemme = {
    "components": {
        "main": {
            "mediaPlayback": {
                "supportedPlaybackCommands": {
                    "value": ["play", "pause", "stop", "fastForward", "rewind"],
                    "timestamp": "1970-01-19T08:10:09.180Z"
                }, "playbackStatus": {"value": null, "timestamp": "2020-07-25T17:27:32.797Z"}
            },
            "samsungvd.supportsPowerOnByOcf": {
                "supportsPowerOnByOcf": {
                    "value": "false",
                    "timestamp": "2022-11-17T16:46:08.431Z"
                }
            },
            "audioVolume": {"volume": {"value": 0, "unit": "%", "timestamp": "2022-03-21T18:00:06.659Z"}},
            "samsungvd.mediaInputSource": {
                "supportedInputSourcesMap": {
                    "value": [{
                        "id": "dtv",
                        "name": "TV"
                    }, {"id": "HDMI2", "name": "Chromecast"}, {"id": "HDMI3", "name": "Apple~TV"}],
                    "timestamp": "2022-11-26T10:29:16.304Z"
                }, "inputSource": {"value": "dtv", "timestamp": "2023-02-05T09:41:05.436Z"}
            },
            "mediaInputSource": {
                "supportedInputSources": {
                    "value": ["digitalTv", "HDMI2", "HDMI3"],
                    "timestamp": "2022-11-26T10:29:16.304Z"
                }, "inputSource": {"value": "digitalTv", "timestamp": "2023-02-05T09:41:05.436Z"}
            },
            "custom.tvsearch": {},
            "samsungvd.ambient": {},
            "refresh": {},
            "custom.error": {"error": {"value": null, "timestamp": "2020-07-20T20:57:07.903Z"}},
            "execute": {"data": {"value": null, "data": {}, "timestamp": "2020-07-25T16:35:47.506Z"}},
            "switch": {"switch": {"value": "off", "timestamp": "2023-02-05T09:45:48.070Z"}},
            "tvChannel": {
                "tvChannel": {"value": "", "timestamp": "1970-01-19T08:10:09.180Z"},
                "tvChannelName": {"value": "", "timestamp": "1970-01-19T08:10:09.180Z"}
            },
            "ocf": {
                "st": {"value": "2022-11-17T17:46:05Z", "timestamp": "2022-11-17T16:46:09.539Z"},
                "mndt": {"value": "2016-01-01", "timestamp": "2021-12-09T12:46:46.094Z"},
                "mnfv": {"value": "T-JZMDEUC-1260.1", "timestamp": "2022-07-23T12:31:18.477Z"},
                "mnhw": {"value": "0-0", "timestamp": "2020-03-20T07:47:28.416Z"},
                "di": {"value": "a91910e0-8c6f-41bd-8662-3c8688f59407", "timestamp": "2020-03-27T09:35:12.439Z"},
                "mnsl": {"value": "http://www.samsung.com/sec/tv/overview/", "timestamp": "2021-12-09T12:46:46.094Z"},
                "dmv": {"value": "res.1.1.0,sh.1.1.0", "timestamp": "2020-03-27T09:58:57.171Z"},
                "n": {"value": "[TV] Samsung 8 Series (55)", "timestamp": "2020-03-27T09:59:59.768Z"},
                "mnmo": {"value": "UE55KS8005", "timestamp": "2020-03-27T09:24:15.553Z"},
                "vid": {"value": "VD-STV_2017_K", "timestamp": "2020-03-20T07:46:17.685Z"},
                "mnmn": {"value": "Samsung Electronics", "timestamp": "2020-03-27T09:34:05.236Z"},
                "mnml": {"value": "http://www.samsung.com", "timestamp": "2020-03-27T09:24:45.091Z"},
                "mnpv": {"value": "Tizen 2.3", "timestamp": "2020-03-22T11:05:23.207Z"},
                "mnos": {"value": "3.10.30", "timestamp": "2020-03-20T07:49:17.447Z"},
                "pi": {"value": "a91910e0-8c6f-41bd-8662-3c8688f59407", "timestamp": "2020-03-27T09:35:11.817Z"},
                "icv": {"value": "core.1.1.0", "timestamp": "2020-03-27T09:59:59.076Z"}
            },
            "custom.picturemode": {
                "pictureMode": {"value": "HDR+", "timestamp": "2022-08-20T17:42:58.835Z"},
                "supportedPictureModes": {"value": ["HDR+"], "timestamp": "2022-08-20T17:42:58.835Z"},
                "supportedPictureModesMap": {
                    "value": [{"id": "modeSDRPlus", "name": "HDR+"}],
                    "timestamp": "2022-10-29T14:32:10.016Z"
                }
            },
            "samsungvd.ambientContent": {
                "supportedAmbientApps": {
                    "value": [],
                    "timestamp": "2021-01-16T05:10:52.131Z"
                }
            },
            "custom.accessibility": {},
            "custom.recording": {},
            "custom.disabledCapabilities": {
                "disabledCapabilities": {
                    "value": ["samsungvd.ambient", "samsungvd.ambientContent"],
                    "timestamp": "2021-01-16T05:10:52.131Z"
                }
            },
            "samsungvd.remoteControl": {},
            "custom.soundmode": {
                "supportedSoundModesMap": {
                    "value": [{
                        "id": "modeStandard",
                        "name": "Standard"
                    }, {"id": "modeMusic", "name": "Musikk"}, {
                        "id": "modeMovie",
                        "name": "Film"
                    }, {"id": "modeClearVoice", "name": "Klar tale"}, {"id": "modeAmplify", "name": "Forsterk"}],
                    "timestamp": "2022-03-13T13:23:40.518Z"
                },
                "soundMode": {"value": "Standard", "timestamp": "1970-01-19T08:10:09.180Z"},
                "supportedSoundModes": {
                    "value": ["Standard", "Musikk", "Film", "Klar tale", "Forsterk"],
                    "timestamp": "2022-03-13T13:23:40.518Z"
                }
            },
            "audioMute": {"mute": {"value": "unmuted", "timestamp": "2021-12-09T12:46:47.062Z"}},
            "mediaTrackControl": {
                "supportedTrackControlCommands": {
                    "value": null,
                    "timestamp": "2020-06-17T09:32:16.470Z"
                }
            },
            "custom.launchapp": {},
            "samsungvd.firmwareVersion": {"firmwareVersion": {"value": null, "timestamp": "2020-11-07T12:57:40.412Z"}}
        }
    }
};