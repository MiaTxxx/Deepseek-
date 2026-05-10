import Store from 'electron-store';

export interface AppConfig {
  apiKey?: string;
  deepseekCookie?: string;
  refreshIntervalSec?: number;
  floatBounds?: { x: number; y: number };
  lastUsageCache?: any;
}

export const store = new Store<AppConfig>({
  defaults: {
    refreshIntervalSec: 60,
  },
  // Lightly obfuscate at rest; not cryptographic security
  encryptionKey: 'deepseek-monitor-local-v1',
});
