(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MRKExportStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DB_NAME = 'mr-khorasani-local-exports';
  const STORE_NAME = 'files';
  const DB_VERSION = 1;

  function createExportStore(adapter, options) {
    if (!adapter || typeof adapter.put !== 'function' ||
        typeof adapter.get !== 'function' ||
        typeof adapter.getAll !== 'function' ||
        typeof adapter.delete !== 'function') {
      throw new TypeError('ذخیره‌ساز فایل خروجی معتبر نیست');
    }
    const opts = options || {};
    const idFactory = opts.idFactory || function () {
      return 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    };
    const now = opts.now || Date.now;

    return {
      async save(name, blob) {
        if (!blob || typeof blob.size !== 'number' || typeof blob.slice !== 'function') {
          throw new TypeError('محتوای فایل خروجی معتبر نیست');
        }
        const record = {
          id: String(idFactory()),
          name: String(name || 'export.bin').slice(0, 240),
          type: String(blob.type || 'application/octet-stream'),
          size: Number(blob.size) || 0,
          createdAt: Number(now()),
          blob
        };
        await adapter.put(record);
        return record;
      },
      async list() {
        const rows = await adapter.getAll();
        return (Array.isArray(rows) ? rows : []).slice().sort((a, b) =>
          (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
        );
      },
      async get(id) {
        return (await adapter.get(String(id))) || null;
      },
      async remove(id) {
        await adapter.delete(String(id));
        return true;
      }
    };
  }

  function createIndexedDBAdapter(indexedDBRef, dbName, storeName) {
    const name = dbName || DB_NAME;
    const store = storeName || STORE_NAME;
    let dbPromise = null;

    function open() {
      if (!indexedDBRef || typeof indexedDBRef.open !== 'function') {
        return Promise.reject(new Error('ذخیره‌سازی محلی مرورگر در دسترس نیست'));
      }
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        let request;
        try {
          request = indexedDBRef.open(name, DB_VERSION);
        } catch (error) {
          reject(error);
          return;
        }
        request.onupgradeneeded = function () {
          const db = request.result;
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error || new Error('باز کردن حافظه مرورگر ناموفق بود')); };
        request.onblocked = function () { reject(new Error('دسترسی به حافظه مرورگر مسدود شده است')); };
      });
      dbPromise.catch(function () { dbPromise = null; });
      return dbPromise;
    }

    function run(mode, operation) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          let tx;
          let result;
          try {
            tx = db.transaction(store, mode);
            const objectStore = tx.objectStore(store);
            const request = operation(objectStore);
            if (request) {
              request.onsuccess = function () { result = request.result; };
              request.onerror = function () { reject(request.error || new Error('عملیات حافظه مرورگر ناموفق بود')); };
            }
          } catch (error) {
            reject(error);
            return;
          }
          tx.oncomplete = function () { resolve(result); };
          tx.onerror = function () { reject(tx.error || new Error('تراکنش حافظه مرورگر ناموفق بود')); };
          tx.onabort = function () { reject(tx.error || new Error('تراکنش حافظه مرورگر لغو شد')); };
        });
      });
    }

    return {
      put: function (record) { return run('readwrite', function (s) { return s.put(record); }); },
      get: function (id) { return run('readonly', function (s) { return s.get(id); }); },
      getAll: function () { return run('readonly', function (s) { return s.getAll(); }); },
      delete: function (id) { return run('readwrite', function (s) { return s.delete(id); }); }
    };
  }

  function createBrowserStore(indexedDBRef) {
    return createExportStore(createIndexedDBAdapter(
      indexedDBRef || (typeof indexedDB !== 'undefined' ? indexedDB : null)
    ));
  }

  function formatBytes(value) {
    const size = Math.max(0, Number(value) || 0);
    if (size < 1024) return size + ' بایت';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' کیلوبایت';
    return (size / (1024 * 1024)).toFixed(2) + ' مگابایت';
  }

  return {
    createExportStore,
    createIndexedDBAdapter,
    createBrowserStore,
    formatBytes
  };
});
