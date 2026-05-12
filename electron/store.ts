import { app } from 'electron';
import Store from 'electron-store';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface AppConfig {
  apiKey?: string;
  deepseekCookie?: string;
  refreshIntervalSec?: number;
  floatBounds?: { x: number; y: number };
  lastUsageCache?: any;
}

// Machine-specific key derivation; not cryptographic, but prevents trivial
// decryption when config file is moved to another machine.
const ENCRYPTION_KEY = `deepseek-monitor-${os.hostname()}-${os.userInfo().username}-v1`;
const STORE_NAME = 'config';

const storeOptions: Store.Options<AppConfig> = {
  name: STORE_NAME,
  defaults: {
    refreshIntervalSec: 60,
  },
  encryptionKey: ENCRYPTION_KEY,
  clearInvalidConfig: true,
};

function getStorePath() {
  return path.join(app.getPath('userData'), `${STORE_NAME}.json`);
}

function backupCorruptStoreFile() {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return;
  }

  const backupPath = path.join(
    path.dirname(storePath),
    `${STORE_NAME}.corrupt-${Date.now()}.json`,
  );

  try {
    fs.renameSync(storePath, backupPath);
    console.warn(`[store] Backed up corrupt config to ${backupPath}`);
  } catch (renameError) {
    console.warn('[store] Failed to rename corrupt config, removing it instead.', renameError);
    fs.unlinkSync(storePath);
  }
}

function createStore() {
  try {
    return new Store<AppConfig>(storeOptions);
  } catch (error) {
    console.error('[store] Failed to open persisted config. Rebuilding store.', error);
    backupCorruptStoreFile();
    return new Store<AppConfig>(storeOptions);
  }
}

export const store = createStore();
