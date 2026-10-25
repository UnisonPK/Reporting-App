
let loggedInUser=null,masterData=null,currentStep=0,myReportsData=[],currentReportActivityId="";

function value(id){return document.getElementById(id).value.trim()}
function togglePassword(){let p=document.getElementById("password"),t=document.getElementById("passwordToggle");p.type=p.type==="password"?"text":"password";t.innerText=p.type==="password"?"Show":"Hide"}

function normalizeRole(role){
  return String(role||"").trim().toLowerCase();
}

function hasFullAccess(){
  if(!loggedInUser)return false;
  return [
    "admin",
    "ceo",
    "project manager",
    "construction manager",
    "planning engineer",
    "mep manager"
  ].includes(normalizeRole(loggedInUser.role));
}

function hasExecutiveAccess(){
  if(!loggedInUser)return false;
  return ["ceo","project manager"].includes(normalizeRole(loggedInUser.role));
}

function hasAdministrationAccess(){
  if(!loggedInUser)return false;
  return ["admin","project manager"].includes(normalizeRole(loggedInUser.role));
}

function applyRoleAccess(){
  const adminCard=document.getElementById("adminCard");
  const executiveCard=document.getElementById("executiveReportCard");
  const projectControlsSection=document.getElementById("projectControlsDashboardSection");
  const adminSection=document.getElementById("administrationDashboardSection");
  const siteOperationsSection=document.getElementById("siteOperationsDashboardSection");
  const isCEO=normalizeRole(loggedInUser&&loggedInUser.role)==="ceo";
  if(siteOperationsSection)siteOperationsSection.style.display="block";
  if(adminCard)adminCard.style.display=hasAdministrationAccess()?"block":"none";
  if(adminSection)adminSection.style.display=hasAdministrationAccess()?"block":"none";
  if(projectControlsSection)projectControlsSection.style.display=hasExecutiveAccess()?"block":"none";
  if(executiveCard)executiveCard.style.display=hasExecutiveAccess()?"block":"none";

  const reportTitle=document.querySelector("#myReportsPage .step-title");
  const reportSubtitle=document.querySelector("#myReportsPage .step-subtitle");
  if(reportTitle)reportTitle.innerText=hasFullAccess()?"Activity Reports":"My Activity Reports";
  if(reportSubtitle)reportSubtitle.innerText=hasFullAccess()
    ?"Search and filter all submitted reports. Click View for full details and photo evidence."
    :"Search and filter your submitted reports. Click View for full details and photo evidence.";
}


/* ===================== GENERIC PROJECT LAUNCHER — V2 ===================== */
const ACTIVE_PROJECT_KEY="pmcActiveProject";
let projectLauncherData=[];

function normalizeProjectName_(project){
  const key=String(project||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

  /* Backward compatibility — DO NOT REMOVE.
     These aliases preserve all existing LCRG / OLC records and module logic. */
  if(["lcrg","lake city roof garden","lake city roof gardens"].includes(key))return "Lake City Roof Garden";
  if(["olc","one lake city"].includes(key))return "One Lake City";

  return String(project||"").trim();
}

function getActiveProject(){
  return normalizeProjectName_(localStorage.getItem(ACTIVE_PROJECT_KEY)||"");
}

function rowMatchesActiveProject_(row){
  const active=getActiveProject();
  if(!active)return false;
  const p=String(
    row?.project ??
    row?.Project ??
    row?.["Project Name"] ??
    ""
  ).trim();
  return normalizeProjectName_(p)===active;
}

function scopeRowsToActiveProject_(rows){
  return (rows||[]).filter(rowMatchesActiveProject_);
}

function lockProjectSelectToActive_(id){
  const el=document.getElementById(id);
  const active=getActiveProject();
  if(!el||!active)return;

  let opt=Array.from(el.options||[]).find(o=>
    normalizeProjectName_(o.value||o.textContent)===active
  );

  if(!opt){
    opt=document.createElement("option");
    opt.value=active;
    opt.textContent=projectLauncherDisplayName_(active);
    el.insertBefore(opt,el.firstChild);
  }

  el.value=opt.value;
  el.disabled=true;
  el.classList.add("project-context-locked");
  el.title="Project is controlled by the Project Launcher. Use Change Project from Dashboard.";
}

function projectMatchesActive_(row){
  const active=getActiveProject();
  return !!active&&normalizeProjectName_(cockpitRowProject(row))===active;
}

function projectLauncherName_(row){
  return String(
    row?.["Project Name"] ??
    row?.projectName ??
    row?.Project ??
    row?.project ??
    ""
  ).trim();
}

function projectLauncherId_(row){
  return String(
    row?.["Project ID"] ??
    row?.projectId ??
    row?.ID ??
    row?.id ??
    ""
  ).trim();
}

function projectLauncherCode_(name,id){
  const normalized=normalizeProjectName_(name);

  /* Preserve familiar legacy codes. */
  if(normalized==="Lake City Roof Garden")return "LCRG";
  if(normalized==="One Lake City")return "OLC";

  const words=String(name||"").trim().split(/\s+/).filter(Boolean);
  if(words.length>=2){
    return words.slice(0,4).map(w=>w.charAt(0).toUpperCase()).join("").slice(0,5);
  }

  const cleaned=String(name||id||"PRJ").replace(/[^A-Za-z0-9]/g,"").toUpperCase();
  return cleaned.slice(0,5)||"PRJ";
}

function projectLauncherDisplayName_(name){
  const normalized=normalizeProjectName_(name);
  if(normalized==="Lake City Roof Garden")return "Lake City Roof Gardens";
  return name;
}

function projectLauncherMeta_(name){
  const normalized=normalizeProjectName_(name);

  /* Preserve the existing project hierarchy information. */
  if(normalized==="Lake City Roof Garden")return "Tower I • L1 • L2";
  if(normalized==="One Lake City")return "Tower 1 • Tower 2";

  const towers=(masterData?.towers||[]).filter(t=>{
    return normalizeProjectName_(t["Project"]||t["Project Name"]||t.project||"")===normalized;
  }).map(t=>String(t["Tower / Block"]||t["Tower"]||t.tower||"").trim()).filter(Boolean);

  const unique=[...new Set(towers)];
  if(unique.length===1)return unique[0];
  if(unique.length>1)return unique.slice(0,3).join(" • ")+(unique.length>3?" • +"+(unique.length-3):"");

  return "Project Management Dashboard";
}


function userHasAllProjectAccess_(){
  const role=String(loggedInUser?.role||"").trim().toLowerCase();
  return role==="ceo"||role==="project manager";
}

function userProjectAccessTokens_(){
  return String(loggedInUser?.projectAccess||"")
    .split(/[\n,;|]+/)
    .map(v=>String(v||"").trim())
    .filter(Boolean);
}

function projectAccessTokenKey_(v){
  return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}

function projectRowAllowedForUser_(row){
  if(userHasAllProjectAccess_())return true;

  const tokens=userProjectAccessTokens_();
  if(!tokens.length)return false;

  const name=projectLauncherName_(row);
  const id=projectLauncherId_(row);
  const nameKey=projectAccessTokenKey_(name);
  const idKey=projectAccessTokenKey_(id);

  return tokens.some(t=>{
    const key=projectAccessTokenKey_(t);
    return key===nameKey||key===idKey;
  });
}

function renderProjectLauncher(){
  const grid=document.getElementById("projectLauncherGrid");
  const count=document.getElementById("projectLauncherCount");
  if(!grid)return;

  const q=String(document.getElementById("projectLauncherSearch")?.value||"").trim().toLowerCase();

  const rows=(projectLauncherData||[])
    .filter(projectRowAllowedForUser_)
    .map(r=>({
      raw:r,
      name:projectLauncherName_(r),
      id:projectLauncherId_(r)
    }))
    .filter(r=>r.name)
    .filter(r=>!q||[r.name,r.id].join(" ").toLowerCase().includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name));

  if(count){
    const total=(projectLauncherData||[])
      .filter(projectRowAllowedForUser_)
      .filter(r=>projectLauncherName_(r)).length;
    count.innerText=q?rows.length+" of "+total+" projects":total+" accessible project"+(total===1?"":"s");
  }

  if(!rows.length){
    const noAssignment=!userHasAllProjectAccess_()&&!userProjectAccessTokens_().length;
    grid.innerHTML='<div class="project-launcher-empty">'+
      (q
        ?'No accessible project matches your search.'
        :(noAssignment
          ?'No project has been assigned to your account. Please contact the Administrator.'
          :'No accessible active projects are available.'))+
      '</div>';
    return;
  }

  grid.innerHTML=rows.map(r=>{
    const display=projectLauncherDisplayName_(r.name);
    const code=projectLauncherCode_(r.name,r.id);
    const meta=projectLauncherMeta_(r.name);

    return '<button type="button" class="project-choice" data-project="'+escapeHtml(r.name)+'" aria-label="Open '+escapeHtml(display)+' dashboard">'+
      '<div class="project-list-badge">'+escapeHtml(code)+'</div>'+
      '<div class="project-list-main">'+
        '<div class="project-list-name">'+escapeHtml(display)+'</div>'+
        '<div class="project-list-meta">'+escapeHtml(meta)+'</div>'+
        (r.id?'<div class="project-list-id">'+escapeHtml(r.id)+'</div>':'')+
      '</div>'+
      '<div class="project-list-status">Active</div>'+
      '<div class="project-list-arrow">→</div>'+
    '</button>';
  }).join("");

  grid.querySelectorAll(".project-choice[data-project]").forEach(btn=>{
    btn.addEventListener("click",()=>selectActiveProject(btn.getAttribute("data-project")));
  });
}

function loadProjectLauncher(){
  const grid=document.getElementById("projectLauncherGrid");
  const count=document.getElementById("projectLauncherCount");
  if(grid)grid.innerHTML='<div class="project-launcher-loading">Loading active projects...</div>';
  if(count)count.innerText="Loading projects...";

  google.script.run
    .withSuccessHandler(function(d){
      masterData=d||masterData||{};
      projectLauncherData=Array.isArray(d?.projects)?d.projects:[];

      /* Emergency compatibility fallback:
         only used if master data cannot return project rows.
         This prevents the existing LCRG/OLC system from becoming inaccessible. */
      if(!projectLauncherData.length&&userHasAllProjectAccess_()){
        projectLauncherData=[
          {"Project ID":"PRJ-001","Project Name":"Lake City Roof Garden","Status":"Active"},
          {"Project ID":"PRJ-002","Project Name":"One Lake City","Status":"Active"}
        ];
      }

      renderProjectLauncher();
    })
    .withFailureHandler(function(e){
      console.error("Project launcher master-data load failed:",e);

      projectLauncherData=userHasAllProjectAccess_()
        ?[
          {"Project ID":"PRJ-001","Project Name":"Lake City Roof Garden","Status":"Active"},
          {"Project ID":"PRJ-002","Project Name":"One Lake City","Status":"Active"}
        ]
        :[];

      renderProjectLauncher();

      if(count)count.title="Master Data could not be loaded. Legacy LCRG / OLC fallback is active.";
    })
    .getMasterData();
}

function syncActiveProjectDashboard_(){
  const active=getActiveProject();
  const label=document.getElementById("activeProjectDisplay");
  if(label)label.innerText=projectLauncherDisplayName_(active)||"No Project Selected";

  const sel=document.getElementById("cockpitProjectFilter");
  if(sel&&active){
    let option=Array.from(sel.options).find(o=>normalizeProjectName_(o.value||o.textContent)===active);
    if(!option){
      option=document.createElement("option");
      option.value=active;
      option.textContent=projectLauncherDisplayName_(active);
      sel.insertBefore(option,sel.firstChild);
    }
    sel.value=option.value;
  }

  if(active)localStorage.setItem("managementCockpitProject",active);
  syncSmartProjectIdentity_();
}

function showProjectSelection(){
  if(!loggedInUser){
    hideAppPages();
    document.getElementById("loginPage").style.display="flex";
    return;
  }

  hideAppPages();

  const page=document.getElementById("projectSelectionPage");
  if(page)page.style.display="flex";

  const user=document.getElementById("projectSelectionUser");
  if(user){
    const name=loggedInUser.supervisorName||loggedInUser.username||"User";
    const role=loggedInUser.role||"";
    user.innerText=role?name+" • "+role:name;
  }

  const accessNote=document.getElementById("projectAccessNote");
  if(accessNote){
    accessNote.innerText=userHasAllProjectAccess_()
      ?"All active projects are available for your role."
      :"Only projects assigned to your account are shown.";
  }

  const search=document.getElementById("projectLauncherSearch");
  if(search)search.value="";

  loadProjectLauncher();
}

function selectActiveProject(project){
  const normalized=normalizeProjectName_(project);
  if(!normalized)return;

  /* Generic: any active project returned by Projects Master Data is valid. */
  const valid=(projectLauncherData||[]).some(r=>
    projectRowAllowedForUser_(r)&&
    normalizeProjectName_(projectLauncherName_(r))===normalized
  );

  /* Legacy fallback is allowed only for CEO / Project Manager. */
  const legacy=userHasAllProjectAccess_()&&
    ["Lake City Roof Garden","One Lake City"].includes(normalized);

  if(!valid&&!legacy){
    alert("You do not have permission to access this project. Please contact the Administrator.");
    return;
  }

  localStorage.setItem(ACTIVE_PROJECT_KEY,normalized);
  localStorage.setItem("managementCockpitProject",normalized);

  const tower=document.getElementById("cockpitTowerFilter");
  if(tower)tower.value="";

  showDashboard();
}

function changeActiveProject(){
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
  localStorage.removeItem("managementCockpitProject");
  managementCockpitSourceData=null;
  managementCockpitLastData=null;
  showProjectSelection();
}

function hideAppPages(){
  ["loginPage","projectSelectionPage","dashboardPage","activityPage","myReportsPage","pendingInspectionsPage","dailySummaryPage","administrationPage","executiveReportPage","cashFlowPage","boqCostPage","drawingsPage","actionRegisterPage","programmePage","procurementPage","placeholderModulePage"].forEach(function(id){
    const el=document.getElementById(id);
    if(el)el.style.display="none";
  });
}

function login(){
  const u=value("username");
  const p=document.getElementById("password").value;
  const m=document.getElementById("message");
  const b=document.getElementById("loginButton");

  if(!u||!p){
    m.style.color="#dc2626";
    m.innerText="Username and password are required.";
    return;
  }

  b.disabled=true;
  b.innerText="LOGGING IN...";
  m.style.color="#64748b";
  m.innerText="Checking login details...";

  google.script.run
    .withSuccessHandler(function(r){
      b.disabled=false;
      b.innerText="LOGIN";
      if(r.success){
        loggedInUser=r.user;
        if(document.getElementById("rememberMe").checked){
          localStorage.setItem("rememberedUsername",u);
        }else{
          localStorage.removeItem("rememberedUsername");
        }
        m.innerText="";
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
        localStorage.removeItem("managementCockpitProject");
        showProjectSelection();
      }else{
        m.style.color="#dc2626";
        m.innerText=r.message;
      }
    })
    .withFailureHandler(function(e){
      b.disabled=false;
      b.innerText="LOGIN";
      m.style.color="#dc2626";
      m.innerText="Login error: "+e.message;
    })
    .loginUser(u,p);
}

function showDashboard(){
  if(!loggedInUser){hideAppPages();document.getElementById("loginPage").style.display="flex";return}
  if(!getActiveProject()){showProjectSelection();return}
  hideAppPages();document.getElementById("dashboardPage").style.display="block";
  document.getElementById("welcome").innerText="Welcome, "+loggedInUser.supervisorName;
  document.getElementById("userRole").innerText="Role: "+loggedInUser.role+" | Employee ID: "+loggedInUser.employeeId;
  syncDashboardSidebarUser();applyRoleAccess();syncActiveProjectDashboard_();
  const attentionBox=document.getElementById("dashboardManagementAttention");if(attentionBox)attentionBox.style.display=hasExecutiveAccess()?"block":"none";
  loadDashboardStats();loadManagementCockpit();loadActionDashboardBadge();
}
function addOption(s,v){if(!v)return;let o=document.createElement("option");o.value=v;o.textContent=v;s.appendChild(o)}

function dashboardTodayString(){
  const n=new Date();
  return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
}

function loadDashboardStats(){
  if(!loggedInUser)return;
  const btn=document.getElementById("dashboardRefreshButton");
  const status=document.getElementById("dashboardStatus");
  const dateEl=document.getElementById("dashboardDate");
  const today=dashboardTodayString();
  if(dateEl)dateEl.innerText=new Date().toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  if(btn){btn.disabled=true;btn.innerText="↻ Refreshing...";}
  if(status)status.innerText="Updating live dashboard counts...";

  let summaryDone=false,inspectionDone=false,hadError=false;
  function finish(){
    if(!summaryDone||!inspectionDone)return;
    if(btn){btn.disabled=false;btn.innerText="↻ Refresh Dashboard";}
    if(status)status.innerText=hadError?"Some dashboard counts could not be refreshed.":"Live snapshot updated just now.";
  }

  google.script.run
    .withSuccessHandler(function(rows){
      rows=(rows||[]).filter(projectMatchesActive_);
      const completed=rows.filter(r=>String(r.workStatus||"").trim().toLowerCase()==="completed").length;
      const progress=rows.filter(r=>String(r.workStatus||"").trim().toLowerCase()==="in progress").length;
      const constraints=rows.filter(r=>{
        const issue=String(r.issueConstraint||"").trim().toLowerCase();
        const cat=String(r.delayCategory||"").trim().toLowerCase();
        return (issue&&issue!=="none"&&issue!=="n/a")||(cat&&cat!=="none"&&cat!=="n/a");
      }).length;
      document.getElementById("dashActivities").innerText=rows.length;
      document.getElementById("dashProgress").innerText=progress;
      document.getElementById("dashCompleted").innerText=completed;
      document.getElementById("dashConstraints").innerText=constraints;
      document.getElementById("dashReportsCardCount").innerText=rows.length;
      document.getElementById("dashCompletionCardCount").innerText=completed;
      const cc=document.getElementById("dashConstraintCardCount");if(cc)cc.innerText=constraints;
      if(hasExecutiveAccess()){
        const attention=rows.filter(r=>{
          const issue=String(r.issueConstraint||"").trim(),cat=String(r.delayCategory||"").trim(),ws=String(r.workStatus||"").trim().toLowerCase(),ins=String(r.inspectionStatus||"").trim();
          const meaningful=v=>v&&!["none","n/a","na","nil","not applicable"].includes(v.toLowerCase());
          return meaningful(issue)||meaningful(cat)||ws==="hold"||ws==="on hold"||ws==="delayed"||ins==="Rectification Required";
        }).slice(0,5);
        const ae=document.getElementById("dashboardAttentionList");
        if(ae)ae.innerHTML=!attention.length?'<div class="summary-empty">No management attention items reported today.</div>':attention.map(r=>{
          const issue=r.issueConstraint||r.delayCategory||(r.inspectionStatus==="Rectification Required"?"Rectification Required":"Activity on Hold");
          const location=[r.project,r.tower,r.activity].filter(Boolean).join(" • ");
          const status=r.inspectionStatus==="Rectification Required"?"Rectification":(r.workStatus||"Attention");
          return '<div class="dashboard-attention-item"><div class="dashboard-attention-issue">'+escapeHtml(issue)+'</div><div class="dashboard-attention-location">'+escapeHtml(location)+'</div><div class="dashboard-attention-status">'+escapeHtml(status)+'</div></div>';
        }).join("");
      }
      summaryDone=true;finish();
    })
    .withFailureHandler(function(){
      ["dashActivities","dashProgress","dashCompleted","dashConstraints","dashReportsCardCount","dashCompletionCardCount","dashConstraintCardCount"].forEach(id=>{const e=document.getElementById(id);if(e)e.innerText="—";});
      hadError=true;summaryDone=true;finish();
    })
    .getDailySummaryRowsForUser(today,loggedInUser.userId,loggedInUser.username,loggedInUser.role);

  google.script.run
    .withSuccessHandler(function(rows){
      rows=(rows||[]).filter(projectMatchesActive_);
      const n=rows.length;
      document.getElementById("dashPending").innerText=n;
      document.getElementById("dashInspectionCardCount").innerText=n;
      const nb=document.getElementById("inspectionNotificationBadge");
      if(nb){nb.innerText=n;nb.style.display=n?"flex":"none";}
      inspectionDone=true;finish();
    })
    .withFailureHandler(function(){
      document.getElementById("dashPending").innerText="—";
      document.getElementById("dashInspectionCardCount").innerText="—";
      hadError=true;inspectionDone=true;finish();
    })
    .getPendingInspectionsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);

  updateDashboardDraftBadge();
  const adminBadge=document.getElementById("adminNotificationBadge");
  if(adminBadge)adminBadge.style.display="none";
  if(hasAdministrationAccess()){
    google.script.run
      .withSuccessHandler(function(data){
        const n=((data&&data.passwordResetRequests)||[]).filter(r=>String(r.status||"").toLowerCase()==="pending").length;
        if(adminBadge){adminBadge.innerText=n;adminBadge.style.display=n?"flex":"none";}
      })
      .withFailureHandler(function(){if(adminBadge)adminBadge.style.display="none";})
      .getAdministrationData(loggedInUser.userId,loggedInUser.username);
  }
}



/* ===================== MANAGEMENT COCKPIT V1 ===================== */
let managementCockpitLastData=null;

function cockpitSetHealth(name,color,text,detail){
  const dot=document.getElementById("health"+name+"Dot"),txt=document.getElementById("health"+name+"Text"),det=document.getElementById("health"+name+"Detail");
  if(dot)dot.className="health-dot "+color;
  if(txt)txt.innerText=text;
  if(det)det.innerText=detail;
}
function cockpitMoney(v){
  const n=Number(v||0);
  if(!isFinite(n))return "PKR 0";
  const a=Math.abs(n);
  if(a>=1000000000)return "PKR "+(n/1000000000).toFixed(2).replace(/\.00$/,'')+" B";
  if(a>=1000000)return "PKR "+(n/1000000).toFixed(1).replace(/\.0$/,'')+" M";
  if(a>=1000)return "PKR "+(n/1000).toFixed(1).replace(/\.0$/,'')+" K";
  return "PKR "+Math.round(n).toLocaleString();
}
function cockpitNum(v){
  if(v===null||v===undefined||v==="")return 0;
  if(typeof v==="number")return isFinite(v)?v:0;
  let s=String(v).trim();
  const neg=/^\(.*\)$/.test(s);
  s=s.replace(/[(),]/g,"").replace(/%/g,"").replace(/PKR/ig,"").replace(/Rs\.?/ig,"").replace(/[^\d.\-]/g,"");
  let n=Number(s);if(!isFinite(n))n=0;if(neg&&n>0)n=-n;return n;
}
function setCockpitHealth(name,status,text,detail){
  const dot=document.getElementById("health"+name+"Dot"),tx=document.getElementById("health"+name+"Text"),dt=document.getElementById("health"+name+"Detail");
  if(dot)dot.className="health-dot "+status;
  if(tx)tx.innerText=text||status;
  if(dt)dt.innerText=detail||"";
}
function cockpitApi(action,data){
  if(window.LCRG_API&&typeof window.LCRG_API.call==="function")return window.LCRG_API.call(action,data||{});
  return Promise.reject(new Error("API unavailable"));
}
function cockpitMeaningful(v){
  v=String(v||"").trim().toLowerCase();
  return !!v&&!['none','n/a','na','nil','not applicable','-'].includes(v);
}
function cockpitDelta(current,previous,suffix){
  if(previous===null||previous===undefined)return "Baseline saved";
  const d=current-previous;if(!d)return "No change";
  return (d>0?"+":"")+d+(suffix||"");
}
function cockpitMoneyDelta(current,previous){
  if(previous===null||previous===undefined)return "Baseline saved";
  const d=current-previous;if(Math.abs(d)<1)return "No change";
  return (d>0?"+":"−")+cockpitMoney(Math.abs(d));
}
let managementCockpitSourceData=null;
function cockpitRowProject(r){return String((r&&r.project)||(r&&r.projectName)||(r&&r["Project"])||(r&&r["Project Name"])||"").trim();}
function cockpitRowTower(r){return String((r&&r.tower)||(r&&r.towerArea)||(r&&r.area)||(r&&r["Tower / Block"])||(r&&r["Tower / Area"])||"").trim();}
function cockpitPopulateProjectFilter(data){
  const sel=document.getElementById('cockpitProjectFilter');if(!sel)return '';
  const active=getActiveProject();
  const projects=[...new Set([].concat(data.daily,data.inspections,data.cash,data.boq,data.drawings).map(cockpitRowProject).filter(Boolean))].sort();
  if(active&&!projects.some(p=>normalizeProjectName_(p)===active))projects.unshift(active);
  sel.innerHTML=projects.length?projects.map(p=>'<option value="'+escapeHtml(p)+'">'+escapeHtml(p)+'</option>').join(''):'<option value="'+escapeHtml(active)+'">'+escapeHtml(active||'No project data')+'</option>';
  const matched=projects.find(p=>normalizeProjectName_(p)===active)||active||projects[0]||'';
  sel.value=matched;if(matched)localStorage.setItem('managementCockpitProject',normalizeProjectName_(matched));syncActiveProjectDashboard_();return matched;
}
function cockpitPopulateTowerFilter(data,project){
  const sel=document.getElementById('cockpitTowerFilter');if(!sel)return;
  const previous=sel.value||'';
  const towers=[...new Set([].concat(data.daily,data.inspections,data.cash,data.boq,data.drawings).filter(r=>!project||cockpitRowProject(r)===project).map(cockpitRowTower).filter(Boolean))].sort();
  sel.innerHTML='<option value="">All Towers / Areas</option>'+towers.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('');
  if(towers.includes(previous))sel.value=previous;
}

function pmcProjectImageFor_(project){
  const key=String(project||"").trim().toLowerCase();
  if(key==="one lake city"||key==="olc")return "olc-elevation.jpg?v=20260820-1";
  return "lcrg-elevation.jpg?v=20260820-1";
}
function syncSmartProjectIdentity_(){
  const project=(document.getElementById("cockpitProjectFilter")||{}).value||"";
  const img=pmcProjectImageFor_(project);
  ["projectElevationImage","projectHealthThumb"].forEach(function(id){const el=document.getElementById(id);if(el&&el.getAttribute("src")!==img)el.setAttribute("src",img);});
  const hero=document.getElementById("projectHeroName");if(hero)hero.innerText=project||"Selected Project";
  const kpi=document.getElementById("selectedProjectKpiName");if(kpi)kpi.innerText=project||"—";
  const ht=document.getElementById("projectHealthTitle");if(ht)ht.innerText="Project Health"+(project?" — "+project:"");
  const at=document.getElementById("projectAlertsTitle");if(at)at.innerText="Key Alerts"+(project?" — "+project:"");
}
function syncSmartExecutiveDashboard_(data){
  data=data||{};
  syncSmartProjectIdentity_();
  const pct=Math.max(0,Math.min(100,Number(data.financial||0)));
  const pp=document.getElementById("projectHealthProgress");if(pp)pp.innerText=pct.toFixed(1)+"%";
  const bar=document.getElementById("projectHealthProgressBar");if(bar){bar.style.width=pct.toFixed(1)+"%";bar.style.background=data.overall==="red"?"#dc2626":data.overall==="amber"?"#f59e0b":"#16a34a";}
  const st=document.getElementById("projectHealthStatus");if(st){st.innerText=data.overallText||"Stable";st.className="pmc-status-pill "+(data.overall==="red"?"red":data.overall==="amber"?"amber":"green");}
  const on=document.getElementById("ceoOnTrackCount"),risk=document.getElementById("ceoAtRiskCount"),onNote=document.getElementById("ceoOnTrackNote"),riskNote=document.getElementById("ceoAtRiskNote");
  const atRisk=data.overall==="red"||data.overall==="amber";
  if(on)on.innerText=atRisk?"0":"1";if(risk)risk.innerText=atRisk?"1":"0";
  if(onNote)onNote.innerText=atRisk?"0% of selected project":"100% of selected project";
  if(riskNote)riskNote.innerText=atRisk?"100% of selected project":"0% of selected project";
}
function syncSmartTopbarUser_(){
  if(!loggedInUser)return;
  const name=document.getElementById("topbarUserName"),role=document.getElementById("topbarUserRole"),initials=document.getElementById("topbarUserInitials");
  if(name)name.innerText=loggedInUser.supervisorName||loggedInUser.username||"User";
  if(role)role.innerText=loggedInUser.role||"";
  if(initials){const parts=String(loggedInUser.supervisorName||loggedInUser.username||"U").trim().split(/\s+/);initials.innerText=(parts[0]?.[0]||"U")+(parts.length>1?(parts[parts.length-1][0]||""):"");}
}

