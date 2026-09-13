/* Reporting App - API Reliability V4
   LOGIN: bounded retry for Apps Script cold starts / transient HTML responses.
   Never passes a non-JSON login response to the application parser.
   DESIGN CHANGES: blocks an identical save request repeated within 5 seconds.
*/
(function () {
  "use strict";

  if (window.__pmcLoginFetchReliabilityInstalled) return;
  window.__pmcLoginFetchReliabilityInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const LOGIN_TIMEOUT_MS = 15000;
  const MAX_LOGIN_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 700;
  const MUTATION_GUARD_MS = 5000;
  let lastMutationKey = "";
  let lastMutationAt = 0;
  let loginInFlight = null;
  let loginInFlightBody = "";

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

  async function validateResponse(response) {
    let text = "";
    try {
      text = await response.clone().text();
      const parsed = JSON.parse(text);
      return { valid: !!parsed && typeof parsed === "object", text: text };
    } catch (_e) {
      return { valid: false, text: text };
    }
  }

  function isTransientStatus(status) {
    return [408, 425, 429, 500, 502, 503, 504].indexOf(Number(status)) !== -1;
  }

  async function loginAttempt(input, init, attempt, startedAt) {
    try {
      const response = await fetchWithTimeout(input, init, LOGIN_TIMEOUT_MS);
      const checked = await validateResponse(response);
      const retryable = !response.ok || isTransientStatus(response.status) || !checked.valid;

      if (retryable && attempt + 1 < MAX_LOGIN_ATTEMPTS) {
        await wait(RETRY_DELAY_MS * (attempt + 1));
        return loginAttempt(input, init, attempt + 1, startedAt);
      }

      if (!checked.valid) {
        throw new Error("Login service returned an invalid response. Please try again; the server may be restarting.");
      }
      if (!response.ok || isTransientStatus(response.status)) {
        throw new Error("Login service is temporarily unavailable (HTTP " + response.status + "). Please try again.");
      }

      console.info("[PMC Login] completed in " + Math.round(performance.now() - startedAt) + " ms" + (attempt ? " after retry" : ""));
      return response;
    } catch (err) {
      if (attempt + 1 < MAX_LOGIN_ATTEMPTS && (!err || err.name === "AbortError" || /fetch|network|invalid response|temporarily/i.test(String(err.message || err)))) {
        await wait(RETRY_DELAY_MS * (attempt + 1));
        return loginAttempt(input, init, attempt + 1, startedAt);
      }

      if (err && err.name === "AbortError") {
        throw new Error("Login server did not respond in time. Please try again.");
      }
      throw err;
    }
  }

  function reliableLogin(input, init, body) {
    if (loginInFlight && loginInFlightBody === body) {
      return loginInFlight.then(function (r) { return r.clone(); });
    }
    const startedAt = performance.now();
    loginInFlightBody = body;
    loginInFlight = loginAttempt(input, init, 0, startedAt)
      .finally(function () {
        loginInFlight = null;
        loginInFlightBody = "";
      });
    return loginInFlight.then(function (r) { return r.clone(); });
  }

  window.fetch = function (input, init) {
    const method = String(init && init.method || "GET").toUpperCase();
    const req = requestFromInit(init);

    if (method === "POST" && isApiUrl(input) && req.action === "login") {
      return reliableLogin(input, init, req.body);
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