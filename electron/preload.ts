import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('dsApi', {
  // Window
  winMinimize: () => ipcRenderer.invoke('win:min'),
  winClose: () => ipcRenderer.invoke('win:close'),
  winHide: () => ipcRenderer.invoke('win:hide'),
  showMain: () => ipcRenderer.invoke('main:show'),
  showFloat: () => ipcRenderer.invoke('float:show'),
  hideFloat: () => ipcRenderer.invoke('float:hide'),
  toggleFloat: (): Promise<boolean> => ipcRenderer.invoke('float:toggle'),

  // Auth
  loginDeepSeek: () => ipcRenderer.invoke('auth:loginDeepSeek'),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg: Record<string, unknown>) => ipcRenderer.invoke('config:set', cfg),
  clearCookie: () => ipcRenderer.invoke('config:clearCookie'),

  // Data
  fetchBalance: () => ipcRenderer.invoke('api:balance'),
  fetchUsage: (range?: { start?: string; end?: string }) => ipcRenderer.invoke('api:usage', range),
  fetchAll: () => ipcRenderer.invoke('api:fetchAll'),
  diagnose: () => ipcRenderer.invoke('api:diagnose'),
  useCaptured: (index: number) => ipcRenderer.invoke('api:useCaptured', index),

  // External
  openExternal: (url: string) => ipcRenderer.invoke('open:external', url),
});

export {};