function cockpitProjectChanged(){
  const p=document.getElementById('cockpitProjectFilter').value||'';
  if(p)localStorage.setItem('managementCockpitProject',p);
  if(managementCockpitSourceData)cockpitPopulateTowerFilter(managementCockpitSourceData,p);
  syncSmartProjectIdentity_();
  renderManagementCockpitFromCache();
}
function cockpitScopeRows(rows,project,tower){return (rows||[]).filter(r=>(!project||cockpitRowProject(r)===project)&&(!tower||cockpitRowTower(r)===tower));}
function loadManagementCockpit(){
  const cockpit=document.getElementById("managementCockpit");
  const legacy=document.getElementById("legacyDashboardKpis");
  const legacyAttention=document.getElementById("dashboardManagementAttention");
  if(!cockpit)return;
  if(!hasExecutiveAccess()){
    cockpit.style.display="none";if(legacy)legacy.style.display="grid";if(legacyAttention)legacyAttention.style.display="none";return;
  }
  cockpit.style.display="block";if(legacy)legacy.style.display="none";if(legacyAttention)legacyAttention.style.display="none";
  const updated=document.getElementById("cockpitUpdated");if(updated)updated.innerText="Updating live project view...";
  const today=dashboardTodayString();
  Promise.allSettled([
    cockpitApi("dailySummary",{date:today}),
    cockpitApi("pendingInspections",{}),
    cockpitApi("cashFlow",{}),
    cockpitApi("boqCost",{}),
    cockpitApi("drawings",{}),
    actionApi("actionRegister",{}),
    cockpitApi("programme",{}),
    cockpitApi("procurement",{})
  ]).then(function(results){
    managementCockpitSourceData={
      daily:results[0].status==="fulfilled"?(results[0].value||[]):[],
      inspections:results[1].status==="fulfilled"?(results[1].value||[]):[],
      cash:results[2].status==="fulfilled"?(results[2].value||[]):[],
      boq:results[3].status==="fulfilled"?(results[3].value||[]):[],
      drawings:results[4].status==="fulfilled"?(results[4].value||[]):[],
      actions:results[5].status==="fulfilled"?(results[5].value||[]):[],
      programme:results[6].status==="fulfilled"?(results[6].value||[]):[],
      procurement:results[7].status==="fulfilled"?(results[7].value||[]):[],
      failed:results.filter(x=>x.status!=="fulfilled").length
    };
    const project=cockpitPopulateProjectFilter(managementCockpitSourceData);cockpitPopulateTowerFilter(managementCockpitSourceData,project);renderManagementCockpitFromCache();
  });
}
function renderManagementCockpitFromCache(){
  if(!managementCockpitSourceData)return;
  const source=managementCockpitSourceData;
  const project=(document.getElementById('cockpitProjectFilter')||{}).value||'';
  const tower=(document.getElementById('cockpitTowerFilter')||{}).value||'';
  const daily=cockpitScopeRows(source.daily,project,tower),
        inspections=cockpitScopeRows(source.inspections,project,tower),
        cash=cockpitScopeRows(source.cash,project,tower),
        boq=cockpitScopeRows(source.boq,project,tower),
        drawings=cockpitScopeRows(source.drawings,project,tower),
        actionRows=cockpitScopeRows(source.actions||[],project,tower),
        programmeRows=cockpitScopeRows(source.programme||[],project,tower),
        procurementRows=cockpitScopeRows(source.procurement||[],project,tower),
        failed=source.failed||0;

  const openActions=actionRows.filter(r=>String(r.status||"").trim().toLowerCase()!=="closed");
  const decisionActions=openActions.filter(r=>{
    const d=String(r.decisionRequired||"").trim();
    return d&&d.toLowerCase()!=="no decision required";
  });
  const criticalActions=openActions.filter(r=>
    String(r.priority||"").trim().toLowerCase()==="critical"||!!r.isOverdue
  );
  const overdueActions=openActions.filter(r=>!!r.isOverdue);

  const programmeDelayed=programmeRows.filter(r=>r.isDelayed||String(r.status||"").toLowerCase()==="delayed");
  if(!programmeRows.length)cockpitSetHealth('Programme','gray','No Data','No programme milestones recorded');
  else if(programmeDelayed.length)cockpitSetHealth('Programme','red','Delayed',programmeDelayed.length+' delayed / overdue milestone'+(programmeDelayed.length===1?'':'s'));
  else if(programmeRows.some(r=>Number(r.varianceDays||0)>0))cockpitSetHealth('Programme','amber','At Risk','Forecast slippage exists in programme milestones');
  else cockpitSetHealth('Programme','green','On Track','No delayed programme milestones');

  const procurementLate=procurementRows.filter(r=>r.isLate);
  const procurementRisk=procurementRows.filter(r=>r.isAtRisk&&!r.isLate);
  if(!procurementRows.length)cockpitSetHealth('Procurement','gray','No Data','No procurement packages recorded');
  else if(procurementLate.length)cockpitSetHealth('Procurement','red','Delayed',procurementLate.length+' package'+(procurementLate.length===1?'':'s')+' late');
  else if(procurementRisk.length)cockpitSetHealth('Procurement','amber','At Risk',procurementRisk.length+' package'+(procurementRisk.length===1?'':'s')+' forecast after required date');
  else cockpitSetHealth('Procurement','green','On Track','No late procurement packages');

  const completed=daily.filter(r=>String(r.workStatus||"").trim().toLowerCase()==="completed").length;
  const inProgress=daily.filter(r=>String(r.workStatus||"").trim().toLowerCase()==="in progress").length;
  const constraints=daily.filter(r=>cockpitMeaningful(r.issueConstraint)||cockpitMeaningful(r.delayCategory)||['hold','on hold','delayed'].includes(String(r.workStatus||"").trim().toLowerCase())||String(r.inspectionStatus||"").trim().toLowerCase()==="rectification required");
  const rectification=daily.filter(r=>String(r.inspectionStatus||"").trim().toLowerCase()==="rectification required").length;
  const cashUnique=new Map();cash.forEach(r=>cashUnique.set([String(r.serialNo||'').toLowerCase(),cockpitRowProject(r).toLowerCase(),cockpitRowTower(r).toLowerCase(),String(r.activity||'').toLowerCase()].join('||'),r));
  const cashRows=Array.from(cashUnique.values()),awarded=cashRows.reduce((a,r)=>a+cockpitNum(r.awardedValue),0),spent=cashRows.reduce((a,r)=>a+cockpitNum(r.actualSpending),0),pending=cashRows.reduce((a,r)=>a+cockpitNum(r.pendingApproval),0),initial=cashRows.reduce((a,r)=>a+cockpitNum(r.initialBudget),0),financial=awarded?(spent/awarded)*100:0;
  const revised=boq.reduce((a,r)=>a+cockpitNum(r.revisedAmount),0),certified=boq.reduce((a,r)=>a+cockpitNum(r.certifiedAmount),0),paid=boq.reduce((a,r)=>a+cockpitNum(r.paidAmount),0),variations=boq.reduce((a,r)=>a+cockpitNum(r.variationAmount),0),certifiedOutstanding=Math.max(certified-paid,0),costCompletion=revised?(certified/revised)*100:0;
  const technicalAttention=drawings.filter(r=>['under review','approved with comments','superseded'].includes(String(r.status||"").trim().toLowerCase()));
  let siteStatus='green',siteText='On Track';if(constraints.length>=3||rectification>=2)siteStatus='red',siteText='Attention';else if(constraints.length||inspections.length>=5||rectification)siteStatus='amber',siteText='Watch';setCockpitHealth('Site',siteStatus,siteText,'Why: '+constraints.length+' constraints • '+inspections.length+' pending inspections • '+rectification+' rectification');
  let costStatus='green',costText='Within Position';if(initial>0&&awarded+pending>initial*1.05)costStatus='red',costText='Exposure';else if(pending>0||(initial>0&&awarded>initial))costStatus='amber',costText='Watch';setCockpitHealth('Cost',costStatus,costText,'Why: '+cockpitMoney(pending)+' pending • '+financial.toFixed(1)+'% financial progress • '+cockpitMoney(awarded)+' awarded');
  let techStatus='green',techText='Controlled';if(technicalAttention.length>=10)techStatus='red',techText='Attention';else if(technicalAttention.length)techStatus='amber',techText='Watch';setCockpitHealth('Technical',techStatus,techText,'Why: '+technicalAttention.length+' drawing / technical item'+(technicalAttention.length===1?'':'s')+' need review');
  let approvalsStatus='green',approvalsText='Clear';if(initial>0&&pending>initial*0.05)approvalsStatus='red',approvalsText='Critical';else if(pending>0)approvalsStatus='amber',approvalsText='Pending';setCockpitHealth('Approvals',approvalsStatus,approvalsText,pending>0?'Why: '+cockpitMoney(pending)+' awaiting approval':'Why: No financial approvals pending');
  let commercialStatus='green',commercialText='Controlled';const variationRatio=revised?Math.abs(variations)/revised:0;if(variationRatio>0.10)commercialStatus='red',commercialText='Exposure';else if(Math.abs(variations)>0||certifiedOutstanding>0)commercialStatus='amber',commercialText='Watch';setCockpitHealth('Commercial',commercialStatus,commercialText,'Why: '+cockpitMoney(certifiedOutstanding)+' certified unpaid • '+cockpitMoney(variations)+' variations');
  const redCount=[siteStatus,costStatus,techStatus,approvalsStatus,commercialStatus].filter(x=>x==='red').length,amberCount=[siteStatus,costStatus,techStatus,approvalsStatus,commercialStatus].filter(x=>x==='amber').length;let overall='green',overallText='Stable';if(redCount>=2)overall='red',overallText='Critical';else if(redCount>=1||amberCount>=2)overall='amber',overallText='Attention';const overallReason=redCount?redCount+' Red + '+amberCount+' Amber connected areas':amberCount?amberCount+' Amber connected area'+(amberCount===1?'':'s'):'All connected areas within position';setCockpitHealth('Overall',overall,overallText,'Why: '+overallReason+(failed?' • '+failed+' source(s) unavailable':''));
  const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};setText('cockpitDecisionCount',decisionActions.length);setText('cockpitConstraintCount',constraints.length);setText('cockpitConstraintImpact',constraints.length?'Requires site / management follow-up':'No current exceptions');setText('cockpitTechnicalCount',technicalAttention.length);setText('cockpitPendingApproval',cockpitMoney(pending));setText('cockpitActivities',daily.length);setText('cockpitCompleted',completed);setText('cockpitFinancial',financial.toFixed(1)+'%');setText('cockpitCostCompletion',costCompletion.toFixed(1)+'%');
  const scopeKey=(project||'none')+'_'+(tower||'all'),snapshot={activities:daily.length,inspections:inspections.length,constraints:constraints.length,pending:Math.round(pending),openActions:openActions.length,criticalActions:criticalActions.length,decisions:decisionActions.length,at:Date.now()};let previous=null;try{previous=JSON.parse(localStorage.getItem('managementCockpitSnapshot_'+(loggedInUser.username||loggedInUser.userId||'user')+'_'+scopeKey)||'null');}catch(e){}setText('changeActivities',cockpitDelta(snapshot.activities,previous&&previous.activities));setText('changeInspections',cockpitDelta(snapshot.inspections,previous&&previous.inspections));setText('changeConstraints',cockpitDelta(snapshot.constraints,previous&&previous.constraints));setText('changePendingCost',cockpitMoneyDelta(snapshot.pending,previous&&previous.pending));try{localStorage.setItem('managementCockpitSnapshot_'+(loggedInUser.username||loggedInUser.userId||'user')+'_'+scopeKey,JSON.stringify(snapshot));}catch(e){}
  const brief=[];brief.push('<b>'+escapeHtml(project||'Selected project')+(tower?' — '+escapeHtml(tower):'')+'</b> overall status is <b>'+overallText.toUpperCase()+'</b>.');if(daily.length)brief.push('Today '+daily.length+' site activities are reported, with '+completed+' completed and '+inProgress+' in progress.');if(constraints.length)brief.push('<b>'+constraints.length+' site constraint'+(constraints.length===1?'':'s')+'</b> currently require follow-up.');else brief.push('No site constraints are currently surfaced from today’s reports.');if(pending>0)brief.push('<b>'+cockpitMoney(pending)+'</b> is recorded as pending approval in Cash Flow.');else brief.push('No financial approvals are currently pending.');if(certifiedOutstanding>0||Math.abs(variations)>0)brief.push('Commercial watch: <b>'+cockpitMoney(certifiedOutstanding)+'</b> certified amount remains unpaid and <b>'+cockpitMoney(variations)+'</b> is recorded in variations.');if(technicalAttention.length)brief.push(technicalAttention.length+' design / technical item'+(technicalAttention.length===1?' requires':'s require')+' attention.');if(openActions.length)brief.push('<b>'+openActions.length+' management action'+(openActions.length===1?' is':'s are')+'</b> open; '+criticalActions.length+' critical / overdue and '+decisionActions.length+' requiring management decision.');else brief.push('No open management actions are currently recorded for this project.');if(programmeRows.length)brief.push('Programme: <b>'+programmeDelayed.length+'</b> delayed / overdue milestone'+(programmeDelayed.length===1?'':'s')+'.');if(procurementRows.length)brief.push('Procurement: <b>'+procurementLate.length+'</b> late and <b>'+procurementRisk.length+'</b> at-risk package'+((procurementLate.length+procurementRisk.length)===1?'':'s')+'.');const be=document.getElementById('cockpitManagementBrief');if(be)be.innerHTML=brief.join(' ');setText('cockpitBriefStatus','Project-wise'+(tower?' • tower filtered':' • all towers')+(failed?' • partial live data':' • live data'));
  const actions=[];

  /* 1. Formal Decision / Action Register is the primary management source. */
  const rankedActions=openActions.slice().sort((a,b)=>{
    function score(r){
      let s=0;
      if(r.isOverdue)s+=100;
      const p=String(r.priority||"").trim().toLowerCase();
      if(p==="critical")s+=80;
      else if(p==="high")s+=50;
      else if(p==="attention")s+=25;
      const d=String(r.decisionRequired||"").trim().toLowerCase();
      if(d&&d!=="no decision required")s+=35;
      return s;
    }
    return score(b)-score(a);
  });

  rankedActions.slice(0,4).forEach(r=>{
    const flags=[];
    if(r.isOverdue)flags.push("OVERDUE");
    if(r.priority)flags.push(r.priority);
    if(r.decisionRequired&&String(r.decisionRequired).trim().toLowerCase()!=="no decision required")flags.push("Decision Required");
    if(r.status)flags.push(r.status);

    actions.push({
      title:r.issue||r.actionRequired||r.actionId||"Management Action",
      meta:[r.actionId,r.category,r.tower,r.floor,r.targetDate?("Target "+r.targetDate):""].filter(Boolean).join(" • "),
      owner:r.responsiblePerson||r.responsibleParty||"Management",
      impact:flags.join(" • ")||"Open",
      button:"Open Action",
      fn:"openActionDetail('"+escAttr(r.actionId)+"')"
    });
  });

  /* 2. Surface operational exceptions only when they are not already
        represented by the formal action register shortlist. */
  if(actions.length<6){
    constraints.slice(0,2).forEach(r=>{
      if(actions.length>=6)return;
      const issue=r.issueConstraint||r.delayCategory||
        (String(r.inspectionStatus||'').toLowerCase()==='rectification required'
          ?'Rectification Required'
          :'Activity on Hold');
      actions.push({
        title:issue,
        meta:[r.tower,r.floor,r.activity].filter(Boolean).join(' • '),
        owner:r.contractor||r.supervisorName||'Site Team',
        impact:r.workStatus||r.inspectionStatus||'Attention',
        button:'View Summary',
        fn:'openDailySummary()'
      });
    });
  }

  if(actions.length<6){
    technicalAttention.slice(0,1).forEach(r=>actions.push({
      title:r.drawingTitle||r.title||r.drawingNo||'Technical Item',
      meta:[r.drawingNo,r.revision,r.status].filter(Boolean).join(' • '),
      owner:r.consultant||r.issuer||'Technical Team',
      impact:'Technical review',
      button:'Open Drawings',
      fn:'openDrawings()'
    }));
  }

  if(actions.length<6&&pending>0){
    actions.push({
      title:'Pending Financial Approval',
      meta:cockpitMoney(pending)+' currently recorded',
      owner:'Management / Commercial',
      impact:'Cost exposure',
      button:'Open Cash Flow',
      fn:'openCashFlow()'
    });
  }

  const ae=document.getElementById('cockpitActions');
  if(ae){
    if(!actions.length){
      ae.innerHTML='<div class="summary-empty">No management actions or connected exceptions require attention for this project / area.</div>';
    }else{
      ae.innerHTML=actions.slice(0,6).map(a=>
        '<div class="cockpit-action-row">'+
          '<div><div class="cockpit-action-title">'+escapeHtml(a.title)+'</div>'+
          '<div class="cockpit-action-meta">'+escapeHtml(a.meta||'')+'</div></div>'+
          '<div class="cockpit-owner"><b>Owner:</b> '+escapeHtml(a.owner)+'</div>'+
          '<div class="cockpit-impact"><b>Status:</b> '+escapeHtml(a.impact)+'</div>'+
          '<button class="cockpit-action-btn" onclick="'+a.fn+'">'+escapeHtml(a.button)+'</button>'+
        '</div>'
      ).join('');
    }
  }
  actionRegisterData=actionRows;
  updateActionDashboardBadge();
  managementCockpitLastData=snapshot;const updated=document.getElementById('cockpitUpdated');if(updated)updated.innerText=(project||'Project')+(tower?' • '+tower:'')+' • updated '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+(failed?' • partial connection':'');syncSmartExecutiveDashboard_({project:project,tower:tower,financial:financial,costCompletion:costCompletion,overall:overall,overallText:overallText,constraints:constraints.length,pending:pending});
}

function resetSelect(id,t){document.getElementById(id).innerHTML='<option value="">'+t+'</option>'}

const ACTIVITY_DRAFT_KEY="LCRG_OLC_ACTIVITY_DRAFT_V1";
let draftAutosaveTimer=null,draftAutosaveBound=false;

function updateNetworkStatus(){
  const el=document.getElementById("networkStatusBadge");
  if(el){const online=navigator.onLine;el.className="network-status "+(online?"online":"offline");el.innerText=online?"● Online":"● Offline — draft stays on this device";}
}
window.addEventListener("online",updateNetworkStatus);window.addEventListener("offline",updateNetworkStatus);

function activityDraftFieldIds(){return ["project","tower","floor","locationType","apartment","specificLocation","trade","subTrade","activity","contractor","quantity","unit","workStatus","startDate","plannedCompletionDate","actualCompletionDate","todayQuantity","cumulativeQuantity","inspectionRequired","inspectionStatus","inspectionDate","inspector","inspectionRemarks","housekeepingStatus","housekeepingRemarks","supervisorRemarks","issueConstraint","actionRequired","workFrontAvailable","materialAvailable","drawingApprovalAvailable","delayCategory","siteLatitude","siteLongitude","siteGpsAccuracy","siteLocationCapturedAt"];}
function getStoredActivityDraft(){try{const raw=localStorage.getItem(ACTIVITY_DRAFT_KEY);return raw?JSON.parse(raw):null}catch(e){return null}}
function updateDashboardDraftBadge(){const badge=document.getElementById("draftNotificationBadge");if(!badge)return;const d=getStoredActivityDraft();const own=d&&loggedInUser&&String(d.userId||"")===String(loggedInUser.userId||"");badge.style.display=own?"flex":"none";}
function saveActivityDraft(showMessage){
  if(!loggedInUser)return;
  const data={savedAt:new Date().toISOString(),userId:loggedInUser.userId,values:{}};
  activityDraftFieldIds().forEach(id=>{const el=document.getElementById(id);if(el)data.values[id]=el.value;});
  localStorage.setItem(ACTIVITY_DRAFT_KEY,JSON.stringify(data));
  const status=document.getElementById("draftStatusText");if(status)status.innerText="Draft saved "+new Date(data.savedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  updateDashboardDraftBadge();
  if(showMessage){const m=document.getElementById("activityMessage");if(m){m.className="success-box";m.innerText="Draft saved on this device.";}}
}
function clearActivityDraft(showMessage){
  localStorage.removeItem(ACTIVITY_DRAFT_KEY);
  const notice=document.getElementById("draftRestoreNotice");if(notice)notice.style.display="none";
  const status=document.getElementById("draftStatusText");if(status)status.innerText="Auto-save ready";
  updateDashboardDraftBadge();
  if(showMessage){const m=document.getElementById("activityMessage");if(m){m.className="message";m.innerText="Saved draft cleared.";}}
}
function setupActivityDraftAutosave(){
  updateNetworkStatus();
  if(draftAutosaveBound)return;
  draftAutosaveBound=true;
  document.getElementById("activityPage").addEventListener("input",e=>{if(e.target.type!=="file"){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=setTimeout(()=>saveActivityDraft(false),700);}});
  document.getElementById("activityPage").addEventListener("change",e=>{if(e.target.type!=="file"){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=setTimeout(()=>saveActivityDraft(false),700);}});
}
async function restoreActivityDraft(){
  const draft=getStoredActivityDraft();if(!draft||!loggedInUser||String(draft.userId||"")!==String(loggedInUser.userId||""))return;
  const v=draft.values||{};
  if(v.project){document.getElementById("project").value=v.project;updateTowers();}
  if(v.tower){document.getElementById("tower").value=v.tower;updateFloors();}
  if(v.floor)document.getElementById("floor").value=v.floor;
  if(v.trade){document.getElementById("trade").value=v.trade;updateSubTrades();}
  if(v.subTrade){
    document.getElementById("subTrade").value=v.subTrade;
    await new Promise(resolve=>google.script.run.withSuccessHandler(list=>{resetSelect("activity","Select Activity");(list||[]).forEach(x=>addOption(document.getElementById("activity"),x));if(!(list||[]).length)addOption(document.getElementById("activity"),"Other / Not Listed");resolve();}).withFailureHandler(()=>resolve()).getActivitiesForSelection(v.trade,v.subTrade));
  }
  activityDraftFieldIds().forEach(id=>{if(["project","tower","floor","trade","subTrade","activity"].includes(id))return;const el=document.getElementById(id);if(el&&v[id]!==undefined)el.value=v[id];});
  if(v.activity)document.getElementById("activity").value=v.activity;
  updateProgressRequirements();updateInspectionRequirements();updatePhotoRequirements();updateGpsStatusFromFields();
  const notice=document.getElementById("draftRestoreNotice");if(notice)notice.style.display="flex";
  const status=document.getElementById("draftStatusText");if(status&&draft.savedAt)status.innerText="Restored draft from "+new Date(draft.savedAt).toLocaleString();
}
function copyLastActivity(){
  const m=document.getElementById("activityMessage");
  if(m){m.className="message";m.innerText="Loading your last submitted activity...";}
  google.script.run.withSuccessHandler(async rows=>{
    const r=(rows||[])[0];if(!r){if(m)m.innerText="No previous activity is available to copy.";return;}
    document.getElementById("project").value=r.project||"";updateTowers();
    document.getElementById("tower").value=r.tower||"";updateFloors();
    document.getElementById("floor").value=r.floor||"";
    document.getElementById("locationType").value=r.locationType||"";document.getElementById("apartment").value=r.apartment||"";document.getElementById("specificLocation").value=r.specificLocation||"";
    document.getElementById("trade").value=r.trade||"";updateSubTrades();document.getElementById("subTrade").value=r.subTrade||"";
    await new Promise(resolve=>google.script.run.withSuccessHandler(list=>{resetSelect("activity","Select Activity");(list||[]).forEach(x=>addOption(document.getElementById("activity"),x));if(!(list||[]).length)addOption(document.getElementById("activity"),"Other / Not Listed");resolve();}).withFailureHandler(()=>resolve()).getActivitiesForSelection(r.trade||"",r.subTrade||""));
    document.getElementById("activity").value=r.activity||"";document.getElementById("contractor").value=r.contractor||"";document.getElementById("quantity").value=r.quantity||"";document.getElementById("unit").value=r.unit||"";
    document.getElementById("startDate").value=isoDateFromReportDate(r.startDate);document.getElementById("plannedCompletionDate").value=isoDateFromReportDate(r.plannedCompletionDate);
    ["workStatus","actualCompletionDate","todayQuantity","cumulativeQuantity","inspectionRequired","inspectionStatus","inspectionDate","inspector","inspectionRemarks","housekeepingStatus","housekeepingRemarks","supervisorRemarks","issueConstraint","actionRequired","workFrontAvailable","materialAvailable","drawingApprovalAvailable","delayCategory"].forEach(id=>document.getElementById(id).value="");
    ["beforePhoto","progressPhotos","completionPhoto","inspectionPhoto"].forEach(id=>document.getElementById(id).value="");["beforePreview","progressPreview","completionPreview","inspectionPreview"].forEach(clearPreview);
    updateProgressRequirements();updateInspectionRequirements();updatePhotoRequirements();saveActivityDraft(false);
    if(m){m.className="success-box";m.innerText="Previous activity copied. Update Floor / Location and today's reporting details before submission.";}
    document.getElementById("sectionLocation").scrollIntoView({behavior:"smooth",block:"start"});
  }).withFailureHandler(e=>{if(m){m.className="message";m.innerText="Unable to copy previous activity: "+e.message;}}).getReportsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);
}
function captureSiteLocation(){
  const status=document.getElementById("gpsStatus"),btn=document.getElementById("captureGpsButton");
  if(!navigator.geolocation){status.innerText="GPS/location is not supported by this browser.";return;}
  btn.disabled=true;status.innerText="Capturing site location...";
  navigator.geolocation.getCurrentPosition(pos=>{
    const c=pos.coords;document.getElementById("siteLatitude").value=Number(c.latitude).toFixed(6);document.getElementById("siteLongitude").value=Number(c.longitude).toFixed(6);document.getElementById("siteGpsAccuracy").value=Math.round(c.accuracy||0);document.getElementById("siteLocationCapturedAt").value=new Date(pos.timestamp||Date.now()).toISOString();btn.disabled=false;updateGpsStatusFromFields();saveActivityDraft(false);
  },err=>{btn.disabled=false;status.innerText="Location not captured: "+(err.message||"permission denied / unavailable")+". You can submit without GPS.";},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}
function updateGpsStatusFromFields(){
  const lat=value("siteLatitude"),lng=value("siteLongitude"),acc=value("siteGpsAccuracy"),stamp=value("siteLocationCapturedAt"),status=document.getElementById("gpsStatus");if(!status)return;
  status.innerText=lat&&lng?"Captured: "+lat+", "+lng+(acc?" (±"+acc+" m)":"")+(stamp?" • "+new Date(stamp).toLocaleString():""):"Not captured. Submission time is recorded automatically.";
}
function openActivityForm(){
  hideAppPages();
  document.getElementById("activityPage").style.display="block";
  currentStep=0;
  if(document.getElementById("startDate")&&!document.getElementById("startDate").value)document.getElementById("startDate").value=localToday();
  updateStepDisplay();

  google.script.run
    .withSuccessHandler(function(d){
      masterData=d;
      loadMasterDropdowns();
      lockProjectSelectToActive_("project");
      updateTowers();
      setupActivityDraftAutosave();
      restoreActivityDraft();
      lockProjectSelectToActive_("project");
      updateTowers();
    })
    .withFailureHandler(function(e){
      alert("Unable to load Project / Tower / Floor master data: "+e.message);
      document.getElementById("activityMessage").innerText="Master data loading failed: "+e.message;
    })
    .getMasterData();
}
function loadMasterDropdowns(){
  resetSelect("project","Select Project");
  resetSelect("trade","Select Trade");
  resetSelect("unit","Select Unit");
  resetSelect("delayCategory","Select Category");
  resetSelect("activity","Select Activity");

  masterData.projects.forEach(i=>addOption(document.getElementById("project"),i["Project Name"]));
  [...new Set(masterData.trades.map(i=>i["Trade"]))].forEach(v=>addOption(document.getElementById("trade"),v));
  masterData.units.forEach(i=>addOption(document.getElementById("unit"),i["Unit"]));
  masterData.delayCategories.forEach(i=>addOption(document.getElementById("delayCategory"),i["Delay / Constraint Category"]));
}
function updateTowers(){let p=value("project");resetSelect("tower","Select Tower");resetSelect("floor","Select Floor");[...new Set(masterData.towers.filter(i=>i["Project"]===p).map(i=>i["Tower / Block"]))].forEach(v=>addOption(document.getElementById("tower"),v))}
function updateFloors(){let t=value("tower"),p=value("project");resetSelect("floor","Select Floor");[...new Set(masterData.floors.filter(i=>i["Tower / Block"]===t&&(!i["Project"]||i["Project"]===p)).map(i=>i["Floor"]))].forEach(v=>addOption(document.getElementById("floor"),v))}
function updateSubTrades(){
  let t=value("trade");
  resetSelect("subTrade","Select Sub-Trade");
  resetSelect("activity","Select Activity");
  [...new Set(masterData.trades.filter(i=>i["Trade"]===t).map(i=>i["Sub-Trade"]))].forEach(v=>addOption(document.getElementById("subTrade"),v));
}

function updateActivities(){
  const trade=value("trade");
  const subTrade=value("subTrade");
  resetSelect("activity","Loading Activities...");

  if(!trade||!subTrade){
    resetSelect("activity","Select Activity");
    return;
  }

  google.script.run
    .withSuccessHandler(function(list){
      resetSelect("activity","Select Activity");
      (list||[]).forEach(function(v){addOption(document.getElementById("activity"),v)});
      if(!(list||[]).length){
        addOption(document.getElementById("activity"),"Other / Not Listed");
      }
    })
    .withFailureHandler(function(e){
      resetSelect("activity","Select Activity");
      alert("Unable to load Activities: "+e.message);
    })
    .getActivitiesForSelection(trade,subTrade);
}
function localToday(){
  const n=new Date();
  return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
}

function setDisabled(id,disabled){
  const el=document.getElementById(id);
  if(!el)return;
  el.disabled=disabled;
  if(disabled)el.classList.remove("field-error");
}

function updateProgressRequirements(){
  const status=value("workStatus");
  const actual=document.getElementById("actualCompletionDate");
  if(status==="Completed"){
    actual.disabled=false;
    if(!actual.value)actual.value=localToday();
  }else{
    actual.value="";
    actual.disabled=true;
  }
  updatePhotoRequirements();
}

function updateInspectionRequirements(){
  const required=value("inspectionRequired");
  const status=document.getElementById("inspectionStatus");
  const date=document.getElementById("inspectionDate");
  const inspector=document.getElementById("inspector");
  const remarks=document.getElementById("inspectionRemarks");
  const note=document.getElementById("inspectionSmartNote");
  const ids=["inspectionStatus","inspectionDate","inspector","inspectionRemarks"];

  if(required==="No"){
    status.value="Not Requested"; date.value=""; inspector.value=""; remarks.value="";
    ids.forEach(id=>setDisabled(id,true));
    if(note)note.innerText="No inspection required — inspection detail fields are skipped.";
  }else if(required==="Yes"){
    ids.forEach(id=>setDisabled(id,false));
    if(!status.value||status.value==="Not Requested")status.value="Requested";
    if(!date.value)date.value=localToday();
    if(note)note.innerText="Inspection required — status, date, inspector and remarks must be completed.";
  }else{
    ids.forEach(id=>setDisabled(id,true));
    status.value=""; date.value=""; inspector.value=""; remarks.value="";
    if(note)note.innerText="Choose Yes or No to configure this step.";
  }
  updatePhotoRequirements();
}

function updatePhotoRequirements(){
  const ws=value("workStatus");
  const ir=value("inspectionRequired");
  const is=value("inspectionStatus");
  const progressReq=ws==="In Progress";
  const completionReq=ws==="Completed";
  const inspectionReq=ir==="Yes" && is!=="Not Requested";
  const a=document.getElementById("progressPhotoReq"),b=document.getElementById("completionPhotoReq"),c=document.getElementById("inspectionPhotoReq");
  if(a)a.innerText=progressReq?"*":"(optional)";
  if(b)b.innerText=completionReq?"*":"(optional)";
  if(c)c.innerText=inspectionReq?"*":"(optional)";
  const n=document.getElementById("photoSmartNote");
  if(n){
    let req=["Before Work"];
    if(progressReq)req.push("Progress");
    if(completionReq)req.push("Completion");
    if(inspectionReq)req.push("Inspection");
    n.innerText="Required for this report: "+req.join(" • ")+".";
  }
}

function clearFieldErrors(){
  document.querySelectorAll("#activityPage .field-error").forEach(el=>el.classList.remove("field-error"));
}

function markInvalid(el){
  if(!el)return; el.classList.add("field-error");
  try{el.scrollIntoView({behavior:"smooth",block:"center"})}catch(e){}
}

function updateStepDisplay(){
  updateProgressRequirements();
  updateInspectionRequirements();
  updatePhotoRequirements();
}
function validateActivityForm(){
  clearFieldErrors();

  const requiredIds=[
    "project","tower","floor","locationType","apartment","specificLocation",
    "trade","subTrade","activity","contractor","quantity","unit",
    "workStatus","startDate","plannedCompletionDate","todayQuantity","cumulativeQuantity",
    "inspectionRequired","housekeepingStatus","housekeepingRemarks",
    "supervisorRemarks","issueConstraint","actionRequired",
    "workFrontAvailable","materialAvailable","drawingApprovalAvailable","delayCategory"
  ];

  for(const id of requiredIds){
    const el=document.getElementById(id);
    if(el && !el.disabled && !String(el.value||"").trim()){
      markInvalid(el);
      el.scrollIntoView({behavior:"smooth",block:"center"});
      alert("Please complete all mandatory fields.");
      return false;
    }
  }

  const status=value("workStatus");
  const actual=value("actualCompletionDate");
  if(status==="Completed"&&!actual){
    const el=document.getElementById("actualCompletionDate");markInvalid(el);el.scrollIntoView({behavior:"smooth",block:"center"});
    alert("Actual Completion Date is required when Work Status is Completed.");
    return false;
  }
  if(actual){
    const selected=new Date(actual+"T00:00:00"),today=new Date();today.setHours(0,0,0,0);
    if(selected>today){
      const el=document.getElementById("actualCompletionDate");markInvalid(el);el.scrollIntoView({behavior:"smooth",block:"center"});
      alert("Actual Completion Date cannot be in the future.");
      return false;
    }
  }

  const tq=Number(value("todayQuantity")),cq=Number(value("cumulativeQuantity")),q=Number(value("quantity"));
  if(!isNaN(tq)&&!isNaN(cq)&&tq>cq){
    const el=document.getElementById("todayQuantity");markInvalid(el);el.scrollIntoView({behavior:"smooth",block:"center"});
    alert("Today's Quantity cannot be greater than Cumulative Quantity.");
    return false;
  }
  if(!isNaN(q)&&!isNaN(cq)&&q>0&&cq>q){
    const el=document.getElementById("cumulativeQuantity");markInvalid(el);el.scrollIntoView({behavior:"smooth",block:"center"});
    alert("Cumulative Quantity cannot be greater than the total Quantity.");
    return false;
  }

  if(value("inspectionRequired")==="Yes"){
    for(const id of ["inspectionStatus","inspectionDate","inspector","inspectionRemarks"]){
      if(!value(id)){
        const el=document.getElementById(id);markInvalid(el);el.scrollIntoView({behavior:"smooth",block:"center"});
        alert("Please complete the required inspection details.");
        return false;
      }
    }
  }

  const photoRules=[
    ["beforePhoto",true,"Before Work Photo is required."],
    ["progressPhotos",status==="In Progress","Progress Photo is required when Work Status is In Progress."],
    ["completionPhoto",status==="Completed","Completion Photo is required when Work Status is Completed."],
    ["inspectionPhoto",value("inspectionRequired")==="Yes"&&value("inspectionStatus")!=="Not Requested","Inspection Photo is required for the selected inspection status."]
  ];

  for(const [id,needed,msg] of photoRules){
    const el=document.getElementById(id);
    if(needed && el && !el.files.length){
      markInvalid(el);el.scrollIntoView({behavior:"smooth",block:"center"});
      alert(msg);
      return false;
    }
  }
  return true;
}

function validateCurrentStep(){return validateActivityForm()}
function nextStep(){return false}
function previousStep(){return false}
function collectFormData(){return {supervisorName:loggedInUser.supervisorName,userId:loggedInUser.userId,username:loggedInUser.username,project:value("project"),tower:value("tower"),floor:value("floor"),locationType:value("locationType"),apartment:value("apartment"),specificLocation:value("specificLocation"),trade:value("trade"),subTrade:value("subTrade"),activity:value("activity"),contractor:value("contractor"),quantity:value("quantity"),unit:value("unit"),workStatus:value("workStatus"),startDate:value("startDate"),plannedCompletionDate:value("plannedCompletionDate"),actualCompletionDate:value("actualCompletionDate"),todayQuantity:value("todayQuantity"),cumulativeQuantity:value("cumulativeQuantity"),inspectionRequired:value("inspectionRequired"),inspectionStatus:value("inspectionStatus"),inspectionDate:value("inspectionDate"),inspector:value("inspector"),inspectionRemarks:value("inspectionRemarks"),housekeepingStatus:value("housekeepingStatus"),housekeepingRemarks:value("housekeepingRemarks"),supervisorRemarks:value("supervisorRemarks"),issueConstraint:value("issueConstraint"),actionRequired:value("actionRequired"),workFrontAvailable:value("workFrontAvailable"),materialAvailable:value("materialAvailable"),drawingApprovalAvailable:value("drawingApprovalAvailable"),delayCategory:value("delayCategory"),siteLatitude:value("siteLatitude"),siteLongitude:value("siteLongitude"),siteGpsAccuracy:value("siteGpsAccuracy"),siteLocationCapturedAt:value("siteLocationCapturedAt"),beforePhoto:"",progressPhotos:"",completionPhoto:"",inspectionPhoto:""}}

function clearPreview(id){document.getElementById(id).innerHTML=""}
function previewSinglePhoto(input,previewId){clearPreview(previewId);if(!input.files||!input.files[0])return;let img=document.createElement("img");img.className="photo-preview";img.src=URL.createObjectURL(input.files[0]);document.getElementById(previewId).appendChild(img)}
function previewMultiplePhotos(input,previewId){clearPreview(previewId);Array.from(input.files||[]).forEach(f=>{let img=document.createElement("img");img.className="photo-preview";img.src=URL.createObjectURL(f);document.getElementById(previewId).appendChild(img)})}
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    if(!file)return reject(new Error("Required photo missing."));
    const r=new FileReader();
    r.onload=e=>resolve({base64:e.target.result.split(",")[1],mimeType:file.type,name:file.name});
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}
function compressImageFile(file,maxDimension=1600,quality=.78){
  return new Promise((resolve,reject)=>{
    if(!file)return reject(new Error("Required photo missing."));
    if(!String(file.type||"").startsWith("image/")){fileToBase64(file).then(resolve).catch(reject);return;}
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=function(){
      let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
      const scale=Math.min(1,maxDimension/Math.max(w,h)),cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
      const canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;
      canvas.getContext("2d").drawImage(img,0,0,cw,ch);
      canvas.toBlob(function(blob){
        URL.revokeObjectURL(url);
        if(!blob){fileToBase64(file).then(resolve).catch(reject);return;}
        const reader=new FileReader();
        reader.onload=e=>resolve({base64:e.target.result.split(",")[1],mimeType:"image/jpeg",name:(file.name.replace(/\.[^.]+$/,"")||"photo")+"_compressed.jpg"});
        reader.onerror=reject;
        reader.readAsDataURL(blob);
      },"image/jpeg",quality);
    };
    img.onerror=function(){URL.revokeObjectURL(url);fileToBase64(file).then(resolve).catch(reject);};
    img.src=url;
  });
}
async function collectPhotoData(){
  const progress=[];
  for(const f of Array.from(document.getElementById("progressPhotos").files||[]))progress.push(await compressImageFile(f));
  const opt=async id=>{const f=document.getElementById(id).files[0];return f?await compressImageFile(f):null;};
  return {beforePhoto:await opt("beforePhoto"),progressPhotos:progress,completionPhoto:await opt("completionPhoto"),inspectionPhoto:await opt("inspectionPhoto")};
}

