// Вызовы серверных API (конвертация, qpdf)
export async function callServer(endpoint, file, params = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('params', JSON.stringify(params));
  let r;
  try {
    r = await fetch(endpoint, { method: 'POST', body: fd });
  } catch {
    throw new Error('Не удалось связаться с сервером. Проверьте подключение.');
  }
  if (!r.ok) {
    let msg = `Ошибка сервера (${r.status})`;
    try { msg = (await r.json()).error || msg; } catch {}
    const err = new Error(msg);
    if (r.status === 501) err.code = 'NO_SERVER'; // на сервере нет нужной программы
    throw err;
  }
  const blob = await r.blob();
  const name = decodeURIComponent(r.headers.get('X-Filename') || 'result');
  return { name, blob };
}

export async function runServerTool(tool, files, opts, ctx = {}) {
  const outs = [];
  const params = { ...(tool.server.params || {}) };
  for (const f of tool.options || []) params[f.name] = opts[f.name];
  let useFallback = false;
  for (let i = 0; i < files.length; i++) {
    ctx.onProgress && ctx.onProgress(i / files.length, `Обработка: ${files[i].name}`);
    if (!useFallback) {
      try {
        outs.push(await callServer(tool.server.endpoint, files[i], params));
        continue;
      } catch (e) {
        if (e.code !== 'NO_SERVER') throw e;
        useFallback = true; // на сервере нет LibreOffice/qpdf — работаем в браузере
      }
    }
    const { runFallback } = await import('./fallbacks');
    outs.push(...(await runFallback(tool, files[i], opts, ctx)));
  }
  ctx.onProgress && ctx.onProgress(1, 'Готово');
  return outs;
}

export async function postJson(endpoint, body) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || `Ошибка сервера (${r.status})`);
  return data;
}

/** Загрузка файла с индикатором прогресса отправки (для больших файлов) */
export function uploadWithProgress(endpoint, file, params, onUpload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.responseType = 'blob';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onUpload) onUpload(e.loaded / e.total); };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ name: decodeURIComponent(xhr.getResponseHeader('X-Filename') || 'result'), blob: xhr.response });
        return;
      }
      let msg = `Ошибка сервера (${xhr.status})`;
      try { msg = JSON.parse(await xhr.response.text()).error || msg; } catch {}
      const err = new Error(msg);
      if (xhr.status === 501) err.code = 'NO_SERVER';
      reject(err);
    };
    xhr.onerror = () => reject(new Error('Не удалось связаться с сервером. Проверьте подключение.'));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('params', JSON.stringify(params));
    xhr.send(fd);
  });
}
