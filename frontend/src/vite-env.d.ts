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

// Suite launcher: absolute URLs of sibling Bushie Tools apps (separate
// deployments in suite Phase 1). Augments vite/client's ImportMetaEnv.
interface ImportMetaEnv {
  readonly VITE_SANTA_RUN_URL?: string;
  readonly VITE_FIREBREAK_URL?: string;
}