function buildReview(){let d=collectFormData(),r=document.getElementById("reviewContainer");r.innerHTML="";["project","tower","floor","trade","subTrade","activity","contractor","quantity","unit","workStatus","inspector","inspectionStatus","housekeepingStatus","delayCategory"].forEach(k=>{let x=document.createElement("div");x.className="review-row";x.textContent=k+": "+d[k];r.appendChild(x)})}
async function submitActivity(){if(!validateActivityForm())return;let m=document.getElementById("activityMessage"),b=document.getElementById("submitButton");b.disabled=true;m.className="message";m.innerText="Uploading photos and submitting activity... Please wait.";try{let payload={formData:collectFormData(),photos:await collectPhotoData()};google.script.run.withSuccessHandler(r=>{m.className="success-box";m.innerHTML="Activity submitted successfully.<br>Activity ID: <b>"+r.activityId+"</b>"+(r.activityFolderUrl?'<br><a href="'+r.activityFolderUrl+'" target="_blank">Open Activity Photo Folder</a>':'');clearActivityDraft(false);b.disabled=false}).withFailureHandler(e=>{m.className="message";m.innerText="Submission failed: "+e.message;b.disabled=false}).saveActivityWithPhotos(payload)}catch(e){m.className="message";m.innerText=e.message;b.disabled=false}}

function escapeHtml(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]})}
function uniqueValues(arr,key){return [...new Set(arr.map(x=>String(x[key]||"").trim()).filter(Boolean))].sort()}
function fillReportFilter(id,values,label){let s=document.getElementById(id),current=s.value;s.innerHTML='<option value="">'+label+'</option>';values.forEach(v=>addOption(s,v));if(values.includes(current))s.value=current}
function openMyReports(){
  hideAppPages();
  document.getElementById("myReportsPage").style.display="block";
  document.getElementById("reportsContainer").className="reports-loading";
  document.getElementById("reportsContainer").innerText="Loading reports...";

  google.script.run
    .withSuccessHandler(function(rows){
      myReportsData=scopeRowsToActiveProject_(rows||[]);
      fillReportFilter("reportProject",uniqueValues(myReportsData,"project"),"Project");
      lockProjectSelectToActive_("reportProject");
      fillReportFilter("reportTower",uniqueValues(myReportsData,"tower"),"All Towers");
      fillReportFilter("reportFloor",uniqueValues(myReportsData,"floor"),"All Floors");
      applyReportFilters();
    })
    .withFailureHandler(function(e){
      document.getElementById("reportsContainer").className="empty-state";
      document.getElementById("reportsContainer").innerText="Unable to load reports: "+e.message;
    })
    .getReportsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);
}
function applyReportFilters(){
  const q=(document.getElementById("reportSearch").value||"").toLowerCase().trim();
  const p=document.getElementById("reportProject").value;
  const t=document.getElementById("reportTower").value;
  const f=document.getElementById("reportFloor").value;
  const s=document.getElementById("reportStatus").value;
  const from=document.getElementById("reportFromDate").value;
  const to=document.getElementById("reportToDate").value;
  const fromDate=from?new Date(from+"T00:00:00"):null;
  const toDate=to?new Date(to+"T23:59:59"):null;
  const rows=myReportsData.filter(r=>{
    const txt=[r.activityId,r.activity,r.contractor,r.trade,r.subTrade,r.supervisorName].join(" ").toLowerCase();
    const rd=parseReportDate(r.timestamp);
    return (!q||txt.includes(q))&&(!p||r.project===p)&&(!t||r.tower===t)&&(!f||r.floor===f)&&(!s||r.workStatus===s)&&(!fromDate||!rd||rd>=fromDate)&&(!toDate||!rd||rd<=toDate);
  });
  document.getElementById("reportCount").innerText=rows.length+" Report"+(rows.length===1?"":"s");
  renderReports(rows);
}

function workStatusClass(status){
  const s=String(status||"").trim().toLowerCase();
  if(s==="completed")return "status-completed";
  if(s==="in progress")return "status-progress";
  if(s==="hold")return "status-hold";
  return "status-not-started";
}
function inspectionClass(status){
  return String(status||"").trim().toLowerCase().replace(/\s+/g,"-");
}
function renderReports(rows){
  const c=document.getElementById("reportsContainer");
  if(!rows.length){c.className="empty-state";c.innerHTML="No reports found for the selected filters.";return}
  c.className="table-wrap";
  let h='<table class="reports-table"><thead><tr><th>Activity ID</th><th>Date</th><th>Project</th><th>Tower</th><th>Floor</th><th>Activity</th><th>Contractor</th><th>Status</th><th>Inspection</th><th></th></tr></thead><tbody>';
  rows.forEach(r=>{
    h+='<tr><td><b>'+escapeHtml(r.activityId)+'</b></td><td>'+escapeHtml(r.timestamp)+'</td><td>'+escapeHtml(r.project)+'</td><td>'+escapeHtml(r.tower)+'</td><td>'+escapeHtml(r.floor)+'</td><td>'+escapeHtml(r.activity)+'</td><td>'+escapeHtml(r.contractor)+'</td><td><span class="status-badge '+workStatusClass(r.workStatus)+'">'+escapeHtml(r.workStatus)+'</span></td><td><span class="inspection-badge '+inspectionClass(r.inspectionStatus)+'">'+escapeHtml(r.inspectionStatus||"-")+'</span></td><td><button class="view-btn" onclick="viewReportDetail(\''+escapeHtml(r.activityId)+'\')">View</button></td></tr>';
  });
  h+='</tbody></table><div class="report-mobile-list">';
  rows.forEach(r=>{
    h+='<div class="report-mobile-card"><div class="report-mobile-top"><div><div class="report-mobile-id">'+escapeHtml(r.activityId)+'</div><div class="report-mobile-date">'+escapeHtml(r.timestamp)+'</div></div><span class="status-badge '+workStatusClass(r.workStatus)+'">'+escapeHtml(r.workStatus)+'</span></div><div class="report-mobile-path">'+escapeHtml([r.project,r.tower,r.floor].filter(Boolean).join(" • "))+'</div><div class="report-mobile-activity">'+escapeHtml(r.activity)+'</div><div class="report-mobile-meta">'+escapeHtml(r.trade||"")+(r.contractor?' • '+escapeHtml(r.contractor):'')+'</div><div class="report-mobile-badges"><span class="inspection-badge '+inspectionClass(r.inspectionStatus)+'">'+escapeHtml(r.inspectionStatus||"-")+'</span></div><div class="report-mobile-actions"><button class="view-btn" onclick="viewReportDetail(\''+escapeHtml(r.activityId)+'\')">View Details</button></div></div>';
  });
  h+='</div>';
  c.innerHTML=h;
}
function detailItem(label,value){return '<div class="detail-item"><strong>'+escapeHtml(label)+'</strong><div>'+escapeHtml(value||"-")+'</div></div>'}
function longDetail(label,value){return '<div class="long-text"><strong style="display:block;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">'+escapeHtml(label)+'</strong>'+escapeHtml(value||"-")+'</div>'}
function photoLink(url,label){return url?'<a class="photo-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener">'+escapeHtml(label)+'</a>':''}
function detailSection(title,content){return '<section class="detail-section"><div class="detail-section-title">'+escapeHtml(title)+'</div><div class="detail-section-body">'+content+'</div></section>'}
function photoCategory(title,links){return '<div class="photo-category"><div class="photo-category-title">'+escapeHtml(title)+'</div><div class="photo-links">'+(links||'<span style="color:#6b7280">No photo available</span>')+'</div></div>'}

function viewReportDetail(id){
  let r=myReportsData.find(x=>x.activityId===id);
  if(!r)return;
  currentReportActivityId=id;

  const canEdit=hasFullAccess() || (loggedInUser && String(r.userId||"")===String(loggedInUser.userId||""));
  const editBtn=document.getElementById("detailEditButton");
  const editFooterBtn=document.getElementById("detailEditFooterButton");
  if(editBtn)editBtn.style.display=canEdit?"inline-block":"none";
  if(editFooterBtn)editFooterBtn.style.display=canEdit?"inline-block":"none";

  document.getElementById("detailTitle").innerText=r.activityId;
  document.getElementById("detailSubtitle").innerText=r.timestamp+" • "+r.project+" • "+r.tower+" • "+r.floor;

  let h="";

  h+=detailSection("📍 Location & Activity",
    '<div class="detail-grid">'+
      detailItem("Project",r.project)+
      detailItem("Tower / Block",r.tower)+
      detailItem("Floor",r.floor)+
      detailItem("Location Type",r.locationType)+
      detailItem("Apartment / Room",r.apartment)+
      detailItem("Specific Location",r.specificLocation)+
      detailItem("Trade",r.trade)+
      detailItem("Sub-Trade",r.subTrade)+
      detailItem("Activity",r.activity)+
      detailItem("Contractor",r.contractor)+
      detailItem("Supervisor",r.supervisorName)+
      detailItem("Submitted",r.timestamp)+
    '</div>'
  );

  h+=detailSection("📈 Progress",
    '<div class="detail-grid">'+
      detailItem("Quantity",String(r.quantity||"-")+(r.unit?" "+r.unit:""))+
      detailItem("Today's Quantity",r.todayQuantity)+
      detailItem("Cumulative Quantity",r.cumulativeQuantity)+
      detailItem("Work Status",r.workStatus)+
      detailItem("Start Date",r.startDate)+
      detailItem("Planned Completion",r.plannedCompletionDate)+
      detailItem("Actual Completion",r.actualCompletionDate)+
    '</div>'
  );

  h+=detailSection("🔍 Inspection & Housekeeping",
    '<div class="detail-grid">'+
      detailItem("Inspection Required",r.inspectionRequired)+
      detailItem("Inspection Status",r.inspectionStatus)+
      detailItem("Inspection Date",r.inspectionDate)+
      detailItem("Inspector / Engineer",r.inspector)+
      detailItem("Housekeeping Status",r.housekeepingStatus)+
    '</div>'+
    longDetail("Inspection Remarks",r.inspectionRemarks)+
    longDetail("Housekeeping Remarks",r.housekeepingRemarks)
  );

  h+=detailSection("⚠️ Constraints & Required Actions",
    '<div class="detail-grid">'+
      detailItem("Work Front Available",r.workFrontAvailable)+
      detailItem("Material Available",r.materialAvailable)+
      detailItem("Drawing / Approval Available",r.drawingApprovalAvailable)+
      detailItem("Delay / Constraint Category",r.delayCategory)+
    '</div>'+
    longDetail("Supervisor Remarks",r.supervisorRemarks)+
    longDetail("Issue / Constraint",r.issueConstraint)+
    longDetail("Action Required",r.actionRequired)
  );

  const beforeLinks=photoLink(r.beforePhoto,"Open Before Photo");
  const progressLinks=(r.progressPhotos||[]).map((u,i)=>photoLink(u,"Open Progress Photo "+(i+1))).join("");
  const completionLinks=photoLink(r.completionPhoto,"Open Completion Photo");
  const inspectionLinks=photoLink(r.inspectionPhoto,"Open Inspection Photo");

  h+=detailSection("📷 Photo Evidence",
    photoCategory("Before Work",beforeLinks)+
    photoCategory("Progress / During Work",progressLinks)+
    photoCategory("Completion",completionLinks)+
    photoCategory("Inspection",inspectionLinks)
  );

  if(r.lastEditedAt||r.lastEditedBy||r.lastEditReason){
    h+=detailSection("📝 Correction Audit",
      '<div class="detail-grid">'+
        detailItem("Last Edited At",r.lastEditedAt||"-")+
        detailItem("Last Edited By",r.lastEditedBy||"-")+
      '</div>'+
      longDetail("Correction Reason",r.lastEditReason||"-")
    );
  }

  document.getElementById("detailContent").innerHTML=h;
  document.getElementById("reportDetailModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeReportDetail(e){
  if(e&&e.target!==document.getElementById("reportDetailModal"))return;
  document.getElementById("reportDetailModal").style.display="none";
  document.body.style.overflow="";
}

function printCurrentReport(){window.print()}


function isoDateFromReportDate(s){
  if(!s)return "";
  const d=parseReportDate(s);
  if(!d||isNaN(d.getTime()))return "";
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
}

function openReportEditModal(){
  const r=myReportsData.find(x=>x.activityId===currentReportActivityId);
  if(!r)return;

  const canEdit=hasFullAccess() || (loggedInUser && String(r.userId||"")===String(loggedInUser.userId||""));
  if(!canEdit){
    alert("You do not have permission to edit this report.");
    return;
  }

  document.getElementById("reportEditId").innerText=r.activityId+" • "+[r.project,r.tower,r.floor,r.activity].filter(Boolean).join(" • ");
  document.getElementById("editContractor").value=r.contractor||"";
  document.getElementById("editWorkStatus").value=r.workStatus||"";
  document.getElementById("editStartDate").value=isoDateFromReportDate(r.startDate);
  document.getElementById("editPlannedCompletionDate").value=isoDateFromReportDate(r.plannedCompletionDate);
  document.getElementById("editActualCompletionDate").value=isoDateFromReportDate(r.actualCompletionDate);
  document.getElementById("editTodayQuantity").value=r.todayQuantity||"";
  document.getElementById("editCumulativeQuantity").value=r.cumulativeQuantity||"";
  document.getElementById("editHousekeepingStatus").value=r.housekeepingStatus||"";
  document.getElementById("editHousekeepingRemarks").value=r.housekeepingRemarks||"";
  document.getElementById("editSupervisorRemarks").value=r.supervisorRemarks||"";
  document.getElementById("editIssueConstraint").value=r.issueConstraint||"";
  document.getElementById("editActionRequired").value=r.actionRequired||"";
  document.getElementById("editWorkFrontAvailable").value=r.workFrontAvailable||"";
  document.getElementById("editMaterialAvailable").value=r.materialAvailable||"";
  document.getElementById("editDrawingApprovalAvailable").value=r.drawingApprovalAvailable||"";

  const dc=document.getElementById("editDelayCategory");
  dc.innerHTML='<option value="">Select Category</option>';
  const cats=(masterData&&masterData.delayCategories)||[];
  cats.forEach(x=>addOption(dc,x["Delay / Constraint Category"]));
  if(r.delayCategory && !Array.from(dc.options).some(o=>o.value===r.delayCategory))addOption(dc,r.delayCategory);
  dc.value=r.delayCategory||"";

  document.getElementById("editReason").value="";
  document.getElementById("reportEditMessage").innerText="";
  updateEditCompletionRequirement();
  document.getElementById("reportEditModal").style.display="block";
  document.body.style.overflow="hidden";
}

function updateEditCompletionRequirement(){
  const completed=document.getElementById("editWorkStatus").value==="Completed";
  const actual=document.getElementById("editActualCompletionDate");
  actual.disabled=!completed;
  if(!completed)actual.value="";
  document.getElementById("editActualReq").innerText=completed?"*":"(only when Completed)";
}

function closeReportEditModal(e){
  if(e&&e.target!==document.getElementById("reportEditModal"))return;
  document.getElementById("reportEditModal").style.display="none";
  document.body.style.overflow="";
}

function saveReportCorrection(){
  const msg=document.getElementById("reportEditMessage");
  const btn=document.getElementById("saveReportEditButton");

  const payload={
    activityId:currentReportActivityId,
    contractor:value("editContractor"),
    workStatus:value("editWorkStatus"),
    startDate:value("editStartDate"),
    plannedCompletionDate:value("editPlannedCompletionDate"),
    actualCompletionDate:value("editActualCompletionDate"),
    todayQuantity:value("editTodayQuantity"),
    cumulativeQuantity:value("editCumulativeQuantity"),
    housekeepingStatus:value("editHousekeepingStatus"),
    housekeepingRemarks:value("editHousekeepingRemarks"),
    supervisorRemarks:value("editSupervisorRemarks"),
    issueConstraint:value("editIssueConstraint"),
    actionRequired:value("editActionRequired"),
    workFrontAvailable:value("editWorkFrontAvailable"),
    materialAvailable:value("editMaterialAvailable"),
    drawingApprovalAvailable:value("editDrawingApprovalAvailable"),
    delayCategory:value("editDelayCategory"),
    editReason:value("editReason")
  };

  const required=["activityId","contractor","workStatus","startDate","plannedCompletionDate","todayQuantity","cumulativeQuantity","housekeepingStatus","housekeepingRemarks","supervisorRemarks","issueConstraint","actionRequired","workFrontAvailable","materialAvailable","drawingApprovalAvailable","delayCategory","editReason"];
  for(const k of required){
    if(!String(payload[k]||"").trim()){
      msg.style.color="#dc2626";
      msg.innerText="Please complete all mandatory correction fields.";
      return;
    }
  }

  if(payload.workStatus==="Completed"&&!payload.actualCompletionDate){
    msg.style.color="#dc2626";
    msg.innerText="Actual Completion Date is required when Work Status is Completed.";
    return;
  }

  const tq=Number(payload.todayQuantity),cq=Number(payload.cumulativeQuantity);
  if(!isNaN(tq)&&!isNaN(cq)&&tq>cq){
    msg.style.color="#dc2626";
    msg.innerText="Today's Quantity cannot be greater than Cumulative Quantity.";
    return;
  }

  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText="Saving correction...";

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;
      msg.style.color="#16a34a";
      msg.innerText=r.message||"Report corrected successfully.";

      google.script.run
        .withSuccessHandler(function(rows){
          myReportsData=rows||[];
          closeReportEditModal();
          applyReportFilters();
          viewReportDetail(currentReportActivityId);
        })
        .getReportsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);
    })
    .withFailureHandler(function(e){
      btn.disabled=false;
      msg.style.color="#dc2626";
      msg.innerText=e.message;
    })
    .updateActivityReport(payload);
}


let pendingInspectionData=[];
let inspectionHistoryData=[];
let inspectionHistoryLoaded=false;
let currentInspectionActivityId="";

function openPendingInspections(){
  hideAppPages();
  document.getElementById("pendingInspectionsPage").style.display="block";
  showInspectionTab("pending");
  loadPendingInspectionQueue();
}

function loadPendingInspectionQueue(){
  const c=document.getElementById("pendingInspectionsContainer");
  c.className="reports-loading";
  c.innerText="Loading pending inspections...";

  google.script.run
    .withSuccessHandler(function(rows){
      pendingInspectionData=scopeRowsToActiveProject_(rows||[]);
      fillReportFilter("inspectionProjectFilter",uniqueValues(pendingInspectionData,"project"),"Project");
      lockProjectSelectToActive_("inspectionProjectFilter");
      updateInspectionDependentFilters();
      applyInspectionFilters();
      document.getElementById("pendingTabCount").innerText=pendingInspectionData.length;
    })
    .withFailureHandler(function(e){
      c.className="empty-state";
      c.innerText="Unable to load pending inspections: "+e.message;
    })
    .getPendingInspectionsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);
}

function showInspectionTab(tab){
  document.getElementById("inspectionPendingSection").classList.toggle("active",tab==="pending");
  document.getElementById("inspectionHistorySection").classList.toggle("active",tab==="history");
  document.getElementById("inspectionPendingTab").classList.toggle("active",tab==="pending");
  document.getElementById("inspectionHistoryTab").classList.toggle("active",tab==="history");
  if(tab==="history"&&!inspectionHistoryLoaded)loadInspectionHistory();
}

function refreshInspectionWorkflow(){
  loadPendingInspectionQueue();
  if(inspectionHistoryLoaded)loadInspectionHistory();
}

function updateInspectionDependentFilters(){
  const p=document.getElementById("inspectionProjectFilter").value;
  const rows=p?pendingInspectionData.filter(r=>r.project===p):pendingInspectionData;
  fillReportFilter("inspectionTowerFilter",uniqueValues(rows,"tower"),"All Towers");
  updateInspectionFloorFilter();
}

function updateInspectionFloorFilter(){
  const p=document.getElementById("inspectionProjectFilter").value;
  const t=document.getElementById("inspectionTowerFilter").value;
  let rows=pendingInspectionData;
  if(p)rows=rows.filter(r=>r.project===p);
  if(t)rows=rows.filter(r=>r.tower===t);
  fillReportFilter("inspectionFloorFilter",uniqueValues(rows,"floor"),"All Floors");
}

function resetInspectionFilters(){
  ["inspectionSearch","inspectionProjectFilter","inspectionTowerFilter","inspectionFloorFilter","inspectionWorkStatusFilter"].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value="";
  });
  updateInspectionDependentFilters();
  applyInspectionFilters();
}

function applyInspectionFilters(){
  const q=(document.getElementById("inspectionSearch").value||"").toLowerCase().trim();
  const p=document.getElementById("inspectionProjectFilter").value;
  const t=document.getElementById("inspectionTowerFilter").value;
  const f=document.getElementById("inspectionFloorFilter").value;
  const ws=document.getElementById("inspectionWorkStatusFilter").value;

  const rows=pendingInspectionData.filter(r=>{
    const text=[r.activityId,r.activity,r.contractor,r.trade,r.subTrade,r.supervisorName].join(" ").toLowerCase();
    return (!q||text.includes(q))&&(!p||r.project===p)&&(!t||r.tower===t)&&(!f||r.floor===f)&&(!ws||r.workStatus===ws);
  });

  document.getElementById("pendingInspectionCount").innerText=rows.length+" Pending";
  document.getElementById("pendingTabCount").innerText=pendingInspectionData.length;
  renderPendingInspections(rows);
}

function renderPendingInspections(rows){
  const c=document.getElementById("pendingInspectionsContainer");
  if(!rows.length){
    c.className="empty-state";
    c.innerHTML="No pending inspections found.";
    return;
  }

  c.className="pending-table-wrap";
  let h='<table class="pending-table"><thead><tr><th>Activity ID</th><th>Date</th><th>Project</th><th>Tower</th><th>Floor</th><th>Activity</th><th>Contractor</th><th>Supervisor</th><th>Work Status</th><th></th></tr></thead><tbody>';

  rows.forEach(r=>{
    h+='<tr>'+
      '<td><b>'+escapeHtml(r.activityId)+'</b></td>'+
      '<td>'+escapeHtml(r.timestamp)+'</td>'+
      '<td>'+escapeHtml(r.project)+'</td>'+
      '<td>'+escapeHtml(r.tower)+'</td>'+
      '<td>'+escapeHtml(r.floor)+'</td>'+
      '<td>'+escapeHtml(r.activity)+'</td>'+
      '<td>'+escapeHtml(r.contractor)+'</td>'+
      '<td>'+escapeHtml(r.supervisorName)+'</td>'+
      '<td><span class="status-badge '+workStatusClass(r.workStatus)+'">'+escapeHtml(r.workStatus)+'</span></td>'+
      '<td><button class="inspect-btn" onclick="openInspectionDecision(\''+escapeHtml(r.activityId)+'\')">Inspect</button></td>'+
      '</tr>';
  });
  h+='</tbody></table><div class="inspection-mobile-list">';

  rows.forEach(r=>{
    h+='<div class="inspection-mobile-card">'+
      '<div class="inspection-mobile-top"><div><div class="inspection-mobile-id">'+escapeHtml(r.activityId)+'</div><div class="inspection-mobile-date">'+escapeHtml(r.timestamp)+'</div></div><span class="pending-badge">Requested</span></div>'+
      '<div class="inspection-mobile-path">'+escapeHtml([r.project,r.tower,r.floor].filter(Boolean).join(" • "))+'</div>'+
      '<div class="inspection-mobile-activity">'+escapeHtml(r.activity)+'</div>'+
      '<div class="inspection-mobile-meta">'+escapeHtml(r.contractor||"-")+' • '+escapeHtml(r.supervisorName||"-")+'</div>'+
      '<div class="inspection-mobile-actions"><button class="inspect-btn" onclick="openInspectionDecision(\''+escapeHtml(r.activityId)+'\')">Inspect</button></div>'+
      '</div>';
  });

  h+='</div>';
  c.innerHTML=h;
}

function inspectionInfoItem(label,val){
  return '<div class="inspect-info-item"><strong>'+escapeHtml(label)+'</strong>'+escapeHtml(val||"-")+'</div>';
}

function openInspectionDecision(id){
  const r=pendingInspectionData.find(x=>x.activityId===id);
  if(!r)return;
  currentInspectionActivityId=id;
  document.getElementById("inspectionDecisionTitle").innerText=id;
  document.getElementById("inspectionDecisionPath").innerText=r.project+" • "+r.tower+" • "+r.floor+" • "+r.activity;

  let info='<div class="inspect-info">'+
    inspectionInfoItem("Project",r.project)+
    inspectionInfoItem("Tower / Block",r.tower)+
    inspectionInfoItem("Floor",r.floor)+
    inspectionInfoItem("Activity",r.activity)+
    inspectionInfoItem("Trade / Sub-Trade",(r.trade||"")+" / "+(r.subTrade||""))+
    inspectionInfoItem("Contractor",r.contractor)+
    inspectionInfoItem("Work Status",r.workStatus)+
    inspectionInfoItem("Supervisor",r.supervisorName)+
    inspectionInfoItem("Requested Inspector",r.inspector)+
    inspectionInfoItem("Current Remarks",r.inspectionRemarks)+
    inspectionInfoItem("Quantity",String(r.quantity||"-")+(r.unit?" "+r.unit:""))+
    inspectionInfoItem("Specific Location",r.specificLocation)+
    '</div>';

  let photoLinks='<div class="inspect-photo-links">';
  if(r.beforePhoto)photoLinks+='<a href="'+escapeHtml(r.beforePhoto)+'" target="_blank">Before Photo</a>';
  (r.progressPhotos||[]).forEach((u,i)=>{photoLinks+='<a href="'+escapeHtml(u)+'" target="_blank">Progress '+(i+1)+'</a>'});
  if(r.completionPhoto)photoLinks+='<a href="'+escapeHtml(r.completionPhoto)+'" target="_blank">Completion Photo</a>';
  if(r.inspectionPhoto)photoLinks+='<a href="'+escapeHtml(r.inspectionPhoto)+'" target="_blank">Inspection Photo</a>';
  photoLinks+='</div>';

  document.getElementById("inspectionDecisionInfo").innerHTML=info+'<div style="font-weight:800;margin:6px 0">📷 Photo Evidence</div>'+photoLinks;

  document.getElementById("inspectionDecisionStatus").value="";
  document.getElementById("inspectionDecisionInspector").value=(loggedInUser&&loggedInUser.supervisorName)||"";
  document.getElementById("inspectionDecisionRemarks").value="";
  document.getElementById("inspectionDecisionMessage").innerText="";
  document.getElementById("inspectionDecisionDate").value=new Date().toISOString().slice(0,10);

  document.getElementById("inspectionDecisionModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeInspectionDecision(e){
  if(e&&e.target!==document.getElementById("inspectionDecisionModal"))return;
  document.getElementById("inspectionDecisionModal").style.display="none";
  document.body.style.overflow="";
  currentInspectionActivityId="";
}

function saveInspectionDecision(){
  const status=value("inspectionDecisionStatus");
  const date=value("inspectionDecisionDate");
  const inspector=value("inspectionDecisionInspector");
  const remarks=value("inspectionDecisionRemarks");
  const msg=document.getElementById("inspectionDecisionMessage");
  const btn=document.getElementById("inspectionSaveButton");

  if(!currentInspectionActivityId||!status||!date||!inspector||!remarks){
    msg.style.color="#dc2626";
    msg.innerText="Please complete Decision, Inspection Date, Inspector and Remarks.";
    return;
  }

  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText="Saving inspection decision...";

  google.script.run
    .withSuccessHandler(function(r){
      msg.style.color="#16a34a";
      msg.innerText="Inspection updated successfully: "+r.status;
      btn.disabled=false;
      pendingInspectionData=pendingInspectionData.filter(x=>x.activityId!==currentInspectionActivityId);
      inspectionHistoryLoaded=false;
      applyInspectionFilters();
      setTimeout(closeInspectionDecision,700);
    })
    .withFailureHandler(function(e){
      msg.style.color="#dc2626";
      msg.innerText="Unable to save: "+e.message;
      btn.disabled=false;
    })
    .updateInspectionDecision({
      activityId:currentInspectionActivityId,
      inspectionStatus:status,
      inspectionDate:date,
      inspector:inspector,
      inspectionRemarks:remarks,
      updatedByUserId:loggedInUser&&loggedInUser.userId||"",
      updatedByUsername:loggedInUser&&loggedInUser.username||""
    });
}



function loadInspectionHistory(){
  const c=document.getElementById("inspectionHistoryContainer");
  c.className="reports-loading";
  c.innerText="Loading inspection history...";

  google.script.run
    .withSuccessHandler(function(rows){
      inspectionHistoryData=(rows||[]).filter(r=>{
        const s=String(r.inspectionStatus||"").trim();
        return ["Approved","Rejected","Rectification Required"].includes(s);
      });
      inspectionHistoryLoaded=true;
      fillReportFilter("inspectionHistoryProject",uniqueValues(inspectionHistoryData,"project"),"All Projects");
      document.getElementById("historyTabCount").innerText=inspectionHistoryData.length;
      applyInspectionHistoryFilters();
    })
    .withFailureHandler(function(e){
      c.className="empty-state";
      c.innerText="Unable to load inspection history: "+e.message;
    })
    .getReportsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);
}

function applyInspectionHistoryFilters(){
  const q=(document.getElementById("inspectionHistorySearch").value||"").toLowerCase().trim();
  const s=document.getElementById("inspectionHistoryStatus").value;
  const p=document.getElementById("inspectionHistoryProject").value;
  const from=document.getElementById("inspectionHistoryFrom").value;
  const to=document.getElementById("inspectionHistoryTo").value;
  const fromDate=from?new Date(from+"T00:00:00"):null;
  const toDate=to?new Date(to+"T23:59:59"):null;

  const rows=inspectionHistoryData.filter(r=>{
    const txt=[r.activityId,r.activity,r.contractor,r.trade,r.supervisorName,r.inspector,r.inspectionRemarks].join(" ").toLowerCase();
    const rd=parseReportDate(r.inspectionDate||r.timestamp);
    return (!q||txt.includes(q))&&(!s||r.inspectionStatus===s)&&(!p||r.project===p)&&(!fromDate||!rd||rd>=fromDate)&&(!toDate||!rd||rd<=toDate);
  });

  document.getElementById("inspectionHistoryCount").innerText=rows.length+" Decision"+(rows.length===1?"":"s");
  renderInspectionHistory(rows);
}

