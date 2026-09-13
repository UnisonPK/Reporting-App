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
  function addScript(id,src){if(document.getElementById(id))return;var s=document.createElement("script");s.id=id;s.src=src;s.async=false;document.head.appendChild(s);}

  /* Startup now contains only the core reliability/performance layer.
     Programme and Design Management enhancement bundles are loaded on demand
     by app-performance-v2.js. */
  addScript("apiLoginReliabilityScript","api-login-reliability.js?v=20260913-2");
  addScript("appStabilityV1Script","app-stability-v1.js?v=20260913-2");
  addScript("appPerformanceV2Script","app-performance-v2.js?v=20260913-2");
})();