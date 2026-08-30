window.LCRG_APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxXiJluivDRvmlg_jYleOyuf6g1-k5ahSD9y5Ns8_MlYJtbqh-pW63h-QRA0SHedgXziA/exec"
};

/* Expose read-only access to global lexical data used by the Design Management
   enhancement. The large index.html baseline intentionally remains unchanged. */
window.addEventListener("load", function () {
  try {
    if (!Object.prototype.hasOwnProperty.call(window, "drawingsData")) {
      Object.defineProperty(window, "drawingsData", {
        configurable: true,
        get: function () { return typeof drawingsData !== "undefined" ? drawingsData : []; }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(window, "masterData")) {
      Object.defineProperty(window, "masterData", {
        configurable: true,
        get: function () { return typeof masterData !== "undefined" ? masterData : null; }
      });
    }
  } catch (e) {
    console.warn("Design Management data bridge warning:", e);
  }
});

/* Design Management Stage 1 loader. */
(function () {
  if (!document.getElementById("designManagementStage1Script")) {
    var s = document.createElement("script");
    s.id = "designManagementStage1Script";
    s.src = "design-management.js?v=20260830-1";
    document.head.appendChild(s);
  }

  if (!document.getElementById("designManagementUiCss")) {
    var css = document.createElement("link");
    css.id = "designManagementUiCss";
    css.rel = "stylesheet";
    css.href = "design-management-ui.css?v=20260830-3";
    document.head.appendChild(css);
  }

  if (!document.getElementById("designManagementUiScript")) {
    var ui = document.createElement("script");
    ui.id = "designManagementUiScript";
    ui.src = "design-management-ui.js?v=20260830-2";
    document.head.appendChild(ui);
  }

  if (!document.getElementById("designBulkUploadCss")) {
    var bulkCss = document.createElement("link");
    bulkCss.id = "designBulkUploadCss";
    bulkCss.rel = "stylesheet";
    bulkCss.href = "design-bulk-upload.css?v=20260830-1";
    document.head.appendChild(bulkCss);
  }

  if (!document.getElementById("designBulkUploadScript")) {
    var bulkJs = document.createElement("script");
    bulkJs.id = "designBulkUploadScript";
    bulkJs.src = "design-bulk-upload.js?v=20260830-1";
    document.head.appendChild(bulkJs);
  }

  if (!document.getElementById("designActionLayoutCss")) {
    var actionCss = document.createElement("link");
    actionCss.id = "designActionLayoutCss";
    actionCss.rel = "stylesheet";
    actionCss.href = "design-action-layout.css?v=20260830-1";
    document.head.appendChild(actionCss);
  }
})();

/* Project Launcher hotfix loader — loaded after the main application so it can safely override only the launcher functions. */
window.addEventListener("load", function () {
  if (document.getElementById("projectLauncherHotfixScript")) return;
  var s = document.createElement("script");
  s.id = "projectLauncherHotfixScript";
  s.src = "js/project-launcher-fix.js?v=20260822-1";
  document.body.appendChild(s);
});
