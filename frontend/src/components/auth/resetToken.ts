const RESET_TOKEN_KEY = 'pulsehook.password-reset-token';

interface ResetTokenBrowser {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>;
  history: Pick<History, 'state' | 'replaceState'>;
  sessionStorage: Storage;
}

export function captureResetToken(browser: ResetTokenBrowser): string {
  const query = new URLSearchParams(browser.location.search);
  const fragment = new URLSearchParams(browser.location.hash.slice(1));
  const supplied = query.has('token')
    ? query.get('token')
    : fragment.has('token')
      ? fragment.get('token')
      : null;

  if (supplied === null) {
    try {
      return browser.sessionStorage.getItem(RESET_TOKEN_KEY)?.trim() || '';
    } catch {
      return '';
    }
  }

  const token = supplied.trim();
  let inFragment = !token.startsWith('ph_rst_');
  try {
    if (token.startsWith('ph_rst_')) {
      browser.sessionStorage.setItem(RESET_TOKEN_KEY, token);
    } else {
      browser.sessionStorage.removeItem(RESET_TOKEN_KEY);
    }
  } catch {
    inFragment = true;
  }

  const fallback = inFragment ? `#token=${encodeURIComponent(token)}` : '';
  browser.history.replaceState(
    browser.history.state,
    '',
    `${browser.location.pathname}${fallback}`
  );
  return token;
}

export function clearResetToken(browser: ResetTokenBrowser): void {
  try {
    browser.sessionStorage.removeItem(RESET_TOKEN_KEY);
  } catch {
    // Storage may be disabled; the URL fallback can still be cleared.
  }
  if (new URLSearchParams(browser.location.hash.slice(1)).has('token')) {
    browser.history.replaceState(browser.history.state, '', browser.location.pathname);
  }
}
