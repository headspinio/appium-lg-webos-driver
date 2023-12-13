/**
 * These are scripts which are sent to the browser via an `/execute/<async|sync>` command.
 * @module
 */

export const AsyncScripts = Object.freeze({
  /**
   * @param {number|string} code
   * @param {string} key
   * @param {number} duration
   * @param {import('./types').AsyncCallback<null>} done
   * @returns {void}
   */
  pressKey: (code, key, duration, done) => {
    document.dispatchEvent(new KeyboardEvent('keydown', {code: String(code), key}));
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', {code: String(code), key}));
      done(null);
    }, duration);
  },
});

/**
 * These are all synchronous
 */
 export const SyncScripts = Object.freeze({
  reset: () => {
    window.localStorage.clear();
    window.location.reload();
    return 0;
  },
});
