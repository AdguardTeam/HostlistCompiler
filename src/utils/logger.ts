// deno-lint-ignore-file no-console
/**
 * Deno-native logger implementation
 * Replaces consola for Deno compatibility
 */

import type { ILogger } from '../types/index.ts';

/**
 * Log levels for filtering output
 */
export enum LogLevel {
    Trace = -1,
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Silent = 4,
}

/**
 * ANSI color codes for terminal output
 */
const Colors = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
} as const;

/**
 * Logger configuration options
 */
export interface LoggerOptions {
    level?: LogLevel;
    prefix?: string;
    timestamps?: boolean;
    colors?: boolean;
}

/**
 * Creates a formatted timestamp string
 */
function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Console-based logger implementation for Deno
 */
export class Logger implements ILogger {
    private level: LogLevel;
    private prefix: string;
    private timestamps: boolean;
    private colors: boolean;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? LogLevel.Info;
        this.prefix = options.prefix ?? '';
        this.timestamps = options.timestamps ?? false;
        this.colors = options.colors ?? true;
    }

    /**
     * Formats a log message with optional prefix and timestamp
     */
    private format(levelName: string, color: string, message: string): string {
        const parts: string[] = [];

        if (this.timestamps) {
            parts.push(
                this.colors
                    ? `${Colors.dim}${getTimestamp()}${Colors.reset}`
                    : getTimestamp()
            );
        }

        if (this.prefix) {
            parts.push(
                this.colors
                    ? `${Colors.cyan}[${this.prefix}]${Colors.reset}`
                    : `[${this.prefix}]`
            );
        }

        parts.push(
            this.colors
                ? `${color}${levelName}${Colors.reset}`
                : levelName
        );

        parts.push(message);

        return parts.join(' ');
    }

    /**
     * Logs a trace message (most verbose)
     */
    trace(message: string): void {
        if (this.level <= LogLevel.Trace) {
            console.debug(this.format('TRACE', Colors.dim, message));
        }
    }

    /**
     * Logs a debug message
     */
    debug(message: string): void {
        if (this.level <= LogLevel.Debug) {
            console.debug(this.format('DEBUG', Colors.dim, message));
        }
    }

    /**
     * Logs an info message
     */
    info(message: string): void {
        if (this.level <= LogLevel.Info) {
            console.info(this.format('INFO', Colors.blue, message));
        }
    }

    /**
     * Logs a warning message
     */
    warn(message: string): void {
        if (this.level <= LogLevel.Warn) {
            console.warn(this.format('WARN', Colors.yellow, message));
        }
    }

    /**
     * Logs an error message
     */
    error(message: string): void {
        if (this.level <= LogLevel.Error) {
            console.error(this.format('ERROR', Colors.red, message));
        }
    }

    /**
     * Logs a success message (info level)
     */
    success(message: string): void {
        if (this.level <= LogLevel.Info) {
            console.info(this.format('SUCCESS', Colors.green, message));
        }
    }

    /**
     * Creates a child logger with an additional prefix
     */
    child(prefix: string): Logger {
        const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
        return new Logger({
            level: this.level,
            prefix: childPrefix,
            timestamps: this.timestamps,
            colors: this.colors,
        });
    }

    /**
     * Sets the log level
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Creates a new logger with the given options
 */
export function createLogger(options?: LoggerOptions): Logger {
    return new Logger(options);
}

/**
 * Silent logger that discards all output (useful for testing)
 */
export const silentLogger: ILogger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
};
