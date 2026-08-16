/* Reporting App API Shim - BOQ & Cost V1 build 2026-08-16.4 */

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
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    if (expiresAt) {
      localStorage.setItem(
        TOKEN_EXP_KEY,
        String(expiresAt)
      );
    }
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
  }


  /* =========================================================
     API CALL
  ========================================================= */

  async function apiCall(action, data) {

    const url =
      window.LCRG_APP_CONFIG &&
      window.LCRG_APP_CONFIG.API_URL;

    if (!url) {
      throw new Error(
        "Apps Script API URL is not configured."
      );
    }

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
        "The Apps Script API did not return JSON. " +
        "Check the deployment access and /exec URL."
      );
    }

    if (!json.ok) {

      if (
        /expired|token|authentication/i.test(
          String(json.error || "")
        )
      ) {
        clearToken();
      }

      throw new Error(
        json.error || "API request failed."
      );
    }

    return json.data;
  }


  /* =========================================================
     FRONTEND METHOD -> API ACTION
  ========================================================= */

  function methodToRequest(method, args) {

    switch (method) {


      /* =====================================================
         LOGIN / PASSWORD
      ===================================================== */

      case "loginUser":

        return {
          action: "login",

          data: {
            username: args[0] || "",
            password: args[1] || ""
          },

          login: true
        };


      case "requestPasswordReset":

        return {
          action: "requestPasswordReset",
          data: args[0] || {}
        };


      case "changeOwnPassword":

        return {
          action: "changeOwnPassword",
          data: args[0] || {}
        };


      /* =====================================================
         MASTER DATA
      ===================================================== */

      case "getMasterData":

        return {
          action: "masterData",
          data: {}
        };


      case "getActivitiesForSelection":

        return {
          action: "activities",

          data: {
            trade: args[0] || "",
            subTrade: args[1] || ""
          }
        };


      /* =====================================================
         SITE ACTIVITY
      ===================================================== */

      case "saveActivityWithPhotos":

        return {
          action: "saveActivity",
          data: args[0] || {}
        };


      /* =====================================================
         MY REPORTS
      ===================================================== */

      case "getReportsForUser":
      case "getMyReports":

        return {
          action: "reports",
          data: {}
        };


      case "updateActivityReport":

        return {
          action: "updateActivityReport",
          data: args[0] || {}
        };


      /* =====================================================
         INSPECTIONS
      ===================================================== */

      case "getPendingInspectionsForUser":
      case "getPendingInspections":

        return {
          action: "pendingInspections",
          data: {}
        };


      case "updateInspectionDecision":

        return {
          action: "updateInspection",
          data: args[0] || {}
        };


      /* =====================================================
         DAILY SUMMARY
      ===================================================== */

      case "getDailySummaryRowsForUser":
      case "getDailySummaryRows":

        return {
          action: "dailySummary",

          data: {
            date: args[0] || ""
          }
        };


      /* =====================================================
         EXECUTIVE REPORT
      ===================================================== */

      case "getExecutiveReportRows":

        return {
          action: "executiveReport",

          data: {
            fromDate: args[0] || "",
            toDate: args[1] || ""
          }
        };


      /* =====================================================
         BOQ & COST V1
      ===================================================== */

      case "getBOQCostRows":

        return {
          action: "boqCost",
          data: {}
        };


      case "saveBOQCostItem":

        return {
          action: "saveBOQCostItem",
          data: args[0] || {}
        };


      /* =====================================================
         DRAWINGS V3
      ===================================================== */

      case "getDrawings":

        return {
          action: "drawings",
          data: {}
        };


      case "saveDrawing":

        return {
          action: "saveDrawing",
          data: args[0] || {}
        };


      case "saveDrawingWithPdf":

        return {
          action: "saveDrawingWithPdf",
          data: args[0] || {}
        };


      /* =====================================================
         ADMINISTRATION
      ===================================================== */

      case "getAdministrationData":

        return {
          action: "administrationData",
          data: {}
        };


      case "adminCreateUser":

        return {
          action: "adminCreateUser",
          data: args[0] || {}
        };


      case "adminUpdateUser":

        return {
          action: "adminUpdateUser",
          data: args[0] || {}
        };


      case "adminSetUserStatus":

        return {
          action: "adminSetUserStatus",
          data: args[0] || {}
        };


      case "adminResetUserPassword":

        return {
          action: "adminResetPassword",
          data: args[0] || {}
        };


      case "adminSaveMasterData":

        return {
          action: "adminSaveMasterData",
          data: args[0] || {}
        };


      case "adminSetMasterDataStatus":

        return {
          action: "adminSetMasterDataStatus",
          data: args[0] || {}
        };


      case "adminSaveActivityMaster":

        return {
          action: "adminSaveActivityMaster",
          data: args[0] || {}
        };


      /* =====================================================
         UNSUPPORTED METHOD
      ===================================================== */

      default:

        throw new Error(
          "Unsupported frontend API method: " +
          method
        );
    }
  }


  /* =========================================================
     GOOGLE.SCRIPT.RUN COMPATIBILITY LAYER
  ========================================================= */

  function createRunner(
    successHandler,
    failureHandler
  ) {

    return new Proxy({}, {

      get: function (_target, prop) {


        /* -----------------------------------------------
           SUCCESS HANDLER
        ----------------------------------------------- */

        if (prop === "withSuccessHandler") {

          return function (fn) {

            return createRunner(
              fn,
              failureHandler
            );

          };
        }


        /* -----------------------------------------------
           FAILURE HANDLER
        ----------------------------------------------- */

        if (prop === "withFailureHandler") {

          return function (fn) {

            return createRunner(
              successHandler,
              fn
            );

          };
        }


        /* -----------------------------------------------
           ACTUAL API METHOD
        ----------------------------------------------- */

        return function () {

          const args =
            Array.prototype.slice.call(
              arguments
            );

          let req;


          try {

            req = methodToRequest(
              String(prop),
              args
            );

          } catch (err) {

            if (failureHandler) {

              failureHandler(err);

            } else {

              console.error(err);

            }

            return;
          }


          apiCall(
            req.action,
            req.data
          )

            .then(function (data) {


              /* =========================================
                 LOGIN HANDLING
              ========================================= */

              if (req.login) {

                setToken(
                  data.token,
                  data.expiresAt
                );


                if (successHandler) {

                  successHandler({
                    success: true,
                    user: data.user
                  });

                }

                return;
              }


              /* =========================================
                 NORMAL SUCCESS
              ========================================= */

              if (successHandler) {

                successHandler(data);

              }

            })


            .catch(function (err) {


              /* =========================================
                 LOGIN FAILURE
              ========================================= */

              if (
                req.login &&
                successHandler
              ) {

                successHandler({
                  success: false,
                  message: err.message
                });

                return;
              }


              /* =========================================
                 NORMAL FAILURE
              ========================================= */

              if (failureHandler) {

                failureHandler(err);

              } else {

                console.error(err);

              }

            });
        };
      }
    });
  }


  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.LCRG_API = {

    call: apiCall,

    getToken: getToken,

    clearToken: clearToken

  };


  /* =========================================================
     GOOGLE APPS SCRIPT COMPATIBILITY
  ========================================================= */

  window.google =
    window.google || {};


  window.google.script =
    window.google.script || {};


  window.google.script.run =
    createRunner(
      null,
      null
    );

})();
