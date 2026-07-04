import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthCancellation } from '../js/audio/speech.js';

// A minimal stand-in for the Azure Speech SDK's enums — isAuthCancellation
// only reads these two, so a fake sdk keeps this test independent of the
// (browser-only, CDN-loaded) real SDK.
const sdk = {
  CancellationReason: { Error: 'Error', EndOfStream: 'EndOfStream' },
  CancellationErrorCode: {
    AuthenticationFailure: 'AuthenticationFailure',
    ConnectionFailure: 'ConnectionFailure',
    BadRequestParameters: 'BadRequestParameters',
  },
};

test('isAuthCancellation is true for an authentication-failure cancellation', () => {
  assert.equal(
    isAuthCancellation(sdk, { reason: sdk.CancellationReason.Error, errorCode: sdk.CancellationErrorCode.AuthenticationFailure }),
    true,
  );
});

test('isAuthCancellation is true for a connection-failure cancellation', () => {
  assert.equal(
    isAuthCancellation(sdk, { reason: sdk.CancellationReason.Error, errorCode: sdk.CancellationErrorCode.ConnectionFailure }),
    true,
  );
});

test('isAuthCancellation is false for other cancellation error codes', () => {
  assert.equal(
    isAuthCancellation(sdk, { reason: sdk.CancellationReason.Error, errorCode: sdk.CancellationErrorCode.BadRequestParameters }),
    false,
  );
});

test('isAuthCancellation is false when the cancellation reason is not Error (e.g. a clean end-of-stream)', () => {
  assert.equal(
    isAuthCancellation(sdk, { reason: sdk.CancellationReason.EndOfStream, errorCode: sdk.CancellationErrorCode.AuthenticationFailure }),
    false,
  );
});

test('isAuthCancellation is false for a missing/undefined event', () => {
  assert.equal(isAuthCancellation(sdk, undefined), false);
  assert.equal(isAuthCancellation(sdk, {}), false);
});
