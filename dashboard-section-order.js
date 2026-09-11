/* Dashboard cockpit layout helper
   Keeps Management Control immediately after the Management Cockpit health row,
   while compacting Design Actions / Decisions into the right-side management column.
*/
(function(){
  "use strict";

  function ensureStyles(){
    if(document.getElementById("cockpitManagementControlPlacementStyles"))return;
    const s=document.createElement("style");
    s.id="cockpitManagementControlPlacementStyles";
    s.textContent=`
      #cockpitManagementDesignGrid{
        display:grid;
        grid-template-columns:minmax(0,1.35fr) minmax(420px,.9fr);
        gap:12px;
        align-items:stretch;
        margin:14px 0 0;
      }
      #cockpitManagementDesignGrid > #managementControlDashboardSection,
      #cockpitManagementDesignGrid > #cockpitDesignActions{
        margin:0!important;
        min-width:0;
        height:100%;
        box-shadow:none!important;
        border:1px solid #e2e8f0!important;
        border-radius:12px!important;
        overflow:hidden;
        background:#fff;
      }
      #cockpitManagementDesignGrid > #managementControlDashboardSection .pmc-panel-head{
        padding:11px 13px!important;
        margin:0!important;
        background:#f8fafc;
        border-bottom:1px solid #e5e7eb;
      }
      #cockpitManagementDesignGrid > #managementControlDashboardSection .pmc-panel-head h2{
        font-size:14px!important;
        margin:0!important;
      }
      #cockpitManagementDesignGrid > #managementControlDashboardSection .pmc-panel-head p{
        font-size:9px!important;
        margin:2px 0 0!important;
      }
      #cockpitManagementDesignGrid > #managementControlDashboardSection .pmc-control-grid,
      #cockpitManagementDesignGrid > #managementControlDashboardSection .management-control-grid{
        padding:10px 12px 12px;
      }

      /* Right-side compact Design Actions / Decisions */
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-head{
        padding:10px 11px;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-head b{font-size:11px}
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-head span{font-size:8px}
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-open{
        padding:6px 8px;
        font-size:8px;
        white-space:nowrap;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-kpis{
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:5px;
        padding:8px 9px;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-kpi{
        padding:6px;
        border-radius:7px;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-kpi span{font-size:6px}
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-kpi b{font-size:14px}
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-list{
        padding:0 9px 7px;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-list-title{
        padding:2px 0 5px;
        font-size:7px;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-row{
        grid-template-columns:60px minmax(0,1fr) 76px;
        gap:6px;
        padding:6px 0;
        font-size:7px;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-row b{font-size:8px}
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-row .cdx-hide{display:none!important}
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-badge{
        font-size:7px;
        text-align:right;
      }
      #cockpitManagementDesignGrid > #cockpitDesignActions .cdx-status{
        padding:0 9px 7px;
        font-size:7px;
      }

      @media(max-width:1150px){
        #cockpitManagementDesignGrid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  function move(){
    const cockpit=document.getElementById("managementCockpit");
    const management=document.getElementById("managementControlDashboardSection");
    const design=document.getElementById("cockpitDesignActions");
    const health=cockpit&&cockpit.querySelector(".cockpit-health");
    if(!cockpit||!management||!design||!health)return false;

    ensureStyles();

    let grid=document.getElementById("cockpitManagementDesignGrid");
    if(!grid){
      grid=document.createElement("div");
      grid.id="cockpitManagementDesignGrid";
      health.insertAdjacentElement("afterend",grid);
    }else if(grid.previousElementSibling!==health){
      health.insertAdjacentElement("afterend",grid);
    }

    if(management.parentElement!==grid)grid.appendChild(management);
    if(design.parentElement!==grid)grid.appendChild(design);

    management.dataset.cockpitNested="true";
    design.dataset.cockpitCompact="true";
    return management.parentElement===grid && design.parentElement===grid;
  }

  function boot(){
    if(move())return;
    let n=0;
    const t=setInterval(function(){
      n++;
      if(move()||n>=80)clearInterval(t);
    },250);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
  window.addEventListener("load",boot,{once:true});
})();