function launchChrome(targetUrl) {
  return new Promise((resolve, reject) => {
    const chrome = spawn('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=0',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      targetUrl
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        chrome.kill();
        reject(new Error('Chrome launch timed out after 10s'));
      }
    }, 10000);

    chrome.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    chrome.stderr.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/[a-f0-9-]+)/);
      if (match && !settled) {
        const cdpPort = parseInt(match[2], 10);
        // Query http://127.0.0.1:<cdpPort>/json to locate the page target
        let retries = 20;
        const findPage = () => {
          http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
              try {
                const targets = JSON.parse(body);
                const pageTarget = targets.find(t => t.type === 'page');
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                  settled = true;
                  clearTimeout(timeout);
                  resolve({ chrome, wsUrl: pageTarget.webSocketDebuggerUrl, port: cdpPort });
                } else if (retries-- > 0) {
                  setTimeout(findPage, 100);
                } else {
                  settled = true;
                  clearTimeout(timeout);
                  reject(new Error('No page target found'));
                }
              } catch (e) {
                if (retries-- > 0) setTimeout(findPage, 100);
                else {
                  settled = true;
                  clearTimeout(timeout);
                  reject(e);
                }
              }
            });
          }).on('error', () => {
            if (retries-- > 0) setTimeout(findPage, 100);
            else {
              settled = true;
              clearTimeout(timeout);
              reject(new Error('Failed to reach Chrome JSON API'));
            }
          });
        };
        setTimeout(findPage, 150);
      }
    });
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(msg.error);
          else cb.resolve(msg.result);
        }

        if (msg.method === 'Runtime.exceptionThrown') {
          this.exceptions.push(msg.params);
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          if (msg.params.type === 'error') {
            this.consoleErrors.push(msg.params);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runChallenger2Suite() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // CHALLENGER 2 EMPIRICAL ADVERSARIAL TEST SUITE');
  console.log('Milestone M1: Core Omarchy Foundation & Theme Engine Hardening');
  console.log('================================================================\n');

  let serverObj = null;
  let chromeInstance = null;
  let cdp = null;

  try {
    serverObj = await startStaticServer();
    const serverPort = serverObj.port;
    const targetUrl = `http://127.0.0.1:${serverPort}/index.html`;

    const chromeData = await launchChrome(targetUrl);
    chromeInstance = chromeData.chrome;
    cdp = new CdpClient(chromeData.wsUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 800));
    await cdp.eval(`new Promise(r => {
      const check = () => {
        if (typeof window !== 'undefined' && window.ClownTheme && window.ClownPalette) r(true);
        else setTimeout(check, 50);
      };
      check();
    })`);

    // =========================================================================