function resetInspectionHistoryFilters(){
  ["inspectionHistorySearch","inspectionHistoryStatus","inspectionHistoryProject","inspectionHistoryFrom","inspectionHistoryTo"].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value="";
  });
  applyInspectionHistoryFilters();
}

function renderInspectionHistory(rows){
  const c=document.getElementById("inspectionHistoryContainer");
  if(!rows.length){
    c.className="empty-state";
    c.innerHTML="No inspection decisions found for the selected filters.";
    return;
  }

  c.className="pending-table-wrap";
  let h='<table class="inspection-history-table"><thead><tr><th>Activity ID</th><th>Inspection Date</th><th>Project / Location</th><th>Activity</th><th>Decision</th><th>Inspector</th><th>Remarks</th><th></th></tr></thead><tbody>';

  rows.forEach(r=>{
    h+='<tr>'+
      '<td><b>'+escapeHtml(r.activityId)+'</b></td>'+
      '<td>'+escapeHtml(r.inspectionDate||"-")+'</td>'+
      '<td>'+escapeHtml([r.project,r.tower,r.floor].filter(Boolean).join(" / "))+'</td>'+
      '<td>'+escapeHtml(r.activity)+'</td>'+
      '<td><span class="inspection-decision-badge '+inspectionClass(r.inspectionStatus)+'">'+escapeHtml(r.inspectionStatus)+'</span></td>'+
      '<td>'+escapeHtml(r.inspector||"-")+'</td>'+
      '<td>'+escapeHtml(r.inspectionRemarks||"-")+'</td>'+
      '<td><button class="view-btn" onclick="openInspectionHistoryReport(\''+escapeHtml(r.activityId)+'\')">View</button></td>'+
      '</tr>';
  });

  h+='</tbody></table><div class="inspection-mobile-list">';
  rows.forEach(r=>{
    h+='<div class="inspection-mobile-card">'+
      '<div class="inspection-mobile-top"><div><div class="inspection-mobile-id">'+escapeHtml(r.activityId)+'</div><div class="inspection-mobile-date">'+escapeHtml(r.inspectionDate||r.timestamp)+'</div></div><span class="inspection-decision-badge '+inspectionClass(r.inspectionStatus)+'">'+escapeHtml(r.inspectionStatus)+'</span></div>'+
      '<div class="inspection-mobile-path">'+escapeHtml([r.project,r.tower,r.floor].filter(Boolean).join(" • "))+'</div>'+
      '<div class="inspection-mobile-activity">'+escapeHtml(r.activity)+'</div>'+
      '<div class="inspection-mobile-meta">Inspector: '+escapeHtml(r.inspector||"-")+'</div>'+
      '<div class="inspection-mobile-actions"><button class="view-btn" onclick="openInspectionHistoryReport(\''+escapeHtml(r.activityId)+'\')">View Details</button></div>'+
      '</div>';
  });
  h+='</div>';
  c.innerHTML=h;
}

function openInspectionHistoryReport(id){
  myReportsData=inspectionHistoryData.slice();
  viewReportDetail(id);
}


let dailySummaryCache=[];

function openDailySummary(){
  hideAppPages();
  document.getElementById("dailySummaryPage").style.display="block";

  if(!document.getElementById("summaryDate").value){
    document.getElementById("summaryDate").value=new Date().toISOString().slice(0,10);
  }
  loadDailySummary();
}

function loadDailySummary(){
  const d=document.getElementById("summaryDate").value;
  google.script.run
    .withSuccessHandler(function(rows){
      dailySummaryCache=scopeRowsToActiveProject_(rows||[]);
      fillReportFilter("summaryProject", uniqueValues(dailySummaryCache,"project"), "Project");
      lockProjectSelectToActive_("summaryProject");
      fillReportFilter("summaryTrade", uniqueValues(dailySummaryCache,"trade"), "All Trades");
      updateSummaryDependentFilters();
      renderDailySummaryFromCache();
    })
    .withFailureHandler(function(e){
      document.getElementById("summaryRecent").innerHTML='<div class="summary-empty">Unable to load summary: '+escapeHtml(e.message)+'</div>';
    })
    .getDailySummaryRowsForUser(
      d,
      loggedInUser.userId,
      loggedInUser.username,
      loggedInUser.role
    );
}

function resetSummaryFilters(){
  ["summaryTower","summaryFloor","summaryTrade","summaryWorkStatusFilter","summaryContractor"].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value="";
  });
  lockProjectSelectToActive_("summaryProject");
  updateSummaryDependentFilters();
  renderDailySummaryFromCache();
}

function renderDailySummaryFromCache(){
  const p=document.getElementById("summaryProject").value;
  const t=document.getElementById("summaryTower").value;
  const f=document.getElementById("summaryFloor").value;
  const tr=document.getElementById("summaryTrade").value;
  const ws=document.getElementById("summaryWorkStatusFilter").value;
  const c=(document.getElementById("summaryContractor").value||"").toLowerCase().trim();

  const rows=dailySummaryCache.filter(r=>
    (!p||r.project===p)&&
    (!t||r.tower===t)&&
    (!f||r.floor===f)&&
    (!tr||r.trade===tr)&&
    (!ws||r.workStatus===ws)&&
    (!c||String(r.contractor||"").toLowerCase().includes(c))
  );

  const countBy=(key)=>{
    const o={};
    rows.forEach(r=>{
      const v=String(r[key]||"Unspecified").trim()||"Unspecified";
      o[v]=(o[v]||0)+1;
    });
    return o;
  };

  const total=rows.length;
  const inProgress=rows.filter(r=>r.workStatus==="In Progress").length;
  const completed=rows.filter(r=>r.workStatus==="Completed").length;
  const pending=rows.filter(r=>r.inspectionStatus==="Requested").length;
  const rectification=rows.filter(r=>r.inspectionStatus==="Rectification Required").length;
  const constraints=rows.filter(r=>{
    const x=String(r.delayCategory||"").trim();
    const issue=String(r.issueConstraint||"").trim();
    return !!x || (!!issue && !["none","n/a","na","nil"].includes(issue.toLowerCase()));
  }).length;

  const pct=n=>total?Math.round((n/total)*100):0;

  document.getElementById("kpiActivities").innerText=total;
  document.getElementById("kpiInProgress").innerText=inProgress;
  document.getElementById("kpiCompleted").innerText=completed;
  document.getElementById("kpiPending").innerText=pending;
  document.getElementById("kpiRectification").innerText=rectification;
  document.getElementById("kpiConstraints").innerText=constraints;

  document.getElementById("kpiInProgressPct").innerText=pct(inProgress)+"% of activities";
  document.getElementById("kpiCompletedPct").innerText=pct(completed)+"% of activities";
  document.getElementById("kpiRectificationPct").innerText=pct(rectification)+"% requiring action";
  document.getElementById("kpiConstraintsPct").innerText=pct(constraints)+"% with constraints";

  document.getElementById("summaryProgressText").innerText=completed+" of "+total+" completed";
  document.getElementById("summaryProgressPercent").innerText=pct(completed)+"%";
  document.getElementById("summaryProgressBar").style.width=pct(completed)+"%";

  const dateVal=document.getElementById("summaryDate").value;
  if(dateVal){
    const d=new Date(dateVal+"T00:00:00");
    document.getElementById("summaryDateLabel").innerText=d.toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
  }

  renderSummaryTable("summaryByProject",countBy("project"));
  renderSummaryTable("summaryByTower",countBy("tower"));
  renderSummaryTable("summaryWorkStatus",countBy("workStatus"));
  renderSummaryTable("summaryInspectionStatus",countBy("inspectionStatus"));
  renderSummaryTable("summaryConstraints",countBy("delayCategory"));
  renderSummaryTable("summaryHousekeeping",countBy("housekeepingStatus"));
  renderSummaryTable("summarySupervisors",countBy("supervisorName"));
  renderQuantitySummary(rows);
  renderManagementAttention(rows);
  renderTopContributors(rows);
  renderRecentSummary(rows);
}


function updateSummaryDependentFilters(){
  const p=document.getElementById("summaryProject").value;
  const currentTower=document.getElementById("summaryTower").value;
  const rows=p?dailySummaryCache.filter(r=>r.project===p):dailySummaryCache;
  fillReportFilter("summaryTower",uniqueValues(rows,"tower"),"All Towers");
  if(uniqueValues(rows,"tower").includes(currentTower))document.getElementById("summaryTower").value=currentTower;
  updateSummaryFloorFilter();
}

function updateSummaryFloorFilter(){
  const p=document.getElementById("summaryProject").value;
  const t=document.getElementById("summaryTower").value;
  const currentFloor=document.getElementById("summaryFloor").value;
  let rows=dailySummaryCache;
  if(p)rows=rows.filter(r=>r.project===p);
  if(t)rows=rows.filter(r=>r.tower===t);
  fillReportFilter("summaryFloor",uniqueValues(rows,"floor"),"All Floors");
  if(uniqueValues(rows,"floor").includes(currentFloor))document.getElementById("summaryFloor").value=currentFloor;
}

function renderQuantitySummary(rows){
  const el=document.getElementById("summaryQuantities");
  const managementView=hasExecutiveAccess();

  const items=rows
    .map(r=>({
      activityId:String(r.activityId||""),
      activity:String(r.activity||"Unspecified"),
      contractor:String(r.contractor||"-"),
      project:String(r.project||""),
      tower:String(r.tower||""),
      floor:String(r.floor||""),
      qty:Number(r.todayQuantity),
      unit:String(r.unit||"").trim()
    }))
    .filter(x=>!isNaN(x.qty) && x.qty!==0);

  if(!items.length){
    el.innerHTML='<div class="summary-empty">No reported quantity data</div>';
    return;
  }

  if(managementView){
    const grouped={};

    items.forEach(x=>{
      const key=[x.activity,x.tower,x.unit].join("|||");
      if(!grouped[key]){
        grouped[key]={
          activity:x.activity,
          tower:x.tower||"-",
          unit:x.unit,
          qty:0
        };
      }
      grouped[key].qty+=x.qty;
    });

    const rows2=Object.values(grouped).sort((a,b)=>{
      const aa=(a.activity+" "+a.tower).toLowerCase();
      const bb=(b.activity+" "+b.tower).toLowerCase();
      return aa.localeCompare(bb);
    });

    let h='<div class="quantity-activity-wrap"><table class="quantity-activity-table"><thead><tr>'+
      '<th>Activity</th><th>Tower</th><th>Today Qty</th>'+
      '</tr></thead><tbody>';

    rows2.forEach(x=>{
      h+='<tr>'+
        '<td><b>'+escapeHtml(x.activity)+'</b></td>'+
        '<td>'+escapeHtml(x.tower)+'</td>'+
        '<td class="qty-value">'+escapeHtml(String(x.qty))+(x.unit?' '+escapeHtml(x.unit):'')+'</td>'+
        '</tr>';
    });

    h+='</tbody></table></div><div class="quantity-activity-mobile">';

    rows2.forEach(x=>{
      h+='<div class="quantity-activity-card">'+
        '<div class="quantity-activity-card-title">'+escapeHtml(x.activity)+'</div>'+
        '<div class="quantity-activity-card-meta">'+escapeHtml(x.tower)+'</div>'+
        '<div class="quantity-activity-card-qty">'+escapeHtml(String(x.qty))+(x.unit?' '+escapeHtml(x.unit):'')+'</div>'+
        '</div>';
    });

    h+='</div>';
    el.innerHTML=h;
    return;
  }

  let h='<div class="quantity-activity-wrap"><table class="quantity-activity-table"><thead><tr>'+
    '<th>Activity</th><th>Location</th><th>Contractor</th><th>Today Qty</th>'+
    '</tr></thead><tbody>';

  items.forEach(x=>{
    const location=[x.project,x.tower,x.floor].filter(Boolean).join(" / ");
    h+='<tr>'+
      '<td><b>'+escapeHtml(x.activity)+'</b><div style="color:#94a3b8;font-size:10px;margin-top:2px">'+escapeHtml(x.activityId)+'</div></td>'+
      '<td>'+escapeHtml(location||"-")+'</td>'+
      '<td>'+escapeHtml(x.contractor)+'</td>'+
      '<td class="qty-value">'+escapeHtml(String(x.qty))+(x.unit?' '+escapeHtml(x.unit):'')+'</td>'+
      '</tr>';
  });

  h+='</tbody></table></div><div class="quantity-activity-mobile">';

  items.forEach(x=>{
    const location=[x.project,x.tower,x.floor].filter(Boolean).join(" • ");
    h+='<div class="quantity-activity-card">'+
      '<div class="quantity-activity-card-title">'+escapeHtml(x.activity)+'</div>'+
      '<div class="quantity-activity-card-meta">'+escapeHtml(x.activityId)+(location?' • '+escapeHtml(location):'')+(x.contractor?' • '+escapeHtml(x.contractor):'')+'</div>'+
      '<div class="quantity-activity-card-qty">'+escapeHtml(String(x.qty))+(x.unit?' '+escapeHtml(x.unit):'')+'</div>'+
      '</div>';
  });

  h+='</div>';
  el.innerHTML=h;
}

function changeSummaryDate(days){
  const el=document.getElementById("summaryDate");
  const base=el.value?new Date(el.value+"T00:00:00"):new Date();
  base.setDate(base.getDate()+days);
  const y=base.getFullYear(),m=String(base.getMonth()+1).padStart(2,"0"),d=String(base.getDate()).padStart(2,"0");
  el.value=y+"-"+m+"-"+d;
  loadDailySummary();
}

function setSummaryToday(){
  const n=new Date();
  document.getElementById("summaryDate").value=n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
  loadDailySummary();
}

function printDailySummary(){window.print()}
function scrollToRecentSummary(){document.getElementById("summaryRecentPanel").scrollIntoView({behavior:"smooth"})}

function openSummaryReport(id){
  google.script.run
    .withSuccessHandler(function(rows){
      myReportsData=rows||[];
      viewReportDetail(id);
    })
    .withFailureHandler(function(e){alert("Unable to open report: "+e.message)})
    .getReportsForUser(loggedInUser.userId,loggedInUser.username,loggedInUser.role);
}

function renderSummaryTable(id,obj){
  const el=document.getElementById(id);
  const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){
    el.innerHTML='<div class="summary-empty">No data</div>';
    return;
  }
  const max=Math.max(...entries.map(x=>x[1]),1);
  let h='<table class="summary-list">';
  entries.forEach(([k,v])=>{
    const w=Math.max(4,Math.round((v/max)*100));
    h+='<tr><td>'+escapeHtml(k)+'</td><td class="summary-bar-cell"><div class="summary-mini-track"><div class="summary-mini-fill" style="width:'+w+'%"></div></div></td><td>'+v+'</td></tr>';
  });
  h+='</table>';
  el.innerHTML=h;
}

function renderManagementAttention(rows){
  const el=document.getElementById("summaryAttention");
  const critical=rows.filter(r=>{
    const hasConstraint=String(r.issueConstraint||"").trim() || String(r.delayCategory||"").trim();
    return hasConstraint || r.workStatus==="Hold" || r.inspectionStatus==="Rectification Required";
  }).slice().sort((a,b)=>(b.timestampMs||0)-(a.timestampMs||0)).slice(0,8);

  if(!critical.length){
    el.innerHTML='<div class="summary-empty">No management attention items for selected filters.</div>';
    return;
  }

  el.innerHTML='<div class="attention-list">'+critical.map(r=>{
    const isRect=r.inspectionStatus==="Rectification Required";
    const title=isRect?"Rectification Required":(r.workStatus==="Hold"?"Activity on Hold":"Constraint / Issue");
    const meta=[r.activityId,r.project,r.tower,r.floor,r.activity].filter(Boolean).join(" • ");
    const detail=r.issueConstraint||r.delayCategory||r.inspectionRemarks||r.actionRequired||"Action required";
    return '<div class="attention-item '+(isRect?'warning':'')+'"><div class="attention-item-title">'+escapeHtml(title)+' — '+escapeHtml(detail)+'</div><div class="attention-item-meta">'+escapeHtml(meta)+'</div></div>';
  }).join("")+'</div>';
}

function renderTopContributors(rows){
  const el=document.getElementById("summaryTopContributors");
  const counts={};
  rows.forEach(r=>{
    const n=String(r.supervisorName||"Unspecified").trim()||"Unspecified";
    counts[n]=(counts[n]||0)+1;
  });
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(!entries.length){
    el.innerHTML='<div class="summary-empty">No data</div>';
    return;
  }
  el.innerHTML=entries.map(([n,v],i)=>'<div class="contributor-row"><span>'+(i+1)+'. '+escapeHtml(n)+'</span><b>'+v+'</b></div>').join("");
}

function renderRecentSummary(rows){
  const el=document.getElementById("summaryRecent");
  if(!rows.length){el.innerHTML='<div class="summary-empty">No activities for selected date / filters.</div>';return;}
  const recent=rows.slice().sort((a,b)=>b.timestampMs-a.timestampMs).slice(0,20);
  let h='<div class="recent-table-wrap"><table class="recent-table"><thead><tr>'+
    '<th>Activity ID</th><th>Time</th><th>Project</th><th>Tower</th><th>Floor</th><th>Activity</th><th>Contractor</th><th>Work Status</th><th>Inspection</th><th></th>'+
    '</tr></thead><tbody>';
  recent.forEach(r=>{
    h+='<tr>'+
      '<td><b>'+escapeHtml(r.activityId)+'</b></td>'+
      '<td>'+escapeHtml(r.timestamp)+'</td>'+
      '<td>'+escapeHtml(r.project)+'</td>'+
      '<td>'+escapeHtml(r.tower)+'</td>'+
      '<td>'+escapeHtml(r.floor)+'</td>'+
      '<td>'+escapeHtml(r.activity)+'</td>'+
      '<td>'+escapeHtml(r.contractor)+'</td>'+
      '<td><span class="summary-status-badge">'+escapeHtml(r.workStatus)+'</span></td>'+
      '<td><span class="summary-status-badge">'+escapeHtml(r.inspectionStatus)+'</span></td>'+
      '<td><button class="recent-view-btn" onclick="openSummaryReport(\''+escapeHtml(r.activityId)+'\')">View</button></td>'+
      '</tr>';
  });
  h+='</tbody></table></div>';
  el.innerHTML=h;
}



/* ===================== EXECUTIVE REPORT ===================== */
let executiveRows=[];


let executiveManagementSources={
  programme:[],
  procurement:[],
  cash:[],
  boq:[],
  drawings:[],
  actions:[],
  inspections:[]
};

function executiveApi_(action,data){
  if(window.LCRG_API&&typeof LCRG_API.apiRequest==="function"){
    return LCRG_API.apiRequest(action,data||{});
  }
  return Promise.reject(new Error("API not available."));
}

function execSetPosition_(name,color,text,detail){
  const dot=document.getElementById("exec"+name+"Dot");
  const txt=document.getElementById("exec"+name+"Text");
  const det=document.getElementById("exec"+name+"Detail");
  if(dot)dot.className="exec-position-dot "+(color||"");
  if(txt)txt.innerText=text||"—";
  if(det)det.innerText=detail||"";
}

function execProjectRows_(rows){
  const active=getActiveProject();
  return (rows||[]).filter(r=>normalizeProjectName_(r.project||r.Project||"")===active);
}

function loadExecutiveManagementSources_(){
  return Promise.allSettled([
    executiveApi_("programme",{}),
    executiveApi_("procurement",{}),
    executiveApi_("cashFlow",{}),
    executiveApi_("boqCost",{}),
    executiveApi_("drawings",{}),
    executiveApi_("actionRegister",{}),
    executiveApi_("pendingInspections",{})
  ]).then(results=>{
    executiveManagementSources={
      programme:results[0].status==="fulfilled"?execProjectRows_(results[0].value):[],
      procurement:results[1].status==="fulfilled"?execProjectRows_(results[1].value):[],
      cash:results[2].status==="fulfilled"?execProjectRows_(results[2].value):[],
      boq:results[3].status==="fulfilled"?execProjectRows_(results[3].value):[],
      drawings:results[4].status==="fulfilled"?execProjectRows_(results[4].value):[],
      actions:results[5].status==="fulfilled"?execProjectRows_(results[5].value):[],
      inspections:results[6].status==="fulfilled"?execProjectRows_(results[6].value):[]
    };
    renderExecutiveManagementPosition_();
  });
}

function renderExecutiveManagementPosition_(){
  const d=executiveManagementSources||{};
  const programme=d.programme||[],procurement=d.procurement||[],cash=d.cash||[],
        drawings=d.drawings||[],actions=d.actions||[],inspections=d.inspections||[];

  const progDelayed=programme.filter(r=>r.isDelayed||String(r.status||"").toLowerCase()==="delayed");
  const progRisk=programme.filter(r=>!r.isDelayed&&Number(r.varianceDays||0)>0);
  if(!programme.length)execSetPosition_("Programme","gray","No Data","No programme milestones recorded.");
  else if(progDelayed.length)execSetPosition_("Programme","red","Delayed",progDelayed.length+" delayed / overdue milestone"+(progDelayed.length===1?"":"s"));
  else if(progRisk.length)execSetPosition_("Programme","amber","At Risk",progRisk.length+" milestone"+(progRisk.length===1?"":"s")+" forecast late");
  else execSetPosition_("Programme","green","On Track","No delayed milestones.");

  const procLate=procurement.filter(r=>r.isLate);
  const procRisk=procurement.filter(r=>r.isAtRisk&&!r.isLate);
  if(!procurement.length)execSetPosition_("Procurement","gray","No Data","No procurement packages recorded.");
  else if(procLate.length)execSetPosition_("Procurement","red","Delayed",procLate.length+" late package"+(procLate.length===1?"":"s"));
  else if(procRisk.length)execSetPosition_("Procurement","amber","At Risk",procRisk.length+" package"+(procRisk.length===1?"":"s")+" forecast late");
  else execSetPosition_("Procurement","green","On Track","No late procurement packages.");

  const awarded=cash.reduce((a,r)=>a+Number(r.awardedValue||0),0);
  const spend=cash.reduce((a,r)=>a+Number(r.actualSpending||0),0);
  const pendingApproval=cash.reduce((a,r)=>a+Number(r.pendingApproval||0),0);
  setText("execAwardedValue",cockpitMoney(awarded));
  setText("execActualSpend",cockpitMoney(spend));
  setText("execPendingApproval",cockpitMoney(pendingApproval));

  if(!cash.length)execSetPosition_("Cost","gray","No Data","No Cash Flow records.");
  else if(awarded>0&&spend>awarded)execSetPosition_("Cost","red","Overrun","Actual spending exceeds awarded value.");
  else if(pendingApproval>0)execSetPosition_("Cost","amber","Attention",cockpitMoney(pendingApproval)+" pending approval");
  else execSetPosition_("Cost","green","Controlled","No current financial exception.");

  const technicalAttention=drawings.filter(r=>{
    const s=String(r.status||"").toLowerCase();
    return s.includes("review")||s.includes("comment")||s.includes("superseded");
  });
  if(!drawings.length)execSetPosition_("Technical","gray","No Data","No drawings recorded.");
  else if(technicalAttention.length)execSetPosition_("Technical","amber","Attention",technicalAttention.length+" drawing"+(technicalAttention.length===1?"":"s")+" need attention");
  else execSetPosition_("Technical","green","Controlled","No drawing exception identified.");

  const openActions=actions.filter(r=>String(r.status||"").toLowerCase()!=="closed");
  const overdue=openActions.filter(r=>r.isOverdue);
  const critical=openActions.filter(r=>String(r.priority||"").toLowerCase()==="critical");
  const decisions=openActions.filter(r=>{
    const x=String(r.decisionRequired||"").trim().toLowerCase();
    return x&&x!=="no decision required";
  });
  setText("execOpenActions",openActions.length);
  setText("execActionSub",decisions.length+" decisions • "+overdue.length+" overdue");
  if(!openActions.length)execSetPosition_("Action","green","Clear","No open management actions.");
  else if(overdue.length||critical.length)execSetPosition_("Action","red","Critical",critical.length+" critical • "+overdue.length+" overdue");
  else if(decisions.length)execSetPosition_("Action","amber","Decision Due",decisions.length+" management decision"+(decisions.length===1?"":"s")+" required");
  else execSetPosition_("Action","amber","Open",openActions.length+" open action"+(openActions.length===1?"":"s"));

  const activeRows=executiveRows.filter(r=>normalizeProjectName_(r.project)===getActiveProject());
  const constraints=activeRows.filter(r=>String(r.issueConstraint||"").trim()||String(r.delayCategory||"").trim());
  const rectifications=inspections.filter(r=>String(r.inspectionStatus||"").toLowerCase()==="rectification required");
  if(rectifications.length)execSetPosition_("Site","red","Quality Risk",rectifications.length+" rectification item"+(rectifications.length===1?"":"s"));
  else if(constraints.length)execSetPosition_("Site","amber","Attention",constraints.length+" site constraint"+(constraints.length===1?"":"s"));
  else execSetPosition_("Site","green","Stable","No major site / quality exception.");

  const brief=[];
  brief.push("<b>"+projectLauncherDisplayName_(getActiveProject())+"</b> management position:");
  if(progDelayed.length)brief.push("<b>"+progDelayed.length+"</b> programme milestone"+(progDelayed.length===1?" is":"s are")+" delayed/overdue.");
  if(procLate.length||procRisk.length)brief.push("Procurement has <b>"+procLate.length+"</b> late and <b>"+procRisk.length+"</b> at-risk package"+((procLate.length+procRisk.length)===1?"":"s")+".");
  if(pendingApproval>0)brief.push("<b>"+cockpitMoney(pendingApproval)+"</b> is pending financial approval.");
  if(decisions.length)brief.push("<b>"+decisions.length+"</b> management decision"+(decisions.length===1?" is":"s are")+" pending.");
  if(overdue.length)brief.push("<b>"+overdue.length+"</b> action"+(overdue.length===1?" is":"s are")+" overdue.");
  if(technicalAttention.length)brief.push("<b>"+technicalAttention.length+"</b> technical drawing item"+(technicalAttention.length===1?" needs":"s need")+" attention.");
  if(brief.length===1)brief.push("No major connected management exception is currently recorded.");
  document.getElementById("execManagementBrief").innerHTML=brief.join(" ");

  const ranked=openActions.slice().sort((a,b)=>{
    const score=r=>(r.isOverdue?100:0)+(String(r.priority||"").toLowerCase()==="critical"?80:String(r.priority||"").toLowerCase()==="high"?50:0)+(String(r.decisionRequired||"").trim()&&String(r.decisionRequired||"").toLowerCase()!=="no decision required"?35:0);
    return score(b)-score(a);
  }).slice(0,6);

  const actionBox=document.getElementById("execLiveActions");
  if(actionBox){
    actionBox.innerHTML=ranked.length?'<div class="exec-live-actions">'+ranked.map(r=>{
      const cls=r.isOverdue?"overdue":String(r.priority||"").toLowerCase()==="critical"?"critical":"";
      const meta=[r.actionId,r.category,r.tower,r.floor,r.responsiblePerson||r.responsibleParty,r.targetDate].filter(Boolean).join(" • ");
      const decision=String(r.decisionRequired||"").trim();
      return '<div class="exec-live-action '+cls+'"><div class="exec-live-action-title">'+escapeHtml(r.issue||r.actionRequired||r.actionId||"Action")+'</div><div class="exec-live-action-meta">'+escapeHtml(meta)+'</div>'+(decision&&decision.toLowerCase()!=="no decision required"?'<div class="exec-live-action-decision">Decision: '+escapeHtml(decision)+'</div>':'')+'</div>';
    }).join("")+'</div>':'<div class="empty-state">No open management actions.</div>';
  }

  const exceptions=[];
  progDelayed.slice(0,3).forEach(r=>exceptions.push("Programme — "+r.milestone+" ("+Number(r.varianceDays||0)+" days variance)"));
  procLate.slice(0,3).forEach(r=>exceptions.push("Procurement — "+r.packageName+" (required "+r.requiredDate+")"));
  procRisk.slice(0,2).forEach(r=>exceptions.push("Procurement risk — "+r.packageName+" (forecast "+r.forecastDate+")"));
  const control=document.getElementById("execControlExceptions");
  if(control){
    control.innerHTML=exceptions.length
      ?'<table class="exec-summary-table"><tbody>'+exceptions.map(x=>'<tr><td>'+escapeHtml(x)+'</td></tr>').join("")+'</tbody></table>'
      :'<div class="empty-state">No Programme / Procurement exception.</div>';
  }
}

function openExecutiveReport(){
  if(!hasExecutiveAccess()){
    alert("Executive Report is available to CEO and Project Manager only.");
    return;
  }

  hideAppPages();
  document.getElementById("executiveReportPage").style.display="block";

  const today=new Date();
  const to=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const fromDate=new Date(today);
  fromDate.setDate(fromDate.getDate()-6);
  const from=fromDate.getFullYear()+"-"+String(fromDate.getMonth()+1).padStart(2,"0")+"-"+String(fromDate.getDate()).padStart(2,"0");

  if(!document.getElementById("execFromDate").value)document.getElementById("execFromDate").value=from;
  if(!document.getElementById("execToDate").value)document.getElementById("execToDate").value=to;

  loadExecutiveReport();
}

function executiveCountBy(rows,key){
  const map={};
  rows.forEach(function(r){
    const v=String(r[key]||"Not Specified").trim()||"Not Specified";
    map[v]=(map[v]||0)+1;
  });
  return map;
}

function simpleExecTable(map){
  const entries=Object.keys(map).sort(function(a,b){return map[b]-map[a]});
  if(!entries.length)return '<div class="empty-state">No data.</div>';
  const max=Math.max.apply(null,entries.map(k=>map[k]))||1;
  let h='<table class="exec-summary-table"><tbody>';
  entries.forEach(function(k){
    const width=Math.max(4,Math.round((map[k]/max)*100));
    h+='<tr><td>'+escapeHtml(k)+'</td><td class="exec-bar-cell"><div class="exec-mini-track"><div class="exec-mini-fill" style="width:'+width+'%"></div></div></td><td><b>'+map[k]+'</b></td></tr>';
  });
  return h+'</tbody></table>';
}

function executiveCountProjectTower(rows){
  const map={};
  rows.forEach(r=>{
    const key=[r.project,r.tower].filter(Boolean).join(" / ")||"Not Specified";
    map[key]=(map[key]||0)+1;
  });
  return map;
}

function normalizeExecutiveActivityName(name){
  let s=String(name||"").trim().toLowerCase();

  // Standardize obvious historical naming variations for executive aggregation.
  // Examples: Brickwork / Brick Work / Brick Works / brick work -> brickwork
  s=s.replace(/&/g,"and");
  s=s.replace(/[^a-z0-9]+/g,"");
  if(s.endsWith("works"))s=s.slice(0,-1);

  return s||"unspecified";
}

function formatExecutiveDateRange(dateList){
  const valid=dateList
    .filter(d=>d&&!isNaN(d.getTime()))
    .sort((a,b)=>a-b);

  if(!valid.length)return "-";

  const first=valid[0];
  const last=valid[valid.length-1];

  const fmt=d=>d.toLocaleDateString(undefined,{
    day:"2-digit",
    month:"short",
    year:"numeric"
  });

  return first.toDateString()===last.toDateString()
    ? fmt(first)
    : fmt(first)+" – "+fmt(last);
}

