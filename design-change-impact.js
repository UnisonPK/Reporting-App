/* Design Management - Change Impact Summary V1
   Management summary derived entirely from the shared Design Changes register.
   No duplicate data entry and no backend changes required.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  let impactRows=[];

  function project(){try{return typeof getActiveProject==="function"?getActiveProject():"";}catch(e){return"";}}
  function money(v){return "PKR "+Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});}
  function doneStatus(s){return ["Approved","Rejected","Implemented"].includes(String(s||""));}

  function install(){
    const panel=$("designChangesPanel");
    if(!panel||$("dcViewSwitch"))return false;
    const head=panel.querySelector(".design-changes-head");
    const kpis=$("designChangeKpis");
    if(!head||!kpis)return false;

    const sw=document.createElement("div");
    sw.id="dcViewSwitch";sw.className="dc-impact-switch";
    sw.innerHTML='<button id="dcRegisterView" class="active" type="button">Register</button><button id="dcImpactView" type="button">Impact Summary</button>';
    head.insertAdjacentElement("afterend",sw);

    const view=document.createElement("div");
    view.id="dcImpactPanel";view.style.display="none";
    view.innerHTML='<div class="dc-impact-filters"><select id="dcImpactTower"><option value="">All Towers / Areas</option></select><select id="dcImpactStatus"><option value="">All Statuses</option><option>Proposed</option><option>Under Review</option><option>Pending Approval</option><option>Approved</option><option>Rejected</option><option>Implemented</option></select><select id="dcImpactType"><option value="">All Impacts</option><option>None</option><option>Cost</option><option>Programme</option><option>Cost + Programme</option></select></div><div id="dcImpactKpis" class="dc-impact-kpis"></div><div id="dcImpactTable"></div>';
    sw.insertAdjacentElement("afterend",view);

    $("dcRegisterView").onclick=showRegister;
    $("dcImpactView").onclick=showImpact;
    ["dcImpactTower","dcImpactStatus","dcImpactType"].forEach(id=>$(id).onchange=renderImpact);
    return true;
  }

  function showRegister(){
    $("dcRegisterView").classList.add("active");$("dcImpactView").classList.remove("active");
    $("dcImpactPanel").style.display="none";
    $("designChangeKpis").style.display="grid";
    const tools=document.querySelector("#designChangesPanel .design-change-tools");if(tools)tools.style.display="grid";
    $("designChangeTable").style.display="block";
  }

  async function showImpact(){
    $("dcImpactView").classList.add("active");$("dcRegisterView").classList.remove("active");
    $("designChangeKpis").style.display="none";
    const tools=document.querySelector("#designChangesPanel .design-change-tools");if(tools)tools.style.display="none";
    $("designChangeTable").style.display="none";$("dcImpactPanel").style.display="block";
    $("dcImpactTable").innerHTML='<div class="dc-impact-empty">Loading impact summary...</div>';
    try{
      const r=await window.LCRG_API.call("designChanges",{project:project()});
      impactRows=Array.isArray(r)?r:(r&&Array.isArray(r.rows)?r.rows:[]);
      populateTowers();renderImpact();
    }catch(e){
      $("dcImpactTable").innerHTML='<div class="dc-impact-empty">Could not load the shared Design Changes register. '+esc(e&&e.message||e)+'</div>';
    }
  }

  function populateTowers(){
    const sel=$("dcImpactTower"),current=sel.value;
    const vals=[...new Set(impactRows.map(r=>String(r.tower||"").trim()).filter(Boolean))].sort();
    sel.innerHTML='<option value="">All Towers / Areas</option>'+vals.map(v=>'<option>'+esc(v)+'</option>').join("");
    if(vals.includes(current))sel.value=current;
  }

  function filtered(){
    const p=project(),tw=$("dcImpactTower").value,st=$("dcImpactStatus").value,im=$("dcImpactType").value;
    return impactRows.filter(r=>(!p||!r.project||r.project===p)&&(!tw||r.tower===tw)&&(!st||r.status===st)&&(!im||r.impact===im));
  }

  function renderImpact(){
    const a=filtered();
    const pending=a.filter(r=>!doneStatus(r.status)).length;
    const approved=a.filter(r=>["Approved","Implemented"].includes(r.status)).length;
    const totalCost=a.reduce((s,r)=>s+Number(r.costImpact||0),0);
    const totalDays=a.reduce((s,r)=>s+Number(r.programmeDays||0),0);
    const revisions=a.filter(r=>String(r.drawingRevision||"").toLowerCase()==="yes").length;
    $("dcImpactKpis").innerHTML='<div><span>Total Changes</span><b>'+a.length+'</b></div><div><span>Pending Approval</span><b>'+pending+'</b></div><div><span>Approved / Implemented</span><b>'+approved+'</b></div><div><span>Total Cost Impact</span><b>'+money(totalCost)+'</b></div><div><span>Recorded Programme Impact</span><b>'+totalDays+' days</b></div><div><span>Drawing Revisions Required</span><b>'+revisions+'</b></div>';
    if(!a.length){$("dcImpactTable").innerHTML='<div class="dc-impact-empty">No design changes match this impact view.</div>';return;}
    $("dcImpactTable").innerHTML='<div class="dc-impact-table-wrap"><table><thead><tr><th>Ref.</th><th>Change / Location</th><th>Status</th><th>Impact</th><th>Cost Impact</th><th>Programme</th><th>Drawing Rev.</th><th>Responsible</th><th>Target</th><th>Decision Required</th></tr></thead><tbody>'+a.sort((x,y)=>String(x.target||"9999").localeCompare(String(y.target||"9999"))).map(r=>'<tr><td><b>'+esc(r.ref)+'</b></td><td>'+esc(r.title)+'<small>'+esc([r.tower,r.floor].filter(Boolean).join(" / ")||"-")+'</small></td><td><span class="dc-impact-status">'+esc(r.status)+'</span></td><td>'+esc(r.impact||"None")+'</td><td class="num">'+(Number(r.costImpact||0)?money(r.costImpact):"-")+'</td><td class="num">'+(Number(r.programmeDays||0)?esc(r.programmeDays)+" days":"-")+'</td><td>'+esc(r.drawingRevision||"No")+'</td><td>'+esc(r.responsible||"-")+'</td><td>'+esc(r.target||"-")+'</td><td>'+esc(r.decision||"-")+'</td></tr>').join("")+'</tbody></table></div>';
  }

  const css=document.createElement("style");css.textContent='.dc-impact-switch{display:flex;gap:6px;margin:12px 0 10px}.dc-impact-switch button{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;padding:7px 14px;font-weight:800;cursor:pointer}.dc-impact-switch button.active{background:#0b3f88;color:#fff;border-color:#0b3f88}.dc-impact-filters{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;margin:8px 0 12px}.dc-impact-filters select{border:1px solid #d5deea;border-radius:8px;padding:9px;background:#fff}.dc-impact-kpis{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:10px;margin-bottom:14px}.dc-impact-kpis>div{background:#fff;border:1px solid #dbe4ef;border-radius:10px;padding:12px}.dc-impact-kpis span{display:block;color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase}.dc-impact-kpis b{display:block;color:#0b3f88;font-size:17px;margin-top:5px}.dc-impact-table-wrap{overflow:auto;border:1px solid #dbe4ef;border-radius:10px;background:#fff}.dc-impact-table-wrap table{width:100%;border-collapse:collapse;font-size:11px}.dc-impact-table-wrap th{background:#f4f7fb;color:#48617d;text-transform:uppercase;font-size:9px;text-align:left;padding:10px;border-bottom:1px solid #dbe4ef;white-space:nowrap}.dc-impact-table-wrap td{padding:10px;border-bottom:1px solid #edf2f7;vertical-align:top}.dc-impact-table-wrap small{display:block;color:#64748b;margin-top:3px}.dc-impact-table-wrap .num{white-space:nowrap}.dc-impact-status{background:#eef2ff;color:#3730a3;border-radius:12px;padding:4px 7px;font-weight:800;white-space:nowrap}.dc-impact-empty{padding:24px;text-align:center;color:#64748b;background:#fff;border:1px solid #dbe4ef;border-radius:10px}@media(max-width:1000px){.dc-impact-kpis{grid-template-columns:repeat(3,1fr)}}';document.head.appendChild(css);
  window.addEventListener("load",()=>{let n=0,t=setInterval(()=>{if(install()||++n>25)clearInterval(t);},400);});
})();