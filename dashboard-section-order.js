/* Dashboard section placement helper
   Places Management Control inside the Management Cockpit, directly above
   the Design Actions / Decisions block.
*/
(function(){
  "use strict";

  function ensureStyles(){
    if(document.getElementById("cockpitManagementControlPlacementStyles"))return;
    const s=document.createElement("style");
    s.id="cockpitManagementControlPlacementStyles";
    s.textContent=`
      #managementCockpit > #managementControlDashboardSection{
        margin:14px 0 0!important;
        box-shadow:none!important;
        border:1px solid #e2e8f0!important;
        border-radius:12px!important;
        overflow:hidden;
        background:#fff;
      }
      #managementCockpit > #managementControlDashboardSection .pmc-panel-head{
        padding:11px 13px!important;
        margin:0!important;
        background:#f8fafc;
        border-bottom:1px solid #e5e7eb;
      }
      #managementCockpit > #managementControlDashboardSection .pmc-panel-head h2{
        font-size:14px!important;
        margin:0!important;
      }
      #managementCockpit > #managementControlDashboardSection .pmc-panel-head p{
        font-size:10px!important;
        margin:3px 0 0!important;
      }
      #managementCockpit > #managementControlDashboardSection .pmc-control-grid,
      #managementCockpit > #managementControlDashboardSection .management-control-grid{
        padding:10px 12px 12px;
      }
      #managementCockpit > #cockpitDesignActions{
        margin-top:10px!important;
      }
    `;
    document.head.appendChild(s);
  }

  function move(){
    const cockpit=document.getElementById("managementCockpit");
    const management=document.getElementById("managementControlDashboardSection");
    const design=document.getElementById("cockpitDesignActions");
    if(!cockpit||!management||!design)return false;

    ensureStyles();

    /* Move the actual Management Control section into the Cockpit. This keeps
       all existing buttons, counts and handlers intact; only its DOM position changes. */
    if(management.parentElement!==cockpit){
      cockpit.insertBefore(management,design);
    }else if(management.nextElementSibling!==design){
      cockpit.insertBefore(management,design);
    }

    management.dataset.cockpitNested="true";
    return management.parentElement===cockpit && management.nextElementSibling===design;
  }

  function boot(){
    if(move())return;
    let n=0;
    const t=setInterval(function(){
      n++;
      if(move()||n>=60)clearInterval(t);
    },250);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
  window.addEventListener("load",boot,{once:true});
})();