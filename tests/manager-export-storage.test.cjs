'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createManagerExportStorage } = require('../mrk-manager-export-storage.js');

const COMPANY = '11111111-2222-4333-8444-555555555555';
const OTHER_COMPANY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function response(data, status = 200) {
  return new Response(data instanceof Blob ? data : JSON.stringify(data), {
    status,
    headers: data instanceof Blob ? { 'Content-Type': data.type || 'application/octet-stream' } : { 'Content-Type': 'application/json' }
  });
}

test('manager export upload writes only beneath the authenticated company exports folder', async () => {
  const calls = [];
  const storage = createManagerExportStorage({
    url: 'https://project.supabase.co/',
    publishableKey: 'sb_publishable_test',
    getSession: async () => ({ access_token: 'user-jwt' }),
    now: () => 1700000000000,
    idFactory: () => 'export-id',
    fetchImpl: async (url, options) => { calls.push({ url, options }); return response({ Key: 'ok' }); }
  });
  const blob = new Blob(['backup-bytes'], { type: 'application/json' });
  const result = await storage.upload(COMPANY, 'پشتیبان.json', blob);
  assert.equal(result.path, COMPANY + '/exports/1700000000000_export-id_پشتیبان.json');
  assert.equal(calls[0].url, 'https://project.supabase.co/storage/v1/object/mrk-manager-exports/' + COMPANY + '/exports/1700000000000_export-id_%D9%BE%D8%B4%D8%AA%DB%8C%D8%A8%D8%A7%D9%86.json');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer user-jwt');
  assert.equal(calls[0].options.headers['x-upsert'], 'false');
  assert.equal(await calls[0].options.body.text(), 'backup-bytes');
  assert.equal(result.size, blob.size);
});

test('manager export list is private, scoped to the current company and returns real object paths', async () => {
  const calls = [];
  const storage = createManagerExportStorage({
    url: 'https://project.supabase.co',
    publishableKey: 'public-key',
    getSession: async () => ({ access_token: 'admin-jwt' }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response([
        { name: '140000_file.xlsx', id: 'object-id', created_at: '2026-11-18T10:00:00Z', metadata: { size: 2048, mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } },
        { name: 'folder', id: null, metadata: null }
      ]);
    }
  });
  const rows = await storage.list(COMPANY);
  assert.equal(calls[0].url, 'https://project.supabase.co/storage/v1/object/list/mrk-manager-exports');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    prefix: COMPANY + '/exports',
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].path, COMPANY + '/exports/140000_file.xlsx');
  assert.equal(rows[0].size, 2048);
});

test('manager export download and delete use authenticated private storage endpoints', async () => {
  const calls = [];
  const storage = createManagerExportStorage({
    url: 'https://project.supabase.co',
    publishableKey: 'public-key',
    getSession: async () => ({ access_token: 'admin-jwt' }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return options.method === 'GET' ? response(new Blob(['private-file'])) : response({ message: 'removed' });
    }
  });
  const path = COMPANY + '/exports/file.json';
  const blob = await storage.download(COMPANY, path);
  assert.equal(await blob.text(), 'private-file');
  assert.equal(calls[0].url, 'https://project.supabase.co/storage/v1/object/authenticated/mrk-manager-exports/' + COMPANY + '/exports/file.json');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer admin-jwt');
  await storage.remove(COMPANY, path);
  assert.equal(calls[1].url, 'https://project.supabase.co/storage/v1/object/mrk-manager-exports');
  assert.equal(calls[1].options.method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[1].options.body), { prefixes: [path] });
});

test('manager export storage rejects missing sessions and paths outside the selected company', async () => {
  let calls = 0;
  const missingSession = createManagerExportStorage({
    url: 'https://project.supabase.co',
    publishableKey: 'public-key',
    getSession: async () => null,
    fetchImpl: async () => { calls++; return response({}); }
  });
  await assert.rejects(missingSession.list(COMPANY), /با حساب مدیریتی وارد شوید/);
  const storage = createManagerExportStorage({
    url: 'https://project.supabase.co',
    publishableKey: 'public-key',
    getSession: async () => ({ access_token: 'jwt' }),
    fetchImpl: async () => { calls++; return response({}); }
  });
  await assert.rejects(storage.download(COMPANY, OTHER_COMPANY + '/exports/secret.json'), /مسیر فایل متعلق به شرکت فعال نیست/);
  await assert.rejects(storage.remove(COMPANY, 'not-a-company/exports/secret.json'), /مسیر فایل متعلق به شرکت فعال نیست/);
  assert.equal(calls, 0);
});
