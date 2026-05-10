import Store from 'electron-store';
import * as os from 'os';

export interface AppConfig {
  apiKey?: string;
  deepseekCookie?: string;
  refreshIntervalSec?: number;
  floatBounds?: { x: number; y: number };
  lastUsageCache?: any;
}

// Machine-specific key derivation — not cryptographic, but prevents trivial
// decryption when config file is moved to another machine.
const ENCRYPTION_KEY = `deepseek-monitor-${os.hostname()}-${os.userInfo().username}-v1`;

export const store = new Store<AppConfig>({
  defaults: {
    refreshIntervalSec: 60,
  },
  encryptionKey: ENCRYPTION_KEY,
});
