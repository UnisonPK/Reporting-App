/* Reporting App - API Reliability V2
   Keeps the existing API shim intact.
   1) LOGIN: fail fast and retry once for transient Apps Script failures.
   2) DESIGN CHANGES: block an identical save request repeated within 5 seconds.
      This prevents a successful server write from being duplicated when the
      browser loses/invalidates only the first response and Stage 2 retries it.
*/
(function () {
  "use strict";

  if (window.__pmcLoginFetchReliabilityInstalled) return;
  window.__pmcLoginFetchReliabilityInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const TIMEOUT_MS = 10000;
  const RETRY_DELAY_MS = 450;
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
