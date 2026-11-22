import test from 'node:test';
import assert from 'node:assert/strict';
import { captureResetToken, clearResetToken } from './resetToken';

function resetBrowser(path: string, storageBlocked = false) {
  let current = new URL(path, 'https://example.test');
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  const browser = {
    get location() {
      return current;
    },
    history: {
      state: null,
      replaceState(_state: unknown, _unused: string, url?: string | URL | null) {
        if (url != null) current = new URL(url, current);
      },
    },
    get sessionStorage() {
      if (storageBlocked) throw new Error('Storage unavailable');
      return storage;
    },
  };
  return {
    browser,
    storage,
    navigate(pathname: string) {
      current = new URL(pathname, current);
    },
  };
}

test('reset token survives reload in this tab and is removed after use', () => {
  const { browser, storage, navigate } = resetBrowser('/reset-password?token=ph_rst_first');
  assert.equal(captureResetToken(browser), 'ph_rst_first');
  assert.equal(browser.location.search, '');
  assert.equal(browser.location.hash, '');
  assert.equal(captureResetToken(browser), 'ph_rst_first');

  navigate('/reset-password?token=ph_rst_second');
  assert.equal(captureResetToken(browser), 'ph_rst_second');
  assert.equal(captureResetToken(browser), 'ph_rst_second');
  clearResetToken(browser);
  assert.equal(storage.length, 0);
  assert.equal(captureResetToken(browser), '');
});

test('a malformed supplied link cannot fall back to a previous token', () => {
  const { browser, navigate, storage } = resetBrowser('/reset-password?token=ph_rst_first');
  captureResetToken(browser);
  navigate('/reset-password?token=bad');
  assert.equal(captureResetToken(browser), 'bad');
  assert.equal(storage.length, 0);
  clearResetToken(browser);
  assert.equal(captureResetToken(browser), '');
});

test('reset links remain reloadable without browser storage', () => {
  const { browser } = resetBrowser('/reset-password?token=ph_rst_first', true);
  assert.equal(captureResetToken(browser), 'ph_rst_first');
  assert.equal(browser.location.search, '');
  assert.equal(captureResetToken(browser), 'ph_rst_first');
  clearResetToken(browser);
  assert.equal(browser.location.hash, '');
  assert.equal(captureResetToken(browser), '');
});
