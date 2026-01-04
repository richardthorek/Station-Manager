import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git commit SHA and build timestamp
const getGitCommitSha = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch (error) {
    console.warn('Unable to get git commit SHA:', error)
    return 'unknown'
  }
}

const getGitCommitShort = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch (error) {
    return 'unknown'
  }
}

const getBuildTimestamp = () => {
  return new Date().toISOString()
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    '__APP_VERSION__': JSON.stringify({
      commitSha: getGitCommitSha(),
      commitShort: getGitCommitShort(),
      buildTime: getBuildTimestamp(),
      nodeEnv: process.env.NODE_ENV || 'production',
    }),
  },
})
