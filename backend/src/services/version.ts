/**
 * Version information utilities for the backend
 * Reads version info from environment variables injected during build/deployment
 */

export interface VersionInfo {
  commitSha: string;
  commitShort: string;
  buildTime: string;
  nodeEnv: string;
}

/**
 * Get version information from environment variables
 * These should be set during the build/deployment process
 */
export function getVersionInfo(): VersionInfo {
  return {
    commitSha: process.env.GIT_COMMIT_SHA || 'unknown',
    commitShort: process.env.GIT_COMMIT_SHORT || 'unknown',
    buildTime: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
