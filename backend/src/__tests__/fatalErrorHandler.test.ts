import { handleFatalProcessError } from '../services/fatalErrorHandler';
import { logger } from '../services/logger';

describe('handleFatalProcessError', () => {
  it('logs, flushes telemetry, then exits with code 1 for an uncaught exception', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const flush = jest.fn((callback?: () => void) => callback?.());
    const exit = jest.fn();
    const error = new Error('boom');

    handleFatalProcessError('uncaughtException', error, flush, exit);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('uncaughtException'),
      expect.objectContaining({ source: 'uncaughtException', error: 'boom', stack: error.stack })
    );
    expect(flush).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
  });

  it('logs, flushes telemetry, then exits with code 1 for an unhandled rejection', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const flush = jest.fn((callback?: () => void) => callback?.());
    const exit = jest.fn();

    handleFatalProcessError('unhandledRejection', 'rejected with a plain string', flush, exit);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('unhandledRejection'),
      expect.objectContaining({ source: 'unhandledRejection', error: 'rejected with a plain string' })
    );
    expect(exit).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
  });

  it('does not exit until the telemetry flush callback fires', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    let flushCallback: (() => void) | undefined;
    const flush = jest.fn((callback?: () => void) => {
      flushCallback = callback;
    });
    const exit = jest.fn();

    handleFatalProcessError('uncaughtException', new Error('boom'), flush, exit);

    expect(exit).not.toHaveBeenCalled();
    flushCallback?.();
    expect(exit).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
  });
});
