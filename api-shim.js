(function () {
  "use strict";

  const TOKEN_KEY = "lcrgApiToken";
  const TOKEN_EXP_KEY = "lcrgApiTokenExpiresAt";

  function getToken() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const expiresAt = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0);

    if (token && expiresAt && Date.now() >= expiresAt) {
      clearToken();
      return "";
    }
    return token;
  }

  function setToken(token, expiresAt) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (expiresAt) localStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
  }

  async function apiCall(action, data) {
    const url = window.LCRG_APP_CONFIG && window.LCRG_APP_CONFIG.API_URL;
    if (!url) throw new Error("Apps Script API URL is not configured.");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: action,
        data: data || {},
        token: getToken()
      }),
      redirect: "follow"
    });

    const text = await response.text();
    let json;

    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(
        "The Apps Script API did not return JSON. Check the deployment access and /exec URL."
      );
    }

    if (!json.ok) {
      if (/expired|token|authentication/i.test(String(json.error || ""))) {
        clearToken();
      }
      throw new Error(json.error || "API request failed.");
    }

    return json.data;
  }

  function methodToRequest(method, args) {
    switch (method) {
      case "loginUser":
        return {
          action: "login",
          data: { username: args[0] || "", password: args[1] || "" },
          login: true
        };

      case "getMasterData":
        return { action: "masterData", data: {} };

      case "getActivitiesForSelection":
        return {
          action: "activities",
          data: { trade: args[0] || "", subTrade: args[1] || "" }
        };

      case "saveActivityWithPhotos":
        return { action: "saveActivity", data: args[0] || {} };

      case "getReportsForUser":
      case "getMyReports":
        return { action: "reports", data: {} };

      case "getPendingInspectionsForUser":
      case "getPendingInspections":
        return { action: "pendingInspections", data: {} };

      case "updateInspectionDecision":
        return { action: "updateInspection", data: args[0] || {} };

      case "getDailySummaryRowsForUser":
      case "getDailySummaryRows":
        return {
          action: "dailySummary",
          data: { date: args[0] || "" }
        };

      case "getExecutiveReportRows":
        return {
          action: "executiveReport",
          data: {
            fromDate: args[0] || "",
            toDate: args[1] || ""
          }
        };

      case "getAdministrationData":
        return { action: "administrationData", data: {} };

      case "adminCreateUser":
        return { action: "adminCreateUser", data: args[0] || {} };

      case "adminUpdateUser":
        return { action: "adminUpdateUser", data: args[0] || {} };

      case "adminSetUserStatus":
        return { action: "adminSetUserStatus", data: args[0] || {} };

      case "adminResetUserPassword":
        return { action: "adminResetPassword", data: args[0] || {} };

      case "adminSaveActivityMaster":
        return { action: "adminSaveActivityMaster", data: args[0] || {} };

      default:
        throw new Error("Unsupported frontend API method: " + method);
    }
  }

  function createRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get: function (_target, prop) {
        if (prop === "withSuccessHandler") {
          return function (fn) {
            return createRunner(fn, failureHandler);
          };
        }

        if (prop === "withFailureHandler") {
          return function (fn) {
            return createRunner(successHandler, fn);
          };
        }

        return function () {
          const args = Array.prototype.slice.call(arguments);
          let req;

          try {
            req = methodToRequest(String(prop), args);
          } catch (err) {
            if (failureHandler) failureHandler(err);
            else console.error(err);
            return;
          }

          apiCall(req.action, req.data)
            .then(function (data) {
              if (req.login) {
                setToken(data.token, data.expiresAt);
                if (successHandler) {
                  successHandler({
                    success: true,
                    user: data.user
                  });
                }
                return;
              }

              if (successHandler) successHandler(data);
            })
            .catch(function (err) {
              if (req.login && successHandler) {
                successHandler({
                  success: false,
                  message: err.message
                });
                return;
              }

              if (failureHandler) failureHandler(err);
              else console.error(err);
            });
        };
      }
    });
  }

  window.LCRG_API = {
    call: apiCall,
    getToken: getToken,
    clearToken: clearToken
  };

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner(null, null);
})();