function renderExecutiveQuantities(rows){
  const el=document.getElementById("execQuantities");
  const grouped={};

  rows.forEach(r=>{
    const qty=Number(r.todayQuantity);
    if(isNaN(qty)||qty===0)return;

    const activity=String(r.activity||"Unspecified").trim()||"Unspecified";
    const tower=String(r.tower||"-").trim()||"-";
    const unit=String(r.unit||"").trim();
    const activityKey=normalizeExecutiveActivityName(activity);
    const key=[activityKey,tower.toLowerCase(),unit.toLowerCase()].join("|||");

    if(!grouped[key]){
      grouped[key]={
        activity:activity,
        tower:tower,
        unit:unit,
        qty:0,
        dates:[]
      };
    }

    grouped[key].qty+=qty;

    const d=parseReportDate(r.timestamp);
    if(d&&!isNaN(d.getTime()))grouped[key].dates.push(d);

    // Prefer the cleanest/shortest display label among equivalent historical names.
    if(activity.length<grouped[key].activity.length){
      grouped[key].activity=activity;
    }
  });

  const items=Object.values(grouped).sort((a,b)=>{
    const da=a.dates.length?Math.max(...a.dates.map(d=>d.getTime())):0;
    const db=b.dates.length?Math.max(...b.dates.map(d=>d.getTime())):0;
    if(db!==da)return db-da;
    return (a.activity+" "+a.tower).localeCompare(b.activity+" "+b.tower);
  });

  if(!items.length){
    el.innerHTML='<div class="empty-state">No quantity data in selected period.</div>';
    return;
  }

  let h='<div style="overflow-x:auto"><table class="exec-quantity-table"><thead><tr>'+
    '<th>Reporting Date(s)</th><th>Activity</th><th>Tower</th><th>Reported Qty</th>'+
    '</tr></thead><tbody>';

  items.forEach(x=>{
    h+='<tr>'+
      '<td>'+escapeHtml(formatExecutiveDateRange(x.dates))+'</td>'+
      '<td>'+escapeHtml(x.activity)+'</td>'+
      '<td>'+escapeHtml(x.tower)+'</td>'+
      '<td>'+escapeHtml(String(x.qty))+(x.unit?' '+escapeHtml(x.unit):'')+'</td>'+
      '</tr>';
  });

  el.innerHTML=h+'</tbody></table></div>';
}

function renderExecutiveInspectionSummary(rows){
  document.getElementById("execInspectionSummary").innerHTML=
    simpleExecTable(executiveCountBy(rows,"inspectionStatus"));
}

function printExecutiveReport(){window.print()}

function loadExecutiveReport(){
  if(!hasExecutiveAccess())return;

  const from=document.getElementById("execFromDate").value;
  const to=document.getElementById("execToDate").value;

  if(!from||!to){
    alert("Please select From Date and To Date.");
    return;
  }

  document.getElementById("execCritical").innerHTML='<div class="reports-loading">Loading executive report...</div>';

  google.script.run
    .withSuccessHandler(function(rows){
      executiveRows=scopeRowsToActiveProject_(rows||[]);

      fillReportFilter("execProject",uniqueValues(executiveRows,"project"),"Project");
      lockProjectSelectToActive_("execProject");

      renderExecutiveReport();
      loadExecutiveManagementSources_();
    })
    .withFailureHandler(function(e){
      document.getElementById("execCritical").innerHTML=
        '<div class="empty-state">Unable to load executive report: '+escapeHtml(e.message)+'</div>';
    })
    .getExecutiveReportRows(
      from,
      to,
      loggedInUser.userId,
      loggedInUser.username,
      loggedInUser.role
    );
}

function renderExecutiveReport(){
  lockProjectSelectToActive_("execProject");
  const p=getActiveProject();
  const s=document.getElementById("execStatus").value;

  const rows=executiveRows.filter(function(r){
    return (!p||r.project===p)&&(!s||r.workStatus===s);
  });

  const total=rows.length;
  const completed=rows.filter(r=>normalizeRole(r.workStatus)==="completed").length;
  const progress=rows.filter(r=>normalizeRole(r.workStatus)==="in progress").length;
  const hold=rows.filter(function(r){
    const x=normalizeRole(r.workStatus);
    return x==="hold"||x==="on hold"||x==="delayed";
  }).length;
  const pending=rows.filter(r=>normalizeRole(r.inspectionStatus)==="requested").length;
  const constraints=rows.filter(function(r){
    const issue=String(r.issueConstraint||"").trim();
    const category=String(r.delayCategory||"").trim();
    return (issue && !["none","n/a","na","nil"].includes(normalizeRole(issue))) ||
           (category && !["none","n/a","na","nil"].includes(normalizeRole(category)));
  }).length;

  const pct=n=>total?Math.round((n/total)*100):0;

  document.getElementById("execTotal").innerText=total;
  document.getElementById("execCompleted").innerText=completed;
  document.getElementById("execProgress").innerText=progress;
  document.getElementById("execHold").innerText=hold;
  document.getElementById("execPending").innerText=pending;
  document.getElementById("execConstraints").innerText=constraints;
  document.getElementById("execCompletedPct").innerText=pct(completed)+"%";
  document.getElementById("execProgressPct").innerText=pct(progress)+"%";

  document.getElementById("execCompletionText").innerText=completed+" of "+total+" completed";
  document.getElementById("execCompletionPercent").innerText=pct(completed)+"%";
  document.getElementById("execCompletionBar").style.width=pct(completed)+"%";

  const from=document.getElementById("execFromDate").value;
  const to=document.getElementById("execToDate").value;
  if(from&&to){
    const fd=new Date(from+"T00:00:00"),td=new Date(to+"T00:00:00");
    const fmt=d=>d.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});
    document.getElementById("execPeriodLabel").innerText=fmt(fd)+" – "+fmt(td);
  }

  document.getElementById("execProjects").innerHTML=simpleExecTable(executiveCountProjectTower(rows));
  document.getElementById("execStatuses").innerHTML=simpleExecTable(executiveCountBy(rows,"workStatus"));
  document.getElementById("execTrades").innerHTML=simpleExecTable(executiveCountBy(rows,"trade"));
  document.getElementById("execContractors").innerHTML=simpleExecTable(executiveCountBy(rows,"contractor"));

  renderExecutiveQuantities(rows);
  renderExecutiveInspectionSummary(rows);

  const critical=rows
    .filter(function(r){
      return String(r.issueConstraint||"").trim() ||
             String(r.actionRequired||"").trim() ||
             String(r.delayCategory||"").trim() ||
             r.workStatus==="Hold" ||
             r.inspectionStatus==="Rectification Required";
    })
    .sort(function(a,b){return (b.timestampMs||0)-(a.timestampMs||0)})
    .slice(0,20);

  const el=document.getElementById("execCritical");
  if(!critical.length){
    el.innerHTML='<div class="empty-state">No critical items in the selected period.</div>';
    return;
  }

  el.innerHTML='<div class="exec-critical-list">'+critical.map(r=>{
    const warning=r.inspectionStatus==="Rectification Required"||r.workStatus==="Hold";
    const title=r.issueConstraint||r.delayCategory||(r.inspectionStatus==="Rectification Required"?"Rectification Required":"Management Attention");
    const meta=[r.timestamp,r.project,r.tower,r.floor,r.activity].filter(Boolean).join(" • ");
    const action=r.actionRequired||r.inspectionRemarks||"Follow-up required";
    return '<div class="exec-critical-item '+(warning?'warning':'')+'">'+
      '<div class="exec-critical-title">'+escapeHtml(title)+'</div>'+
      '<div class="exec-critical-meta">'+escapeHtml(meta)+'</div>'+
      '<div class="exec-critical-action"><b>Action:</b> '+escapeHtml(action)+'</div>'+
      '</div>';
  }).join("")+'</div>';
}


let adminUsersData=[];
let adminPasswordResetRequests=[];
let adminMasterData=null;
let adminEditUserId="";
let adminPasswordUserId="";

function openAdministrationSection(section){
  if(!loggedInUser || !hasAdministrationAccess()){alert("You do not have permission to access Administration.");return;}
  hideAppPages();document.getElementById("administrationPage").style.display="block";showAdminSection(section||"users");loadAdministrationData();
}

function openAdministration(){
  if(!loggedInUser || !hasAdministrationAccess()){
    alert("You do not have permission to access Administration.");
    return;
  }
  hideAppPages();
  document.getElementById("administrationPage").style.display="block";
  showAdminSection("users");
  loadAdministrationData();
}

function showAdminSection(section){
  document.getElementById("adminUsersSection").classList.toggle("active",section==="users");
  document.getElementById("adminMasterSection").classList.toggle("active",section==="master");
  document.getElementById("adminActivitiesSection").classList.toggle("active",section==="activities");

  document.getElementById("adminUsersTab").classList.toggle("active",section==="users");
  document.getElementById("adminMasterTab").classList.toggle("active",section==="master");
  document.getElementById("adminActivitiesTab").classList.toggle("active",section==="activities");
}

function loadAdministrationData(){
  document.getElementById("adminUsersContainer").innerText="Loading users...";
  google.script.run
    .withSuccessHandler(function(data){
      adminUsersData=data.users||[];
      adminPasswordResetRequests=data.passwordResetRequests||[];
      adminMasterData=data.masterData||{};
      renderAdminPasswordResetRequests();
      renderAdminUsers();
      renderAdminMasterData();
      fillReportFilter("adminActivityTradeFilter",uniqueValues(adminMasterData.trades||[],"Trade"),"All Trades");
      fillReportFilter("adminActivitySubTradeFilter",uniqueValues(adminMasterData.trades||[],"Sub-Trade"),"All Sub-Trades");
      renderAdminActivities();
    })
    .withFailureHandler(function(e){
      document.getElementById("adminUsersContainer").innerHTML='<div class="empty-state">Unable to load administration data: '+escapeHtml(e.message)+'</div>';
    })
    .getAdministrationData(loggedInUser.userId,loggedInUser.username);
}


function renderAdminPasswordResetRequests(){
  const panel=document.getElementById("adminResetRequestsPanel");
  const c=document.getElementById("adminResetRequestsContainer");
  const count=document.getElementById("adminResetRequestCount");
  if(!panel||!c||!count)return;

  const rows=(adminPasswordResetRequests||[]).filter(r=>String(r.status||"").toLowerCase()==="pending");
  count.innerText=rows.length;
  panel.style.display=rows.length?"block":"none";

  if(!rows.length){
    c.innerHTML="";
    return;
  }

  c.innerHTML=rows.map(r=>{
    return '<div class="admin-reset-request">'+
      '<div class="admin-reset-request-main"><b>'+escapeHtml(r.supervisorName||r.username||"User")+'</b>'+
      '<div class="admin-reset-request-meta">'+escapeHtml(r.username||"")+' • '+escapeHtml(r.employeeId||"")+' • Requested '+escapeHtml(r.requestedAt||"")+'</div></div>'+
      '<button onclick="openAdminPasswordModalFromRequest(\''+escapeHtml(r.userId)+'\')">Reset Password</button>'+
      '</div>';
  }).join("");
}

function openAdminPasswordModalFromRequest(userId){
  openAdminPasswordModal(userId);
}


function adminRoleHasAutomaticAllProjects_(role){
  const r=String(role||"").trim().toLowerCase();
  return r==="ceo"||r==="project manager";
}

function adminActiveProjectRows_(){
  return ((adminMasterData&&adminMasterData.projects)||[])
    .filter(r=>String(r["Status"]||"Active").trim().toLowerCase()==="active");
}

function adminProjectRowName_(r){
  return String(r["Project Name"]||r["Project"]||"").trim();
}

function adminProjectRowId_(r){
  return String(r["Project ID"]||"").trim();
}

function adminAccessTokens_(value){
  return String(value||"").split(/[\n,;|]+/).map(v=>String(v||"").trim()).filter(Boolean);
}

function adminAccessKey_(v){
  return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}

function renderAdminProjectAccess(selectedValue){
  const grid=document.getElementById("adminProjectAccessGrid");
  const auto=document.getElementById("adminProjectAccessAuto");
  const actions=document.getElementById("adminProjectAccessActions");
  if(!grid||!auto||!actions)return;

  const role=value("adminRole");
  const automatic=adminRoleHasAutomaticAllProjects_(role);

  auto.style.display=automatic?"block":"none";
  actions.style.display=automatic?"none":"flex";
  grid.style.display=automatic?"none":"grid";

  if(automatic){
    grid.innerHTML="";
    return;
  }

  const rows=adminActiveProjectRows_();
  if(!rows.length){
    grid.innerHTML='<div class="project-access-empty">No active projects are available in Project Master Data.</div>';
    return;
  }

  const tokens=adminAccessTokens_(selectedValue);
  const keys=new Set(tokens.map(adminAccessKey_));

  grid.innerHTML=rows.map((r,i)=>{
    const name=adminProjectRowName_(r);
    const id=adminProjectRowId_(r);
    const checked=keys.has(adminAccessKey_(name))||keys.has(adminAccessKey_(id));
    return '<label class="project-access-option">'+
      '<input type="checkbox" class="admin-project-access-check" data-project-name="'+escapeHtml(name)+'" data-project-id="'+escapeHtml(id)+'" '+(checked?'checked':'')+'>'+
      '<div class="project-access-option-main">'+
        '<div class="project-access-option-name">'+escapeHtml(name)+'</div>'+
        (id?'<div class="project-access-option-id">'+escapeHtml(id)+'</div>':'')+
      '</div>'+
    '</label>';
  }).join("");
}

function adminRoleProjectAccessChanged(){
  const existing=adminEditUserId
    ?((adminUsersData.find(x=>x.userId===adminEditUserId)||{}).projectAccess||"")
    :"";
  renderAdminProjectAccess(existing);
}

function setAllAdminProjectAccess(checked){
  document.querySelectorAll(".admin-project-access-check").forEach(x=>x.checked=!!checked);
}

function getAdminProjectAccessValue(){
  if(adminRoleHasAutomaticAllProjects_(value("adminRole")))return "";
  return Array.from(document.querySelectorAll(".admin-project-access-check:checked"))
    .map(x=>x.getAttribute("data-project-id")||x.getAttribute("data-project-name"))
    .filter(Boolean)
    .join(", ");
}

function adminProjectAccessSummary_(u){
  if(adminRoleHasAutomaticAllProjects_(u.role)){
    return '<div class="user-access-summary"><span class="user-access-chip user-access-all">All Projects</span></div>';
  }

  const tokens=adminAccessTokens_(u.projectAccess);
  if(!tokens.length){
    return '<div class="user-access-summary"><span class="user-access-chip user-access-none">No Projects</span></div>';
  }

  const rows=adminActiveProjectRows_();
  const labels=tokens.map(t=>{
    const key=adminAccessKey_(t);
    const row=rows.find(r=>adminAccessKey_(adminProjectRowId_(r))===key||adminAccessKey_(adminProjectRowName_(r))===key);
    return row?adminProjectRowName_(row):t;
  });

  const unique=[...new Set(labels)];
  const shown=unique.slice(0,3);
  let h='<div class="user-access-summary">'+shown.map(x=>'<span class="user-access-chip">'+escapeHtml(x)+'</span>').join("");
  if(unique.length>3)h+='<span class="user-access-chip">+'+(unique.length-3)+' more</span>';
  h+='</div>';
  return h;
}

function renderAdminUsers(){
  const c=document.getElementById("adminUsersContainer");
  const q=(document.getElementById("adminUserSearch").value||"").toLowerCase().trim();
  const rows=adminUsersData.filter(u=>{
    const s=[u.supervisorName,u.employeeId,u.username,u.role,u.status,u.projectAccess].join(" ").toLowerCase();
    return !q||s.includes(q);
  });

  if(!rows.length){c.innerHTML='<div class="empty-state">No users found.</div>';return;}
  let h='<div class="admin-table-wrap"><table class="admin-table"><thead><tr>'+
    '<th>User ID</th><th>Name</th><th>Employee ID</th><th>Username</th><th>Role</th><th>Project Access</th><th>Status</th><th>Created</th><th>Last Login</th><th>Actions</th>'+
    '</tr></thead><tbody>';
  rows.forEach(u=>{
    const statusClass=String(u.status).toLowerCase()==="active"?"active":"inactive";
    const nextStatus=statusClass==="active"?"Inactive":"Active";
    h+='<tr>'+
      '<td><b>'+escapeHtml(u.userId)+'</b></td>'+
      '<td>'+escapeHtml(u.supervisorName)+'</td>'+
      '<td>'+escapeHtml(u.employeeId)+'</td>'+
      '<td>'+escapeHtml(u.username)+'</td>'+
      '<td>'+escapeHtml(u.role)+'</td>'+
      '<td>'+adminProjectAccessSummary_(u)+'</td>'+
      '<td><span class="admin-badge '+statusClass+'">'+escapeHtml(u.status)+'</span></td>'+
      '<td>'+escapeHtml(u.createdAt)+'</td>'+
      '<td>'+escapeHtml(u.lastLogin||"-")+'</td>'+
      '<td>'+
        '<button class="admin-small-btn admin-edit-btn" onclick="openEditUserModal(\''+escapeHtml(u.userId)+'\')">Edit</button>'+
        '<button class="admin-small-btn admin-status-btn" onclick="changeAdminUserStatus(\''+escapeHtml(u.userId)+'\',\''+nextStatus+'\')">'+(nextStatus==="Inactive"?"Deactivate":"Activate")+'</button>'+
        '<button class="admin-small-btn admin-reset-btn" onclick="openAdminPasswordModal(\''+escapeHtml(u.userId)+'\')">Reset Password</button>'+
      '</td>'+
    '</tr>';
  });
  h+='</tbody></table></div>';
  c.innerHTML=h;
}

let currentMasterType="Projects";
let adminEditMasterKey="";

function selectMasterType(type,btn){
  currentMasterType=type;
  document.querySelectorAll(".master-type-tab").forEach(x=>x.classList.remove("active"));
  if(btn)btn.classList.add("active");
  renderAdminMasterData();
}

function getMasterRowsByType(type){
  const md=adminMasterData||{};
  if(type==="Projects")return md.projects||[];
  if(type==="Towers")return md.towers||[];
  if(type==="Floors")return md.floors||[];
  if(type==="Trades")return md.trades||[];
  if(type==="Units")return md.units||[];
  if(type==="Delay_Categories")return md.delayCategories||[];
  return [];
}

function masterRecordLabel(type,r){
  if(type==="Projects")return r["Project Name"]||"";
  if(type==="Towers")return r["Tower / Block"]||"";
  if(type==="Floors")return r["Floor"]||"";
  if(type==="Trades")return [r["Trade"],r["Sub-Trade"]].filter(Boolean).join(" / ");
  if(type==="Units")return r["Unit"]||"";
  if(type==="Delay_Categories")return r["Delay / Constraint Category"]||"";
  return "";
}

function masterRecordMeta(type,r){
  if(type==="Projects")return "ID: "+(r["Project ID"]||"-");
  if(type==="Towers")return "Project: "+(r["Project"]||"-")+" • ID: "+(r["Tower ID"]||"-");
  if(type==="Floors")return "Tower: "+(r["Tower / Block"]||"-")+" • ID: "+(r["Floor ID"]||"-");
  if(type==="Trades")return "Status: "+(r["Status"]||"Active");
  if(type==="Units")return "Status: "+(r["Status"]||"Active");
  if(type==="Delay_Categories")return "Status: "+(r["Status"]||"Active");
  return "";
}

function masterRecordKey(type,r){
  if(type==="Projects")return r["Project ID"]||r["Project Name"]||"";
  if(type==="Towers")return r["Tower ID"]||[r["Project"],r["Tower / Block"]].join("|||");
  if(type==="Floors")return r["Floor ID"]||[r["Tower / Block"],r["Floor"]].join("|||");
  if(type==="Trades")return [r["Trade"],r["Sub-Trade"]].join("|||");
  if(type==="Units")return r["Unit"]||"";
  if(type==="Delay_Categories")return r["Delay / Constraint Category"]||"";
  return "";
}

function renderAdminMasterData(){
  const c=document.getElementById("adminMasterContainer");
  if(!c)return;
  const q=(document.getElementById("adminMasterSearch")?.value||"").toLowerCase().trim();
  const rows=getMasterRowsByType(currentMasterType).filter(r=>{
    const txt=Object.values(r).join(" ").toLowerCase();
    return !q||txt.includes(q);
  });

  if(!rows.length){
    c.className="empty-state";
    c.innerHTML="No records found.";
    return;
  }

  c.className="";
  c.innerHTML='<div class="master-record-list">'+rows.map(r=>{
    const status=String(r["Status"]||"Active");
    const active=status.toLowerCase()==="active";
    const key=masterRecordKey(currentMasterType,r);
    return '<div class="master-record-card">'+
      '<div class="master-record-main"><div class="master-record-title">'+escapeHtml(masterRecordLabel(currentMasterType,r))+'</div>'+
      '<div class="master-record-meta">'+escapeHtml(masterRecordMeta(currentMasterType,r))+'</div>'+
      '<div style="margin-top:6px"><span class="admin-badge '+(active?'active':'inactive')+'">'+escapeHtml(status)+'</span></div></div>'+
      '<div class="master-record-actions">'+
      '<button class="master-edit" onclick="openEditMasterDataModal(\''+escapeHtml(key)+'\')">Edit</button>'+
      '<button class="master-toggle" onclick="toggleMasterDataStatus(\''+escapeHtml(key)+'\',\''+(active?'Inactive':'Active')+'\')">'+(active?'Deactivate':'Activate')+'</button>'+
      '</div></div>';
  }).join("")+'</div>';
}

function openMasterDataModal(){
  adminEditMasterKey="";
  document.getElementById("masterDataModalTitle").innerText="Add Master Data";
  document.getElementById("masterDataType").disabled=false;
  document.getElementById("masterDataType").value=currentMasterType;
  document.getElementById("masterDataMessage").innerText="";
  buildMasterDataFields();
  document.getElementById("masterDataModal").style.display="block";
  document.body.style.overflow="hidden";
}

function buildMasterDataFields(record){
  const type=document.getElementById("masterDataType").value;
  const wrap=document.getElementById("masterDataFields");
  const status=record&&record["Status"]||"Active";
  let h="";

  if(type==="Projects"){
    h+='<div><label>Project ID *</label><input id="masterField1" value="'+escapeHtml(record&&record["Project ID"]||"")+'"></div>';
    h+='<div><label>Project Name *</label><input id="masterField2" value="'+escapeHtml(record&&record["Project Name"]||"")+'"></div>';
  }else if(type==="Towers"){
    h+='<div><label>Tower ID *</label><input id="masterField1" value="'+escapeHtml(record&&record["Tower ID"]||"")+'"></div>';
    h+='<div><label>Project *</label><select id="masterField2"></select></div>';
    h+='<div class="full-width"><label>Tower / Block *</label><input id="masterField3" value="'+escapeHtml(record&&record["Tower / Block"]||"")+'"></div>';
  }else if(type==="Floors"){
    h+='<div><label>Floor ID *</label><input id="masterField1" value="'+escapeHtml(record&&record["Floor ID"]||"")+'"></div>';
    h+='<div><label>Tower / Block *</label><select id="masterField2"></select></div>';
    h+='<div class="full-width"><label>Floor *</label><input id="masterField3" value="'+escapeHtml(record&&record["Floor"]||"")+'"></div>';
  }else if(type==="Trades"){
    h+='<div><label>Trade *</label><input id="masterField1" value="'+escapeHtml(record&&record["Trade"]||"")+'"></div>';
    h+='<div><label>Sub-Trade *</label><input id="masterField2" value="'+escapeHtml(record&&record["Sub-Trade"]||"")+'"></div>';
  }else if(type==="Units"){
    h+='<div class="full-width"><label>Unit *</label><input id="masterField1" value="'+escapeHtml(record&&record["Unit"]||"")+'"></div>';
  }else if(type==="Delay_Categories"){
    h+='<div class="full-width"><label>Delay / Constraint Category *</label><input id="masterField1" value="'+escapeHtml(record&&record["Delay / Constraint Category"]||"")+'"></div>';
  }

  h+='<div><label>Status *</label><select id="masterStatus"><option>Active</option><option>Inactive</option></select></div>';
  wrap.innerHTML=h;
  document.getElementById("masterStatus").value=status;

  if(type==="Towers"){
    const s=document.getElementById("masterField2");
    s.innerHTML='<option value="">Select Project</option>';
    (adminMasterData.projects||[]).forEach(r=>addOption(s,r["Project Name"]));
    if(record)s.value=record["Project"]||"";
  }
  if(type==="Floors"){
    const s=document.getElementById("masterField2");
    s.innerHTML='<option value="">Select Tower</option>';
    (adminMasterData.towers||[]).forEach(r=>addOption(s,r["Tower / Block"]));
    if(record)s.value=record["Tower / Block"]||"";
  }
}

function openEditMasterDataModal(key){
  const rows=getMasterRowsByType(currentMasterType);
  const record=rows.find(r=>masterRecordKey(currentMasterType,r)===key);
  if(!record)return;
  adminEditMasterKey=key;
  document.getElementById("masterDataModalTitle").innerText="Edit Master Data";
  document.getElementById("masterDataType").value=currentMasterType;
  document.getElementById("masterDataType").disabled=true;
  document.getElementById("masterDataMessage").innerText="";
  buildMasterDataFields(record);
  document.getElementById("masterDataModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeMasterDataModal(e){
  if(e&&e.target!==document.getElementById("masterDataModal"))return;
  document.getElementById("masterDataModal").style.display="none";
  document.body.style.overflow="";
}

function getMasterDataPayload(){
  const type=document.getElementById("masterDataType").value;
  const payload={
    actorUserId:loggedInUser.userId,
    actorUsername:loggedInUser.username,
    type:type,
    originalKey:adminEditMasterKey,
    status:value("masterStatus")
  };

  if(type==="Projects"){
    payload.projectId=value("masterField1");
    payload.projectName=value("masterField2");
  }else if(type==="Towers"){
    payload.towerId=value("masterField1");
    payload.project=value("masterField2");
    payload.tower=value("masterField3");
  }else if(type==="Floors"){
    payload.floorId=value("masterField1");
    payload.tower=value("masterField2");
    payload.floor=value("masterField3");
  }else if(type==="Trades"){
    payload.trade=value("masterField1");
    payload.subTrade=value("masterField2");
  }else if(type==="Units"){
    payload.unit=value("masterField1");
  }else if(type==="Delay_Categories"){
    payload.delayCategory=value("masterField1");
  }
  return payload;
}

function saveMasterDataRecord(){
  const payload=getMasterDataPayload();
  const msg=document.getElementById("masterDataMessage");
  const btn=document.getElementById("masterDataSaveButton");
  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText="Saving master data...";

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;
      msg.style.color="#16a34a";
      msg.innerText=r.message||"Saved successfully.";
      currentMasterType=payload.type;
      loadAdministrationData();
      google.script.run.withSuccessHandler(function(d){
        masterData=d;
        projectLauncherData=Array.isArray(d?.projects)?d.projects:projectLauncherData;
      }).getMasterData();
      setTimeout(closeMasterDataModal,650);
    })
    .withFailureHandler(function(e){
      btn.disabled=false;
      msg.style.color="#dc2626";
      msg.innerText=e.message;
    })
    .adminSaveMasterData(payload);
}

function toggleMasterDataStatus(key,status){
  if(!confirm((status==="Inactive"?"Deactivate":"Activate")+" this record?"))return;

  google.script.run
    .withSuccessHandler(function(){
      loadAdministrationData();
      google.script.run.withSuccessHandler(function(d){
        masterData=d;
        projectLauncherData=Array.isArray(d?.projects)?d.projects:projectLauncherData;
      }).getMasterData();
    })
    .withFailureHandler(function(e){alert(e.message)})
    .adminSetMasterDataStatus({
      actorUserId:loggedInUser.userId,
      actorUsername:loggedInUser.username,
      type:currentMasterType,
      key:key,
      status:status
    });
}


let adminEditActivityRow="";

function renderAdminActivities(){
  const c=document.getElementById("adminActivitiesContainer");
  const rows=(adminMasterData&&adminMasterData.activities)||[];
  const q=(document.getElementById("adminActivitySearch").value||"").toLowerCase().trim();
  const tr=document.getElementById("adminActivityTradeFilter").value||"";
  const st=document.getElementById("adminActivitySubTradeFilter").value||"";

  const filtered=rows.filter(r=>{
    const txt=[r["Trade"],r["Sub-Trade"],r["Activity"],r["Status"]].join(" ").toLowerCase();
    return (!q||txt.includes(q))&&(!tr||r["Trade"]===tr)&&(!st||r["Sub-Trade"]===st);
  });

  if(!filtered.length){
    c.innerHTML='<div class="empty-state">No activities found.</div>';
    return;
  }

  let h='<div class="admin-table-wrap"><table class="admin-table"><thead><tr>'+
    '<th>Trade</th><th>Sub-Trade</th><th>Activity</th><th>Status</th><th>Actions</th>'+
    '</tr></thead><tbody>';

  filtered.forEach(r=>{
    const key=[r["Trade"],r["Sub-Trade"],r["Activity"]].join("|||");
    const statusClass=String(r["Status"]||"Active").toLowerCase()==="active"?"active":"inactive";
    h+='<tr>'+
      '<td>'+escapeHtml(r["Trade"])+'</td>'+
      '<td>'+escapeHtml(r["Sub-Trade"])+'</td>'+
      '<td><b>'+escapeHtml(r["Activity"])+'</b></td>'+
      '<td><span class="admin-badge '+statusClass+'">'+escapeHtml(r["Status"]||"Active")+'</span></td>'+
      '<td><button class="admin-small-btn admin-edit-btn" onclick="openEditActivityMasterModal(\''+escapeHtml(key)+'\')">Edit</button></td>'+
      '</tr>';
  });

  h+='</tbody></table></div>';
  c.innerHTML=h;
}

function openActivityMasterModal(){
  adminEditActivityRow="";
  document.getElementById("activityMasterModalTitle").innerText="Add Activity";
  fillReportFilter("activityMasterTrade",uniqueValues((adminMasterData&&adminMasterData.trades)||[],"Trade"),"Select Trade");
  resetSelect("activityMasterSubTrade","Select Sub-Trade");
  document.getElementById("activityMasterName").value="";
  document.getElementById("activityMasterStatus").value="Active";
  document.getElementById("activityMasterMessage").innerText="";
  document.getElementById("activityMasterModal").style.display="block";
  document.body.style.overflow="hidden";
}

function populateActivityMasterSubTrades(){
  const tr=value("activityMasterTrade");
  const rows=(adminMasterData&&adminMasterData.trades)||[];
  const vals=[...new Set(rows.filter(r=>r["Trade"]===tr).map(r=>r["Sub-Trade"]).filter(Boolean))];
  fillReportFilter("activityMasterSubTrade",vals,"Select Sub-Trade");
}

