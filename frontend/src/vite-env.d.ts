/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Application version information injected at build time
interface AppVersion {
  commitSha: string;
  commitShort: string;
  buildTime: string;
  nodeEnv: string;
}

declare const __APP_VERSION__: AppVersion;
