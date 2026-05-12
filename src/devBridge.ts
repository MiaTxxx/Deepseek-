import type { FetchAllResult } from './types';

const isDev = Boolean((import.meta as any).env?.DEV);

if (isDev && !window.dsApi) {
  let floatVisible = false;

  const noRuntime = '未连接 Electron 真实接口，请通过 npm run electron:dev 启动应用。';

  const emptyResult = (): FetchAllResult => ({
    ok: false,
    balance: null,
    usage: null,
    errors: [
      { kind: 'balance', error: noRuntime },
      { kind: 'usage', error: noRuntime },
    ],
  });

  window.dsApi = {
    winMinimize: async () => undefined,
    winClose: async () => undefined,
    winHide: async () => undefined,
    showMain: async () => undefined,
    showFloat: async () => undefined,
    hideFloat: async () => undefined,
    toggleFloat: async () => {
      floatVisible = !floatVisible;
      return floatVisible;
    },
    loginDeepSeek: async () => ({ ok: false, error: noRuntime }),
    getConfig: async () => ({
      apiKey: '',
      hasCookie: false,
      refreshIntervalSec: 60,
      usageEndpoint: '',
    }),
    setConfig: async () => ({ ok: false }),
    clearCookie: async () => ({ ok: false }),
    fetchBalance: async () => ({ ok: false, error: noRuntime }),
    fetchUsage: async () => ({ ok: false, error: noRuntime }),
    fetchAll: async () => emptyResult(),
    diagnose: async () => ({ ok: false, error: noRuntime }),
    useCaptured: async () => ({ ok: false, error: noRuntime }),
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  };
}