function openEditActivityMasterModal(key){
  const [tr,st,act]=String(key).split("|||");
  const r=((adminMasterData&&adminMasterData.activities)||[]).find(x=>x["Trade"]===tr&&x["Sub-Trade"]===st&&x["Activity"]===act);
  if(!r)return;

  adminEditActivityRow=key;
  document.getElementById("activityMasterModalTitle").innerText="Edit Activity";
  fillReportFilter("activityMasterTrade",uniqueValues((adminMasterData&&adminMasterData.trades)||[],"Trade"),"Select Trade");
  document.getElementById("activityMasterTrade").value=tr;
  populateActivityMasterSubTrades();
  document.getElementById("activityMasterSubTrade").value=st;
  document.getElementById("activityMasterName").value=act;
  document.getElementById("activityMasterStatus").value=r["Status"]||"Active";
  document.getElementById("activityMasterMessage").innerText="";
  document.getElementById("activityMasterModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeActivityMasterModal(e){
  if(e&&e.target!==document.getElementById("activityMasterModal"))return;
  document.getElementById("activityMasterModal").style.display="none";
  document.body.style.overflow="";
}

function saveActivityMaster(){
  const payload={
    actorUserId:loggedInUser.userId,
    actorUsername:loggedInUser.username,
    originalKey:adminEditActivityRow,
    trade:value("activityMasterTrade"),
    subTrade:value("activityMasterSubTrade"),
    activity:value("activityMasterName"),
    status:value("activityMasterStatus")
  };

  const msg=document.getElementById("activityMasterMessage");
  if(!payload.trade||!payload.subTrade||!payload.activity||!payload.status){
    msg.style.color="#dc2626";
    msg.innerText="Please complete all mandatory fields.";
    return;
  }

  const btn=document.getElementById("activityMasterSaveButton");
  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText="Saving activity...";

  google.script.run
    .withSuccessHandler(function(r){
      msg.style.color="#16a34a";
      msg.innerText=r.message||"Activity saved successfully.";
      btn.disabled=false;
      loadAdministrationData();
      google.script.run.withSuccessHandler(function(d){masterData=d}).getMasterData();
      setTimeout(closeActivityMasterModal,700);
    })
    .withFailureHandler(function(e){
      msg.style.color="#dc2626";
      msg.innerText=e.message;
      btn.disabled=false;
    })
    .adminSaveActivityMaster(payload);
}


function openCreateUserModal(){
  adminEditUserId="";
  document.getElementById("adminUserModalTitle").innerText="Add User";
  ["adminSupervisorName","adminEmployeeId","adminUsername","adminPassword"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("adminRole").value="";
  document.getElementById("adminUsername").disabled=false;
  document.getElementById("adminPasswordGroup").style.display="block";
  renderAdminProjectAccess("");
  document.getElementById("adminUserMessage").innerText="";
  document.getElementById("adminUserModal").style.display="block";
  document.body.style.overflow="hidden";
}

function openEditUserModal(userId){
  const u=adminUsersData.find(x=>x.userId===userId);
  if(!u)return;
  adminEditUserId=userId;
  document.getElementById("adminUserModalTitle").innerText="Edit User";
  document.getElementById("adminSupervisorName").value=u.supervisorName||"";
  document.getElementById("adminEmployeeId").value=u.employeeId||"";
  document.getElementById("adminUsername").value=u.username||"";
  document.getElementById("adminUsername").disabled=true;
  document.getElementById("adminRole").value=u.role||"";
  document.getElementById("adminPasswordGroup").style.display="none";
  renderAdminProjectAccess(u.projectAccess||"");
  document.getElementById("adminUserMessage").innerText="";
  document.getElementById("adminUserModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeAdminUserModal(e){
  if(e&&e.target!==document.getElementById("adminUserModal"))return;
  document.getElementById("adminUserModal").style.display="none";
  document.body.style.overflow="";
}

function saveAdminUser(){
  const payload={
    actorUserId:loggedInUser.userId,
    actorUsername:loggedInUser.username,
    userId:adminEditUserId,
    supervisorName:value("adminSupervisorName"),
    employeeId:value("adminEmployeeId"),
    username:value("adminUsername"),
    role:value("adminRole"),
    password:document.getElementById("adminPassword").value,
    projectAccess:getAdminProjectAccessValue()
  };
  const msg=document.getElementById("adminUserMessage");
  if(!payload.supervisorName||!payload.employeeId||!payload.username||!payload.role||(!adminEditUserId&&!payload.password)){
    msg.style.color="#dc2626";msg.innerText="Please complete all mandatory fields.";return;
  }
  if(!adminRoleHasAutomaticAllProjects_(payload.role)&&!payload.projectAccess){
    const ok=confirm("No project is selected. This user will not be able to open any project until Admin assigns one. Continue?");
    if(!ok)return;
  }
  const btn=document.getElementById("adminSaveUserButton");
  btn.disabled=true;msg.style.color="#475569";msg.innerText="Saving user...";
  const runner=adminEditUserId?"adminUpdateUser":"adminCreateUser";
  google.script.run
    .withSuccessHandler(function(r){
      msg.style.color="#16a34a";msg.innerText=r.message||"Saved successfully.";
      btn.disabled=false;loadAdministrationData();setTimeout(closeAdminUserModal,700);
    })
    .withFailureHandler(function(e){
      msg.style.color="#dc2626";msg.innerText=e.message;btn.disabled=false;
    })[runner](payload);
}

function changeAdminUserStatus(userId,status){
  const u=adminUsersData.find(x=>x.userId===userId);
  if(!u)return;
  if(!confirm((status==="Inactive"?"Deactivate ":"Activate ")+u.supervisorName+"?"))return;
  google.script.run
    .withSuccessHandler(function(){loadAdministrationData()})
    .withFailureHandler(function(e){alert(e.message)})
    .adminSetUserStatus({
      actorUserId:loggedInUser.userId,
      actorUsername:loggedInUser.username,
      userId:userId,
      status:status
    });
}

function openAdminPasswordModal(userId){
  const u=adminUsersData.find(x=>x.userId===userId);
  if(!u)return;
  adminPasswordUserId=userId;
  document.getElementById("adminPasswordUserLabel").innerText=u.supervisorName+" ("+u.username+")";
  document.getElementById("adminNewPassword").value="";
  document.getElementById("adminConfirmPassword").value="";
  document.getElementById("adminPasswordMessage").innerText="";
  document.getElementById("adminPasswordModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeAdminPasswordModal(e){
  if(e&&e.target!==document.getElementById("adminPasswordModal"))return;
  document.getElementById("adminPasswordModal").style.display="none";
  document.body.style.overflow="";
  adminPasswordUserId="";
}

function saveAdminPasswordReset(){
  const p=document.getElementById("adminNewPassword").value;
  const c=document.getElementById("adminConfirmPassword").value;
  const msg=document.getElementById("adminPasswordMessage");
  if(!p||p.length<6){msg.style.color="#dc2626";msg.innerText="Password must be at least 6 characters.";return;}
  if(p!==c){msg.style.color="#dc2626";msg.innerText="Passwords do not match.";return;}
  const btn=document.getElementById("adminResetPasswordButton");
  btn.disabled=true;msg.style.color="#475569";msg.innerText="Resetting password...";
  google.script.run
    .withSuccessHandler(function(r){
      msg.style.color="#16a34a";msg.innerText=r.message||"Password reset successfully.";
      btn.disabled=false;
      loadAdministrationData();
      setTimeout(closeAdminPasswordModal,700);
    })
    .withFailureHandler(function(e){msg.style.color="#dc2626";msg.innerText=e.message;btn.disabled=false})
    .adminResetUserPassword({
      actorUserId:loggedInUser.userId,
      actorUsername:loggedInUser.username,
      userId:adminPasswordUserId,
      newPassword:p
    });
}


function openForgotPasswordModal(){
  const remembered=localStorage.getItem("rememberedUsername")||document.getElementById("username").value||"";
  document.getElementById("forgotPasswordUsername").value=remembered;
  document.getElementById("forgotPasswordMessage").innerText="";
  document.getElementById("forgotPasswordModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeForgotPasswordModal(e){
  if(e&&e.target!==document.getElementById("forgotPasswordModal"))return;
  document.getElementById("forgotPasswordModal").style.display="none";
  document.body.style.overflow="";
}

function submitForgotPasswordRequest(){
  const username=value("forgotPasswordUsername");
  const msg=document.getElementById("forgotPasswordMessage");
  const btn=document.getElementById("forgotPasswordSubmitButton");

  if(!username){
    msg.style.color="#dc2626";
    msg.innerText="Please enter your username.";
    return;
  }

  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText="Submitting password reset request...";

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;
      msg.style.color="#16a34a";
      msg.innerText=(r&&r.message)||"If the account exists, a password reset request has been submitted.";
    })
    .withFailureHandler(function(){
      btn.disabled=false;
      msg.style.color="#16a34a";
      msg.innerText="If the account exists, a password reset request has been submitted.";
    })
    .requestPasswordReset({username:username});
}

function openChangePasswordModal(){
  if(!loggedInUser)return;
  ["changeCurrentPassword","changeNewPassword","changeConfirmPassword"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("changePasswordMessage").innerText="";
  document.getElementById("changePasswordModal").style.display="block";
  document.body.style.overflow="hidden";
}

function closeChangePasswordModal(e){
  if(e&&e.target!==document.getElementById("changePasswordModal"))return;
  document.getElementById("changePasswordModal").style.display="none";
  document.body.style.overflow="";
}

function saveOwnPasswordChange(){
  const current=document.getElementById("changeCurrentPassword").value;
  const next=document.getElementById("changeNewPassword").value;
  const confirmPassword=document.getElementById("changeConfirmPassword").value;
  const msg=document.getElementById("changePasswordMessage");
  const btn=document.getElementById("changePasswordSaveButton");

  if(!current||!next||!confirmPassword){
    msg.style.color="#dc2626";
    msg.innerText="Please complete all password fields.";
    return;
  }
  if(next.length<6){
    msg.style.color="#dc2626";
    msg.innerText="New password must be at least 6 characters.";
    return;
  }
  if(next!==confirmPassword){
    msg.style.color="#dc2626";
    msg.innerText="New passwords do not match.";
    return;
  }
  if(current===next){
    msg.style.color="#dc2626";
    msg.innerText="New password must be different from the current password.";
    return;
  }

  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText="Changing password...";

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;
      msg.style.color="#16a34a";
      msg.innerText=(r&&r.message)||"Password changed successfully.";
      setTimeout(closeChangePasswordModal,900);
    })
    .withFailureHandler(function(e){
      btn.disabled=false;
      msg.style.color="#dc2626";
      msg.innerText=e.message;
    })
    .changeOwnPassword({
      currentPassword:current,
      newPassword:next
    });
}




/* ===================== CASH FLOW V1.0 ===================== */
let cashFlowData=[];
let cashFlowWorkbook=null;
let cashFlowImportRows=[];

function cashNum(v){
  if(v===null||v===undefined||v==="")return 0;
  if(typeof v==="number")return isFinite(v)?v:0;
  let s=String(v).trim();
  if(!s)return 0;
  const neg=/^\(.*\)$/.test(s);
  s=s.replace(/[(),]/g,"").replace(/%/g,"").replace(/PKR/ig,"").replace(/Rs\.?/ig,"").replace(/[^\d.\-]/g,"");
  let n=Number(s);
  if(!isFinite(n))n=0;
  if(neg&&n>0)n=-n;
  return n;
}

function cashPercent(v){
  let n=cashNum(v);
  if(n>0&&n<=1)n*=100;
  return Math.max(0,Math.min(100,n));
}

function formatCashPKR(v){
  return "PKR "+Math.round(cashNum(v)).toLocaleString();
}

function cashFlowApi(action,data){
  data=data||{};
  if(window.LCRG_API&&typeof window.LCRG_API.call==="function"){
    return window.LCRG_API.call(action,data);
  }
  return new Promise(function(resolve,reject){
    if(!window.google||!google.script||!google.script.run){
      reject(new Error("Reporting App API is not available."));
      return;
    }
    const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
    const map={
      cashFlow:"getCashFlowRows",
      saveCashFlow:"saveCashFlowItem",
      deleteCashFlow:"deleteCashFlowItem",
      bulkImportCashFlow:"bulkImportCashFlowItems"
    };
    const fn=map[action];
    if(!fn||typeof runner[fn]!=="function"){
      reject(new Error("Cash Flow API method is not available."));
      return;
    }
    if(action==="cashFlow")runner[fn](loggedInUser.userId,loggedInUser.username);
    else{
      data.actorUserId=loggedInUser.userId;
      data.actorUsername=loggedInUser.username;
      runner[fn](data);
    }
  });
}

function ensureCashFlowMasterData(cb){
  if(masterData){if(cb)cb();return;}
  google.script.run
    .withSuccessHandler(function(md){masterData=md||{};if(cb)cb();})
    .withFailureHandler(function(e){alert("Unable to load master data: "+e.message);})
    .getMasterData();
}

function openCashFlow(){
  if(!hasExecutiveAccess()){
    alert("Cash Flow is available to CEO and Project Manager only.");
    return;
  }
  hideAppPages();
  document.getElementById("cashFlowPage").style.display="block";
  ensureCashFlowMasterData(function(){
    populateCashFlowProjectOptions();
    loadCashFlow();
  });
}

function loadCashFlow(){
  const c=document.getElementById("cashFlowContainer");
  c.className="reports-loading";
  c.innerText="Loading Cash Flow register...";
  cashFlowApi("cashFlow",{})
    .then(function(rows){
      cashFlowData=scopeRowsToActiveProject_(rows||[]);
      populateCashFlowProjectOptions();
      updateCashFlowTowerFilter();
      renderCashFlow();
    })
    .catch(function(e){
      c.className="empty-state";
      c.innerText="Unable to load Cash Flow: "+e.message;
    });
}

function populateCashFlowProjectOptions(){
  const projects=[...new Set((masterData&&masterData.projects||[]).map(x=>x["Project Name"]).filter(Boolean))].sort();
  fillSimpleSelect("cashProjectFilter",projects,"Project");
  fillSimpleSelect("cashProject",projects,"Project");
  fillSimpleSelect("cashFlowImportProject",projects,"Project");
  lockProjectSelectToActive_("cashProjectFilter");
  lockProjectSelectToActive_("cashProject");
  lockProjectSelectToActive_("cashFlowImportProject");
}


function cashFlowScopeOptions(project){
  let towers=(masterData&&masterData.towers||[]);
  if(project)towers=towers.filter(x=>String(x["Project"]||"")===project);

  const vals=[...new Set(towers.map(x=>x["Tower / Block"]).filter(Boolean))].sort();

  /* Cash Flow-specific scopes for Lake City Roof Garden. */
  if(!project || project==="Lake City Roof Garden"){
    ["Ground Floor","External Development"].forEach(x=>{
      if(!vals.includes(x))vals.push(x);
    });
  }

  vals.sort((a,b)=>a.localeCompare(b));
  vals.unshift("Overall / All Towers");
  return vals;
}

function updateCashFlowTowerFilter(){
  const p=document.getElementById("cashProjectFilter").value;
  const vals=cashFlowScopeOptions(p);
  const current=document.getElementById("cashTowerFilter").value;
  fillSimpleSelect("cashTowerFilter",vals,"All Towers / Scopes");
  if(vals.includes(current))document.getElementById("cashTowerFilter").value=current;
}

function updateCashFlowFormTowers(){
  const p=document.getElementById("cashProject").value;
  const vals=cashFlowScopeOptions(p);
  const current=document.getElementById("cashTower").value;
  fillSimpleSelect("cashTower",vals,"Select Tower / Scope");
  if(vals.includes(current))document.getElementById("cashTower").value=current;
}

function updateCashFlowImportTowers(){
  const p=document.getElementById("cashFlowImportProject").value;
  const vals=cashFlowScopeOptions(p);
  const current=document.getElementById("cashFlowImportTower").value;
  fillSimpleSelect("cashFlowImportTower",vals,"Select Tower / Scope");
  if(vals.includes(current))document.getElementById("cashFlowImportTower").value=current;
}

function resetCashFlowFilters(){
  lockProjectSelectToActive_("cashProjectFilter");
  updateCashFlowTowerFilter();
  document.getElementById("cashTowerFilter").value="";
  document.getElementById("cashStatusFilter").value="";
  renderCashFlow();
}

function getFilteredCashFlowRows(){
  const p=document.getElementById("cashProjectFilter").value;
  const t=document.getElementById("cashTowerFilter").value;
  const status=document.getElementById("cashStatusFilter").value;

  const unique=new Map();

  (cashFlowData||[]).forEach(r=>{
    const key=[
      String(r.serialNo||"").trim().toLowerCase(),
      String(r.project||"").trim().toLowerCase(),
      String(r.tower||"").trim().toLowerCase(),
      String(r.activity||"").trim().toLowerCase()
    ].join("||");

    /* If duplicate rows somehow exist in the sheet/API response,
       display only one logical Cash Flow line. */
    unique.set(key,r);
  });

  return Array.from(unique.values()).filter(r=>{
    if(p&&r.project!==p)return false;
    if(t&&r.tower!==t)return false;

    if(status==="awarded" && cashNum(r.awardedValue)<=0)return false;
    if(status==="spent" && cashNum(r.actualSpending)<=0)return false;
    if(status==="balance" && cashNum(r.actualBalance)<=0)return false;
    if(status==="pending" && cashNum(r.pendingApproval)<=0)return false;

    return true;
  });
}

function renderCashFlow(){
  const rows=getFilteredCashFlowRows();
  const sum=key=>rows.reduce((a,r)=>a+cashNum(r[key]),0);

  const initial=sum("initialBudget");
  const awarded=sum("awardedValue");
  const spent=sum("actualSpending");
  const balance=sum("actualBalance");
  const pending=sum("pendingApproval");
  const actualWeighted=awarded?rows.reduce((a,r)=>a+(cashNum(r.awardedValue)*cashPercent(r.actualProgress)),0)/awarded:0;
  const financial=awarded?(spent/awarded)*100:0;

  document.getElementById("cashKpiInitial").innerText=formatCashPKR(initial);
  document.getElementById("cashKpiAwarded").innerText=formatCashPKR(awarded);
  document.getElementById("cashKpiSpent").innerText=formatCashPKR(spent);
  document.getElementById("cashKpiBalance").innerText=formatCashPKR(balance);
  document.getElementById("cashKpiPending").innerText=formatCashPKR(pending);
  document.getElementById("cashKpiActualProgress").innerText=(Math.round(actualWeighted*10)/10)+"%";
  document.getElementById("cashKpiFinancialProgress").innerText=(Math.round(financial*10)/10)+"%";
  const activeStatus=document.getElementById("cashStatusFilter").value;
  document.getElementById("cashFlowCount").innerText=
    rows.length+" Record"+(rows.length===1?"":"")+
    (activeStatus?" • filtered by financial status":"");

  const c=document.getElementById("cashFlowContainer");
  if(!rows.length){
    c.className="empty-state";
    c.innerText="No Cash Flow records found. Use + Add / Update or Smart Excel Import.";
    return;
  }

  c.className="cashflow-table-wrap";
  let h='<table class="cashflow-table"><thead><tr>'+
    '<th>S.No.</th><th>Project</th><th>Tower / Scope</th><th>Activity</th><th>Initial Budget</th><th>Awarded Value</th>'+
    '<th>Actual Spending</th><th>Actual Balance</th><th>Pending Approval</th><th>Actual Progress</th><th>Financial Progress</th><th>Remarks</th><th></th>'+
    '</tr></thead><tbody>';

  rows.forEach(r=>{
    const ap=Math.max(0,Math.min(100,cashPercent(r.actualProgress)));
    const fp=Math.max(0,Math.min(100,cashPercent(r.financialProgress)));
    h+='<tr>'+
      '<td>'+escapeHtml(String(r.serialNo||""))+'</td>'+
      '<td>'+escapeHtml(r.project||"")+'</td>'+
      '<td><b>'+escapeHtml(r.tower||"")+'</b></td>'+
      '<td>'+escapeHtml(r.activity||"")+'</td>'+
      '<td class="cashflow-money">'+escapeHtml(formatCashPKR(r.initialBudget))+'</td>'+
      '<td class="cashflow-money"><b>'+escapeHtml(formatCashPKR(r.awardedValue))+'</b></td>'+
      '<td class="cashflow-money">'+escapeHtml(formatCashPKR(r.actualSpending))+'</td>'+
      '<td class="cashflow-money"><b>'+escapeHtml(formatCashPKR(r.actualBalance))+'</b></td>'+
      '<td class="cashflow-money">'+escapeHtml(formatCashPKR(r.pendingApproval))+'</td>'+
      '<td><div class="cashflow-progress-wrap"><div class="cashflow-progress-track"><div class="cashflow-progress-fill" style="width:'+ap+'%"></div></div><span class="cashflow-percent">'+(Math.round(ap*10)/10)+'%</span></div></td>'+
      '<td><div class="cashflow-progress-wrap"><div class="cashflow-progress-track"><div class="cashflow-progress-fill" style="width:'+fp+'%"></div></div><span class="cashflow-percent">'+(Math.round(fp*10)/10)+'%</span></div></td>'+
      '<td>'+escapeHtml(r.remarks||"")+'</td>'+
      '<td><button class="view-btn" data-id="'+escapeHtml(r.cashFlowId)+'" onclick="editCashFlowRecord(this.dataset.id)">Edit</button><button class="record-delete-btn" data-id="'+escapeHtml(r.cashFlowId)+'" onclick="deleteCashFlowRecord(this.dataset.id)">Delete</button></td>'+
      '</tr>';
  });

  h+='</tbody></table>';
  c.innerHTML=h;
}

function clearCashFlowForm(){
  ["cashFlowId","cashSerialNo","cashActivity","cashInitialBudget","cashAwardedValue","cashActualSpending","cashPendingApproval","cashActualProgress","cashRemarks"].forEach(id=>{
    const e=document.getElementById(id);if(e)e.value="";
  });
  populateCashFlowProjectOptions();
  lockProjectSelectToActive_("cashProject");
  updateCashFlowFormTowers();
  updateCashFlowCalcPreview();
  document.getElementById("cashFlowMessage").innerText="";
}

function openCashFlowModal(){
  if(!hasExecutiveAccess()){alert("Cash Flow is available to CEO and Project Manager only.");return;}
  ensureCashFlowMasterData(function(){
    clearCashFlowForm();
    document.getElementById("cashFlowModalTitle").innerText="Add / Update Cash Flow";
    document.getElementById("cashFlowModal").style.display="block";
  });
}

function closeCashFlowModal(e){
  if(e&&e.target!==document.getElementById("cashFlowModal"))return;
  document.getElementById("cashFlowModal").style.display="none";
}

function editCashFlowRecord(id){
  const r=(cashFlowData||[]).find(x=>String(x.cashFlowId)===String(id));
  if(!r)return;
  ensureCashFlowMasterData(function(){
    populateCashFlowProjectOptions();
    document.getElementById("cashFlowId").value=r.cashFlowId||"";
    document.getElementById("cashSerialNo").value=r.serialNo||"";
    document.getElementById("cashProject").value=r.project||"";
    updateCashFlowFormTowers();
    document.getElementById("cashTower").value=r.tower||"";
    document.getElementById("cashActivity").value=r.activity||"";
    document.getElementById("cashInitialBudget").value=cashNum(r.initialBudget);
    document.getElementById("cashAwardedValue").value=cashNum(r.awardedValue);
    document.getElementById("cashActualSpending").value=cashNum(r.actualSpending);
    document.getElementById("cashPendingApproval").value=cashNum(r.pendingApproval);
    document.getElementById("cashActualProgress").value=cashPercent(r.actualProgress);
    document.getElementById("cashRemarks").value=r.remarks||"";
    document.getElementById("cashFlowModalTitle").innerText="Update Cash Flow";
    document.getElementById("cashFlowMessage").innerText="";
    updateCashFlowCalcPreview();
    document.getElementById("cashFlowModal").style.display="block";
  });
}

function updateCashFlowCalcPreview(){
  const awarded=cashNum(document.getElementById("cashAwardedValue").value);
  const spent=cashNum(document.getElementById("cashActualSpending").value);
  const bal=awarded-spent;
  const pct=awarded?(spent/awarded)*100:0;
  document.getElementById("cashPreviewBalance").innerText=formatCashPKR(bal);
  document.getElementById("cashPreviewFinancial").innerText=(Math.round(pct*100)/100)+"%";
}

function saveCashFlowRecord(){
  const btn=document.getElementById("cashFlowSaveButton");
  const m=document.getElementById("cashFlowMessage");
  const project=document.getElementById("cashProject").value;
  const tower=document.getElementById("cashTower").value;

  if(!project||!tower){
    m.style.color="#dc2626";m.innerText="Project and Tower are required.";return;
  }

  const payload={
    cashFlowId:document.getElementById("cashFlowId").value,
    serialNo:document.getElementById("cashSerialNo").value.trim(),
    project:project,
    tower:tower,
    activity:document.getElementById("cashActivity").value.trim(),
    initialBudget:cashNum(document.getElementById("cashInitialBudget").value),
    awardedValue:cashNum(document.getElementById("cashAwardedValue").value),
    actualSpending:cashNum(document.getElementById("cashActualSpending").value),
    pendingApproval:cashNum(document.getElementById("cashPendingApproval").value),
    actualProgress:cashPercent(document.getElementById("cashActualProgress").value),
    remarks:document.getElementById("cashRemarks").value.trim()
  };

  btn.disabled=true;
  m.style.color="#475569";m.innerText="Saving Cash Flow...";
  cashFlowApi("saveCashFlow",payload)
    .then(function(r){
      btn.disabled=false;
      m.style.color="#16a34a";m.innerText=r.message||"Cash Flow saved.";
      setTimeout(function(){closeCashFlowModal();loadCashFlow();},550);
    })
    .catch(function(e){
      btn.disabled=false;
      m.style.color="#dc2626";m.innerText=e.message;
    });
}


function deleteCashFlowRecord(id){
  const r=(cashFlowData||[]).find(x=>String(x.cashFlowId)===String(id));
  if(!r)return;

  const label=[r.project,r.tower,r.activity].filter(Boolean).join(" • ");

  if(!confirm(
    "Delete this Cash Flow record?\n\n"+
    label+
    "\n\nThis action cannot be undone."
  )){
    return;
  }

  cashFlowApi("deleteCashFlow",{cashFlowId:id})
    .then(function(result){
      alert(result.message||"Cash Flow record deleted successfully.");
      loadCashFlow();
    })
    .catch(function(e){
      alert("Unable to delete Cash Flow record: "+e.message);
    });
}

/* Cash Flow Excel Import */
function cashCanon(v){
  return String(v==null?"":v).replace(/\s+/g," ").trim().toLowerCase().replace(/[_-]+/g," ").replace(/[.:]+$/g,"");
}
function cashNorm(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}

function normalizeCashFlowImportProject(v){
  const raw=cashNorm(v);
  const key=cashCanon(raw);
  if(["lcrg","lake city roof garden","lake city roof gardens"].includes(key))return "Lake City Roof Garden";
  if(["olc","one lake city"].includes(key))return "One Lake City";
  return raw;
}
function isCashFlowOverallImportValue(v){
  const key=cashCanon(v);
  return [
    "all","overall","all tower","all towers","all block","all blocks",
    "overall tower","overall towers","overall all"
  ].includes(key);
}
function normalizeCashFlowImportTower(v,defaultTower,project){
  const raw=cashNorm(v);
  const fallback=cashNorm(defaultTower);

  if(isCashFlowOverallImportValue(raw))return "Overall / All Towers";

  const source=raw||fallback;
  if(!source)return "Overall / All Towers";

  const key=cashCanon(source);

  const aliasMap={
    "i":"Tower I",
    "tower i":"Tower I",
    "l1":"L1",
    "l 1":"L1",
    "tower l1":"L1",
    "l2":"L2",
    "l 2":"L2",
    "tower l2":"L2",
    "1":"Tower 1",
    "tower 1":"Tower 1",
    "2":"Tower 2",
    "tower 2":"Tower 2",
    "gf":"Ground Floor",
    "ground floor":"Ground Floor"
  };

  const candidate=aliasMap[key]||source;

  /* Use master-data spelling whenever possible. */
  const projectKey=cashCanon(project);
  const found=(masterData&&masterData.towers||[]).find(x=>
    cashCanon(x["Project"])===projectKey &&
    cashCanon(x["Tower / Block"])===cashCanon(candidate)
  );

  return found?cashNorm(found["Tower / Block"]):candidate;
}

const CASH_ALIASES={
  serialNo:["s.no","s no","s.no.","sno","serial no","sr no","sr. no."],
  activity:["activity","work activity","scope","description"],
  project:["project","project name"],
  tower:["tower","tower / block","tower/block","block"],
  initialBudget:["budget as per initial quotation","budget as per initial quotation received","first quotation received","initial quotation","initial budget"],
  awardedValue:["awarded value / budgeted value","awarded value","budgeted value","awarded valuue"],
  actualSpending:["actual spending","actual spent","spending","actual expenditure"],
  actualBalance:["actual balance amount","actual balance","balance amount"],
  pendingApproval:["pending approval","pending approvals"],
  actualProgress:["actual progress","physical progress"],
  financialProgress:["financial progress","finance progress"],
  remarks:["remarks","remark","reason for balance","reason for balance amount"]
};
function cashAliasMatch(h,aliases){
  const c=cashCanon(h);
  return aliases.some(a=>{const x=cashCanon(a);return c===x||c.indexOf(x)!==-1;});
}
function cashFindColumn(headers,aliases){
  for(let i=0;i<headers.length;i++)if(cashAliasMatch(headers[i],aliases))return i;
  return -1;
}
function cashMapColumns(headers){
  const m={};Object.keys(CASH_ALIASES).forEach(k=>m[k]=cashFindColumn(headers,CASH_ALIASES[k]));return m;
}
function cashHeaderScore(headers){
  const m=cashMapColumns(headers);
  let s=0;
  ["initialBudget","awardedValue","actualSpending"].forEach(k=>{if(m[k]>=0)s+=3;});
  ["serialNo","activity","pendingApproval","actualProgress","financialProgress","remarks","project","tower"].forEach(k=>{if(m[k]>=0)s+=1;});
  return s;
}
function cashDetectHeader(rows){
  let best={score:-1,rowIndex:-1,headers:[]};
  const max=Math.min(rows.length,30);
  for(let r=0;r<max;r++){
    const h=(rows[r]||[]).map(cashNorm);
    const s=cashHeaderScore(h);
    if(s>best.score)best={score:s,rowIndex:r,headers:h};
  }
  if(best.score<7)throw new Error("Could not detect Cash Flow headers in the selected worksheet.");
  return best;
}
function injectCashFlowSheetJs(){
  if(window.XLSX)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload=resolve;s.onerror=()=>reject(new Error("Unable to load Excel reader library."));
    document.head.appendChild(s);
  });
}
async function loadCashFlowWorkbook(){
  const file=document.getElementById("cashFlowImportFile").files[0];
  const status=document.getElementById("cashFlowImportStatus");
  if(!file)return;
  try{
    status.style.color="#475569";status.innerText="Reading workbook...";
    await injectCashFlowSheetJs();
    const buf=await file.arrayBuffer();
    cashFlowWorkbook=XLSX.read(buf,{type:"array",cellDates:false});
    const sel=document.getElementById("cashFlowImportSheet");
    sel.innerHTML='<option value="">Select worksheet</option>';
    cashFlowWorkbook.SheetNames.forEach(n=>addOption(sel,n));
    if(cashFlowWorkbook.SheetNames.length)sel.value=cashFlowWorkbook.SheetNames[0];
    status.style.color="#166534";status.innerText="Workbook loaded. Select worksheet, Project and Tower, then Detect & Preview.";
  }catch(e){
    cashFlowWorkbook=null;status.style.color="#dc2626";status.innerText=e.message;
  }
}
function openCashFlowImport(){
  if(!hasExecutiveAccess()){alert("Cash Flow is available to CEO and Project Manager only.");return;}
  ensureCashFlowMasterData(function(){
    populateCashFlowProjectOptions();
    updateCashFlowImportTowers();
    cashFlowWorkbook=null;cashFlowImportRows=[];
    document.getElementById("cashFlowImportFile").value="";
    document.getElementById("cashFlowImportSheet").innerHTML='<option value="">Select worksheet</option>';
    document.getElementById("cashFlowImportStatus").innerText="";
    document.getElementById("cashFlowImportSummary").innerHTML="";
    document.getElementById("cashFlowImportPreview").innerHTML="";
    document.getElementById("cashFlowImportNowButton").disabled=true;
    document.getElementById("cashFlowImportModal").style.display="block";
    document.body.style.overflow="hidden";
  });
}
function closeCashFlowImport(){
  document.getElementById("cashFlowImportModal").style.display="none";
  document.body.style.overflow="";
}
function previewCashFlowExcel(){
  const status=document.getElementById("cashFlowImportStatus");
  const sheetName=document.getElementById("cashFlowImportSheet").value;
  const defaultProject=document.getElementById("cashFlowImportProject").value;
  const defaultTower=document.getElementById("cashFlowImportTower").value;
  if(!cashFlowWorkbook){status.style.color="#dc2626";status.innerText="Select an Excel file first.";return;}
  if(!sheetName){status.style.color="#dc2626";status.innerText="Select a worksheet.";return;}
  if(!defaultProject||!defaultTower){status.style.color="#dc2626";status.innerText="Select the default Project and Tower.";return;}

  try{
    const ws=cashFlowWorkbook.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});
    const detected=cashDetectHeader(rows);
    const map=cashMapColumns(detected.headers);
    const out=[];

    for(let r=detected.rowIndex+1;r<rows.length;r++){
      const row=rows[r]||[];
      const serial=map.serialNo>=0?cashNorm(row[map.serialNo]):"";
      const activity=map.activity>=0?cashNorm(row[map.activity]):"";
      const initial=map.initialBudget>=0?row[map.initialBudget]:"";
      const awarded=map.awardedValue>=0?row[map.awardedValue]:"";
      const spent=map.actualSpending>=0?row[map.actualSpending]:"";
      const pending=map.pendingApproval>=0?row[map.pendingApproval]:"";
      const actual=map.actualProgress>=0?row[map.actualProgress]:"";
      const remarks=map.remarks>=0?cashNorm(row[map.remarks]):"";
      const sourceProject=map.project>=0?cashNorm(row[map.project]):"";
      const sourceTower=map.tower>=0?cashNorm(row[map.tower]):"";
      const project=normalizeCashFlowImportProject(sourceProject||defaultProject);
      const tower=normalizeCashFlowImportTower(sourceTower,defaultTower,project);

      if(!serial && !activity && cashNorm(initial)==="" && cashNorm(awarded)==="" && cashNorm(spent)==="" && cashNorm(pending)==="" && cashNorm(actual)==="" && !remarks)continue;

      const errors=[];
      if(!project)errors.push("Project required");
      if(!tower)errors.push("Tower required");

      if(
        !["Overall / All Towers","Ground Floor","External Development"].includes(tower) &&
        !(masterData&&masterData.towers||[]).some(x=>
          cashCanon(x["Project"])===cashCanon(project) &&
          cashCanon(x["Tower / Block"])===cashCanon(tower)
        )
      ){
        errors.push("Tower / Scope not found in master data");
      }

      const initialN=cashNum(initial),awardedN=cashNum(awarded),spentN=cashNum(spent),pendingN=cashNum(pending),actualN=cashPercent(actual);
      if(initialN<0||awardedN<0||spentN<0||pendingN<0)errors.push("Amounts cannot be negative");

      out.push({
        _row:r+1,_errors:errors,
        serialNo:serial,project:project,tower:tower,activity:activity,
        initialBudget:initialN,awardedValue:awardedN,actualSpending:spentN,
        pendingApproval:pendingN,actualProgress:actualN,remarks:remarks
      });
    }

    cashFlowImportRows=out;
    const valid=out.filter(x=>!x._errors.length);
    document.getElementById("cashFlowImportSummary").innerHTML=
      '<span class="cashflow-import-chip">Rows: '+out.length+'</span>'+
      '<span class="cashflow-import-chip">Valid: '+valid.length+'</span>'+
      '<span class="cashflow-import-chip">Errors: '+(out.length-valid.length)+'</span>'+
      '<span class="cashflow-import-chip">Awarded: '+formatCashPKR(valid.reduce((a,x)=>a+x.awardedValue,0))+'</span>';

    let h='<div class="cashflow-import-table-wrap"><table class="cashflow-import-table"><thead><tr>'+
      '<th>Excel Row</th><th>S.No.</th><th>Activity</th><th>Project</th><th>Tower / Scope</th><th>Initial Budget</th><th>Awarded</th><th>Actual Spending</th><th>Balance</th><th>Pending Approval</th><th>Actual Progress</th><th>Financial Progress</th><th>Remarks</th><th>Validation</th>'+
      '</tr></thead><tbody>';
    out.forEach(x=>{
      const bal=x.awardedValue-x.actualSpending;
      const fp=x.awardedValue?(x.actualSpending/x.awardedValue)*100:0;
      h+='<tr class="'+(x._errors.length?"cashflow-import-error":"cashflow-import-valid")+'">'+
        '<td>'+x._row+'</td><td>'+escapeHtml(x.serialNo)+'</td><td>'+escapeHtml(x.activity)+'</td><td>'+escapeHtml(x.project)+'</td><td>'+escapeHtml(x.tower)+'</td>'+
        '<td>'+escapeHtml(formatCashPKR(x.initialBudget))+'</td><td>'+escapeHtml(formatCashPKR(x.awardedValue))+'</td><td>'+escapeHtml(formatCashPKR(x.actualSpending))+'</td><td>'+escapeHtml(formatCashPKR(bal))+'</td>'+
        '<td>'+escapeHtml(formatCashPKR(x.pendingApproval))+'</td><td>'+x.actualProgress.toFixed(2)+'%</td><td>'+fp.toFixed(2)+'%</td><td>'+escapeHtml(x.remarks)+'</td><td>'+(x._errors.length?escapeHtml(x._errors.join("; ")):"Ready")+'</td></tr>';
    });
    h+='</tbody></table></div>';
    document.getElementById("cashFlowImportPreview").innerHTML=h;
    status.style.color=valid.length?"#166534":"#dc2626";
    status.innerText=valid.length+" valid row(s) ready from worksheet “"+sheetName+"”. Tower aliases were normalized to master data.";
    document.getElementById("cashFlowImportNowButton").disabled=valid.length===0;
  }catch(e){
    cashFlowImportRows=[];
    document.getElementById("cashFlowImportNowButton").disabled=true;
    status.style.color="#dc2626";status.innerText=e.message;
  }
}
function commitCashFlowImport(){
  const valid=cashFlowImportRows.filter(x=>!x._errors.length).map(x=>({
    serialNo:x.serialNo,project:x.project,tower:x.tower,activity:x.activity,
    defaultTower:document.getElementById("cashFlowImportTower").value,
    initialBudget:x.initialBudget,awardedValue:x.awardedValue,
    actualSpending:x.actualSpending,pendingApproval:x.pendingApproval,
    actualProgress:x.actualProgress,remarks:x.remarks
  }));
  if(!valid.length)return;
  const btn=document.getElementById("cashFlowImportNowButton");
  const status=document.getElementById("cashFlowImportStatus");
  btn.disabled=true;status.style.color="#475569";status.innerText="Importing Cash Flow rows...";
  cashFlowApi("bulkImportCashFlow",{rows:valid})
    .then(function(r){
      btn.disabled=false;
      status.style.color=(r.errors&&r.errors.length)?"#b45309":"#166534";
      status.innerText=r.message||"Cash Flow import complete.";
      loadCashFlow();
    })
    .catch(function(e){
      btn.disabled=false;status.style.color="#dc2626";status.innerText=e.message;
    });
}


