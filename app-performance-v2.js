/* PMC App Performance V2.2
   Progressive dashboard loading + lazy Programme and Design Management loading.
   Keeps the large index.html baseline and existing module APIs intact.
*/
(function(){
  "use strict";
  if(window.__PMC_PERFORMANCE_V2__)return;
  window.__PMC_PERFORMANCE_V2__=true;

  const loaded=new Map();
  const loadedCss=new Map();

  const programmeScripts=[
    ["programmeControlEnhancementScript","programme-control-enhancement.js?v=20260912-2"],
    ["programmeScheduleImportScript","programme-schedule-import.js?v=20260912-2"],
    ["programmeDelayLookAheadScript","programme-delay-lookahead.js?v=20260912-1"],
    ["programmeReadinessControlScript","programme-readiness-control.js?v=20260912-1"],
    ["programmeFloatControlScript","programme-float-control.js?v=20260913-1"],
    ["programmeTopActionsScript","programme-top-actions.js?v=20260913-1"],
    ["programmeRiskRankingScript","programme-risk-ranking.js?v=20260913-1"]
  ];

  const cockpitScripts=[
    ["managementCockpitProgrammeScript","management-cockpit-programme.js?v=20260912-1"],
    ["managementCockpitDesignScript","management-cockpit-design.js?v=20260911-1"],
    ["programmeRiskRankingScript","programme-risk-ranking.js?v=20260913-1"],
    ["dashboardSectionOrderScript","dashboard-section-order.js?v=20260911-3"]
  ];

  const designCss=[
    ["designManagementUiCss","design-management-ui.css?v=20260830-3"],
    ["designBulkUploadCss","design-bulk-upload.css?v=20260830-3"],
    ["designFileSupportCss","design-file-support.css?v=20260830-1"],
    ["designBundleCss","design-drawing-bundle.css?v=20260830-1"],
    ["designRevisionArchiveCss","design-revision-archive.css?v=20260830-1"],
    ["designIssuesCss","design-issues.css?v=20260830-1"],
    ["designChangesCss","design-changes.css?v=20260910-1"],
    ["designManagementControlsCss","design-management-controls.css?v=20260910-1"],
    ["designActionLayoutCss","design-action-layout.css?v=20260830-1"]
  ];

  const designScripts=[
    ["designManagementStage1Script","design-management.js?v=20260830-1"],
    ["designManagementUiScript","design-management-ui.js?v=20260830-2"],
    ["designBulkUploadScript","design-bulk-upload-v3.js?v=20260830-1"],
    ["designFileSupportScript","design-file-support.js?v=20260830-2"],
    ["designRegisterControlScript","design-register-control.js?v=20260830-1"],
    ["designDashboardCurrentScript","design-dashboard-current.js?v=20260830-1"],
    ["designIssuesScript","design-issues.js?v=20260910-4"],
    ["designChangesScript","design-changes.js?v=20260911-3"],
    ["designAttachmentsScript","design-attachments.js?v=20260911-2"],
    ["designChangeImpactScript","design-change-impact.js?v=20260911-1"],
    ["designLookAheadScript","design-lookahead-stage2.js?v=20260911-1"],
    ["designDashboardLookAheadScript","design-dashboard-lookahead.js?v=20260911-1"],
    ["designActionEngineScript","design-action-engine.js?v=20260911-1"],
    ["designManagementControlsScript","design-management-controls.js?v=20260910-1"]
  ];

  /* Older Design modules were written to initialize on window.load.
     When lazy-loaded after page load, temporarily mirror those late load listeners
     once so the existing modules can initialize without being rewritten. */
  function loadScript(id,src,lateLoadCompat){
    if(document.getElementById(id))return Promise.resolve();
    if(loaded.has(id))return loaded.get(id);

    const p=new Promise((resolve,reject)=>{
      const realAdd=window.addEventListener;
      let restored=false;
      function restore(){
        if(restored)return;
        restored=true;
        if(lateLoadCompat)window.addEventListener=realAdd;
      }

      if(lateLoadCompat && document.readyState==="complete"){
        window.addEventListener=function(type,listener,options){
          realAdd.call(window,type,listener,options);
          if(type==="load" && typeof listener==="function"){
            setTimeout(function(){
              try{listener.call(window,new Event("load"));}catch(e){console.warn("Late Design init:",e);}
            },0);
          }
        };
      }

      const s=document.createElement("script");
      s.id=id;s.src=src;s.async=false;
      s.onload=()=>{restore();resolve();};
      s.onerror=()=>{restore();loaded.delete(id);reject(new Error("Unable to load "+src));};
      document.head.appendChild(s);
    });

    loaded.set(id,p);
    return p;
  }

  function loadCss(id,href){
    if(document.getElementById(id))return Promise.resolve();
    if(loadedCss.has(id))return loadedCss.get(id);
    const p=new Promise((resolve,reject)=>{
      const c=document.createElement("link");
      c.id=id;c.rel="stylesheet";c.href=href;
      c.onload=resolve;
      c.onerror=()=>{loadedCss.delete(id);reject(new Error("Unable to load "+href));};
      document.head.appendChild(c);
    });
    loadedCss.set(id,p);
    return p;
  }

  async function loadSequence(list,lateLoadCompat){
    for(const x of list)await loadScript(x[0],x[1],!!lateLoadCompat);
  }

  async function loadDesignBundle(){
    await Promise.all(designCss.map(x=>loadCss(x[0],x[1])));
    await loadSequence(designScripts,true);
  }

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
      loadSequence(programmeScripts,false).catch(e=>console.warn("Programme enhancements:",e.message));
      return result;
    };
    wrapped.__pmcLazyV2=true;
    window.openProgramme=wrapped;
    return true;
  }

  function installDesignLazy(){
    if(typeof window.openDrawings!=="function")return false;
    if(window.openDrawings.__pmcDesignLazyV2)return true;

    const original=window.openDrawings;
    let opening=false;

    const wrapped=function(){
      const ctx=this,args=arguments;
      if(document.getElementById("designManagementStage1Script")){
        return original.apply(ctx,args);
      }
      if(opening)return;
      opening=true;

      const page=document.getElementById("drawingsPage");
      const container=document.getElementById("drawingsContainer");
      try{
        if(typeof window.hideAppPages==="function")window.hideAppPages();
        if(page)page.style.display="block";
        if(container)container.innerHTML='<div class="reports-loading">Loading Design Management…</div>';
      }catch(_e){}

      loadDesignBundle().then(function(){
        opening=false;
        original.apply(ctx,args);
        setTimeout(function(){
          try{if(typeof window.setDesignTab==="function")window.setDesignTab("dashboard");}catch(_e){}
        },60);
      }).catch(function(e){
        opening=false;
        console.warn("Design Management lazy load:",e.message);
        original.apply(ctx,args);
      });
    };

    wrapped.__pmcDesignLazyV2=true;
    wrapped.__pmcOriginal=original;
    window.openDrawings=wrapped;
    return true;
  }

  function installDashboardProgressive(){
    if(typeof window.showDashboard!=="function")return false;
    if(window.showDashboard.__pmcProgressiveV2)return true;
    const original=window.showDashboard;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      idle(()=>loadSequence(cockpitScripts,false).catch(e=>console.warn("Cockpit enhancements:",e.message)),900);
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
      installDesignLazy();
      installDashboardProgressive();
      installCockpitDelay();
      installRefreshBypass();
      if(n>80||(window.openProgramme&&window.openDrawings&&window.showDashboard&&window.loadManagementCockpit&&document.getElementById("dashboardRefreshButton")))clearInterval(t);
    },200);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.addEventListener("load",boot,{once:true});

  window.PMC_PERFORMANCE={
    version:"2.2",
    loadProgrammeEnhancements:()=>loadSequence(programmeScripts,false),
    loadDesignManagement:()=>loadDesignBundle(),
    loadCockpitEnhancements:()=>loadSequence(cockpitScripts,false)
  };
})();