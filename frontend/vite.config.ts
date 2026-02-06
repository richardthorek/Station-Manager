import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { visualizer } from 'rollup-plugin-visualizer'

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
  } catch {
    return 'unknown'
  }
}

const getBuildTimestamp = () => {
  return new Date().toISOString()
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  define: {
    '__APP_VERSION__': JSON.stringify({
      commitSha: getGitCommitSha(),
      commitShort: getGitCommitShort(),
      buildTime: getBuildTimestamp(),
      nodeEnv: process.env.NODE_ENV || 'production',
    }),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