/* ===================== BOQ & COST CONTROL V2 ===================== */
let boqCostData=[];

function boqNum(v){
  const n=Number(v);
  return isNaN(n)?0:n;
}

function formatPKR(v){
  return "PKR "+Math.round(boqNum(v)).toLocaleString();
}

function boqStatusClass(v){
  return String(v||"").toLowerCase().replace(/\s+/g,"-");
}


function deleteBOQRecord(id){
  const r=(boqCostData||[]).find(x=>String(x.boqId)===String(id));
  if(!r)return;

  const label=[
    r.itemNo,
    r.description,
    r.project,
    r.tower,
    r.floor
  ].filter(Boolean).join(" • ");

  if(!confirm(
    "Delete this BOQ & Cost record?\n\n"+
    label+
    "\n\nThis action cannot be undone."
  )){
    return;
  }

  function done(result){
    alert((result&&result.message)||"BOQ item deleted successfully.");
    loadBOQCost();
  }

  function failed(e){
    alert("Unable to delete BOQ item: "+(e&&e.message?e.message:e));
  }

  if(window.LCRG_API&&typeof window.LCRG_API.call==="function"){
    window.LCRG_API.call("deleteBOQCostItem",{boqId:id})
      .then(done)
      .catch(failed);
    return;
  }

  if(window.google&&google.script&&google.script.run){
    google.script.run
      .withSuccessHandler(done)
      .withFailureHandler(failed)
      .deleteBOQCostItem({
        boqId:id,
        actorUserId:loggedInUser.userId,
        actorUsername:loggedInUser.username
      });
    return;
  }

  failed(new Error("Reporting App API is not available."));
}

function openBOQCost(){
  if(!hasExecutiveAccess()){
    alert("BOQ & Cost is available to CEO and Project Manager only.");
    return;
  }

  hideAppPages();
  document.getElementById("boqCostPage").style.display="block";

  ensureDrawingMasterData(function(){
    loadBOQCost();
  });
}

function loadBOQCost(){
  const c=document.getElementById("boqContainer");
  c.className="reports-loading";
  c.innerText="Loading BOQ & Cost register...";

  google.script.run
    .withSuccessHandler(function(rows){
      boqCostData=scopeRowsToActiveProject_(rows||[]);
      fillBOQFilters();
      renderBOQCost();
    })
    .withFailureHandler(function(e){
      c.className="empty-state";
      c.innerText="Unable to load BOQ & Cost: "+e.message;
    })
    .getBOQCostRows(loggedInUser.userId,loggedInUser.username);
}

function fillBOQFilters(){
  const unique=key=>[...new Set((boqCostData||[]).map(r=>String(r[key]||"").trim()).filter(Boolean))].sort();

  fillSimpleSelect(
    "boqProjectFilter",
    [...new Set((masterData&&masterData.projects||[]).map(x=>x["Project Name"]).filter(Boolean))].sort(),
    "Project"
  );
  lockProjectSelectToActive_("boqProjectFilter");

  updateBOQFilterTowers();
  fillSimpleSelect("boqContractorFilter",unique("contractor"),"All Contractors");
  fillSimpleSelect("boqPackageFilter",unique("workPackage"),"All Work Packages");
}

function updateBOQFilterTowers(){
  const p=document.getElementById("boqProjectFilter").value;
  let towers=(masterData&&masterData.towers||[]);
  if(p)towers=towers.filter(x=>String(x["Project"]||"")===p);
  const vals=[...new Set(towers.map(x=>x["Tower / Block"]).filter(Boolean))].sort();
  fillSimpleSelect("boqTowerFilter",vals,"All Towers / Blocks");
  updateBOQFilterFloors();
}

function updateBOQFilterFloors(){
  const p=document.getElementById("boqProjectFilter").value;
  const t=document.getElementById("boqTowerFilter").value;
  let floors=(masterData&&masterData.floors||[]);
  if(t)floors=floors.filter(x=>String(x["Tower / Block"]||"")===t);
  if(p)floors=floors.filter(x=>!x["Project"]||String(x["Project"])===p);
  const vals=[...new Set(floors.map(x=>x["Floor"]).filter(Boolean))].sort();
  fillSimpleSelect("boqFloorFilter",vals,"All Floors / Areas");
}

function resetBOQFilters(){
  ["boqSearch","boqTowerFilter","boqFloorFilter","boqContractorFilter","boqPackageFilter","boqStatusFilter"].forEach(id=>{
    const e=document.getElementById(id);
    if(e)e.value="";
  });
  lockProjectSelectToActive_("boqProjectFilter");
  updateBOQFilterTowers();
  renderBOQCost();
}

function getFilteredBOQRows(){
  const q=(document.getElementById("boqSearch").value||"").toLowerCase().trim();
  const p=document.getElementById("boqProjectFilter").value;
  const t=document.getElementById("boqTowerFilter").value;
  const f=document.getElementById("boqFloorFilter").value;
  const c=document.getElementById("boqContractorFilter").value;
  const w=document.getElementById("boqPackageFilter").value;
  const s=document.getElementById("boqStatusFilter").value;

  return (boqCostData||[]).filter(r=>{
    const txt=[r.itemNo,r.description,r.contractor,r.workPackage,r.unit,r.remarks,r.project,r.tower,r.floor].join(" ").toLowerCase();
    return (!q||txt.includes(q))&&(!p||r.project===p)&&(!t||r.tower===t)&&(!f||r.floor===f)&&(!c||r.contractor===c)&&(!w||r.workPackage===w)&&(!s||r.status===s);
  });
}

function renderBOQCost(){
  const rows=getFilteredBOQRows();

  const sum=key=>rows.reduce((a,r)=>a+boqNum(r[key]),0);
  const contract=sum("contractAmount");
  const variation=sum("variationAmount");
  const revised=sum("revisedAmount");
  const certified=sum("certifiedAmount");
  const paid=sum("paidAmount");
  const balance=sum("balanceCost");
  const pct=revised?Math.round((certified/revised)*1000)/10:0;

  document.getElementById("boqKpiContract").innerText=formatPKR(contract);
  document.getElementById("boqKpiVariation").innerText=formatPKR(variation);
  document.getElementById("boqKpiRevised").innerText=formatPKR(revised);
  document.getElementById("boqKpiCertified").innerText=formatPKR(certified);
  document.getElementById("boqKpiPaid").innerText=formatPKR(paid);
  document.getElementById("boqKpiBalance").innerText=formatPKR(balance);
  document.getElementById("boqKpiPercent").innerText=pct+"%";
  document.getElementById("boqCount").innerText=rows.length+" BOQ Item"+(rows.length===1?"":"s");

  const c=document.getElementById("boqContainer");

  if(!rows.length){
    c.className="empty-state";
    c.innerText="No BOQ items found. Use + Add BOQ Item to start the cost register.";
    return;
  }

  c.className="boq-table-wrap";

  let h='<table class="boq-table"><thead><tr>'+
    '<th>Item No.</th><th>Description</th><th>Project</th><th>Tower / Block</th><th>Floor / Area</th><th>Work Package</th><th>Contractor</th>'+
    '<th>Unit</th><th>Contract Qty</th><th>Rate</th><th>Contract Amount</th>'+
    '<th>Certified Qty</th><th>Certified Amount</th><th>Paid</th><th>Variation</th>'+
    '<th>Revised</th><th>Balance Qty</th><th>Balance Cost</th><th>Status</th><th></th>'+
    '</tr></thead><tbody>';

  rows.forEach(r=>{
    h+='<tr>'+ 
      '<td><b>'+escapeHtml(r.itemNo)+'</b></td>'+ 
      '<td>'+escapeHtml(r.description)+'</td>'+ 
      '<td>'+escapeHtml(r.project)+'</td>'+ 
      '<td>'+escapeHtml(r.tower||"-")+'</td>'+ 
      '<td>'+escapeHtml(r.floor||"-")+'</td>'+ 
      '<td>'+escapeHtml(r.workPackage)+'</td>'+ 
      '<td>'+escapeHtml(r.contractor)+'</td>'+ 
      '<td>'+escapeHtml(r.unit)+'</td>'+ 
      '<td class="boq-qty">'+escapeHtml(String(r.contractQty))+'</td>'+ 
      '<td class="boq-money">'+escapeHtml(formatPKR(r.rate))+'</td>'+ 
      '<td class="boq-money"><b>'+escapeHtml(formatPKR(r.contractAmount))+'</b></td>'+ 
      '<td class="boq-qty">'+escapeHtml(String(r.certifiedQty))+'</td>'+ 
      '<td class="boq-money">'+escapeHtml(formatPKR(r.certifiedAmount))+'</td>'+ 
      '<td class="boq-money">'+escapeHtml(formatPKR(r.paidAmount))+'</td>'+ 
      '<td class="boq-money">'+escapeHtml(formatPKR(r.variationAmount))+'</td>'+ 
      '<td class="boq-money"><b>'+escapeHtml(formatPKR(r.revisedAmount))+'</b></td>'+ 
      '<td class="boq-qty">'+escapeHtml(String(r.balanceQty))+'</td>'+ 
      '<td class="boq-money"><b>'+escapeHtml(formatPKR(r.balanceCost))+'</b></td>'+ 
      '<td><span class="boq-status '+boqStatusClass(r.status)+'">'+escapeHtml(r.status)+'</span></td>'+ 
      '<td><button class="view-btn" data-id="'+escapeHtml(r.boqId)+'" onclick="editBOQItem(this.dataset.id)">Edit</button><button class="record-delete-btn" data-id="'+escapeHtml(r.boqId)+'" onclick="deleteBOQRecord(this.dataset.id)">Delete</button></td>'+ 
      '</tr>';
  });

  h+='</tbody></table>';
  c.innerHTML=h;
}

function populateBOQMasterDropdowns(){
  const p=document.getElementById("boqProject");
  const u=document.getElementById("boqUnit");
  const currentP=p.value,currentU=u.value;

  p.innerHTML='<option value="">Select Project</option>';
  (masterData&&masterData.projects||[]).forEach(x=>addOption(p,x["Project Name"]));

  u.innerHTML='<option value="">Select Unit</option>';
  (masterData&&masterData.units||[]).forEach(x=>addOption(u,x["Unit"]));

  if(currentP)p.value=currentP;
  if(currentU)u.value=currentU;
}

function updateBOQTowers(){
  const p=value("boqProject");
  const t=document.getElementById("boqTower");
  const current=t.value;
  t.innerHTML='<option value="">Select Tower / Block</option>';

  (masterData&&masterData.towers||[])
    .filter(x=>String(x["Project"]||"")===p)
    .forEach(x=>addOption(t,x["Tower / Block"]));

  if(Array.from(t.options).some(o=>o.value===current))t.value=current;
  updateBOQFloors();
}

function updateBOQFloors(){
  const p=value("boqProject"),t=value("boqTower");
  const f=document.getElementById("boqFloor");
  const current=f.value;

  f.innerHTML='<option value="">Select Floor / Area</option>';

  if(t){
    addOption(f,"Overall / All Floors");
  }

  (masterData&&masterData.floors||[])
    .filter(x=>String(x["Tower / Block"]||"")===t && (!x["Project"]||String(x["Project"])===p))
    .forEach(x=>addOption(f,x["Floor"]));

  if(Array.from(f.options).some(o=>o.value===current))f.value=current;
}

function clearBOQForm(){
  ["boqId","boqWorkPackage","boqItemNo","boqDescription","boqContractQty","boqRate","boqContractor","boqCertifiedQty","boqPaidAmount","boqVariationAmount","boqRemarks"].forEach(id=>{
    const e=document.getElementById(id);
    if(e)e.value="";
  });

  document.getElementById("boqStatus").value="Active";
  document.getElementById("boqCertifiedQty").value="0";
  document.getElementById("boqPaidAmount").value="0";
  document.getElementById("boqVariationAmount").value="0";

  populateBOQMasterDropdowns();
  lockProjectSelectToActive_("boqProject");
  document.getElementById("boqUnit").value="";
  updateBOQTowers();
  updateBOQCalcPreview();
}

function openBOQModal(){
  if(!hasExecutiveAccess()){
    alert("BOQ & Cost is available to CEO and Project Manager only.");
    return;
  }

  ensureDrawingMasterData(function(){
    clearBOQForm();
    document.getElementById("boqModalTitle").innerText="Add BOQ Item";
    document.getElementById("boqSaveButton").innerText="Save BOQ Item";
    document.getElementById("boqMessage").innerText="";
    document.getElementById("boqModal").style.display="block";
    document.body.style.overflow="hidden";
  });
}

function editBOQItem(id){
  const r=(boqCostData||[]).find(x=>String(x.boqId)===String(id));
  if(!r)return;

  ensureDrawingMasterData(function(){
    clearBOQForm();

    document.getElementById("boqId").value=r.boqId||"";
    populateBOQMasterDropdowns();

    document.getElementById("boqProject").value=r.project||"";lockProjectSelectToActive_("boqProject");
    updateBOQTowers();

    if(r.tower && !Array.from(document.getElementById("boqTower").options).some(o=>o.value===r.tower)){
      addOption(document.getElementById("boqTower"),r.tower);
    }
    document.getElementById("boqTower").value=r.tower||"";
    updateBOQFloors();

    if(r.floor && !Array.from(document.getElementById("boqFloor").options).some(o=>o.value===r.floor)){
      addOption(document.getElementById("boqFloor"),r.floor);
    }
    document.getElementById("boqFloor").value=r.floor||"";

    document.getElementById("boqWorkPackage").value=r.workPackage||"";
    document.getElementById("boqItemNo").value=r.itemNo||"";
    document.getElementById("boqDescription").value=r.description||"";
    document.getElementById("boqUnit").value=r.unit||"";
    document.getElementById("boqContractQty").value=r.contractQty||0;
    document.getElementById("boqRate").value=r.rate||0;
    document.getElementById("boqContractor").value=r.contractor||"";
    document.getElementById("boqCertifiedQty").value=r.certifiedQty||0;
    document.getElementById("boqPaidAmount").value=r.paidAmount||0;
    document.getElementById("boqVariationAmount").value=r.variationAmount||0;
    document.getElementById("boqStatus").value=r.status||"Active";
    document.getElementById("boqRemarks").value=r.remarks||"";

    updateBOQCalcPreview();

    document.getElementById("boqModalTitle").innerText="Edit BOQ Item";
    document.getElementById("boqSaveButton").innerText="Update BOQ Item";
    document.getElementById("boqMessage").innerText="";
    document.getElementById("boqModal").style.display="block";
    document.body.style.overflow="hidden";
  });
}

function closeBOQModal(e){
  if(e&&e.target!==document.getElementById("boqModal"))return;
  document.getElementById("boqModal").style.display="none";
  document.body.style.overflow="";
}

function updateBOQCalcPreview(){
  const qty=boqNum(document.getElementById("boqContractQty").value);
  const rate=boqNum(document.getElementById("boqRate").value);
  const certQty=boqNum(document.getElementById("boqCertifiedQty").value);
  const variation=boqNum(document.getElementById("boqVariationAmount").value);

  const contract=qty*rate;
  const certified=certQty*rate;
  const revised=contract+variation;
  const balance=revised-certified;

  document.getElementById("boqPreviewContract").innerText=formatPKR(contract);
  document.getElementById("boqPreviewCertified").innerText=formatPKR(certified);
  document.getElementById("boqPreviewRevised").innerText=formatPKR(revised);
  document.getElementById("boqPreviewBalance").innerText=formatPKR(balance);
}

function saveBOQItem(){
  const payload={
    boqId:value("boqId"),
    project:value("boqProject"),
    tower:value("boqTower"),
    floor:value("boqFloor"),
    workPackage:value("boqWorkPackage"),
    itemNo:value("boqItemNo"),
    description:value("boqDescription"),
    unit:value("boqUnit"),
    contractQty:value("boqContractQty"),
    rate:value("boqRate"),
    contractor:value("boqContractor"),
    certifiedQty:value("boqCertifiedQty")||"0",
    paidAmount:value("boqPaidAmount")||"0",
    variationAmount:value("boqVariationAmount")||"0",
    status:value("boqStatus"),
    remarks:value("boqRemarks"),
    actorUserId:loggedInUser?loggedInUser.userId:"",
    actorUsername:loggedInUser?loggedInUser.username:""
  };

  const required=["project","tower","floor","workPackage","itemNo","description","unit","contractQty","rate","contractor","status"];
  const msg=document.getElementById("boqMessage");
  const btn=document.getElementById("boqSaveButton");

  if(required.some(k=>String(payload[k]||"").trim()==="")){
    msg.style.color="#dc2626";
    msg.innerText="Please complete Project, Tower / Block, Floor / Area and all mandatory BOQ fields.";
    return;
  }

  if(boqNum(payload.contractQty)<0||boqNum(payload.rate)<0||boqNum(payload.certifiedQty)<0||boqNum(payload.paidAmount)<0){
    msg.style.color="#dc2626";
    msg.innerText="Quantity, Rate, Certified Quantity and Paid Amount cannot be negative.";
    return;
  }

  btn.disabled=true;
  msg.style.color="#475569";
  msg.innerText=payload.boqId?"Updating BOQ item...":"Saving BOQ item...";

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;
      msg.style.color="#16a34a";
      msg.innerText=r.message||"BOQ item saved successfully.";

      setTimeout(function(){
        closeBOQModal();
        loadBOQCost();
      },500);
    })
    .withFailureHandler(function(e){
      btn.disabled=false;
      msg.style.color="#dc2626";
      msg.innerText=e.message;
    })
    .saveBOQCostItem(payload);
}

/* ===================== DRAWINGS REGISTER V3 – MASTER DATA + PDF UPLOAD ===================== */
let drawingsData=[];

function drawingUnique(key){
  return [...new Set((drawingsData||[]).map(x=>String(x[key]||"").trim()).filter(Boolean))].sort();
}
function fillSimpleSelect(id,vals,label){
  const el=document.getElementById(id),cur=el.value;
  el.innerHTML='<option value="">'+label+'</option>';
  vals.forEach(v=>addOption(el,v));
  if(vals.includes(cur))el.value=cur;
}
function ensureDrawingMasterData(done){
  if(masterData){
    if(done)done();
    return;
  }
  google.script.run
    .withSuccessHandler(function(d){
      masterData=d;
      if(done)done();
    })
    .withFailureHandler(function(e){
      const c=document.getElementById("drawingsContainer");
      if(c){c.className="empty-state";c.innerText="Unable to load Project / Tower / Floor master data: "+e.message;}
    })
    .getMasterData();
}
function loadDrawings(){
  const c=document.getElementById("drawingsContainer");
  c.className="reports-loading";
  c.innerText="Loading shared drawing register...";

  google.script.run
    .withSuccessHandler(function(rows){
      drawingsData=scopeRowsToActiveProject_(rows||[]);
      fillDrawingFilters();
      renderDrawings();
    })
    .withFailureHandler(function(e){
      c.className="empty-state";
      c.innerText="Unable to load Drawings Register: "+e.message;
    })
    .getDrawings(loggedInUser.userId,loggedInUser.username);
}
function openDrawings(){
  hideAppPages();
  document.getElementById("drawingsPage").style.display="block";
  ensureDrawingMasterData(function(){
    loadDrawings();
  });
}
function fillDrawingFilters(){
  const projects=(masterData&&masterData.projects||[]).map(x=>x["Project Name"]).filter(Boolean);
  fillSimpleSelect("drawingProjectFilter",[...new Set(projects)].sort(),"Project");lockProjectSelectToActive_("drawingProjectFilter");
  updateDrawingFilterTowers();
  fillSimpleSelect("drawingDisciplineFilter",drawingUnique("discipline"),"All Disciplines");
}
function updateDrawingFilterTowers(){
  const p=document.getElementById("drawingProjectFilter").value;
  let towers=(masterData&&masterData.towers||[]);
  if(p)towers=towers.filter(x=>String(x["Project"]||"")===p);
  const vals=[...new Set(towers.map(x=>x["Tower / Block"]).filter(Boolean))].sort();
  fillSimpleSelect("drawingTowerFilter",vals,"All Towers / Blocks");
  updateDrawingFilterFloors();
}
function updateDrawingFilterFloors(){
  const p=document.getElementById("drawingProjectFilter").value;
  const t=document.getElementById("drawingTowerFilter").value;
  let floors=(masterData&&masterData.floors||[]);
  if(t)floors=floors.filter(x=>String(x["Tower / Block"]||"")===t);
  if(p)floors=floors.filter(x=>!x["Project"]||String(x["Project"])===p);
  const vals=[...new Set(floors.map(x=>x["Floor"]).filter(Boolean))].sort();
  fillSimpleSelect("drawingFloorFilter",vals,"All Floors / Areas");
}
function resetDrawingFilters(){
  ["drawingSearch","drawingTowerFilter","drawingFloorFilter","drawingDisciplineFilter","drawingStatusFilter"].forEach(id=>{
    const e=document.getElementById(id);if(e)e.value="";
  });
  lockProjectSelectToActive_("drawingProjectFilter");
  updateDrawingFilterTowers();
  renderDrawings();
}
function drawingStatusClass(v){return String(v||"").toLowerCase().replace(/\s+/g,"-")}
function renderDrawings(){
  const q=(document.getElementById("drawingSearch").value||"").toLowerCase().trim();
  const p=document.getElementById("drawingProjectFilter").value;
  const t=document.getElementById("drawingTowerFilter").value;
  const f=document.getElementById("drawingFloorFilter").value;
  const d=document.getElementById("drawingDisciplineFilter").value;
  const st=document.getElementById("drawingStatusFilter").value;

  const rows=(drawingsData||[]).filter(r=>{
    const txt=[r.drawingNo,r.title,r.discipline,r.consultant,r.revision,r.remarks,r.project,r.tower,r.floor].join(" ").toLowerCase();
    return (!q||txt.includes(q))&&(!p||r.project===p)&&(!t||r.tower===t)&&(!f||r.floor===f)&&(!d||r.discipline===d)&&(!st||r.status===st);
  }).sort((x,y)=>String(y.issueDate||"").localeCompare(String(x.issueDate||"")));

  document.getElementById("drawingCount").innerText=rows.length+" Drawing"+(rows.length===1?"":"s");
  document.getElementById("drawingLatestCount").innerText=rows.filter(r=>r.status!=="Superseded").length+" Current / Latest";

  const c=document.getElementById("drawingsContainer");
  if(!rows.length){
    c.className="empty-state";
    c.innerText="No drawings found. Use + Add Drawing to start the shared register.";
    return;
  }

  c.className="drawings-table-wrap";
  let h='<table class="drawings-table"><thead><tr><th>Drawing No.</th><th>Title</th><th>Project / Tower / Floor</th><th>Discipline</th><th>Rev.</th><th>Status</th><th>Date</th><th>Consultant</th><th>File</th><th></th></tr></thead><tbody>';
  rows.forEach(r=>{
    h+='<tr>'+
      '<td><b>'+escapeHtml(r.drawingNo)+'</b></td>'+
      '<td>'+escapeHtml(r.title)+'</td>'+
      '<td>'+escapeHtml([r.project,r.tower,r.floor].filter(Boolean).join(" / "))+'</td>'+
      '<td>'+escapeHtml(r.discipline)+'</td>'+
      '<td><b>'+escapeHtml(r.revision)+'</b></td>'+
      '<td><span class="drawing-status '+drawingStatusClass(r.status)+'">'+escapeHtml(r.status)+'</span></td>'+
      '<td>'+escapeHtml(r.issueDate)+'</td>'+
      '<td>'+escapeHtml(r.consultant||"-")+'</td>'+
      '<td><a class="drawing-link" href="'+escapeHtml(r.link)+'" target="_blank" rel="noopener">View PDF</a></td>'+
      '<td><button class="view-btn" data-id="'+escapeHtml(r.drawingId)+'" onclick="editDrawing(this.dataset.id)">Edit</button></td>'+
      '</tr>';
  });
  h+='</tbody></table>';
  c.innerHTML=h;
}
function populateDrawingProjects(){
  const p=document.getElementById("drawingProject");
  const current=p.value;
  p.innerHTML='<option value="">Select Project</option>';
  (masterData&&masterData.projects||[]).forEach(x=>addOption(p,x["Project Name"]));
  if(current)p.value=current;
}
function updateDrawingTowers(){
  const p=value("drawingProject");
  const t=document.getElementById("drawingTower");
  const current=t.value;
  t.innerHTML='<option value="">Select Tower / Block</option>';
  (masterData&&masterData.towers||[])
    .filter(x=>String(x["Project"]||"")===p)
    .forEach(x=>addOption(t,x["Tower / Block"]));
  if(Array.from(t.options).some(o=>o.value===current))t.value=current;
  updateDrawingFloors();
}
function updateDrawingFloors(){
  const p=value("drawingProject"),t=value("drawingTower");
  const f=document.getElementById("drawingFloor");
  const current=f.value;
  f.innerHTML='<option value="">Select Floor / Area</option>';
  (masterData&&masterData.floors||[])
    .filter(x=>String(x["Tower / Block"]||"")===t && (!x["Project"]||String(x["Project"])===p))
    .forEach(x=>addOption(f,x["Floor"]));
  if(Array.from(f.options).some(o=>o.value===current))f.value=current;
}
function clearDrawingForm(){
  ["drawingId","drawingNo","drawingRevision","drawingTitle","drawingDiscipline","drawingStatus","drawingDate","drawingConsultant","drawingRemarks"].forEach(id=>{
    const e=document.getElementById(id);if(e)e.value="";
  });
  document.getElementById("drawingPdf").value="";
  document.getElementById("drawingExistingFile").style.display="none";
  document.getElementById("drawingExistingFile").innerHTML="";
  document.getElementById("drawingPdfReq").innerText="*";
  document.getElementById("drawingPdfNote").className="upload-note";
  document.getElementById("drawingPdfNote").innerText="Select the PDF file. It will upload automatically to Google Drive when you save.";
  populateDrawingProjects();
  lockProjectSelectToActive_("drawingProject");
  updateDrawingTowers();
}
function openDrawingModal(){
  ensureDrawingMasterData(function(){
    clearDrawingForm();
    document.getElementById("drawingModalTitle").innerText="Add Drawing";
    document.getElementById("drawingSaveButton").innerText="Upload & Save Drawing";
    document.getElementById("drawingDate").value=localToday();
    document.getElementById("drawingMessage").innerText="";
    document.getElementById("drawingModal").style.display="block";
    document.body.style.overflow="hidden";
  });
}
function editDrawing(id){
  const r=(drawingsData||[]).find(x=>String(x.drawingId)===String(id));
  if(!r)return;

  ensureDrawingMasterData(function(){
    clearDrawingForm();

    document.getElementById("drawingId").value=r.drawingId||"";
    populateDrawingProjects();
    document.getElementById("drawingProject").value=r.project||"";lockProjectSelectToActive_("drawingProject");
    updateDrawingTowers();
    document.getElementById("drawingTower").value=r.tower||"";
    updateDrawingFloors();
    document.getElementById("drawingFloor").value=r.floor||"";

    document.getElementById("drawingNo").value=r.drawingNo||"";
    document.getElementById("drawingRevision").value=r.revision||"";
    document.getElementById("drawingTitle").value=r.title||"";
    document.getElementById("drawingDiscipline").value=r.discipline||"";
    document.getElementById("drawingStatus").value=r.status||"";
    document.getElementById("drawingDate").value=r.issueDate||"";
    document.getElementById("drawingConsultant").value=r.consultant||"";
    document.getElementById("drawingRemarks").value=r.remarks||"";

    document.getElementById("drawingPdfReq").innerText="(optional replacement)";
    document.getElementById("drawingPdfNote").innerText="Leave this blank to keep the existing PDF, or select a new PDF to replace the register link.";
    const ex=document.getElementById("drawingExistingFile");
    ex.style.display="block";
    ex.innerHTML='<a class="drawing-existing-link" href="'+escapeHtml(r.link)+'" target="_blank" rel="noopener">Open Existing PDF</a>';

    document.getElementById("drawingModalTitle").innerText="Edit Drawing";
    document.getElementById("drawingSaveButton").innerText="Update Drawing";
    document.getElementById("drawingMessage").innerText="";
    document.getElementById("drawingModal").style.display="block";
    document.body.style.overflow="hidden";
  });
}
function closeDrawingModal(e){
  if(e&&e.target!==document.getElementById("drawingModal"))return;
  document.getElementById("drawingModal").style.display="none";
  document.body.style.overflow="";
}
function updateDrawingPdfName(){
  const input=document.getElementById("drawingPdf");
  const note=document.getElementById("drawingPdfNote");
  if(input.files&&input.files[0]){
    note.className="drawing-file-selected";
    note.innerText="Selected: "+input.files[0].name;
  }
}
function pdfFileToBase64(file){
  return new Promise((resolve,reject)=>{
    if(!file){resolve(null);return;}
    if(file.type!=="application/pdf" && !/\.pdf$/i.test(file.name||"")){
      reject(new Error("Please select a PDF file only."));
      return;
    }
    const reader=new FileReader();
    reader.onload=e=>resolve({
      base64:e.target.result.split(",")[1],
      mimeType:file.type||"application/pdf",
      name:file.name||"drawing.pdf"
    });
    reader.onerror=()=>reject(new Error("Unable to read the selected PDF."));
    reader.readAsDataURL(file);
  });
}
async function saveDrawing(){
  const record={
    drawingId:value("drawingId"),
    project:value("drawingProject"),
    tower:value("drawingTower"),
    floor:value("drawingFloor"),
    drawingNo:value("drawingNo"),
    revision:value("drawingRevision"),
    title:value("drawingTitle"),
    discipline:value("drawingDiscipline"),
    status:value("drawingStatus"),
    issueDate:value("drawingDate"),
    consultant:value("drawingConsultant"),
    remarks:value("drawingRemarks"),
    actorUserId:loggedInUser?loggedInUser.userId:"",
    actorUsername:loggedInUser?loggedInUser.username:""
  };

  const required=["project","tower","floor","drawingNo","revision","title","discipline","status","issueDate"];
  const m=document.getElementById("drawingMessage");
  const btn=document.getElementById("drawingSaveButton");
  const file=document.getElementById("drawingPdf").files[0]||null;

  if(required.some(k=>!String(record[k]||"").trim())){
    m.style.color="#dc2626";
    m.innerText="Please complete Project, Tower, Floor and all mandatory drawing fields.";
    return;
  }

  if(!record.drawingId && !file){
    m.style.color="#dc2626";
    m.innerText="Please select the drawing PDF file.";
    return;
  }

  try{
    btn.disabled=true;
    m.style.color="#475569";
    m.innerText=file?"Preparing PDF for upload...":"Updating drawing register...";

    const pdf=await pdfFileToBase64(file);

    m.innerText=file?"Uploading PDF to Google Drive...":"Updating drawing register...";

    google.script.run
      .withSuccessHandler(function(r){
        btn.disabled=false;
        m.style.color="#16a34a";
        m.innerText=r.message||"Drawing saved successfully.";
        setTimeout(function(){
          closeDrawingModal();
          loadDrawings();
        },650);
      })
      .withFailureHandler(function(e){
        btn.disabled=false;
        m.style.color="#dc2626";
        m.innerText=e.message;
      })
      .saveDrawingWithPdf({record:record,pdf:pdf});

  }catch(e){
    btn.disabled=false;
    m.style.color="#dc2626";
    m.innerText=e.message;
  }
}



