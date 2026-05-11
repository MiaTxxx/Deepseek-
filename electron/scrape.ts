import { BrowserWindow, net, session } from 'electron';

export interface CapturedResponse {
  url: string;
  method: string;
  status: number;
  json?: any;
  text?: string;
  bytes: number;
  requestHeaders?: Record<string, string>;
}

export interface DiagnoseResult {
  captured: CapturedResponse[];
  finalUrl: string;
  error?: string;
}

/**
 * Open a VISIBLE window loaded with the platform and capture every JSON
 * response fired by the page. User closes the window when done and we
 * return what was captured.
 *
 * visible=true means the user can navigate the site themselves – this is the
 * only reliable way to find DeepSeek's undocumented internal endpoints.
 */
export async function scrapePlatformUsage(opts: {
  visible: boolean;
  targetPath?: string;
  timeoutMs?: number;
}): Promise<DiagnoseResult> {
  const { visible, targetPath = '/usage', timeoutMs = 20000 } = opts;

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: visible,
      width: 1280,
      height: 900,
      title: 'DeepSeek 诊断浏览器（浏览到用量页面后关闭此窗口）',
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:deepseek',
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const captured: CapturedResponse[] = [];
    const requests = new Map<string, { url: string; method: string; headers: Record<string, string> }>();
    let settled = false;

    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      requests.clear();
      let finalUrl = '';
      try {
        finalUrl = win.webContents.getURL();
      } catch {
        /* ignore */
      }
      try {
        win.webContents.debugger.detach();
      } catch {
        /* ignore */
      }
      try {
        if (!win.isDestroyed()) win.close();
      } catch {
        /* ignore */
      }
      resolve({ captured, finalUrl, error });
    };

    try {
      win.webContents.debugger.attach('1.3');
    } catch (err: any) {
      return finish(`debugger attach failed: ${err?.message ?? err}`);
    }

    win.webContents.debugger.on('message', async (_e, method, params: any) => {
      try {
        if (method === 'Network.requestWillBeSent') {
          requests.set(params.requestId, {
            url: params.request.url,
            method: params.request.method,
            headers: params.request.headers ?? {},
          });
          return;
        }

        if (method === 'Network.loadingFailed') {
          requests.delete(params.requestId);
          return;
        }

        if (method === 'Network.loadingFinished') {
          const req = requests.get(params.requestId);
          if (!req) return;
          const { url, method: httpMethod, headers: reqHeaders } = req;
          // Only care about platform api-ish calls, skip assets
          if (/\.(js|css|png|jpe?g|svg|woff2?|ico|map|ttf|gif)(\?|$)/i.test(url)) return;

          try {
            const body: any = await win.webContents.debugger.sendCommand(
              'Network.getResponseBody',
              { requestId: params.requestId },
            );
            const text: string = body?.base64Encoded
              ? Buffer.from(body.body, 'base64').toString('utf-8')
              : body?.body ?? '';
            if (!text) return;
            let json: any;
            try {
              json = JSON.parse(text);
            } catch {
              /* not json */
            }
            if (json !== undefined) {
              captured.push({
                url,
                method: httpMethod,
                status: 200,
                json,
                text: text.length > 20000 ? text.slice(0, 20000) + '…(truncated)' : text,
                bytes: text.length,
                requestHeaders: reqHeaders,
              });
            }
          } catch {
            /* body not available */
          }
        }
      } catch (err) {
        console.error('[scrape] debugger event error:', err);
      }
    });

    win.webContents.debugger.sendCommand('Network.enable').catch(() => {
      /* ignore */
    });

    win.loadURL(`https://platform.deepseek.com${targetPath}`).catch((err) => {
      finish(`loadURL failed: ${err?.message ?? err}`);
    });

    // When user closes the window, resolve immediately
    win.on('closed', () => finish());

    if (!visible) {
      // Background mode: finish after timeout
      setTimeout(() => finish(), timeoutMs);
    }
  });
}

/**
 * Make a direct HTTP GET using Electron net with the stored cookie, for when
 * we already know the URL. Uses the 'persist:deepseek' session so HttpOnly
 * cookies from the login window are auto-included.
 */
export async function fetchJsonWithCookie(
  url: string,
  cookie: string,
  extraHeaders?: Record<string, string>,
) {
  return new Promise<{ status: number; json: any; text: string }>((resolve, reject) => {
    const req = net.request({
      url,
      method: 'GET',
      redirect: 'follow',
      session: session.fromPartition('persist:deepseek'),
      useSessionCookies: true,
    });
    // Also attach our stored cookie string as fallback
    if (cookie) req.setHeader('Cookie', cookie);
    req.setHeader('Accept', 'application/json, text/plain, */*');
    req.setHeader('Referer', 'https://platform.deepseek.com/usage');
    req.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    );
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        // Don't double-set cookie or essential net ones
        if (/^(cookie|host|content-length|connection|accept-encoding)$/i.test(k)) continue;
        try {
          req.setHeader(k, v);
        } catch {
          /* some headers are disallowed */
        }
      }
    }
    let data = '';
    req.on('response', (res) => {
      res.on('data', (c) => (data += c.toString('utf-8')));
      res.on('end', () => {
        let json: any = null;
        try {
          json = JSON.parse(data);
        } catch {
          /* nope */
        }
        resolve({ status: res.statusCode, json, text: data });
      });
      res.on('error', (e) => reject(e));
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}
