"use strict";

const os = require("os");
const fs = require("fs");
const path = require("path");
const util = require("util");

import { Log } from "./index";

const statAsync = util.promisify(fs.stat);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const mkdirAsync = util.promisify(fs.mkdir);

export class Settings {
  private _settings: any;
  private _settingsPath: string | undefined;

  constructor() {
    this._settingsPath = this._getSettingsPath();
  }

  _getSettingsPath() {
    const platform = os.platform();

    if (platform === "win32") {
      return path.join(process.env.APPDATA, "samsung-cli", "settings.json");
    }

    return path.join(process.env.HOME, ".samsung-cli", "settings.json");
  }

  async _getSettings() {
    if (this._settings) return this._settings;

    try {
      const data = await readFileAsync(this._settingsPath, "utf8");
      const json = JSON.parse(data);
      this._settings = json;
    } catch (err: any) {
      if (err.code !== "ENOENT") Log(err);
      this._settings = {};
    }
    return this._settings;
  }

  async get(key: string) {
    await this._getSettings();
    return this._settings[key] || null;
  }

  async set(key: string, value: any) {
    await this._getSettings();

    this._settings[key] = value;

    // create directory if not exists
    const dir = path.dirname(this._settingsPath);
    try {
      await statAsync(dir);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
      await mkdirAsync(dir);
    }

    const json = JSON.stringify(this._settings, null, 4);
    await writeFileAsync(this._settingsPath, json);

    return this.get(key);
  }

  async unset(key: string) {
    return this.set(key, null);
  }
}
