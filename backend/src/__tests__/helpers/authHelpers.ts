import jwt from 'jsonwebtoken';

export type TestUserRole = 'admin' | 'viewer' | 'owner';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Generate a JWT for authenticated test requests. `username` defaults to
 * 'test-user'; override it when a test needs to match/miss a
 * PLATFORM_ADMIN_USERNAMES allowlist entry (Q32).
 */
export function createTestToken(role: TestUserRole = 'admin', organizationId?: string, username = 'test-user'): string {
  return jwt.sign(
    {
      userId: username,
      username,
      role,
      ...(organizationId ? { organizationId } : {}),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Authorization header object for authenticated tests.
 */
export function authHeader(
  role: TestUserRole = 'admin',
  organizationId?: string,
  username?: string,
): { Authorization: string } {
  return { Authorization: `Bearer ${createTestToken(role, organizationId, username)}` };
}
