import React from 'react';
import ReactDOM from 'react-dom';
// @ts-expect-error TODO(A5): App.jsx not yet converted to TSX
import App from '../js/app/components/App';
// @ts-expect-error TODO(A4): audio/index.js not yet converted to TS
import audioManager from '../js/app/common/audio/index';
import isDev from 'electron-is-dev';
// @ts-expect-error TODO(A4): assetLoader.js not yet converted to TS
import { syncBundledAssets } from '../js/app/common/assetLoader';
// @ts-expect-error TODO(A4): extendYup.js not yet converted to TS
import extendYup from '../js/app/common/extendYup';
// @ts-expect-error TODO(A4): config.js not yet converted to TS
import config from '../js/app/config/config';
import { shell } from 'electron';
import remote from '@electron/remote';

extendYup();

interface SpectorInstance {
  onCaptureStarted: { add: (cb: () => void) => void };
  onCapture: { add: (cb: (result: unknown) => void) => void };
  onError: { add: (cb: (err: unknown) => void) => void };
  startCapture: (canvas: Element | null) => void;
  displayUI: () => void;
}

declare global {
  interface Window {
    SPECTOR: { Spector: new () => SpectorInstance };
  }
}

window.confirm = function (message?: string): boolean {
  const buttonIdx = remote.dialog.showMessageBoxSync(null, {
    type: 'question',
    buttons: ['OK', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    detail: message,
    message: '',
  });
  return buttonIdx === 0;
};

window.alert = function (message?: string): void {
  remote.dialog.showMessageBoxSync(null, {
    type: 'warning',
    buttons: ['OK'],
    defaultId: 0,
    cancelId: 0,
    detail: message,
    message: '',
  });
};

const DEVTOOLS_WARNING = `
*** DANGER ***

Danger! Wee-ooo, wee-ooo!

For real though - do NOT execute code given to you by strangers! Executing code in this window can harm your computer. Proceed with caution, or better yet, close this window unless you know precisely what you are doing.

*** DANGER ***
`;

setTimeout(() => console.warn(DEVTOOLS_WARNING), 1500);

function downloadJSON(blob: unknown, fileName = 'download'): void {
  let anchor = document.querySelector<HTMLAnchorElement>('#download-anchor');

  if (!anchor) {
    anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.id = 'download-anchor';
    document.body.appendChild(anchor);
  }

  const dataStr = 'data:text/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify(blob));

  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `${fileName}.json`);
  anchor.click();
}

document.addEventListener(
  'click',
  (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.matches('a[href^="http"]')) {
      e.preventDefault();
      const anchor = target as HTMLAnchorElement;
      const targetUrl = new URL(anchor.href);
      const newQuery = new URLSearchParams(targetUrl.searchParams.toString());
      const newUrl = [
        targetUrl.origin,
        targetUrl.pathname,
        `?${newQuery.toString()}`,
        targetUrl.hash,
      ].join('');
      console.log('Opening external link:', newUrl);
      shell.openExternal(newUrl);
    }
  },
  false,
);

let spector: SpectorInstance | undefined;
if (isDev) {
  const script = document.createElement('script');
  script.onload = () => {
    spector = new window.SPECTOR.Spector();
    spector.onCaptureStarted.add(() => {});
    spector.onCapture.add((result) => {
      downloadJSON(result, 'spector-capture');
    });
    spector.onError.add(console.error);
  };
  script.src = 'https://spectorcdn.babylonjs.com/spector.bundle.js';
  document.head.appendChild(script);
}

const { Menu, MenuItem } = remote;
const applicationMenu = Menu.getApplicationMenu();
const helpMenuItem = applicationMenu.items.find(
  (menuItem: { role?: string }) => menuItem.role === 'help',
);

const devToolsLabel = 'Toggle Developer Tools';
const devToolsItem = helpMenuItem.submenu.items.find(
  (item: { label?: string }) => item.label === devToolsLabel,
);

if (!devToolsItem) {
  helpMenuItem.submenu.append(
    new MenuItem({
      label: devToolsLabel,
      click: () => {
        console.warn(DEVTOOLS_WARNING);
        remote.BrowserWindow.getFocusedWindow().webContents.toggleDevTools();
      },
    }),
  );

  helpMenuItem.submenu.append(
    new MenuItem({
      label: 'Sync Bundled Assets',
      click: async () => {
        console.log('Syncing bundled assets...');
        await syncBundledAssets();
        console.log('Bundled assets synced!');
      },
    }),
  );

  helpMenuItem.submenu.append(
    new MenuItem({
      label: 'Open User Data',
      click: () => {
        shell.openItem(config.userDataPath);
      },
    }),
  );

  helpMenuItem.submenu.append(
    new MenuItem({
      label: 'Open Save File',
      click: () => {
        shell.openItem(config.saveFilePath);
      },
    }),
  );

  if (isDev) {
    helpMenuItem.submenu.append(
      new MenuItem({
        label: 'Show Spector.js UI',
        click: () => {
          spector?.displayUI();
        },
      }),
    );

    helpMenuItem.submenu.append(
      new MenuItem({
        label: 'Capture Frame with Spector.js',
        click: () => {
          console.log('Spector.js capture starting...');
          spector?.startCapture(document.querySelector('canvas'));
        },
      }),
    );
  }
}

Menu.setApplicationMenu(applicationMenu);

interface AppDependency {
  loaded: boolean;
}

const appDependencies: Record<string, AppDependency> = {
  dom: { loaded: false },
  audio: { loaded: false },
};

function areDependenciesLoaded(): boolean {
  return Object.values(appDependencies).every((dependency) => dependency.loaded);
}

function attemptAppRender(): void {
  if (areDependenciesLoaded()) {
    const appNode = document.getElementById('app');
    ReactDOM.render(<App />, appNode);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  appDependencies.dom.loaded = true;
  attemptAppRender();
});

audioManager.loadMusic();
audioManager.loadSfx();
audioManager.onload = () => {
  appDependencies.audio.loaded = true;
  attemptAppRender();
};
