/* Design Management - Look-Ahead Dashboard Integration V1
   Adds shared Design Look-Ahead KPIs and immediate actions to the Design Dashboard.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  let rows=[];
  let loading=false;
  let installed=false;

  const activeProject=()=>{try{return typeof getActiveProject==="function"?String(getActiveProject()||"").trim():"";}catch(_e){return"";}};
  const isoToday=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
  const dateObj=s=>s?new Date(String(s).slice(0,10)+"T00:00:00"):null;
  const daysFromToday=s=>{const d=dateObj(s),t=dateObj(isoToday());return d&&!isNaN(d.getTime())?Math.floor((d-t)/86400000):99999;};
  const closed=r=>["Ready","Closed"].includes(String(r&&r.status||""));
  const projectRows=()=>{const p=activeProject();return rows.filter(r=>!p||String(r.project||"").trim()===p);};
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");

  function metrics(list){
    return {
      overdue:list.filter(r=>!closed(r)&&daysFromToday(r.requiredDate)<0).length,
      risk:list.filter(r=>!closed(r)&&String(r.status||"")==="At Risk").length,
      due7:list.filter(r=>{const n=daysFromToday(r.requiredDate);return !closed(r)&&n>=0&&n<=7;}).length,
      due14:list.filter(r=>{const n=daysFromToday(r.requiredDate);return !closed(r)&&n>=0&&n<=14;}).length
    };
  }

  function ensureStyles(){
    if($("designDashboardLookAheadStyles"))return;
    const s=document.createElement("style");s.id="designDashboardLookAheadStyles";
    s.textContent=`
      .ddl-wrap{margin:14px 0 4px;border-top:1px solid #e5e7eb;padding-top:14px}
      .ddl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .ddl-head b{font-size:13px;color:#172b4d}.ddl-head span{display:block;margin-top:2px;font-size:10px;color:#64748b}
      .ddl-open{border:0;border-radius:8px;background:#0b3f88;color:#fff;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}
      .ddl-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:10px}
      .ddl-card{border:1px solid #e2e8f0;background:#fff;border-radius:11px;padding:11px 12px;cursor:pointer}
      .ddl-card span{display:block;font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.ddl-card b{display:block;font-size:21px;color:#172b4d;margin-top:4px}
      .ddl-card.overdue{border-top:3px solid #dc2626}.ddl-card.risk{border-top:3px solid #ea580c}.ddl-card.week{border-top:3px solid #2563eb}.ddl-card.two{border-top:3px solid #0891b2}
      .ddl-actions{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}.ddl-actions-title{padding:9px 11px;background:#f8fafc;font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}
      .ddl-row{display:grid;grid-template-columns:95px 1.7fr 1.2fr 1fr 85px;gap:8px;padding:8px 11px;border-top:1px solid #eef2f7;align-items:center;font-size:9px}.ddl-row b{font-size:10px;color:#172b4d}.ddl-state{font-weight:900}.ddl-state.overdue{color:#b91c1c}.ddl-state.risk{color:#c2410c}.ddl-empty{padding:14px;text-align:center;color:#64748b;font-size:10px}.ddl-status{font-size:9px;color:#64748b;margin-top:5px}
      @media(max-width:900px){.ddl-grid{grid-template-columns:repeat(2,1fr)}.ddl-row{grid-template-columns:85px 1fr 1fr}.ddl-row .ddl-hide-mobile{display:none}}
    `;
    document.head.appendChild(s);
  }

  function ensurePanel(){
    const panel=$("designDashboardPanel");if(!panel)return null;
    let wrap=$("designDashboardLookAhead");
    if(wrap)return wrap;
    wrap=document.createElement("div");wrap.id="designDashboardLookAhead";wrap.className="ddl-wrap";
    wrap.innerHTML='<div class="ddl-head"><div><b>4-Week Design Look-Ahead</b><span>Upcoming design inputs that may affect planned site activities.</span><div id="ddlStatus" class="ddl-status"></div></div><button id="ddlOpen" class="ddl-open" type="button">Open Look-Ahead →</button></div><div id="ddlGrid" class="ddl-grid"></div><div id="ddlActions" class="ddl-actions"></div>';
    const note=panel.querySelector('.design-dashboard-note');
    if(note)note.insertAdjacentElement('afterend',wrap);else panel.appendChild(wrap);
    $("ddlOpen").onclick=openLookAhead;
    return wrap;
  }

  function openLookAhead(){const tab=$("designLookAheadTab");if(tab&&typeof tab.click==="function")tab.click();}

  function urgency(r){
    const n=daysFromToday(r.requiredDate);
    if(!closed(r)&&n<0)return {label:"Overdue",cls:"overdue",rank:0};
    if(!closed(r)&&String(r.status||"")==="At Risk")return {label:"At Risk",cls:"risk",rank:1};
    if(!closed(r)&&n>=0&&n<=7)return {label:"Due This Week",cls:"",rank:2};
    if(!closed(r)&&n>=0&&n<=14)return {label:"Due Next 2 Weeks",cls:"",rank:3};
    return {label:String(r.status||"Planned"),cls:"",rank:4};
  }

  function render(){
    if(!ensurePanel())return;
    const list=projectRows();const m=metrics(list);
    $("ddlGrid").innerHTML=
      '<div class="ddl-card overdue" data-kind="overdue"><span>Overdue</span><b>'+m.overdue+'</b></div>'+ 
      '<div class="ddl-card risk" data-kind="risk"><span>At Risk</span><b>'+m.risk+'</b></div>'+ 
      '<div class="ddl-card week" data-kind="week"><span>Due This Week</span><b>'+m.due7+'</b></div>'+ 
      '<div class="ddl-card two" data-kind="two"><span>Due Next 2 Weeks</span><b>'+m.due14+'</b></div>';
    $("ddlGrid").querySelectorAll('.ddl-card').forEach(x=>x.onclick=openLookAhead);

    const actions=list.filter(r=>!closed(r)&&daysFromToday(r.requiredDate)<=14)
      .sort((a,b)=>{const ua=urgency(a),ub=urgency(b);if(ua.rank!==ub.rank)return ua.rank-ub.rank;return String(a.requiredDate||"9999").localeCompare(String(b.requiredDate||"9999"));})
      .slice(0,6);
    if(!actions.length){$("ddlActions").innerHTML='<div class="ddl-actions-title">Immediate Design Actions</div><div class="ddl-empty">No overdue, at-risk or next-14-day Look-Ahead actions for this project.</div>';return;}
    $("ddlActions").innerHTML='<div class="ddl-actions-title">Immediate Design Actions</div>'+actions.map(r=>{const u=urgency(r);return '<div class="ddl-row"><div>'+esc(r.requiredDate||'—')+'</div><div><b>'+esc(r.activity||r.deliverable||'—')+'</b><br>'+esc(r.deliverable||'')+'</div><div class="ddl-hide-mobile">'+esc(r.requirement||'—')+'</div><div class="ddl-hide-mobile">'+esc(r.responsible||'—')+'</div><div class="ddl-state '+u.cls+'">'+esc(u.label)+'</div></div>';}).join('');
  }

  function api(action,data){if(!window.LCRG_API||typeof window.LCRG_API.call!=="function")return Promise.reject(new Error("API not ready"));return window.LCRG_API.call(action,data||{});}
  async function loadShared(){
    if(loading)return;loading=true;ensurePanel();
    if($("ddlStatus"))$("ddlStatus").textContent="Refreshing shared Look-Ahead…";
    try{
      let result;
      try{result=await api("designLookAhead",{project:activeProject()});}
      catch(first){await new Promise(r=>setTimeout(r,700));result=await api("designLookAhead",{project:activeProject()});}
      rows=Array.isArray(result)?result:(result&&Array.isArray(result.rows)?result.rows:[]);
      if($("ddlStatus"))$("ddlStatus").textContent="Shared Look-Ahead connected";
      render();
    }catch(e){
      if($("ddlStatus"))$("ddlStatus").textContent="Look-Ahead summary unavailable — open Look-Ahead to retry";
      render();
    }finally{loading=false;}
  }

  function install(){
    const panel=$("designDashboardPanel");if(!panel){setTimeout(install,250);return;}
    if(installed)return;installed=true;ensureStyles();ensurePanel();render();loadShared();
    const tab=$("designDashboardTab");if(tab)tab.addEventListener('click',()=>setTimeout(loadShared,80));
    document.addEventListener('designLookAheadUpdated',()=>setTimeout(loadShared,50));
    window.refreshDesignLookAheadDashboard=loadShared;
  }

  function boot(){setTimeout(install,250);setTimeout(install,900);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.addEventListener("load",boot,{once:true});
})();