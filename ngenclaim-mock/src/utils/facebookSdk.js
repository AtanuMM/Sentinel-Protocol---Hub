const SDK_SCRIPT_ID = 'facebook-jssdk';
const SDK_SCRIPT_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const SDK_VERSION = 'v21.0';

/** @type {Promise<typeof window.FB> | null} */
let loadPromise = null;

/**
 * Dynamically inject Meta's JS SDK and initialize FB.init for on-demand use.
 * @param {string} appId Meta App ID
 * @returns {Promise<typeof window.FB>}
 */
export function loadFacebookSdk(appId) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Facebook SDK can only load in the browser.'));
  }

  if (!appId?.trim()) {
    return Promise.reject(new Error('Meta App ID is required to load the Facebook SDK.'));
  }

  if (window.FB) {
    return Promise.resolve(window.FB);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const finishInit = () => {
      try {
        window.FB.init({
          appId: appId.trim(),
          cookie: true,
          xfbml: false,
          version: SDK_VERSION,
        });
        resolve(window.FB);
      } catch (err) {
        loadPromise = null;
        reject(err instanceof Error ? err : new Error('Facebook SDK initialization failed.'));
      }
    };

    window.fbAsyncInit = finishInit;

    const existingScript = document.getElementById(SDK_SCRIPT_ID);
    if (existingScript) {
      if (window.FB) {
        resolve(window.FB);
        return;
      }
      existingScript.addEventListener('load', () => {
        if (window.FB) resolve(window.FB);
      });
      existingScript.addEventListener('error', () => {
        loadPromise = null;
        reject(new Error('Failed to load Facebook SDK.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = SDK_SCRIPT_SRC;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Facebook SDK.'));
    };

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.body.appendChild(script);
    }
  });

  return loadPromise;
}
