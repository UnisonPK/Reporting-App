/* Programme Control Enhancement V1
   Enhances the existing shared Programme Control register without changing backend storage.
   Uses the current Programme API/register as the single source of truth.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);

  function styles(){
    if($("programmeEnhancementStyles"))return;
    const s=document.createElement("style");s.id="programmeEnhancementStyles";
    s.textContent=`
      #programmePage .programme-enh-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 14px}
      #programmePage .programme-enh-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:11px 12px}
      #programmePage .programme-enh-kpi span{display:block;font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900;letter-spacing:.04em}
      #programmePage .programme-enh-kpi b{display:block;font-size:21px;color:#172b4d;margin-top:4px}
      #programmePage .programme-enh-kpi.red{border-top:3px solid #dc2626}
      #programmePage .programme-enh-kpi.orange{border-top:3px solid #ea580c}
      #programmePage .programme-enh-kpi.green{border-top:3px solid #16a34a}
      #programmePage .programme-enh-note{margin:0 0 12px;padding:9px 11px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:9px;font-size:11px}
      #programmePage .programme-enh-note b{font-weight:900}
      #programmePage .control-table th{white-space:nowrap}
      #programmePage .control-table td{vertical-align:top}
      @media(max-width:900px){#programmePage .programme-enh-kpis{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(s);
  }

  function getRows(){
    try{return Array.isArray(programmeData)?programmeData:[];}catch(_e){return[];}
  }

  function filteredRows(){
    const rows=getRows();
    const q=$("programmeSearch")?String($("programmeSearch").value||"").toLowerCase():"";
    const tower=$("programmeTowerFilter")?$("programmeTowerFilter").value:"";
    const status=$("programmeStatusFilter")?$("programmeStatusFilter").value:"";
    return rows.filter(r=>{
      const s=[r.milestone,r.tower,r.remarks].join(" ").toLowerCase();
      return (!q||s.includes(q))&&(!tower||r.tower===tower)&&(!status||r.status===status);
    });
  }

  function ensureKpis(){
    const page=$("programmePage");if(!page)return null;
    let box=$("programmeEnhKpis");if(box)return box;
    const card=page.querySelector(".container .form-card");if(!card)return null;
    box=document.createElement("div");box.id="programmeEnhKpis";box.className="programme-enh-kpis";
    const head=card.querySelector(".dashboard-head-row");
    if(head)head.insertAdjacentElement("afterend",box);else card.prepend(box);
    const note=document.createElement("div");note.id="programmeEnhNote";note.className="programme-enh-note";
    note.innerHTML='<b>Programme / Milestone Register:</b> Baseline vs current target, actual completion, progress and variance are controlled from the shared programme register.';
    box.insertAdjacentElement("afterend",note);
    return box;
  }

  function renderKpis(){
    const box=ensureKpis();if(!box)return;
    const rows=filteredRows();
    const delayed=rows.filter(r=>String(r.status||"")==="Delayed"||Number(r.varianceDays||0)>0).length;
    const inProgress=rows.filter(r=>String(r.status||"")==="In Progress").length;
    const completed=rows.filter(r=>String(r.status||"")==="Completed").length;
    const onHold=rows.filter(r=>String(r.status||"")==="On Hold").length;
    const avg=rows.length?rows.reduce((a,r)=>a+Number(r.progress||0),0)/rows.length:0;
    box.innerHTML=
      '<div class="programme-enh-kpi"><span>Total Milestones</span><b>'+rows.length+'</b></div>'+ 
      '<div class="programme-enh-kpi red"><span>Delayed / Late</span><b>'+delayed+'</b></div>'+ 
      '<div class="programme-enh-kpi orange"><span>In Progress</span><b>'+inProgress+'</b></div>'+ 
      '<div class="programme-enh-kpi green"><span>Completed</span><b>'+completed+'</b></div>'+ 
      '<div class="programme-enh-kpi"><span>Average Progress</span><b>'+avg.toFixed(1)+'%</b></div>';
    if(onHold&&$("programmeEnhNote"))$("programmeEnhNote").innerHTML='<b>'+onHold+' milestone(s) currently On Hold.</b> Baseline, Current Target and Actual dates remain visible for management follow-up.';
  }

  function renameLabels(){
    const forecast=$("programmeForecastDate");
    if(forecast){const wrap=forecast.closest("div");const label=wrap&&wrap.querySelector("label");if(label)label.textContent="Current Target Date *";}
    const page=$("programmePage");if(!page)return;
    page.querySelectorAll("table.control-table thead th").forEach(th=>{if(th.textContent.trim()==="Forecast")th.textContent="Current Target";});
    const sub=page.querySelector(".app-subtitle");if(sub)sub.textContent="Milestone baseline, current target, actual completion and variance";
  }

  function hook(){
    styles();ensureKpis();renameLabels();renderKpis();
    if(typeof window.renderProgramme==="function"&&!window.renderProgramme.__enhanced){
      const old=window.renderProgramme;
      const wrapped=function(){const r=old.apply(this,arguments);setTimeout(()=>{renameLabels();renderKpis();},0);return r;};
      wrapped.__enhanced=true;window.renderProgramme=wrapped;
    }
    ["programmeSearch","programmeTowerFilter","programmeStatusFilter"].forEach(id=>{const e=$(id);if(e&&!e.dataset.programmeEnhHook){e.dataset.programmeEnhHook="1";e.addEventListener(id==="programmeSearch"?"input":"change",()=>setTimeout(renderKpis,0));}});
  }

  function boot(){let n=0,t=setInterval(()=>{n++;if($("programmePage")){hook();if(n>8)clearInterval(t);}if(n>40)clearInterval(t);},250);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.addEventListener("load",boot,{once:true});
})();