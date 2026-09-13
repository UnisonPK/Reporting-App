/* PMC App Performance V2
   Progressive dashboard loading + lazy Programme enhancement loading.
   Keeps the large index.html baseline and existing module APIs intact.
*/
(function(){
  "use strict";
  if(window.__PMC_PERFORMANCE_V2__)return;
  window.__PMC_PERFORMANCE_V2__=true;

  const loaded=new Map();
  const programmeScripts=[
    ["programmeControlEnhancementScript","programme-control-enhancement.js?v=20260912-2"],
    ["programmeScheduleImportScript","programme-schedule-import.js?v=20260912-2"],
    ["programmeDelayLookAheadScript","programme-delay-lookahead.js?v=20260912-1"],
    ["programmeReadinessControlScript","programme-readiness-control.js?v=20260912-1"],
    ["programmeFloatControlScript","programme-float-control.js?v=20260913-1"],
    ["programmeTopActionsScript","programme-top-actions.js?v=20260913-1"]
  ];
  const cockpitScripts=[
    ["managementCockpitProgrammeScript","management-cockpit-programme.js?v=20260912-1"],
    ["managementCockpitDesignScript","management-cockpit-design.js?v=20260911-1"],
    ["dashboardSectionOrderScript","dashboard-section-order.js?v=20260911-3"]
  ];

  function loadScript(id,src){
    if(document.getElementById(id))return Promise.resolve();
    if(loaded.has(id))return loaded.get(id);
    const p=new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.id=id;s.src=src;s.async=true;
      s.onload=()=>resolve();
      s.onerror=()=>{loaded.delete(id);reject(new Error("Unable to load "+src));};
      document.head.appendChild(s);
    });
    loaded.set(id,p);return p;
  }
  async function loadSequence(list){for(const x of list)await loadScript(x[0],x[1]);}
  function idle(fn,timeout){
    if("requestIdleCallback" in window)requestIdleCallback(fn,{timeout:timeout||1500});
    else setTimeout(fn,timeout||700);
  }

  function installProgrammeLazy(){
    if(typeof window.openProgramme!=="function")return false;
    if(window.openProgramme.__pmcLazyV2)return true;
    const original=window.openProgramme;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      loadSequence(programmeScripts).catch(e=>console.warn("Programme enhancements:",e.message));
      return result;
    };
    wrapped.__pmcLazyV2=true;
    window.openProgramme=wrapped;
    return true;
  }

  function installDashboardProgressive(){
    if(typeof window.showDashboard!=="function")return false;
    if(window.showDashboard.__pmcProgressiveV2)return true;
    const original=window.showDashboard;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      idle(()=>loadSequence(cockpitScripts).catch(e=>console.warn("Cockpit enhancements:",e.message)),900);
      return result;
    };
    wrapped.__pmcProgressiveV2=true;
    window.showDashboard=wrapped;
    return true;
  }

  function installCockpitDelay(){
    if(typeof window.loadManagementCockpit!=="function")return false;
    if(window.loadManagementCockpit.__pmcProgressiveV2)return true;
    const original=window.loadManagementCockpit;
    let timer=0;
    const wrapped=function(){
      const args=arguments,ctx=this;
      clearTimeout(timer);
      const meta=document.getElementById("cockpitUpdated");
      if(meta&&!window.managementCockpitSourceData)meta.textContent="Preparing management data…";
      timer=setTimeout(()=>original.apply(ctx,args),350);
    };
    wrapped.__pmcProgressiveV2=true;
    wrapped.__pmcOriginal=original;
    window.loadManagementCockpit=wrapped;
    return true;
  }

  function installRefreshBypass(){
    const b=document.getElementById("dashboardRefreshButton");
    if(!b||b.__pmcRefreshBypass)return !!b;
    b.__pmcRefreshBypass=true;
    b.addEventListener("click",function(){
      try{if(window.PMC_STABILITY&&typeof window.PMC_STABILITY.clearReadCache==="function")window.PMC_STABILITY.clearReadCache();}catch(_e){}
    },true);
    return true;
  }

  function boot(){
    let n=0;
    const t=setInterval(()=>{
      n++;
      installProgrammeLazy();
      installDashboardProgressive();
      installCockpitDelay();
      installRefreshBypass();
      if(n>80||(window.openProgramme&&window.showDashboard&&window.loadManagementCockpit&&document.getElementById("dashboardRefreshButton")))clearInterval(t);
    },200);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.addEventListener("load",boot,{once:true});

  window.PMC_PERFORMANCE={
    version:"2.0",
    loadProgrammeEnhancements:()=>loadSequence(programmeScripts),
    loadCockpitEnhancements:()=>loadSequence(cockpitScripts)
  };
})();