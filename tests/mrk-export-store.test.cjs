'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createExportStore,
  createIndexedDBAdapter,
  formatBytes
} = require('../mrk-export-store.js');

function fakeIndexedDB() {
  const databases = new Map();
  function request(run, tx) {
    const req = {};
    queueMicrotask(() => {
      try {
        req.result = run();
        if (req.onsuccess) req.onsuccess({ target: req });
        queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete({ target: tx }); });
      } catch (error) {
        req.error = error;
        if (req.onerror) req.onerror({ target: req });
        if (tx.onerror) tx.onerror({ target: tx });
      }
    });
    return req;
  }
  class FakeDB {
    constructor() {
      this.stores = new Map();
      this.objectStoreNames = { contains: name => this.stores.has(name) };
    }
    createObjectStore(name) {
      const rows = new Map();
      this.stores.set(name, rows);
      return rows;
    }
    transaction(name) {
      const tx = {};
      const rows = this.stores.get(name);
      tx.objectStore = () => ({
        put: value => request(() => { rows.set(value.id, value); return value.id; }, tx),
        get: id => request(() => rows.get(id), tx),
        getAll: () => request(() => Array.from(rows.values()), tx),
        delete: id => request(() => rows.delete(id), tx)
      });
      return tx;
    }
  }
  return {
    open(name) {
      const req = {};
      queueMicrotask(() => {
        let db = databases.get(name);
        const isNew = !db;
        if (!db) {
          db = new FakeDB();
          databases.set(name, db);
        }
        req.result = db;
        if (isNew && req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }
  };
}

test('persists a real Blob through the IndexedDB adapter and can retrieve it', async () => {
  let nextId = 0;
  const adapter = createIndexedDBAdapter(fakeIndexedDB(), 'test-exports', 'files');
  const store = createExportStore(adapter, { idFactory: () => 'file-' + (++nextId), now: () => 1700000000000 });
  const blob = new Blob(['Excel-like bytes'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const saved = await store.save('کدینگ-حساب‌ها.xlsx', blob);

  assert.equal(saved.id, 'file-1');
  assert.equal(saved.name, 'کدینگ-حساب‌ها.xlsx');
  assert.equal(saved.size, blob.size);
  assert.equal(saved.type, blob.type);

  const loaded = await store.get(saved.id);
  assert.equal(loaded.name, saved.name);
  assert.equal(await loaded.blob.text(), 'Excel-like bytes');
});

test('lists newest exports first and deletes only the selected stored file', async () => {
  let id = 0;
  let clock = 100;
  const adapter = createIndexedDBAdapter(fakeIndexedDB(), 'list-exports', 'files');
  const store = createExportStore(adapter, { idFactory: () => 'file-' + (++id), now: () => ++clock });
  const first = await store.save('اول.xlsx', new Blob(['1']));
  const second = await store.save('دوم.xlsx', new Blob(['22']));

  assert.deepEqual((await store.list()).map(x => x.id), [second.id, first.id]);
  await store.remove(first.id);
  assert.deepEqual((await store.list()).map(x => x.id), [second.id]);
  assert.equal(await store.get(first.id), null);
});

test('rejects invalid input and formats stored file sizes', async () => {
  const adapter = createIndexedDBAdapter(fakeIndexedDB(), 'validation-exports', 'files');
  const store = createExportStore(adapter);
  await assert.rejects(store.save('bad.xlsx', { size: 2 }), /محتوای فایل خروجی معتبر نیست/);
  assert.equal(formatBytes(100), '100 بایت');
  assert.equal(formatBytes(2048), '2.0 کیلوبایت');
});
