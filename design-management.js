/* Project / Site Management System - Design Management Stage 1
   Three-category drawing management layer for the existing shared Drawings register.
   Backend compatibility is preserved: extended Design Management fields are stored
   inside the existing Remarks field as compact metadata, while the visible remarks
   remain clean in the app.
*/
(function(){
  "use strict";

  const DM_META_RE=/^\[\[DM1:([^\]]+)\]\](?:\r?\n)?/;
  const MAIN_CATEGORIES=["Architecture / Finishes","Structural","MEP"];
  const SUB_DISCIPLINES={
    "Architecture / Finishes":["Architectural","Interior / Finishes","Façade","Joinery / Woodwork","Landscape","External Development","Other Architectural"],
    "Structural":["Foundation","Columns / Walls","Beams / Slabs","Staircases","Steel Structure","Expansion Joints","Structural Details","Other Structural"],
    "MEP":["Electrical","Plumbing","HVAC","Fire Fighting","Fire Alarm","ELV / ICT","BMS","Vertical Transportation / Lifts","Other MEP"]
  };
  const DRAWING_TYPES=["For Information","For Approval","Tender","IFC","Shop Drawing","Coordination","As-Built"];
  const DRAWING_STATUSES=["Draft","Submitted","Under Review","Approved with Comments","Approved","Revise & Resubmit","Superseded"];
  const IMPACTS=["None","Site","Procurement","Programme","Cost"];
  const PRIORITIES=["Normal","High","Critical"];

  let activeDesignTab="dashboard";
  let activeCategory="";
  let originalOpenDrawings=null;
  let originalOpenDrawingModal=null;
  let originalEditDrawing=null;
  let originalSaveDrawing=null;

  function esc(v){
    if(typeof window.escapeHtml==="function")return window.escapeHtml(v==null?"":String(v));
    return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  }
  function el(id){return document.getElementById(id);}
  function addOpt(select,value,label){
    if(!select)return;
    const o=document.createElement("option");o.value=value;o.textContent=label||value;select.appendChild(o);
  }
  function setOptions(select,values,placeholder){
    if(!select)return;
    const cur=select.value;
    select.innerHTML="";
    addOpt(select,"",placeholder);
    values.forEach(v=>addOpt(select,v));
    if(values.includes(cur))select.value=cur;
  }
  function parseMeta(remarks){
    const raw=String(remarks||"");
    const m=raw.match(DM_META_RE);
    let meta={};
    if(m){
      try{meta=JSON.parse(decodeURIComponent(m[1]))||{};}catch(_e){meta={};}
    }
    return {meta:meta,remarks:raw.replace(DM_META_RE,"")};
  }
  function packMeta(meta,remarks){
    return "[[DM1:"+encodeURIComponent(JSON.stringify(meta||{}))+"]]\n"+String(remarks||"");
  }
  function inferMainCategory(discipline){
    const s=String(discipline||"").trim();
    const low=s.toLowerCase();
    if(low.indexOf("architecture / finishes")===0)return "Architecture / Finishes";
    if(low.indexOf("structural")===0)return "Structural";
    if(low.indexOf("mep")===0)return "MEP";
    if(["architectural","interior","landscape","facade","façade","finishes","finish","joinery","woodwork"].some(x=>low.includes(x)))return "Architecture / Finishes";
    if(["electrical","plumbing","hvac","fire fighting","fire alarm","elv","ict","bms","lift","vertical transportation"].some(x=>low.includes(x)))return "MEP";
    if(["foundation","column","beam","slab","stair","steel","expansion joint"].some(x=>low.includes(x)))return "Structural";
    return s==="Structural"?"Structural":s==="MEP"?"MEP":"Architecture / Finishes";
  }
  function inferSubDiscipline(discipline,main){
    const s=String(discipline||"").trim();
    const parts=s.split(/\s+[—|-]\s+/);
    if(parts.length>1 && MAIN_CATEGORIES.includes(parts[0].trim()))return parts.slice(1).join(" — ").trim();
    const low=s.toLowerCase();
    const list=SUB_DISCIPLINES[main]||[];
    const exact=list.find(x=>x.toLowerCase()===low);
    if(exact)return exact;
    if(main==="Architecture / Finishes"){
      if(low.includes("interior"))return "Interior / Finishes";
      if(low.includes("facade")||low.includes("façade"))return "Façade";
      if(low.includes("landscape"))return "Landscape";
      if(low.includes("joinery")||low.includes("wood"))return "Joinery / Woodwork";
      if(low.includes("external"))return "External Development";
      return "Architectural";
    }
    if(main==="MEP"){
      if(low.includes("electrical"))return "Electrical";
      if(low.includes("plumbing"))return "Plumbing";
      if(low.includes("hvac"))return "HVAC";
      if(low.includes("fire fighting"))return "Fire Fighting";
      if(low.includes("fire alarm"))return "Fire Alarm";
      if(low.includes("elv")||low.includes("ict"))return "ELV / ICT";
      if(low.includes("bms"))return "BMS";
      if(low.includes("lift")||low.includes("vertical"))return "Vertical Transportation / Lifts";
      return "Other MEP";
    }
    if(low.includes("foundation"))return "Foundation";
    if(low.includes("column")||low.includes("wall"))return "Columns / Walls";
    if(low.includes("beam")||low.includes("slab"))return "Beams / Slabs";
    if(low.includes("stair"))return "Staircases";
    if(low.includes("steel"))return "Steel Structure";
    if(low.includes("expansion"))return "Expansion Joints";
    if(low.includes("detail"))return "Structural Details";
    return "Other Structural";
  }
  function rowInfo(r){
    const parsed=parseMeta(r&&r.remarks);
    const main=parsed.meta.mainCategory||inferMainCategory(r&&r.discipline);
    const sub=parsed.meta.subDiscipline||inferSubDiscipline(r&&r.discipline,main);
    return {
      mainCategory:main,
      subDiscipline:sub,
      drawingType:parsed.meta.drawingType||"",
      impact:parsed.meta.impact||"None",
      priority:parsed.meta.priority||"Normal",
      requiredAtSite:parsed.meta.requiredAtSite||"",
      responseDate:parsed.meta.responseDate||"",
      remarks:parsed.remarks
    };
  }
  function isClosedStatus(status){return ["approved","superseded"].includes(String(status||"").toLowerCase());}
  function isoToday(){
    const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function isOverdue(r){
    const x=rowInfo(r);return !!x.requiredAtSite && x.requiredAtSite<isoToday() && !isClosedStatus(r.status);
  }
  function inNext14Days(r){
    const x=rowInfo(r);if(!x.requiredAtSite||isClosedStatus(r.status))return false;
    const today=new Date(isoToday()+"T00:00:00");const lim=new Date(today);lim.setDate(lim.getDate()+14);
    const d=new Date(x.requiredAtSite+"T00:00:00");return d>=today&&d<=lim;
  }

  function injectStyles(){
    if(el("designManagementStage1Styles"))return;
    const s=document.createElement("style");s.id="designManagementStage1Styles";
    s.textContent=`
      .design-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e7eb}
      .design-tab{border:0;border-radius:9px;padding:10px 14px;background:#eef2f7;color:#475569;font-size:12px;font-weight:900;cursor:pointer}.design-tab.active{background:#0b3f88;color:#fff}
      .design-category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:4px 0 14px}.design-category-card{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:16px;text-align:left;cursor:pointer;box-shadow:0 3px 12px rgba(15,23,42,.04);transition:.15s}.design-category-card:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(15,23,42,.08)}.design-category-card.arch{border-top:4px solid #2563eb}.design-category-card.struct{border-top:4px solid #ea580c}.design-category-card.mep{border-top:4px solid #0891b2}.design-category-title{font-size:15px;font-weight:900;color:#172b4d}.design-category-total{font-size:28px;font-weight:900;color:#0f172a;margin:8px 0 10px}.design-category-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.design-mini{background:#f8fafc;border-radius:8px;padding:7px 8px}.design-mini span{display:block;font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.design-mini b{display:block;margin-top:3px;font-size:13px;color:#334155}.design-management-indicators{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 18px}.design-indicator{border:1px solid #e5e7eb;border-radius:11px;background:#fff;padding:11px 12px}.design-indicator span{display:block;font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}.design-indicator b{display:block;font-size:20px;color:#172b4d;margin-top:4px}.design-dashboard-note{font-size:11px;color:#64748b;margin:0 0 14px}.design-view-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.design-view-head b{font-size:14px;color:#172b4d}.design-view-head span{font-size:11px;color:#64748b}.design-filter-pill{display:none;border:0;border-radius:999px;background:#dbeafe;color:#1d4ed8;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}.design-filter-pill.show{display:inline-block}.drawing-priority{display:inline-block;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:900}.drawing-priority.normal{background:#f1f5f9;color:#475569}.drawing-priority.high{background:#ffedd5;color:#9a3412}.drawing-priority.critical{background:#fee2e2;color:#991b1b}.drawing-overdue{display:block;color:#dc2626;font-size:9px;font-weight:900;margin-top:3px}.design-field-span{grid-column:1/-1}.design-hidden-discipline{display:none!important}
      @media(max-width:900px){.design-category-grid{grid-template-columns:1fr}.design-management-indicators{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:650px){.design-management-indicators{grid-template-columns:1fr 1fr}.design-view-head{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(s);
  }

  function injectPageShell(){
    const page=el("drawingsPage");if(!page||el("designManagementTabs"))return;
    const appName=page.querySelector(".header .app-name");
    const appSub=page.querySelector(".header .app-subtitle");
    if(appName)appName.textContent="🎨 Design Management";
    if(appSub)appSub.textContent="Drawing control, design status and project design readiness";
    const step=page.querySelector(".step-title");if(step)step.textContent="Design Management";
    const sub=page.querySelector(".step-subtitle");if(sub)sub.textContent="Executive design position and controlled project drawing register.";

    const card=page.querySelector(".form-card");if(!card)return;
    const toolbar=page.querySelector(".admin-toolbar");
    const tabs=document.createElement("div");tabs.id="designManagementTabs";tabs.className="design-tabs";
    tabs.innerHTML='<button id="designDashboardTab" class="design-tab active" type="button">Dashboard</button><button id="designDrawingsTab" class="design-tab" type="button">Drawings</button><button class="design-tab" type="button" disabled title="Stage 2">Design Issues</button><button class="design-tab" type="button" disabled title="Stage 2">Design Changes</button><button class="design-tab" type="button" disabled title="Stage 2">Look-Ahead</button>';
    if(toolbar)toolbar.insertAdjacentElement("afterend",tabs);else card.prepend(tabs);
    el("designDashboardTab").onclick=()=>setDesignTab("dashboard");
    el("designDrawingsTab").onclick=()=>setDesignTab("drawings");

    const dash=document.createElement("div");dash.id="designDashboardPanel";
    dash.innerHTML='<div class="design-category-grid" id="designCategoryGrid"></div><div class="design-management-indicators" id="designManagementIndicators"></div><div class="design-dashboard-note">Overdue and look-ahead indicators use the Required at Site date recorded against each drawing.</div>';
    tabs.insertAdjacentElement("afterend",dash);

    const viewHead=document.createElement("div");viewHead.id="designDrawingsViewHead";viewHead.className="design-view-head";viewHead.style.display="none";
    viewHead.innerHTML='<div><b>Controlled Drawing Register</b><span id="designRegisterSubtitle">All three design categories</span></div><button id="designClearCategory" class="design-filter-pill" type="button">Clear Category Filter</button>';
    dash.insertAdjacentElement("afterend",viewHead);
    el("designClearCategory").onclick=function(){activeCategory="";const f=el("drawingDisciplineFilter");if(f)f.value="";renderDesignDrawings();};
  }

  function injectModalFields(){
    const discipline=el("drawingDiscipline");if(!discipline||el("drawingMainCategory"))return;
    const wrap=discipline.parentElement;
    if(wrap){wrap.classList.add("design-hidden-discipline");}

    const status=el("drawingStatus");
    const statusWrap=status&&status.parentElement;
    const anchor=wrap||statusWrap;
    if(!anchor)return;

    const mainWrap=document.createElement("div");mainWrap.innerHTML='<label>Main Category *</label><select id="drawingMainCategory"><option value="">Select Category</option></select>';
    const subWrap=document.createElement("div");subWrap.innerHTML='<label>Sub-Discipline *</label><select id="drawingSubDiscipline"><option value="">Select Sub-Discipline</option></select>';
    const typeWrap=document.createElement("div");typeWrap.innerHTML='<label>Drawing Type *</label><select id="drawingType"><option value="">Select Type</option></select>';
    const impactWrap=document.createElement("div");impactWrap.innerHTML='<label>Impact</label><select id="drawingImpact"></select>';
    const priorityWrap=document.createElement("div");priorityWrap.innerHTML='<label>Priority</label><select id="drawingPriority"></select>';
    const reqWrap=document.createElement("div");reqWrap.innerHTML='<label>Required at Site</label><input id="drawingRequiredAtSite" type="date">';
    const respWrap=document.createElement("div");respWrap.innerHTML='<label>Response Date</label><input id="drawingResponseDate" type="date">';

    anchor.insertAdjacentElement("beforebegin",mainWrap);
    mainWrap.insertAdjacentElement("afterend",subWrap);
    subWrap.insertAdjacentElement("afterend",typeWrap);
    if(statusWrap){statusWrap.insertAdjacentElement("afterend",impactWrap);impactWrap.insertAdjacentElement("afterend",priorityWrap);priorityWrap.insertAdjacentElement("afterend",reqWrap);reqWrap.insertAdjacentElement("afterend",respWrap);}

    setOptions(el("drawingMainCategory"),MAIN_CATEGORIES,"Select Category");
    setOptions(el("drawingType"),DRAWING_TYPES,"Select Type");
    setOptions(el("drawingImpact"),IMPACTS,"Select Impact");
    setOptions(el("drawingPriority"),PRIORITIES,"Select Priority");
    setOptions(status,DRAWING_STATUSES,"Select Status");
    el("drawingMainCategory").onchange=populateSubDisciplines;
    el("drawingSubDiscipline").onchange=syncLegacyDiscipline;
  }

  function populateSubDisciplines(){
    const main=el("drawingMainCategory")?el("drawingMainCategory").value:"";
    setOptions(el("drawingSubDiscipline"),SUB_DISCIPLINES[main]||[],"Select Sub-Discipline");
    syncLegacyDiscipline();
  }
  function ensureLegacyOption(value){
    const d=el("drawingDiscipline");if(!d||!value)return;
    if(!Array.from(d.options).some(o=>o.value===value))addOpt(d,value);
  }
  function syncLegacyDiscipline(){
    const main=el("drawingMainCategory")?el("drawingMainCategory").value:"";
    const sub=el("drawingSubDiscipline")?el("drawingSubDiscipline").value:"";
    const combined=[main,sub].filter(Boolean).join(" — ");
    ensureLegacyOption(combined);
    if(el("drawingDiscipline"))el("drawingDiscipline").value=combined;
  }

  function setDesignTab(tab){
    activeDesignTab=tab;
    const dash=el("designDashboardPanel");const head=el("designDrawingsViewHead");
    const drawingElements=[document.querySelector("#drawingsPage .module-note"),document.querySelector("#drawingsPage .drawings-toolbar"),document.querySelector("#drawingsPage .drawings-summary"),el("drawingsContainer")];
    if(dash)dash.style.display=tab==="dashboard"?"block":"none";
    if(head)head.style.display=tab==="drawings"?"flex":"none";
    drawingElements.forEach(x=>{if(x)x.style.display=tab==="drawings"?"":"none";});
    if(el("designDashboardTab"))el("designDashboardTab").classList.toggle("active",tab==="dashboard");
    if(el("designDrawingsTab"))el("designDrawingsTab").classList.toggle("active",tab==="drawings");
    if(tab==="dashboard")renderDesignDashboard();else renderDesignDrawings();
  }
  function categoryClass(main){return main==="Structural"?"struct":main==="MEP"?"mep":"arch";}
  function categoryStats(main){
    const rows=(window.drawingsData||[]).filter(r=>rowInfo(r).mainCategory===main);
    return {
      total:rows.length,
      approved:rows.filter(r=>String(r.status||"").toLowerCase()==="approved").length,
      review:rows.filter(r=>["submitted","under review","approved with comments","revise & resubmit"].includes(String(r.status||"").toLowerCase())).length,
      overdue:rows.filter(isOverdue).length,
      critical:rows.filter(r=>rowInfo(r).priority==="Critical").length
    };
  }
  function openCategory(main){
    activeCategory=main;setDesignTab("drawings");
    const f=el("drawingDisciplineFilter");if(f)f.value=main;
    renderDesignDrawings();
  }
  function renderDesignDashboard(){
    const grid=el("designCategoryGrid");if(!grid)return;
    grid.innerHTML=MAIN_CATEGORIES.map(main=>{
      const x=categoryStats(main);
      return '<button type="button" class="design-category-card '+categoryClass(main)+'" data-cat="'+esc(main)+'"><div class="design-category-title">'+esc(main)+'</div><div class="design-category-total">'+x.total+'</div><div class="design-category-metrics"><div class="design-mini"><span>Approved</span><b>'+x.approved+'</b></div><div class="design-mini"><span>Under Review</span><b>'+x.review+'</b></div><div class="design-mini"><span>Overdue</span><b>'+x.overdue+'</b></div><div class="design-mini"><span>Critical</span><b>'+x.critical+'</b></div></div></button>';
    }).join("");
    grid.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>openCategory(b.dataset.cat));
    const rows=window.drawingsData||[];
    const pending=rows.filter(r=>["submitted","under review","approved with comments","revise & resubmit"].includes(String(r.status||"").toLowerCase())).length;
    const overdue=rows.filter(isOverdue).length;
    const site=rows.filter(r=>rowInfo(r).impact==="Site"&&!isClosedStatus(r.status)).length;
    const next=rows.filter(inNext14Days).length;
    const inds=el("designManagementIndicators");if(inds)inds.innerHTML='<div class="design-indicator"><span>Pending Review</span><b>'+pending+'</b></div><div class="design-indicator"><span>Overdue</span><b>'+overdue+'</b></div><div class="design-indicator"><span>Site Impact</span><b>'+site+'</b></div><div class="design-indicator"><span>Required Next 14 Days</span><b>'+next+'</b></div>';
  }

  function fillDesignFilters(){
    if(typeof window.fillSimpleSelect!=="function")return;
    const projects=(window.masterData&&window.masterData.projects||[]).map(x=>x["Project Name"]).filter(Boolean);
    window.fillSimpleSelect("drawingProjectFilter",[...new Set(projects)].sort(),"Project");
    if(typeof window.lockProjectSelectToActive_==="function")window.lockProjectSelectToActive_("drawingProjectFilter");
    if(typeof window.updateDrawingFilterTowers==="function")window.updateDrawingFilterTowers();
    setOptions(el("drawingDisciplineFilter"),MAIN_CATEGORIES,"All Categories");
    if(activeCategory&&MAIN_CATEGORIES.includes(activeCategory))el("drawingDisciplineFilter").value=activeCategory;
  }
  function resetDesignFilters(){
    ["drawingSearch","drawingTowerFilter","drawingFloorFilter","drawingStatusFilter"].forEach(id=>{if(el(id))el(id).value="";});
    activeCategory="";
    if(el("drawingDisciplineFilter"))el("drawingDisciplineFilter").value="";
    if(typeof window.lockProjectSelectToActive_==="function")window.lockProjectSelectToActive_("drawingProjectFilter");
    if(typeof window.updateDrawingFilterTowers==="function")window.updateDrawingFilterTowers();
    renderDesignDrawings();
  }
  function renderDesignDrawings(){
    const q=(el("drawingSearch")&&el("drawingSearch").value||"").toLowerCase().trim();
    const p=el("drawingProjectFilter")?el("drawingProjectFilter").value:"";
    const t=el("drawingTowerFilter")?el("drawingTowerFilter").value:"";
    const f=el("drawingFloorFilter")?el("drawingFloorFilter").value:"";
    const cat=el("drawingDisciplineFilter")?el("drawingDisciplineFilter").value:"";
    const st=el("drawingStatusFilter")?el("drawingStatusFilter").value:"";
    activeCategory=cat||"";
    const rows=(window.drawingsData||[]).filter(r=>{
      const x=rowInfo(r);
      const txt=[r.drawingNo,r.title,x.mainCategory,x.subDiscipline,x.drawingType,r.consultant,r.revision,x.remarks,r.project,r.tower,r.floor].join(" ").toLowerCase();
      return (!q||txt.includes(q))&&(!p||r.project===p)&&(!t||r.tower===t)&&(!f||r.floor===f)&&(!cat||x.mainCategory===cat)&&(!st||r.status===st);
    }).sort((a,b)=>String(b.issueDate||"").localeCompare(String(a.issueDate||"")));
    if(el("drawingCount"))el("drawingCount").textContent=rows.length+" Drawing"+(rows.length===1?"":"s");
    if(el("drawingLatestCount"))el("drawingLatestCount").textContent=rows.filter(r=>r.status!=="Superseded").length+" Current / Latest";
    if(el("designRegisterSubtitle"))el("designRegisterSubtitle").textContent=cat?cat:"All three design categories";
    if(el("designClearCategory"))el("designClearCategory").classList.toggle("show",!!cat);
    const c=el("drawingsContainer");if(!c)return;
    if(!rows.length){c.className="empty-state";c.textContent="No drawings found for the selected Design Management filters.";return;}
    c.className="drawings-table-wrap";
    let h='<table class="drawings-table"><thead><tr><th>Drawing No.</th><th>Title</th><th>Project / Tower / Floor</th><th>Category</th><th>Sub-Discipline</th><th>Type</th><th>Rev.</th><th>Status</th><th>Issued</th><th>Required at Site</th><th>Priority</th><th>Consultant</th><th>File</th><th></th></tr></thead><tbody>';
    rows.forEach(r=>{
      const x=rowInfo(r);const overdue=isOverdue(r);
      const statusClass=typeof window.drawingStatusClass==="function"?window.drawingStatusClass(r.status):String(r.status||"").toLowerCase().replace(/\s+/g,"-");
      h+='<tr><td><b>'+esc(r.drawingNo)+'</b></td><td>'+esc(r.title)+'</td><td>'+esc([r.project,r.tower,r.floor].filter(Boolean).join(" / "))+'</td><td><b>'+esc(x.mainCategory)+'</b></td><td>'+esc(x.subDiscipline)+'</td><td>'+esc(x.drawingType||"-")+'</td><td><b>'+esc(r.revision)+'</b></td><td><span class="drawing-status '+esc(statusClass)+'">'+esc(r.status)+'</span></td><td>'+esc(r.issueDate||"-")+'</td><td>'+esc(x.requiredAtSite||"-")+(overdue?'<span class="drawing-overdue">OVERDUE</span>':'')+'</td><td><span class="drawing-priority '+esc(String(x.priority||"Normal").toLowerCase())+'">'+esc(x.priority||"Normal")+'</span></td><td>'+esc(r.consultant||"-")+'</td><td>'+(r.link?'<a class="drawing-link" href="'+esc(r.link)+'" target="_blank" rel="noopener">View PDF</a>':'-')+'</td><td><button class="view-btn" data-id="'+esc(r.drawingId)+'" onclick="editDrawing(this.dataset.id)">Edit</button></td></tr>';
    });
    c.innerHTML=h+'</tbody></table>';
    renderDesignDashboard();
  }

  function clearDesignModalFields(){
    if(el("drawingMainCategory"))el("drawingMainCategory").value="";
    populateSubDisciplines();
    if(el("drawingType"))el("drawingType").value="";
    if(el("drawingImpact"))el("drawingImpact").value="None";
    if(el("drawingPriority"))el("drawingPriority").value="Normal";
    if(el("drawingRequiredAtSite"))el("drawingRequiredAtSite").value="";
    if(el("drawingResponseDate"))el("drawingResponseDate").value="";
  }
  function loadDesignFieldsFromRow(r){
    if(!r)return;
    const x=rowInfo(r);
    if(el("drawingMainCategory"))el("drawingMainCategory").value=x.mainCategory||"";
    populateSubDisciplines();
    if(el("drawingSubDiscipline")){
      if(x.subDiscipline&&!Array.from(el("drawingSubDiscipline").options).some(o=>o.value===x.subDiscipline))addOpt(el("drawingSubDiscipline"),x.subDiscipline);
      el("drawingSubDiscipline").value=x.subDiscipline||"";
    }
    if(el("drawingType"))el("drawingType").value=x.drawingType||"";
    if(el("drawingImpact"))el("drawingImpact").value=x.impact||"None";
    if(el("drawingPriority"))el("drawingPriority").value=x.priority||"Normal";
    if(el("drawingRequiredAtSite"))el("drawingRequiredAtSite").value=x.requiredAtSite||"";
    if(el("drawingResponseDate"))el("drawingResponseDate").value=x.responseDate||"";
    if(el("drawingRemarks"))el("drawingRemarks").value=x.remarks||"";
    syncLegacyDiscipline();
  }

  function installOverrides(){
    originalOpenDrawings=window.openDrawings;
    originalOpenDrawingModal=window.openDrawingModal;
    originalEditDrawing=window.editDrawing;
    originalSaveDrawing=window.saveDrawing;
    if(typeof originalOpenDrawings==="function")window.openDrawings=function(){originalOpenDrawings.apply(this,arguments);setDesignTab("dashboard");};
    if(typeof originalOpenDrawingModal==="function")window.openDrawingModal=function(){originalOpenDrawingModal.apply(this,arguments);setTimeout(clearDesignModalFields,0);};
    if(typeof originalEditDrawing==="function")window.editDrawing=function(id){originalEditDrawing.apply(this,arguments);setTimeout(function(){const r=(window.drawingsData||[]).find(x=>String(x.drawingId)===String(id));loadDesignFieldsFromRow(r);},0);};
    window.fillDrawingFilters=fillDesignFilters;
    window.resetDrawingFilters=resetDesignFilters;
    window.renderDrawings=renderDesignDrawings;
    window.renderDesignDrawings=renderDesignDrawings;
    window.renderDesignDashboard=renderDesignDashboard;
    window.setDesignTab=setDesignTab;
    window.openDesignCategory=openCategory;

    if(typeof originalSaveDrawing==="function")window.saveDrawing=function(){
      const main=el("drawingMainCategory")?el("drawingMainCategory").value:"";
      const sub=el("drawingSubDiscipline")?el("drawingSubDiscipline").value:"";
      const type=el("drawingType")?el("drawingType").value:"";
      const msg=el("drawingMessage");
      if(!main||!sub||!type){if(msg){msg.style.color="#dc2626";msg.textContent="Please select Main Category, Sub-Discipline and Drawing Type.";}return;}
      syncLegacyDiscipline();
      const remarks=el("drawingRemarks");
      const visibleRemarks=remarks?remarks.value:"";
      const meta={mainCategory:main,subDiscipline:sub,drawingType:type,impact:el("drawingImpact")?el("drawingImpact").value:"None",priority:el("drawingPriority")?el("drawingPriority").value:"Normal",requiredAtSite:el("drawingRequiredAtSite")?el("drawingRequiredAtSite").value:"",responseDate:el("drawingResponseDate")?el("drawingResponseDate").value:""};
      if(remarks)remarks.value=packMeta(meta,visibleRemarks);
      try{return originalSaveDrawing.apply(this,arguments);}finally{if(remarks)remarks.value=visibleRemarks;}
    };
  }

  function updateNavigation(){
    document.querySelectorAll(".pmc-nav-item").forEach(btn=>{
      if(String(btn.getAttribute("onclick")||"").includes("openDrawings"))btn.innerHTML='<span>◩</span>Design Management';
    });
    const health=Array.from(document.querySelectorAll(".health-card")).find(x=>String(x.getAttribute("onclick")||"").includes("openDrawings"));
    if(health){const l=health.querySelector(".health-label");const d=health.querySelector(".health-detail");if(l)l.textContent="Design Management";if(d)d.textContent="Reading design & drawing register";}
  }

  function init(){
    injectStyles();injectPageShell();injectModalFields();updateNavigation();installOverrides();
    setOptions(el("drawingStatusFilter"),DRAWING_STATUSES,"All Statuses");
    setDesignTab("dashboard");
  }
  window.addEventListener("load",function(){setTimeout(init,0);});
})();
