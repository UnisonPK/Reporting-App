/* Reporting App - Login API Reliability V1
   Keeps the existing API shim intact, but makes LOGIN fail fast and retry once
   when Google Apps Script is temporarily slow or returns a transient HTML page.
*/
(function () {
  "use strict";

  if (window.__pmcLoginFetchReliabilityInstalled) return;
  window.__pmcLoginFetchReliabilityInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const TIMEOUT_MS = 10000;
  const RETRY_DELAY_MS = 450;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function isApiUrl(input) {
    const configured = window.LCRG_APP_CONFIG && window.LCRG_APP_CONFIG.API_URL;
    if (!configured) return false;
    const value = typeof input === "string" ? input : (input && input.url) || "";
    return String(value) === String(configured);
  }

  function actionFromInit(init) {
    try {
      const body = init && init.body;
      if (!body || typeof body !== "string") return "";
      const parsed = JSON.parse(body);
      return String(parsed && parsed.action || "").trim();
    } catch (_e) {
      return "";
    }
  }

  async function fetchWithTimeout(input, init) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    const options = Object.assign({}, init || {}, { signal: controller.signal });

    try {
      return await nativeFetch(input, options);
    } finally {
      clearTimeout(timer);
    }
  }

  async function loginAttempt(input, init, attempt) {
    try {
      const response = await fetchWithTimeout(input, init);

      /* Google occasionally returns an HTML error/login page instead of JSON.
         Detect that before api-shim consumes it and retry the login once. */
      let validJson = false;
      try {
        const text = await response.clone().text();
        JSON.parse(text);
        validJson = true;
      } catch (_e) {
        validJson = false;
      }

      const transientStatus = [429, 500, 502, 503, 504].indexOf(response.status) !== -1;

      if (attempt === 0 && (!validJson || transientStatus)) {
        await wait(RETRY_DELAY_MS);
        return loginAttempt(input, init, 1);
      }

      return response;
    } catch (err) {
      if (attempt === 0) {
        await wait(RETRY_DELAY_MS);
        return loginAttempt(input, init, 1);
      }

      if (err && err.name === "AbortError") {
        throw new Error("Login server took too long to respond. Please try again.");
      }

      throw err;
    }
  }

  window.fetch = function (input, init) {
    const method = String(init && init.method || "GET").toUpperCase();

    if (
      method === "POST" &&
      isApiUrl(input) &&
      actionFromInit(init) === "login"
    ) {
      return loginAttempt(input, init, 0);
    }

    return nativeFetch(input, init);
  };
})();
