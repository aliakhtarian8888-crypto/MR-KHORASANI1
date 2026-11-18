(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MRKManagerExportStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BUCKET = 'mrk-manager-exports';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function safeName(value) {
    const name = String(value || 'export.bin')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, 180);
    return name || 'export.bin';
  }

  function encodePath(path) {
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  function createManagerExportStorage(options) {
    const opts = options || {};
    const baseUrl = String(opts.url || '').replace(/\/+$/, '');
    const publishableKey = String(opts.publishableKey || '');
    const getSession = opts.getSession;
    const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const clock = opts.now || Date.now;
    const idFactory = opts.idFactory || (() => Math.random().toString(36).slice(2, 11));

    if (!/^https:\/\//i.test(baseUrl) || !publishableKey || typeof getSession !== 'function' || typeof fetchImpl !== 'function') {
      throw new TypeError('تنظیمات اتصال فضای ذخیره‌سازی مدیر سیستم کامل نیست');
    }

    function companyPrefix(companyId) {
      const id = String(companyId || '').trim();
      if (!UUID_RE.test(id)) throw new Error('شناسه شرکت برای فضای ذخیره‌سازی معتبر نیست');
      return id + '/exports/';
    }

    async function headers(contentType) {
      const session = await getSession();
      const token = String(session?.access_token || '');
      if (!token) throw new Error('برای استفاده از فضای ذخیره‌سازی مدیر، با حساب مدیریتی وارد شوید');
      return {
        apikey: publishableKey,
        Authorization: 'Bearer ' + token,
        ...(contentType ? { 'Content-Type': contentType } : {})
      };
    }

    async function readResponse(response, asBlob) {
      if (!response || !response.ok) {
        let message = 'عملیات فضای ذخیره‌سازی ناموفق بود';
        try {
          const body = await response.json();
          message = body?.message || body?.error || body?.msg || message;
        } catch (error) {}
        throw new Error(message + (response?.status ? ' (HTTP ' + response.status + ')' : ''));
      }
      if (asBlob) return response.blob();
      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      try { return JSON.parse(text); } catch (error) { return text; }
    }

    function validatePath(companyId, path) {
      const prefix = companyPrefix(companyId);
      const value = String(path || '');
      if (!value.startsWith(prefix) || value.length <= prefix.length || value.includes('..') || value.startsWith('/')) {
        throw new Error('مسیر فایل متعلق به شرکت فعال نیست');
      }
      return value;
    }

    async function upload(companyId, fileName, blob) {
      const prefix = companyPrefix(companyId);
      if (!blob || typeof blob.size !== 'number' || typeof blob.slice !== 'function') {
        throw new TypeError('محتوای فایل خروجی معتبر نیست');
      }
      const name = safeName(fileName);
      const stamp = String(Number(clock()) || Date.now());
      const suffix = safeName(String(idFactory())).replace(/[^a-zA-Z0-9_-]/g, '');
      const path = prefix + stamp + '_' + (suffix || 'export') + '_' + name;
      const type = String(blob.type || 'application/octet-stream');
      const response = await fetchImpl(baseUrl + '/storage/v1/object/' + BUCKET + '/' + encodePath(path), {
        method: 'POST',
        headers: { ...(await headers(type)), 'x-upsert': 'false' },
        body: blob
      });
      await readResponse(response, false);
      return {
        bucket: BUCKET,
        path,
        name,
        size: Number(blob.size) || 0,
        contentType: type,
        createdAt: new Date(Number(clock()) || Date.now()).toISOString()
      };
    }

    async function list(companyId, limit) {
      const prefix = companyPrefix(companyId).slice(0, -1);
      const response = await fetchImpl(baseUrl + '/storage/v1/object/list/' + BUCKET, {
        method: 'POST',
        headers: { ...(await headers('application/json')) },
        body: JSON.stringify({
          prefix,
          limit: Math.min(500, Math.max(1, Number(limit) || 100)),
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        })
      });
      const rows = await readResponse(response, false);
      if (!Array.isArray(rows)) throw new Error('فهرست فضای ذخیره‌سازی پاسخ معتبر ندارد');
      return rows.filter(row => row && typeof row.name === 'string' && row.name !== '' && row.id)
        .map(row => ({
          bucket: BUCKET,
          path: prefix + '/' + row.name,
          name: row.name,
          size: Number(row.metadata?.size) || 0,
          contentType: row.metadata?.mimetype || 'application/octet-stream',
          createdAt: row.created_at || '',
          updatedAt: row.updated_at || '',
          cloud: true
        }));
    }

    async function download(companyId, path) {
      const safePath = validatePath(companyId, path);
      const response = await fetchImpl(baseUrl + '/storage/v1/object/authenticated/' + BUCKET + '/' + encodePath(safePath), {
        method: 'GET',
        headers: await headers()
      });
      return readResponse(response, true);
    }

    async function remove(companyId, path) {
      const safePath = validatePath(companyId, path);
      const response = await fetchImpl(baseUrl + '/storage/v1/object/' + BUCKET, {
        method: 'DELETE',
        headers: { ...(await headers('application/json')) },
        body: JSON.stringify({ prefixes: [safePath] })
      });
      await readResponse(response, false);
      return true;
    }

    return { bucket: BUCKET, upload, list, download, remove, companyPrefix, validatePath };
  }

  return { BUCKET, createManagerExportStorage, safeName };
});
