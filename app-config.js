window.LCRG_APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxXiJluivDRvmlg_jYleOyuf6g1-k5ahSD9y5Ns8_MlYJtbqh-pW63h-QRA0SHedgXziA/exec"
};

window.addEventListener("load", function () {
  try {
    if (!Object.prototype.hasOwnProperty.call(window, "drawingsData")) Object.defineProperty(window, "drawingsData", {configurable:true,get:function(){return typeof drawingsData!=="undefined"?drawingsData:[];}});
    if (!Object.prototype.hasOwnProperty.call(window, "masterData")) Object.defineProperty(window, "masterData", {configurable:true,get:function(){return typeof masterData!=="undefined"?masterData:null;}});
  } catch (e) { console.warn("Design Management data bridge warning:", e); }
});

(function () {
  function addScript(id,src){if(document.getElementById(id))return;var s=document.createElement("script");s.id=id;s.src=src;document.head.appendChild(s);}
  function addCss(id,href){if(document.getElementById(id))return;var c=document.createElement("link");c.id=id;c.rel="stylesheet";c.href=href;document.head.appendChild(c);}
  addScript("designManagementStage1Script","design-management.js?v=20260830-1");
  addCss("designManagementUiCss","design-management-ui.css?v=20260830-3");
  addScript("designManagementUiScript","design-management-ui.js?v=20260830-2");
  addCss("designBulkUploadCss","design-bulk-upload.css?v=20260830-3");
  addScript("designBulkUploadScript","design-bulk-upload-v3.js?v=20260830-1");
  addCss("designFileSupportCss","design-file-support.css?v=20260830-1");
  addScript("designFileSupportScript","design-file-support.js?v=20260830-2");
  addCss("designBundleCss","design-drawing-bundle.css?v=20260830-1");
  addCss("designRevisionArchiveCss","design-revision-archive.css?v=20260830-1");
  addScript("designRegisterControlScript","design-register-control.js?v=20260830-1");
  addCss("designActionLayoutCss","design-action-layout.css?v=20260830-1");
})();

window.addEventListener("load", function () {
  if (document.getElementById("projectLauncherHotfixScript")) return;
  var s=document.createElement("script");s.id="projectLauncherHotfixScript";s.src="js/project-launcher-fix.js?v=20260822-1";document.body.appendChild(s);
});
