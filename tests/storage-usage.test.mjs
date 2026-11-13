import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localStorageBytes, estimateStorage} from '../scripts/storage-usage.mjs';

test('counts approximate UTF-16 local storage bytes without modifying values', () => {
  const data = new Map([['kelime', 'elma'], ['emoji', '🍎']]);
  const storage = {get length() { return data.size; }, key: i => [...data.keys()][i], getItem: k => data.get(k)};
  assert.equal(localStorageBytes(storage), [...data].reduce((n, [k,v]) => n + (k.length + v.length) * 2, 0));
  assert.equal(data.size, 2);
});

test('returns unknown when storage access fails', async () => {
  const storage = {get length() { throw new Error('blocked'); }};
  const result = await estimateStorage({storage, navigatorObject: {storage: {estimate: async () => { throw Error('denied'); }}}, cacheStorage: {keys: async () => {throw Error('denied');}}});
  assert.deepEqual(result, {localBytes: null, totalUsageBytes: null, quotaBytes: null, cacheCount: null});
});

test('reports browser estimate separately, never double counts it', async () => {
  const result = await estimateStorage({storage: {length: 0}, navigatorObject: {storage: {estimate: async () => ({usage: 100, quota: 1000})}}, cacheStorage: {keys: async () => ['a','b']}});
  assert.deepEqual(result, {localBytes: 0, totalUsageBytes: 100, quotaBytes: 1000, cacheCount: 2});
});
