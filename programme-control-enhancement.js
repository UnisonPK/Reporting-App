/* Programme Control Enhancement V2
   Keeps the existing Programme Control UI as the single register.
   Fixes the GitHub Pages API bridge and applies management-friendly terminology
   without adding duplicate KPI cards.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);

  function patchProgrammeApi(){
    if(!window.LCRG_API || typeof window.LCRG_API.call!=="function")return false;
    window.programmeApi=function(action,data){
      return window.LCRG_API.call(action,data||{});
    };
    /* Procurement was created with the same obsolete apiRequest reference.
       Repair it here as well so the next Project Controls screen is not broken. */
    window.procurementApi=function(action,data){
      return window.LCRG_API.call(action,data||{});
    };
    return true;
  }

  function removeDuplicateKpis(){
    const extra=$("programmeEnhKpis");if(extra)extra.remove();
    const oldNote=$("programmeEnhNote");if(oldNote)oldNote.remove();
  }

  function ensureNote(){
    const page=$("programmePage");if(!page)return;
    if($("programmeRegisterNote"))return;
    const filters=$("programmeSearch");
    if(!filters)return;
    let anchor=filters.parentElement;
    while(anchor&&anchor.parentElement&&anchor.parentElement!==page&&anchor.parentElement.id!=="programmePage"){
      if(anchor.parentElement.querySelector&&anchor.parentElement.querySelector("#programmeSearch"))anchor=anchor.parentElement;else break;
    }
    const note=document.createElement("div");
    note.id="programmeRegisterNote";
    note.style.cssText="margin:0 0 14px;padding:9px 11px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:9px;font-size:11px";
    note.innerHTML='<b>Programme / Milestone Register:</b> Baseline vs current target, actual completion, progress and variance are controlled from the shared programme register.';
    const card=page.querySelector(".form-card");
    if(card){
      const toolbar=filters.closest(".control-toolbar")||filters.parentElement;
      if(toolbar)toolbar.insertAdjacentElement("beforebegin",note);
    }
  }

  function renameLabels(){
    const forecast=$("programmeForecastDate");
    if(forecast){
      const wrap=forecast.closest("div");
      const label=wrap&&wrap.querySelector("label");
      if(label)label.textContent="Current Target Date *";
    }
    const page=$("programmePage");if(!page)return;
    page.querySelectorAll("table.control-table thead th").forEach(th=>{
      if(th.textContent.trim()==="Forecast")th.textContent="Current Target";
    });
  }

  function hookRender(){
    if(typeof window.renderProgramme!=="function"||window.renderProgramme.__programmeV2)return;
    const old=window.renderProgramme;
    const wrapped=function(){
      const r=old.apply(this,arguments);
      setTimeout(renameLabels,0);
      return r;
    };
    wrapped.__programmeV2=true;
    window.renderProgramme=wrapped;
  }

  function install(){
    removeDuplicateKpis();
    patchProgrammeApi();
    ensureNote();
    renameLabels();
    hookRender();
  }

  function boot(){
    let n=0;
    const t=setInterval(function(){
      n++;
      install();
      if((window.LCRG_API&&typeof window.LCRG_API.call==="function"&&$("programmePage"))||n>40)clearInterval(t);
    },250);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.addEventListener("load",boot,{once:true});
})();