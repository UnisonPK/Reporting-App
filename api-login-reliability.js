/* Reporting App - API Reliability V3
   Keeps the existing API shim intact.
   1) LOGIN: allow realistic Apps Script cold-start time, validate JSON, retry once only for transient failures.
   2) DESIGN CHANGES: block an identical save request repeated within 5 seconds.
*/
(function () {
  "use strict";

  if (window.__pmcLoginFetchReliabilityInstalled) return;
  window.__pmcLoginFetchReliabilityInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const LOGIN_TIMEOUT_MS = 30000;
  const RETRY_DELAY_MS = 900;
  const MUTATION_GUARD_MS = 5000;
  let lastMutationKey = "";
  let lastMutationAt = 0;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function isApiUrl(input) {
    const configured = window.LCRG_APP_CONFIG && window.LCRG_APP_CONFIG.API_URL;
    if (!configured) return false;
    const value = typeof input === "string" ? input : (input && input.url) || "";
    return String(value) === String(configured);
  }

  function requestFromInit(init) {
    try {
      const body = init && init.body;
      if (!body || typeof body !== "string") return { action: "", body: "" };
      const parsed = JSON.parse(body);
      return {
        action: String(parsed && parsed.action || "").trim(),
        body: body
      };
    } catch (_e) {
      return { action: "", body: "" };
    }
  }

  async function fetchWithTimeout(input, init, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs || LOGIN_TIMEOUT_MS);
    const options = Object.assign({}, init || {}, { signal: controller.signal });

    try {
      return await nativeFetch(input, options);
    } finally {
      clearTimeout(timer);
    }
  }

  async function inspectResponse(response) {
    try {
      const text = await response.clone().text();
      JSON.parse(text);
      return true;
    } catch (_e) {
      return false;
    }
  }

  async function loginAttempt(input, init, attempt) {
    try {
      const response = await fetchWithTimeout(input, init, LOGIN_TIMEOUT_MS);
      const validJson = await inspectResponse(response);
      const transientStatus = [408, 429, 500, 502, 503, 504].indexOf(response.status) !== -1;

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
        throw new Error("Login server is taking longer than expected. Please try again once; Apps Script may be starting after being idle.");
      }

      throw err;
    }
  }

  window.fetch = function (input, init) {
    const method = String(init && init.method || "GET").toUpperCase();
    const req = requestFromInit(init);

    if (method === "POST" && isApiUrl(input) && req.action === "login") {
      return loginAttempt(input, init, 0);
    }

    if (method === "POST" && isApiUrl(input) && req.action === "saveDesignChange") {
      const now = Date.now();
      if (req.body && req.body === lastMutationKey && (now - lastMutationAt) < MUTATION_GUARD_MS) {
        return Promise.reject(new Error("Duplicate Design Change save retry blocked. Refresh the register to confirm the saved record."));
      }
      lastMutationKey = req.body;
      lastMutationAt = now;
    }

    return nativeFetch(input, init);
  };
})();