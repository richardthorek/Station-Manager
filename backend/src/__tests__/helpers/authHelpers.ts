import jwt from 'jsonwebtoken';

export type TestUserRole = 'admin' | 'viewer';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Generate a JWT for authenticated test requests.
 */
export function createTestToken(role: TestUserRole = 'admin', organizationId?: string): string {
  return jwt.sign(
    {
      userId: 'test-user',
      username: 'test-user',
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
export function authHeader(role: TestUserRole = 'admin', organizationId?: string): { Authorization: string } {
  return { Authorization: `Bearer ${createTestToken(role, organizationId)}` };
}
