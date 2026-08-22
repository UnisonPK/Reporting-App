/* Project Launcher Hotfix V1 — 2026-08-22
   Keeps project selection usable if master-data loading/rendering fails.
   Overrides only loadProjectLauncher/renderProjectLauncher. */
(function(){
  "use strict";
  function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function norm(v){var s=String(v||"").trim();var k=s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();if(["lcrg","lake city roof garden","lake city roof gardens"].indexOf(k)>=0)return "Lake City Roof Garden";if(["olc","one lake city"].indexOf(k)>=0)return "One Lake City";return s;}
  function pname(r){return String((r&&(r["Project Name"]||r.projectName||r.Project||r.project))||"").trim();}
  function pid(r){return String((r&&(r["Project ID"]||r.projectId||r.ID||r.id))||"").trim();}
  function role(){return String((typeof loggedInUser!=="undefined"&&loggedInUser&&loggedInUser.role)||"").trim().toLowerCase();}
  function allAccess(){var r=role();return r==="ceo"||r==="project manager";}
  function tokens(){return String((typeof loggedInUser!=="undefined"&&loggedInUser&&loggedInUser.projectAccess)||"").split(/[\n,;|]+/).map(function(v){return v.trim();}).filter(Boolean);}
  function key(v){return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
  function allowed(r){if(allAccess())return true;var t=tokens(),nk=key(pname(r)),ik=key(pid(r));return t.some(function(x){var k=key(x);return k===nk||k===ik;});}
  function code(n,id){var x=norm(n);if(x==="Lake City Roof Garden")return "LCRG";if(x==="One Lake City")return "OLC";var w=String(n||"").trim().split(/\s+/).filter(Boolean);if(w.length>1)return w.slice(0,4).map(function(a){return a.charAt(0).toUpperCase();}).join("").slice(0,5);return String(n||id||"PRJ").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,5)||"PRJ";}
  function display(n){return norm(n)==="Lake City Roof Garden"?"Lake City Roof Gardens":n;}
  function meta(n){var x=norm(n);if(x==="Lake City Roof Garden")return "Tower I • L1 • L2";if(x==="One Lake City")return "Tower 1 • Tower 2";return "Project Management Dashboard";}
  var legacy=[{"Project ID":"PRJ-001","Project Name":"Lake City Roof Garden","Status":"Active"},{"Project ID":"PRJ-002","Project Name":"One Lake City","Status":"Active"}];

  window.renderProjectLauncher=function(){
    var grid=document.getElementById("projectLauncherGrid"),count=document.getElementById("projectLauncherCount");if(!grid)return;
    try{
      var q=String((document.getElementById("projectLauncherSearch")||{}).value||"").trim().toLowerCase();
      var src=(typeof projectLauncherData!=="undefined"&&Array.isArray(projectLauncherData))?projectLauncherData:[];
      var accessible=src.filter(allowed).filter(function(r){return !!pname(r);});
      var rows=accessible.filter(function(r){return !q||[pname(r),pid(r)].join(" ").toLowerCase().indexOf(q)>=0;}).sort(function(a,b){return pname(a).localeCompare(pname(b));});
      if(count)count.innerText=q?(rows.length+" of "+accessible.length+" projects"):(accessible.length+" accessible project"+(accessible.length===1?"":"s"));
      if(!rows.length){grid.innerHTML='<div class="project-launcher-empty">'+(q?"No accessible project matches your search.":(!allAccess()&&!tokens().length?"No project has been assigned to your account. Please contact the Administrator.":"No accessible active projects are available."))+"</div>";return;}
      grid.innerHTML=rows.map(function(r){var n=pname(r),d=display(n),i=pid(r);return '<button type="button" class="project-choice" data-project="'+esc(n)+'" aria-label="Open '+esc(d)+' dashboard"><div class="project-list-badge">'+esc(code(n,i))+'</div><div class="project-list-main"><div class="project-list-name">'+esc(d)+'</div><div class="project-list-meta">'+esc(meta(n))+'</div>'+(i?'<div class="project-list-id">'+esc(i)+'</div>':'')+'</div><div class="project-list-status">Active</div><div class="project-list-arrow">→</div></button>';}).join("");
      Array.prototype.forEach.call(grid.querySelectorAll(".project-choice[data-project]"),function(btn){btn.addEventListener("click",function(){if(typeof selectActiveProject==="function")selectActiveProject(btn.getAttribute("data-project"));});});
    }catch(e){console.error("Project launcher render failed:",e);grid.innerHTML='<div class="project-launcher-empty">Project list could not be rendered. Please refresh the app.</div>';}
  };

  window.loadProjectLauncher=function(){
    var grid=document.getElementById("projectLauncherGrid"),count=document.getElementById("projectLauncherCount");
    function fallback(){if(typeof projectLauncherData!=="undefined")projectLauncherData=allAccess()?legacy.slice():[];window.renderProjectLauncher();}
    function success(d){try{if(d&&typeof masterData!=="undefined")masterData=d;var rows=d&&Array.isArray(d.projects)?d.projects:[];if(!rows.length&&allAccess())rows=legacy.slice();if(typeof projectLauncherData!=="undefined")projectLauncherData=rows;window.renderProjectLauncher();}catch(e){console.error("Project launcher apply failed:",e);fallback();}}
    if(grid)grid.innerHTML='<div class="project-launcher-loading">Loading active projects...</div>';if(count)count.innerText="Loading projects...";
    /* CEO / PM see the existing projects immediately; API refresh follows if available. */
    if(allAccess()){if(typeof projectLauncherData!=="undefined")projectLauncherData=legacy.slice();window.renderProjectLauncher();}
    try{
      if(window.LCRG_API&&typeof window.LCRG_API.call==="function"){window.LCRG_API.call("masterData",{}).then(success).catch(function(e){console.error(e);fallback();});return;}
      if(window.LCRG_API&&typeof window.LCRG_API.apiRequest==="function"){window.LCRG_API.apiRequest("masterData",{}).then(success).catch(function(e){console.error(e);fallback();});return;}
    }catch(e){console.error("Project launcher API failed:",e);}
    fallback();
  };
})();