/* ===================== DECISION / ACTION ENGINE — STAGE 1 ===================== */
let actionRegisterData=[];
let currentActionDetailId="";
let actionQuickOverdue=false;
const ACTION_CATEGORIES=["Programme","Design","Site Execution","Quality","Safety","Cost","Cash Flow","Procurement","Approval","Commercial","Drawing","Submittal","Client Decision","Other"];

function actionApi(action,data){
  data=data||{};
  if(window.LCRG_API&&typeof window.LCRG_API.call==="function") return window.LCRG_API.call(action,data);
  return new Promise(function(resolve,reject){
    const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
    const map={actionRegister:"getActionRegister",saveAction:"saveActionItem",updateAction:"addActionUpdate",closeAction:"closeActionItem",deleteAction:"deleteActionItem",actionHistory:"getActionHistory"};
    const fn=map[action]; if(!fn){reject(new Error("Action Register API method is not available."));return;}
    if(action==="actionRegister") runner[fn](loggedInUser.userId,loggedInUser.username); else {data.actorUserId=loggedInUser.userId;data.actorUsername=loggedInUser.username;runner[fn](data);}
  });
}
function actionCanClose(){const r=normalizeRole(loggedInUser&&loggedInUser.role);return ["ceo","project manager","admin"].includes(r)}
function actionCanDelete(){const r=normalizeRole(loggedInUser&&loggedInUser.role);return ["project manager","admin"].includes(r)}
function openActionRegister(mode){hideAppPages();document.getElementById("actionRegisterPage").style.display="block";actionQuickOverdue=false;ensureCashFlowMasterData(function(){populateActionFilters();loadActionRegister(function(){if(mode==="decision"){document.getElementById("actionSearch").value="Decision";}if(mode==="critical"){document.getElementById("actionPriorityFilter").value="Critical";}renderActionRegister();});});}
function loadActionRegister(cb){const c=document.getElementById("actionRegisterContainer");c.className="reports-loading";c.innerText="Loading Action Register...";actionApi("actionRegister",{}).then(function(rows){actionRegisterData=scopeRowsToActiveProject_(rows||[]);renderActionRegister();updateActionDashboardBadge();if(cb)cb();}).catch(function(e){c.className="empty-state";c.innerText="Unable to load Action Register: "+e.message;});}
function populateActionFilters(){const projects=[...new Set((masterData&&masterData.projects||[]).map(x=>x["Project Name"]).filter(Boolean))].sort();fillSimpleSelect("actionProjectFilter",projects,"Project");fillSimpleSelect("actionProject",projects,"Project");lockProjectSelectToActive_("actionProjectFilter");lockProjectSelectToActive_("actionProject");fillSimpleSelect("actionCategoryFilter",ACTION_CATEGORIES,"All Categories");updateActionTowerFilter();actionProjectChanged();}
function actionTowersForProject(project){return [...new Set((masterData&&masterData.towers||[]).filter(x=>!project||String(x["Project"]||"")===project).map(x=>x["Tower / Block"]).filter(Boolean))].sort()}
function updateActionTowerFilter(){const p=value("actionProjectFilter");fillSimpleSelect("actionTowerFilter",actionTowersForProject(p),"All Towers / Areas")}
function actionProjectChanged(){const p=value("actionProject");fillSimpleSelect("actionTower",actionTowersForProject(p),"Select Tower / Block");fillSimpleSelect("actionFloor",[],"Overall / All")}
function actionTowerChanged(){const t=value("actionTower");const floors=[...new Set((masterData&&masterData.floors||[]).filter(x=>String(x["Tower / Block"]||"")===t).map(x=>x["Floor"]).filter(Boolean))];fillSimpleSelect("actionFloor",floors,"Overall / All")}
function openActionModal(id){document.getElementById("actionModal").style.display="block";document.getElementById("actionFormMessage").innerText="";populateActionFilters();const r=(actionRegisterData||[]).find(x=>x.actionId===id);document.getElementById("actionModalTitle").innerText=r?"Edit "+r.actionId:"New Action";document.getElementById("actionId").value=r?r.actionId:"";if(r){document.getElementById("actionProject").value=r.project;lockProjectSelectToActive_("actionProject");actionProjectChanged();document.getElementById("actionTower").value=r.tower;actionTowerChanged();document.getElementById("actionFloor").value=r.floor||"";document.getElementById("actionCategory").value=r.category;document.getElementById("actionIssue").value=r.issue;document.getElementById("actionRequired").value=r.actionRequired;document.getElementById("actionResponsible").value=r.responsiblePerson;document.getElementById("actionResponsibleUsername").value=r.responsibleUsername||"";document.getElementById("actionResponsibleParty").value=r.responsibleParty;document.getElementById("actionPriority").value=r.priority;document.getElementById("actionDecisionRequired").value=r.decisionRequired;document.getElementById("actionTargetDate").value=r.targetDateInput||"";document.getElementById("actionStatus").value=r.status;document.getElementById("actionSource").value=r.source||"Manual";document.getElementById("actionProgressUpdate").value="";}else{["actionIssue","actionRequired","actionResponsible","actionResponsibleUsername","actionProgressUpdate"].forEach(id=>document.getElementById(id).value="");document.getElementById("actionCategory").value="";document.getElementById("actionResponsibleParty").value="";document.getElementById("actionPriority").value="";document.getElementById("actionDecisionRequired").value="No Decision Required";document.getElementById("actionStatus").value="Open";document.getElementById("actionSource").value="Manual";document.getElementById("actionTargetDate").value="";}}
function closeActionModal(e){if(e&&e.target!==document.getElementById("actionModal"))return;document.getElementById("actionModal").style.display="none"}
function saveActionRecord(){const btn=document.getElementById("actionSaveButton"),msg=document.getElementById("actionFormMessage");const payload={actionId:value("actionId"),project:value("actionProject"),tower:value("actionTower"),floor:value("actionFloor")||"Overall / All",category:value("actionCategory"),issue:value("actionIssue"),actionRequired:value("actionRequired"),responsiblePerson:value("actionResponsible"),responsibleUsername:value("actionResponsibleUsername"),responsibleParty:value("actionResponsibleParty"),priority:value("actionPriority"),decisionRequired:value("actionDecisionRequired"),targetDate:value("actionTargetDate"),status:value("actionStatus"),source:value("actionSource"),progressUpdate:value("actionProgressUpdate")};btn.disabled=true;msg.style.color="#64748b";msg.innerText="Saving action...";actionApi("saveAction",payload).then(function(r){btn.disabled=false;msg.style.color="#166534";msg.innerText=r.message||"Saved.";loadActionRegister();setTimeout(closeActionModal,700);}).catch(function(e){btn.disabled=false;msg.style.color="#dc2626";msg.innerText=e.message;});}
function actionIsOverdue(r){return !!r.isOverdue}
function renderActionRegister(){const c=document.getElementById("actionRegisterContainer");if(!c)return;const q=value("actionSearch").toLowerCase(),p=value("actionProjectFilter"),t=value("actionTowerFilter"),cat=value("actionCategoryFilter"),pri=value("actionPriorityFilter"),st=value("actionStatusFilter");let rows=(actionRegisterData||[]).filter(r=>(!p||r.project===p)&&(!t||r.tower===t)&&(!cat||r.category===cat)&&(!pri||r.priority===pri)&&(!st||r.status===st)&&(!actionQuickOverdue||r.isOverdue)&&(!q||[r.actionId,r.issue,r.actionRequired,r.responsiblePerson,r.responsibleParty,r.decisionRequired,r.category].join(" ").toLowerCase().includes(q)));updateActionKpis();if(!rows.length){c.className="empty-state";c.innerText="No actions match the selected filters.";return;}c.className="action-list";c.innerHTML=rows.map(function(r){const ps=String(r.priority||"Normal").toLowerCase().replace(/\s+/g,"-");const ss=String(r.status||"Open").toLowerCase().replace(/\s+/g,"-");return `<div class="action-card priority-${ps}"><div class="action-card-top"><div><div class="action-id">${esc(r.actionId)} • ${esc(r.category)}</div><div class="action-meta">${esc(r.project)} • ${esc(r.tower)} • ${esc(r.floor||"Overall / All")}</div></div><div class="action-meta">Target: <b>${esc(r.targetDate||"—")}</b></div></div><div class="action-issue">${esc(r.issue)}</div><div class="action-required"><b>Action:</b> ${esc(r.actionRequired)}</div><div class="action-tags"><span class="action-tag">${esc(r.priority)}</span><span class="action-tag status-${ss}">${esc(r.status)}</span>${r.isOverdue?'<span class="action-tag overdue">OVERDUE</span>':''}<span class="action-tag decision">${esc(r.decisionRequired)}</span><span class="action-tag">Owner: ${esc(r.responsiblePerson)}</span></div><div class="action-card-actions"><button class="action-btn view" onclick="openActionDetail('${escAttr(r.actionId)}')">View / History</button><button class="action-btn update" onclick="openActionModal('${escAttr(r.actionId)}')">Edit</button>${actionCanClose()&&r.status!=="Closed"?`<button class="action-btn close-action" onclick="closeActionRecord('${escAttr(r.actionId)}')">Close</button>`:""}${actionCanDelete()?`<button class="action-btn delete-action" onclick="deleteActionRecord('${escAttr(r.actionId)}')">Delete</button>`:""}</div></div>`}).join("");}
function updateActionKpis(){const rows=actionRegisterData||[];document.getElementById("actionKpiCritical").innerText=rows.filter(r=>r.priority==="Critical"&&r.status!=="Closed").length;document.getElementById("actionKpiHigh").innerText=rows.filter(r=>r.priority==="High"&&r.status!=="Closed").length;document.getElementById("actionKpiOverdue").innerText=rows.filter(r=>r.isOverdue).length;document.getElementById("actionKpiOpen").innerText=rows.filter(r=>r.status==="Open").length;document.getElementById("actionKpiProgress").innerText=rows.filter(r=>r.status==="In Progress").length;document.getElementById("actionKpiClosed").innerText=rows.filter(r=>r.status==="Closed").length;}
function setActionQuickFilter(type,val){resetActionFilters(false);if(type==="priority")document.getElementById("actionPriorityFilter").value=val;if(type==="status")document.getElementById("actionStatusFilter").value=val;if(type==="overdue")actionQuickOverdue=true;renderActionRegister()}
function resetActionFilters(render=true){["actionSearch","actionTowerFilter","actionCategoryFilter","actionPriorityFilter","actionStatusFilter"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});lockProjectSelectToActive_("actionProjectFilter");actionQuickOverdue=false;updateActionTowerFilter();if(render)renderActionRegister()}
function updateActionDashboardBadge(){const active=getActiveProject();const rows=(actionRegisterData||[]).filter(r=>!active||normalizeProjectName_(r.project)===active),open=rows.filter(r=>r.status!=="Closed").length,urgent=rows.filter(r=>r.status!=="Closed"&&(r.priority==="Critical"||r.isOverdue)).length,decisions=rows.filter(r=>r.status!=="Closed"&&String(r.decisionRequired||"").trim()&&String(r.decisionRequired||"").trim()!=="No Decision Required").length;const n=document.getElementById("dashOpenActions"),b=document.getElementById("actionNotificationBadge"),d=document.getElementById("dashDecisionActions"),c=document.getElementById("dashCriticalActions"),sd=document.getElementById("sidebarDecisionBadge"),sc=document.getElementById("sidebarCriticalBadge"),cc=document.getElementById("ceoCriticalCount");if(n)n.innerText=open;if(d)d.innerText=decisions;if(c)c.innerText=urgent;if(cc)cc.innerText=urgent;if(b){b.innerText=open;b.style.display=open?"flex":"none"}if(sd){sd.innerText=decisions;sd.style.display=decisions?"flex":"none"}if(sc){sc.innerText=urgent;sc.style.display=urgent?"flex":"none"}}
function loadActionDashboardBadge(){if(!loggedInUser)return;actionApi("actionRegister",{}).then(function(rows){actionRegisterData=rows||[];updateActionDashboardBadge();}).catch(function(){})}
function openActionDetail(id){currentActionDetailId=id;const r=(actionRegisterData||[]).find(x=>x.actionId===id);if(!r)return;document.getElementById("actionDetailModal").style.display="block";document.getElementById("actionDetailTitle").innerText=r.actionId+" — "+r.category;document.getElementById("actionDetailPath").innerText=[r.project,r.tower,r.floor].filter(Boolean).join(" • ");document.getElementById("actionDetailBody").innerHTML=`<div class="detail-grid"><div class="detail-item"><strong>Issue / Constraint</strong>${esc(r.issue)}</div><div class="detail-item"><strong>Priority</strong>${esc(r.priority)}${r.isOverdue?" • OVERDUE":""}</div><div class="detail-item"><strong>Action Required</strong>${esc(r.actionRequired)}</div><div class="detail-item"><strong>Responsible</strong>${esc(r.responsiblePerson)} • ${esc(r.responsibleParty)}</div><div class="detail-item"><strong>Decision Required</strong>${esc(r.decisionRequired)}</div><div class="detail-item"><strong>Target / Status</strong>${esc(r.targetDate)} • ${esc(r.status)}</div><div class="detail-item"><strong>Raised By</strong>${esc(r.raisedBy)} • ${esc(r.dateRaised)}</div><div class="detail-item"><strong>Source</strong>${esc(r.source||"Manual")}</div></div>`;document.getElementById("actionUpdateText").value="";document.getElementById("actionDetailMessage").innerText="";loadActionHistory(id)}
function closeActionDetailModal(e){if(e&&e.target!==document.getElementById("actionDetailModal"))return;document.getElementById("actionDetailModal").style.display="none"}
function loadActionHistory(id){const c=document.getElementById("actionHistoryContainer");c.innerHTML='<div class="reports-loading">Loading history...</div>';actionApi("actionHistory",{actionId:id}).then(function(rows){if(!rows||!rows.length){c.innerHTML='<div class="empty-state">No updates yet.</div>';return;}c.innerHTML=rows.map(x=>`<div class="action-history-item"><div class="action-history-head"><b>${esc(x.updatedBy)}</b><span>${esc(x.updatedAt)}</span></div><div class="action-history-text">${esc(x.updateText)}</div></div>`).join("");}).catch(e=>c.innerHTML='<div class="empty-state">'+esc(e.message)+'</div>')}
function appendActionUpdate(){const txt=value("actionUpdateText"),msg=document.getElementById("actionDetailMessage");if(!txt){msg.style.color="#dc2626";msg.innerText="Please enter an update.";return;}actionApi("updateAction",{actionId:currentActionDetailId,updateText:txt}).then(function(r){msg.style.color="#166534";msg.innerText=r.message||"Update added.";document.getElementById("actionUpdateText").value="";loadActionHistory(currentActionDetailId);loadActionRegister();}).catch(function(e){msg.style.color="#dc2626";msg.innerText=e.message;})}
function closeActionRecord(id){const remarks=prompt("Closure remarks for "+id+":");if(remarks===null)return;if(!remarks.trim()){alert("Closure remarks are required.");return;}actionApi("closeAction",{actionId:id,closureRemarks:remarks.trim()}).then(function(r){loadActionRegister();alert(r.message||"Action closed.");}).catch(e=>alert(e.message))}
function deleteActionRecord(id){if(!confirm("Delete "+id+"? This is restricted to Project Manager / Admin and should only be used for erroneous records."))return;actionApi("deleteAction",{actionId:id}).then(function(r){loadActionRegister();alert(r.message||"Action deleted.");}).catch(e=>alert(e.message))}


/* ===================== PROGRAMME CONTROL ===================== */
let programmeData=[],programmeEditId="";
function programmeApi(action,data){if(window.LCRG_API&&typeof LCRG_API.apiRequest==="function")return LCRG_API.apiRequest(action,data||{});return Promise.reject(new Error("API not available."))}
function openProgramme(){
  if(!hasExecutiveAccess()){alert("Programme Control is available to CEO and Project Manager only.");return}
  hideAppPages();document.getElementById("programmePage").style.display="block";
  loadProgramme();
}
function loadProgramme(){
  programmeApi("programme",{}).then(rows=>{
    programmeData=scopeRowsToActiveProject_(rows||[]);
    populateProgrammeFilters();renderProgramme();
  }).catch(e=>{document.getElementById("programmeTableContainer").innerHTML='<div class="empty-state">'+escapeHtml(e.message||String(e))+'</div>'});
}
function populateProgrammeFilters(){
  const active=getActiveProject();
  fillSimpleSelect("programmeProjectFilter",[active],"Project");lockProjectSelectToActive_("programmeProjectFilter");
  const towers=[...new Set(programmeData.map(r=>r.tower).filter(Boolean))].sort();
  fillSimpleSelect("programmeTowerFilter",towers,"All Towers / Areas");
}
function resetProgrammeFilters(){
  document.getElementById("programmeSearch").value="";
  document.getElementById("programmeTowerFilter").value="";
  document.getElementById("programmeStatusFilter").value="";
  lockProjectSelectToActive_("programmeProjectFilter");renderProgramme();
}
function programmeVarianceClass(v){v=Number(v||0);return v>0?"control-danger":v<0?"control-good":""}
function renderProgramme(){
  const q=value("programmeSearch").toLowerCase(),tower=value("programmeTowerFilter"),status=value("programmeStatusFilter");
  const rows=programmeData.filter(r=>{
    const s=[r.milestone,r.tower,r.remarks].join(" ").toLowerCase();
    return (!q||s.includes(q))&&(!tower||r.tower===tower)&&(!status||r.status===status);
  });
  const delayed=rows.filter(r=>r.isDelayed||r.status==="Delayed").length;
  setText("progKpiTotal",rows.length);setText("progKpiCompleted",rows.filter(r=>r.status==="Completed").length);
  setText("progKpiProgress",rows.filter(r=>r.status==="In Progress").length);setText("progKpiDelayed",delayed);
  const maxVar=rows.length?Math.max(0,...rows.map(r=>Number(r.varianceDays||0))):0;setText("progKpiVariance",maxVar+" d");
  const box=document.getElementById("programmeTableContainer");
  if(!rows.length){box.innerHTML='<div class="empty-state">No programme milestones found for this project / filter.</div>';return}
  box.innerHTML='<table class="control-table"><thead><tr><th>Milestone</th><th>Tower / Area</th><th>Baseline</th><th>Forecast</th><th>Actual</th><th>Status</th><th>Progress</th><th>Variance</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td><b>'+escapeHtml(r.milestone)+'</b></td><td>'+escapeHtml(r.tower)+'</td><td>'+escapeHtml(r.baselineDate)+'</td><td>'+escapeHtml(r.forecastDate)+'</td><td>'+escapeHtml(r.actualDate||"—")+'</td><td><span class="control-status '+slugify(r.status)+'">'+escapeHtml(r.status)+'</span></td><td>'+Number(r.progress||0).toFixed(1)+'%</td><td class="'+programmeVarianceClass(r.varianceDays)+'">'+Number(r.varianceDays||0)+' d</td><td>'+escapeHtml(r.remarks||"")+'</td><td><button class="control-edit" onclick="openProgrammeModal(\''+escAttr(r.programmeId)+'\')">Edit</button><button class="control-delete" onclick="deleteProgrammeItem(\''+escAttr(r.programmeId)+'\')">Delete</button></td></tr>').join("")+
    '</tbody></table>';
}
function openProgrammeModal(id){
  programmeEditId=id||"";
  const r=programmeData.find(x=>x.programmeId===programmeEditId)||{};
  fillSimpleSelect("programmeProject",[getActiveProject()],"Project");lockProjectSelectToActive_("programmeProject");
  const towers=(masterData?.towers||[]).filter(t=>normalizeProjectName_(t["Project"]||"")===getActiveProject()).map(t=>t["Tower / Block"]).filter(Boolean);
  fillSimpleSelect("programmeTower",[...new Set(towers)],"Select Tower / Area");
  document.getElementById("programmeTower").value=r.tower||"";
  document.getElementById("programmeMilestone").value=r.milestone||"";
  document.getElementById("programmeBaselineDate").value=r.baselineDateInput||"";
  document.getElementById("programmeForecastDate").value=r.forecastDateInput||"";
  document.getElementById("programmeActualDate").value=r.actualDateInput||"";
  document.getElementById("programmeStatus").value=r.status||"Not Started";
  document.getElementById("programmeProgress").value=r.progress??0;
  document.getElementById("programmeRemarks").value=r.remarks||"";
  setText("programmeModalTitle",programmeEditId?"Edit Programme Milestone":"Add Programme Milestone");
  setText("programmeMessage","");document.getElementById("programmeModal").style.display="block";
}
function closeProgrammeModal(){document.getElementById("programmeModal").style.display="none"}
function saveProgrammeItem(){
  const payload={programmeId:programmeEditId,project:getActiveProject(),tower:value("programmeTower"),milestone:value("programmeMilestone"),baselineDate:value("programmeBaselineDate"),forecastDate:value("programmeForecastDate"),actualDate:value("programmeActualDate"),status:value("programmeStatus"),progress:value("programmeProgress"),remarks:value("programmeRemarks")};
  const msg=document.getElementById("programmeMessage");
  if(!payload.project||!payload.tower||!payload.milestone||!payload.baselineDate||!payload.forecastDate||!payload.status){msg.style.color="#dc2626";msg.innerText="Please complete all mandatory fields.";return}
  msg.style.color="#475569";msg.innerText="Saving...";
  programmeApi("saveProgramme",payload).then(r=>{msg.style.color="#166534";msg.innerText=r.message||"Saved.";setTimeout(()=>{closeProgrammeModal();loadProgramme();loadManagementCockpit()},450)}).catch(e=>{msg.style.color="#dc2626";msg.innerText=e.message||String(e)});
}
function deleteProgrammeItem(id){
  if(!confirm("Delete this programme milestone?"))return;
  programmeApi("deleteProgramme",{programmeId:id}).then(()=>{loadProgramme();loadManagementCockpit()}).catch(e=>alert(e.message||String(e)));
}

/* ===================== PROCUREMENT CONTROL ===================== */
let procurementData=[],procurementEditId="";
function procurementApi(action,data){if(window.LCRG_API&&typeof LCRG_API.apiRequest==="function")return LCRG_API.apiRequest(action,data||{});return Promise.reject(new Error("API not available."))}
function openProcurement(){
  if(!hasExecutiveAccess()){alert("Procurement Control is available to CEO and Project Manager only.");return}
  hideAppPages();document.getElementById("procurementPage").style.display="block";loadProcurement();
}
function loadProcurement(){
  procurementApi("procurement",{}).then(rows=>{
    procurementData=scopeRowsToActiveProject_(rows||[]);
    populateProcurementFilters();renderProcurement();
  }).catch(e=>{document.getElementById("procurementTableContainer").innerHTML='<div class="empty-state">'+escapeHtml(e.message||String(e))+'</div>'});
}
function populateProcurementFilters(){
  const active=getActiveProject();
  fillSimpleSelect("procurementProjectFilter",[active],"Project");lockProjectSelectToActive_("procurementProjectFilter");
  const towers=[...new Set(procurementData.map(r=>r.tower).filter(Boolean))].sort();
  fillSimpleSelect("procurementTowerFilter",towers,"All Towers / Areas");
}
function resetProcurementFilters(){
  document.getElementById("procurementSearch").value="";
  document.getElementById("procurementTowerFilter").value="";
  document.getElementById("procurementStatusFilter").value="";
  lockProjectSelectToActive_("procurementProjectFilter");renderProcurement();
}
function renderProcurement(){
  const q=value("procurementSearch").toLowerCase(),tower=value("procurementTowerFilter"),status=value("procurementStatusFilter");
  const rows=procurementData.filter(r=>{
    const s=[r.packageName,r.vendor,r.tower,r.remarks].join(" ").toLowerCase();
    return (!q||s.includes(q))&&(!tower||r.tower===tower)&&(!status||r.status===status);
  });
  const delivered=rows.filter(r=>["Delivered","Closed"].includes(r.status)).length;
  const awarded=rows.filter(r=>["Awarded","Manufacturing","Shipped","Delivered","Closed"].includes(r.status)).length;
  const late=rows.filter(r=>r.isLate||r.isAtRisk).length;
  const totalValue=rows.reduce((a,r)=>a+Number(r.packageValue||0),0);
  setText("procKpiTotal",rows.length);setText("procKpiAwarded",awarded);setText("procKpiDelivered",delivered);setText("procKpiLate",late);setText("procKpiValue",cockpitMoney(totalValue));
  const box=document.getElementById("procurementTableContainer");
  if(!rows.length){box.innerHTML='<div class="empty-state">No procurement packages found for this project / filter.</div>';return}
  box.innerHTML='<table class="control-table"><thead><tr><th>Package</th><th>Tower / Area</th><th>Vendor</th><th>Status</th><th>Required on Site</th><th>Forecast</th><th>Actual</th><th>Variance</th><th>Lead Time</th><th>Value</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td><b>'+escapeHtml(r.packageName)+'</b></td><td>'+escapeHtml(r.tower)+'</td><td>'+escapeHtml(r.vendor||"—")+'</td><td><span class="control-status '+slugify(r.status)+'">'+escapeHtml(r.status)+'</span></td><td>'+escapeHtml(r.requiredDate)+'</td><td>'+escapeHtml(r.forecastDate)+'</td><td>'+escapeHtml(r.actualDate||"—")+'</td><td class="'+(Number(r.varianceDays)>0?"control-danger":Number(r.varianceDays)<0?"control-good":"")+'">'+Number(r.varianceDays||0)+' d</td><td>'+Number(r.leadTimeDays||0)+' d</td><td>'+cockpitMoney(r.packageValue||0)+'</td><td>'+escapeHtml(r.remarks||"")+'</td><td><button class="control-edit" onclick="openProcurementModal(\''+escAttr(r.procurementId)+'\')">Edit</button><button class="control-delete" onclick="deleteProcurementItem(\''+escAttr(r.procurementId)+'\')">Delete</button></td></tr>').join("")+
    '</tbody></table>';
}
function openProcurementModal(id){
  procurementEditId=id||"";
  const r=procurementData.find(x=>x.procurementId===procurementEditId)||{};
  fillSimpleSelect("procurementProject",[getActiveProject()],"Project");lockProjectSelectToActive_("procurementProject");
  const towers=(masterData?.towers||[]).filter(t=>normalizeProjectName_(t["Project"]||"")===getActiveProject()).map(t=>t["Tower / Block"]).filter(Boolean);
  fillSimpleSelect("procurementTower",[...new Set(towers)],"Select Tower / Area");
  document.getElementById("procurementTower").value=r.tower||"";
  document.getElementById("procurementPackage").value=r.packageName||"";
  document.getElementById("procurementVendor").value=r.vendor||"";
  document.getElementById("procurementStatus").value=r.status||"Planned";
  document.getElementById("procurementRequiredDate").value=r.requiredDateInput||"";
  document.getElementById("procurementForecastDate").value=r.forecastDateInput||"";
  document.getElementById("procurementActualDate").value=r.actualDateInput||"";
  document.getElementById("procurementLeadTime").value=r.leadTimeDays??"";
  document.getElementById("procurementValue").value=r.packageValue??"";
  document.getElementById("procurementRemarks").value=r.remarks||"";
  setText("procurementModalTitle",procurementEditId?"Edit Procurement Package":"Add Procurement Package");
  setText("procurementMessage","");document.getElementById("procurementModal").style.display="block";
}
function closeProcurementModal(){document.getElementById("procurementModal").style.display="none"}
function saveProcurementItem(){
  const payload={procurementId:procurementEditId,project:getActiveProject(),tower:value("procurementTower"),packageName:value("procurementPackage"),vendor:value("procurementVendor"),status:value("procurementStatus"),requiredDate:value("procurementRequiredDate"),forecastDate:value("procurementForecastDate"),actualDate:value("procurementActualDate"),leadTimeDays:value("procurementLeadTime"),packageValue:value("procurementValue"),remarks:value("procurementRemarks")};
  const msg=document.getElementById("procurementMessage");
  if(!payload.project||!payload.tower||!payload.packageName||!payload.status||!payload.requiredDate||!payload.forecastDate){msg.style.color="#dc2626";msg.innerText="Please complete all mandatory fields.";return}
  msg.style.color="#475569";msg.innerText="Saving...";
  procurementApi("saveProcurement",payload).then(r=>{msg.style.color="#166534";msg.innerText=r.message||"Saved.";setTimeout(()=>{closeProcurementModal();loadProcurement();loadManagementCockpit()},450)}).catch(e=>{msg.style.color="#dc2626";msg.innerText=e.message||String(e)});
}
function deleteProcurementItem(id){
  if(!confirm("Delete this procurement package?"))return;
  procurementApi("deleteProcurement",{procurementId:id}).then(()=>{loadProcurement();loadManagementCockpit()}).catch(e=>alert(e.message||String(e)));
}

function openPlaceholderModule(icon,title,text){hideAppPages();document.getElementById("placeholderModulePage").style.display="block";document.getElementById("placeholderModuleHeader").innerText=icon+" "+title;document.getElementById("placeholderModuleIcon").innerText=icon;document.getElementById("placeholderModuleTitle").innerText=title;document.getElementById("placeholderModuleText").innerText=text}

function toggleDashboardSidebar(open){const s=document.getElementById("pmcSidebar");if(!s)return;s.classList.toggle("open",open!==false);}
function syncDashboardSidebarUser(){if(!loggedInUser)return;const name=document.getElementById("sidebarUserName"),role=document.getElementById("sidebarUserRole"),initials=document.getElementById("sidebarUserInitials");if(name)name.innerText=loggedInUser.supervisorName||loggedInUser.username||"User";if(role)role.innerText=loggedInUser.role||"";if(initials){const parts=String(loggedInUser.supervisorName||loggedInUser.username||"U").trim().split(/\s+/);initials.innerText=(parts[0]?.[0]||"U")+(parts.length>1?(parts[parts.length-1][0]||""):"");}syncSmartTopbarUser_();}

function logout(){localStorage.removeItem(ACTIVE_PROJECT_KEY);localStorage.removeItem("managementCockpitProject");loggedInUser=null;if(window.LCRG_API&&LCRG_API.clearToken)LCRG_API.clearToken();location.reload()}
window.onload=function(){let u=localStorage.getItem("rememberedUsername");if(u){document.getElementById("username").value=u;document.getElementById("rememberMe").checked=true}updateStepDisplay();updateNetworkStatus();updateDashboardDraftBadge()}

function parseReportDate(s){
  if(!s)return null;
  const m=String(s).match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(!m)return null;
  const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  return new Date(Number(m[3]),months[m[2]],Number(m[1]),Number(m[4]||0),Number(m[5]||0));
}
function resetMyReportFilters(){
  ["reportSearch","reportProject","reportTower","reportFloor","reportStatus","reportFromDate","reportToDate"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  applyReportFilters();
}

