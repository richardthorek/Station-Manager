import { CORS_ALLOWED_HEADERS } from '../config/corsHeaders';

describe('CORS_ALLOWED_HEADERS', () => {
  it('includes every custom header api.ts sends', () => {
    // Kept in sync with frontend/src/services/api.ts's getHeaders(): a header
    // missing here is invisible in prod (single origin, no preflight) but
    // silently breaks any cross-origin caller using that credential.
    expect(CORS_ALLOWED_HEADERS).toEqual(
      expect.arrayContaining(['Authorization', 'X-Station-Id', 'X-Brigade-Token', 'X-Member-Session'])
    );
  });
});
