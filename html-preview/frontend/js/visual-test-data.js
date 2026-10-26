(function(){
  'use strict';
  const snapshot = window.FractalVisualSnapshot;
  window.__MAHLE_FRACTAL_HOST__ = true;
  const listeners = []; window.chrome = window.chrome || {};
  window.chrome.webview = {
    addEventListener: (_, fn) => listeners.push(fn),
    postMessage: message => {
      let response;
      if (message.type === 'app.environment') response = { id: message.id, ok: true, data: { mode: 'production', data_root: 'Read-only layout comparison', config_path: 'Browser preview · no files are opened or saved' } };
      else if (message.type === 'workspace.get' || message.type === 'workspace.validate') response = { id: message.id, ok: true, data: structuredClone(snapshot) };
      else response = { id: message.id, ok: false, error: { code: 'visual_test', message: 'This preview is read-only. No standards files are needed, opened or changed.' } };
      queueMicrotask(() => listeners.forEach(fn => fn({data:response})));
    }
  };
  window.LayoutCanopy = window.FractalLayout;
})();
