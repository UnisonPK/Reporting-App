window.LCRG_APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxXiJluivDRvmlg_jYleOyuf6g1-k5ahSD9y5Ns8_MlYJtbqh-pW63h-QRA0SHedgXziA/exec"
};

/* Project Launcher hotfix loader — loaded after the main application so it can safely override only the launcher functions. */
window.addEventListener("load", function () {
  if (document.getElementById("projectLauncherHotfixScript")) return;
  var s = document.createElement("script");
  s.id = "projectLauncherHotfixScript";
  s.src = "js/project-launcher-fix.js?v=20260822-1";
  document.body.appendChild(s);
});
