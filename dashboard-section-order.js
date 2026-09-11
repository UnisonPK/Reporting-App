/* Dashboard section order helper
   Keeps Management Control above the Design Actions / Decisions block on the main dashboard.
*/
(function(){
  "use strict";
  function move(){
    const management=document.getElementById("managementControlDashboardSection");
    const design=document.getElementById("managementCockpitDesignActions");
    if(!management||!design)return false;
    const designHost=design.closest(".pmc-panel")||design.parentElement;
    if(!designHost||!management.parentElement||designHost.parentElement!==management.parentElement)return false;
    if(management.nextElementSibling!==designHost){
      management.parentElement.insertBefore(management,designHost);
    }
    return true;
  }
  function boot(){
    if(move())return;
    let n=0;
    const t=setInterval(function(){n++;if(move()||n>=40)clearInterval(t);},250);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.addEventListener("load",boot,{once:true});
})();