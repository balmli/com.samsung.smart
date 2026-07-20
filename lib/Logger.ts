// @ts-nocheck

const logLevelMap = new Map([
    ['silly', 1],
    ['debug', 2],
    ['verbose', 3],
    ['info', 4],
    ['warn', 5],
    ['error', 6],
]);
const logLevelNameMap = new Map(
    Array.from(logLevelMap.entries()).map(entry => [entry[1], entry[0][0].toUpperCase().concat(entry[0].slice(1))]),
);

/**
 * @class Logger
 * This class is used by all RFDriver classes to dynamically print logs.
 */
export class Logger {
    constructor({
        logLevel = 3,
        prefix,
        logFunc,
        errorFunc,
    }: {
        logLevel?: number | string;
        prefix?: string;
        logFunc?: Function;
        errorFunc?: Function;
    }) {
        this.setLogLevel(logLevel);

        this.logFunc = logFunc || console.log;
        this.errorFunc = errorFunc || console.error;
        this.prefix = prefix ? `[${[].concat(prefix).join('][')}]` : '';

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
            throw new Error(
                `Unsupported loglevel (${logLevel}) given. Please choose from ${logLevelMap
                    .entries()
                    .map(entry => entry.join(':'))
                    .join(', ')}`,
            );
        }
        return this.logLevel;
    }

    /**
     * Get the label of the current log level
     * @returns {String} logLevelLabel The label of the logLevel. can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'.
     */
    getLogLevelLabel() {
        return logLevelNameMap.get(this.logLevel);
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
                    this.errorFunc(
                        `${this.prefix}[${logLevelNameMap.get(logLevelId)}]`,
                        logArgs[0].message,
                        logArgs[0].stack,
                    );
                } else {
                    this.errorFunc.apply(null, [`${this.prefix}[${logLevelNameMap.get(logLevelId)}]`].concat(logArgs));
                }
            } else {
                this.logFunc.apply(null, [`${this.prefix}[${logLevelNameMap.get(logLevelId)}]`].concat(logArgs));
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
        if (this.logLevel <= 1) {
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
        if (this.logLevel <= 2) {
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
        if (this.logLevel <= 3) {
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
        if (this.logLevel <= 4) {
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
        if (this.logLevel <= 5) {
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
        if (this.logLevel <= 6) {
            this.log.bind(null, 'error').apply(null, arguments);
        }
    }
}
