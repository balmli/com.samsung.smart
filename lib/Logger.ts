// @ts-nocheck

import Homey from "homey/lib/Homey";

const logLevelMap = new Map([['silly', 1], ['debug', 2], ['verbose', 3], ['info', 4], ['warn', 5], ['error', 6]]);
const sentryLevelMap = new Map([[1, 'debug'], [2, 'debug'], [3, 'debug'], [4, 'info'], [5, 'warning'], [6, 'error']]);
const logLevelNameMap = new Map(
    Array.from(logLevelMap.entries()).map(entry => [entry[1], entry[0][0].toUpperCase().concat(entry[0].slice(1))])
);

/**
 * @class Logger
 * This class is used by all RFDriver classes to dynamically print logs and send logs to sentry
 */
export class Logger {
    constructor(
        {
            homey,
            logLevel = 3,
            captureLevel = 5,
            prefix,
            logFunc,
            errorFunc,
        }: {
            homey?: Homey,
            logLevel?: number | string,
            captureLevel?: number | string,
            prefix?: string,
            logFunc?: Function,
            errorFunc?: Function,
        }, homeyEnv) {

        // Load homey-log and create pre-bound functions or function stubs for logger
        const log = homey && typeof homeyEnv.HOMEY_LOG_URL === 'string' ? require("homey-log") : undefined;
        const homeyLog = log ? new log.Log({homey}) : undefined;

        this.setLogLevel(logLevel);
        this.setCaptureLevel(captureLevel);

        this.logFunc = logFunc || console.log;
        this.errorFunc = errorFunc || console.error;
        this.prefix = prefix ? `[${[].concat(prefix).join('][')}]` : '';

        this.setTags = homeyLog ? homeyLog.setTags.bind(homeyLog) : () => null;
        this.setUser = homeyLog ? homeyLog.setUser.bind(homeyLog) : () => null;
        this.setExtra = homeyLog ? homeyLog.setExtra.bind(homeyLog) : () => null;
        this.captureMessage = homeyLog ? homeyLog.captureMessage.bind(homeyLog) : () => null;
        this.captureException = homeyLog ? homeyLog.captureException.bind(homeyLog) : () => null;

        // Bind logging functions with this to ensure right this context
        this.log = this._log.bind(this);
        this.silly = this._silly.bind(this);
        this.debug = this._debug.bind(this);
        this.verbose = this._verbose.bind(this);
        this.info = this._info.bind(this);
        this.warn = this._warn.bind(this);
        this.error = this._error.bind(this);
    }

    /**
     * Can be used to dynamically set the logLevel of the logger
     * @param {String} logLevel The level at which logs are printed. can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'.
     * @returns {number} result The id of the logLevel
     */
    setLogLevel(logLevel) {
        if (!isNaN(logLevel) && logLevelNameMap.has(logLevel)) {
            this.logLevel = Number(logLevel);
        } else if (logLevelMap.has(logLevel)) {
            this.logLevel = logLevelMap.get(logLevel);
        } else {
            throw new Error(`Unsupported loglevel (${logLevel}) given. Please choose from ${
                logLevelMap.entries().map(entry => entry.join(':')).join(', ')}`);
        }
        return this.logLevel;
    }

    /**
     * Can be used to dynamically set the captureLevel of the logger
     * @param {String} captureLevel The level at which logs are send to sentry. can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'.
     * @returns {number} result The id of the captureLevel
     */
    setCaptureLevel(captureLevel) {
        if (!isNaN(captureLevel) && logLevelNameMap.has(captureLevel)) {
            this.captureLevel = Number(captureLevel);
        } else if (logLevelMap.has(captureLevel)) {
            this.captureLevel = logLevelMap.get(captureLevel);
        } else {
            throw new Error(`Unsupported captureLevel (${captureLevel}) given. Please choose from ${
                logLevelMap.entries().map(entry => entry.join(':')).join(', ')}`);
        }
        return this.captureLevel;
    }

    /**
     * Get the label of the current log level
     * @returns {String} logLevelLabel The label of the logLevel. can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'.
     */
    getLogLevelLabel() {
        return logLevelNameMap.get(this.logLevel);
    }

    /**
     * Get the label of the current capture level
     * @returns {String} captureLevelLabel The label of the captureLevel. can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'.
     */
    getCaptureLevelLabel() {
        return logLevelNameMap.get(this.captureLevel);
    }

    /**
     * Logs a message for given log level
     * @alias log
     * @param {String} level The level to log. can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'.
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _log(level) {
        const logArgs = Array.prototype.slice.call(arguments, logLevelMap.has(level) ? 1 : 0);
        const logLevelId = logLevelMap.get(level) || 4;

        if (this.logLevel <= logLevelId) {
            if (logLevelId === 6) {
                if (logArgs[0] instanceof Error) {
                    this.errorFunc(`${this.prefix}[${logLevelNameMap.get(logLevelId)}]`, logArgs[0].message, logArgs[0].stack);
                } else {
                    this.errorFunc.apply(null, [`${this.prefix}[${logLevelNameMap.get(logLevelId)}]`].concat(logArgs));
                }
            } else {
                this.logFunc.apply(null, [`${this.prefix}[${logLevelNameMap.get(logLevelId)}]`].concat(logArgs));
            }
        }
        if (this.captureLevel <= logLevelId) {
            if (logLevelId === 6 && logArgs[0] instanceof Error) {
                this.captureException(
                    logArgs[0],
                    Object.assign({level: sentryLevelMap.get(logLevelId)}, typeof logArgs[1] === 'object' ? logArgs[1] : null)
                );
            } else {
                this.captureMessage(Array.prototype.join.call(logArgs, ' '), {level: sentryLevelMap.get(logLevelId)});
            }
        }
    }

    /**
     * Logs a message for log level 'silly'
     * @alias silly
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _silly() {
        if (this.captureLevel <= 1 || this.logLevel <= 1) {
            this.log.bind(null, 'silly').apply(null, arguments);
        }
    }

    /**
     * Logs a message for log level 'debug'
     * @alias debug
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _debug() {
        if (this.captureLevel <= 2 || this.logLevel <= 2) {
            this.log.bind(null, 'debug').apply(null, arguments);
        }
    }

    /**
     * Logs a message for log level 'verbose'
     * @alias verbose
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _verbose() {
        if (this.captureLevel <= 3 || this.logLevel <= 3) {
            this.log.bind(null, 'verbose').apply(null, arguments);
        }
    }

    /**
     * Logs a message for log level 'info'
     * @alias info
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _info() {
        if (this.captureLevel <= 4 || this.logLevel <= 4) {
            this.log.bind(null, 'info').apply(null, arguments);
        }
    }

    /**
     * Logs a message for log level 'warn'
     * @alias warn
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _warn() {
        if (this.captureLevel <= 5 || this.logLevel <= 5) {
            this.log.bind(null, 'warn').apply(null, arguments);
        }
    }

    /**
     * Logs a message for log level 'error'
     * @alias error
     * @param {...*} args The variables to log
     * @memberof Logger
     */
    _error() {
        if (this.captureLevel <= 6 || this.logLevel <= 6) {
            this.log.bind(null, 'error').apply(null, arguments);
        }
    }
}
