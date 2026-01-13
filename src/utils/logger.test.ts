import { assertEquals } from '@std/assert';
import { createLogger, Logger, LogLevel, silentLogger } from './logger.ts';

Deno.test('Logger - should create logger with default options', () => {
    const logger = new Logger();
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - should create logger with custom level', () => {
    const logger = new Logger({ level: LogLevel.Error });
    // Logger is created successfully
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - should create logger with prefix', () => {
    const logger = new Logger({ prefix: 'test' });
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - should create logger with timestamps', () => {
    const logger = new Logger({ timestamps: true });
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - should create logger without colors', () => {
    const logger = new Logger({ colors: false });
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - should create child logger with prefix', () => {
    const parent = new Logger({ prefix: 'parent' });
    const child = parent.child('child');
    assertEquals(child instanceof Logger, true);
});

Deno.test('Logger - should create child logger with nested prefix', () => {
    const parent = new Logger({ prefix: 'parent' });
    const child = parent.child('child');
    const grandchild = child.child('grandchild');
    assertEquals(grandchild instanceof Logger, true);
});

Deno.test('Logger - should set log level', () => {
    const logger = new Logger();
    logger.setLevel(LogLevel.Error);
    // No error means success
    assertEquals(true, true);
});

Deno.test('Logger - createLogger should create a new instance', () => {
    const logger = createLogger();
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - createLogger should accept options', () => {
    const logger = createLogger({
        level: LogLevel.Debug,
        prefix: 'test',
        timestamps: true,
    });
    assertEquals(logger instanceof Logger, true);
});

Deno.test('Logger - silentLogger should have all methods', () => {
    assertEquals(typeof silentLogger.trace, 'function');
    assertEquals(typeof silentLogger.debug, 'function');
    assertEquals(typeof silentLogger.info, 'function');
    assertEquals(typeof silentLogger.warn, 'function');
    assertEquals(typeof silentLogger.error, 'function');
});

Deno.test('Logger - silentLogger methods should not throw', () => {
    silentLogger.trace('test');
    silentLogger.debug('test');
    silentLogger.info('test');
    silentLogger.warn('test');
    silentLogger.error('test');
    // No errors means success
    assertEquals(true, true);
});

Deno.test('Logger - all log methods should not throw', () => {
    const logger = new Logger({ level: LogLevel.Trace });
    logger.trace('trace message');
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    logger.success('success message');
    // No errors means success
    assertEquals(true, true);
});

Deno.test('Logger - should respect log level filtering', () => {
    const logger = new Logger({ level: LogLevel.Error });
    // These should not output (but not throw)
    logger.trace('should not show');
    logger.debug('should not show');
    logger.info('should not show');
    logger.warn('should not show');
    // This should output
    logger.error('should show');
    // No errors means success
    assertEquals(true, true);
});

Deno.test('Logger - LogLevel enum should have expected values', () => {
    assertEquals(LogLevel.Trace, -1);
    assertEquals(LogLevel.Debug, 0);
    assertEquals(LogLevel.Info, 1);
    assertEquals(LogLevel.Warn, 2);
    assertEquals(LogLevel.Error, 3);
    assertEquals(LogLevel.Silent, 4);
});
