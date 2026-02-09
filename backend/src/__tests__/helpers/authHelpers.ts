import jwt from 'jsonwebtoken';

export type TestUserRole = 'admin' | 'viewer';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Generate a JWT for authenticated test requests.
 */
export function createTestToken(role: TestUserRole = 'admin'): string {
  return jwt.sign(
    {
      userId: 'test-user',
      username: 'test-user',
      role,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Authorization header object for authenticated tests.
 */
export function authHeader(role: TestUserRole = 'admin'): { Authorization: string } {
  return { Authorization: `Bearer ${createTestToken(role)}` };
}
