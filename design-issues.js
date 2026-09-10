/* Design Management - Design Issues Stage 2
   Shared Apps Script data with safe local fallback.
*/
(function(){
  "use strict";
  const KEY="pmcDesignIssuesV1";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const today=()=>new Date().toISOString().slice(0,10);
  let issues=[], editId="", backendAvailable=null, loading=false;

  function localData(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[];}catch(e){return[];}}
  function saveLocal(a){localStorage.setItem(KEY,JSON.stringify(a||[]));}
  function activeProject(){try{return typeof getActiveProject==="function"?getActiveProject():"";}catch(e){return"";}}
  function api(action,data){if(!window.LCRG_API||typeof window.LCRG_API.call!=="function")return Promise.reject(new Error("API not ready"));return window.LCRG_API.call(action,data||{});}

  function install(){
    const tabs=$("designManagementTabs"); if(!tabs||$("designIssuesPanel"))return;
    const issueBtn=[...tabs.querySelectorAll("button")].find(b=>b.textContent.trim()==="Design Issues"); if(!issueBtn)return;
    issueBtn.disabled=false; issueBtn.title=""; issueBtn.id="designIssuesTab";
    const panel=document.createElement("div"); panel.id="designIssuesPanel"; panel.style.display="none";
    panel.innerHTML='<div class="design-issues-head"><div><b>Design Issues Register</b><span>RFIs, design clarifications, coordination constraints and decisions affecting site delivery.</span></div><button id="addDesignIssueBtn" type="button">+ Add Design Issue</button></div><div id="designIssueKpis" class="design-issue-kpis"></div><div class="design-issue-tools"><input id="designIssueSearch" placeholder="Search issue, reference or responsible party..."><select id="designIssueStatus"><option value="">All Statuses</option><option>Open</option><option>Awaiting Response</option><option>Resolved</option><option>Closed</option></select><select id="designIssuePriority"><option value="">All Priorities</option><option>Normal</option><option>High</option><option>Critical</option></select></div><div id="designIssueTable"></div>';
    const anchor=$("designDrawingsViewHead")||$("designDashboardPanel"); anchor.insertAdjacentElement("afterend",panel);
    issueBtn.onclick=show; $("addDesignIssueBtn").onclick=()=>openModal(); $("designIssueSearch").oninput=render; $("designIssueStatus").onchange=render; $("designIssuePriority").onchange=render;
    makeModal();
  }

  function show(){
    document.querySelectorAll("#designManagementTabs .design-tab").forEach(b=>b.classList.remove("active")); $("designIssuesTab").classList.add("active");
    if($("designDashboardPanel"))$("designDashboardPanel").style.display="none"; if($("designDrawingsViewHead"))$("designDrawingsViewHead").style.display="none";
    const f=document.querySelector("#drawingsPage .drawings-filters"), i=document.querySelector("#drawingsPage .drawings-info"); if(f)f.style.display="none"; if(i)i.style.display="none"; if($("drawingsContainer"))$("drawingsContainer").style.display="none";
    $("designIssuesPanel").style.display="block"; loadIssues();
  }

  async function loadIssues(){
    if(loading)return; loading=true; statusMessage("Loading design issues...");
    try{
      const r=await api("designIssues",{project:activeProject()});
      issues=Array.isArray(r)?r:(r&&Array.isArray(r.rows)?r.rows:[]); backendAvailable=true; saveLocal(issues); render();
    }catch(e){
      backendAvailable=false; issues=localData(); render();
      if(!issues.length)statusMessage("Design Issues backend is not deployed yet. Local test mode is active.");
      console.warn("Design Issues backend fallback:",e);
    }finally{loading=false;}
  }

  function statusMessage(text){if($("designIssueTable"))$("designIssueTable").innerHTML='<div class="design-issue-empty">'+esc(text)+'</div>';}

  function makeModal(){
    if($("designIssueModal"))return;
    const d=document.createElement("div"); d.id="designIssueModal"; d.className="design-issue-modal";
    d.innerHTML='<div class="design-issue-dialog"><div class="design-issue-modal-head"><b id="designIssueModalTitle">Add Design Issue</b><button id="closeDesignIssue">×</button></div><div class="design-issue-form"><div><label>Issue / RFI Ref. *</label><input id="diRef"></div><div><label>Category *</label><select id="diCategory"><option>Architecture / Finishes</option><option>Structural</option><option>MEP</option><option>Coordination</option></select></div><div class="span2"><label>Issue / Clarification *</label><textarea id="diTitle" rows="2"></textarea></div><div><label>Tower / Area</label><input id="diTower"></div><div><label>Floor / Location</label><input id="diFloor"></div><div><label>Responsible Party *</label><input id="diResponsible" placeholder="Consultant / Architect / Contractor"></div><div><label>Priority</label><select id="diPriority"><option>Normal</option><option>High</option><option>Critical</option></select></div><div><label>Status</label><select id="diStatus"><option>Open</option><option>Awaiting Response</option><option>Resolved</option><option>Closed</option></select></div><div><label>Raised Date</label><input id="diRaised" type="date"></div><div><label>Target Response</label><input id="diTarget" type="date"></div><div><label>Impact</label><select id="diImpact"><option>None</option><option>Site</option><option>Programme</option><option>Procurement</option><option>Cost</option></select></div><div class="span2"><label>Action / Decision Required</label><textarea id="diAction" rows="2"></textarea></div><div class="span2"><label>Remarks / Response</label><textarea id="diRemarks" rows="2"></textarea></div></div><div class="design-issue-modal-foot"><button id="cancelDesignIssue">Cancel</button><button id="saveDesignIssue">Save Issue</button></div></div>';
    document.body.appendChild(d); $("closeDesignIssue").onclick=closeModal; $("cancelDesignIssue").onclick=closeModal; $("saveDesignIssue").onclick=saveIssue;
  }

  function openModal(id){
    editId=id||""; const r=issues.find(x=>x.id===editId)||{};
    $("designIssueModalTitle").textContent=editId?"Edit Design Issue":"Add Design Issue"; $("diRef").value=r.ref||""; $("diCategory").value=r.category||"Architecture / Finishes"; $("diTitle").value=r.title||""; $("diTower").value=r.tower||""; $("diFloor").value=r.floor||""; $("diResponsible").value=r.responsible||""; $("diPriority").value=r.priority||"Normal"; $("diStatus").value=r.status||"Open"; $("diRaised").value=r.raised||today(); $("diTarget").value=r.target||""; $("diImpact").value=r.impact||"None"; $("diAction").value=r.action||""; $("diRemarks").value=r.remarks||""; $("designIssueModal").classList.add("show");
  }
  function closeModal(){$("designIssueModal").classList.remove("show");}

  async function saveIssue(){
    const ref=$("diRef").value.trim(), title=$("diTitle").value.trim(), responsible=$("diResponsible").value.trim();
    if(!ref||!title||!responsible){alert("Issue reference, issue/clarification and responsible party are required.");return;}
    const r={id:editId||("DI-"+Date.now()),project:activeProject(),ref,category:$("diCategory").value,title,tower:$("diTower").value.trim(),floor:$("diFloor").value.trim(),responsible,priority:$("diPriority").value,status:$("diStatus").value,raised:$("diRaised").value,target:$("diTarget").value,impact:$("diImpact").value,action:$("diAction").value.trim(),remarks:$("diRemarks").value.trim(),updatedAt:new Date().toISOString()};
    const btn=$("saveDesignIssue"); btn.disabled=true; btn.textContent="Saving...";
    try{
      if(backendAvailable!==false){await api("saveDesignIssue",r); backendAvailable=true; closeModal(); await loadIssues();}
      else throw new Error("Backend unavailable");
    }catch(e){
      let a=localData(), n=a.findIndex(x=>x.id===r.id); if(n>=0)a[n]=r; else a.push(r); saveLocal(a); issues=a; closeModal(); render();
      alert("Saved in local test mode. Deploy the Design Issues Apps Script backend to make it shared across users.");
    }finally{btn.disabled=false; btn.textContent="Save Issue";}
  }

  function render(){
    const p=activeProject(), q=($("designIssueSearch")&&$("designIssueSearch").value||"").toLowerCase(), st=$("designIssueStatus")?$("designIssueStatus").value:"", pr=$("designIssuePriority")?$("designIssuePriority").value:"";
    let a=(issues||[]).filter(r=>!p||!r.project||r.project===p), all=a.slice();
    a=a.filter(r=>(!q||[r.ref,r.title,r.responsible,r.tower,r.floor].join(" ").toLowerCase().includes(q))&&(!st||r.status===st)&&(!pr||r.priority===pr));
    const overdue=all.filter(r=>r.target&&r.target<today()&&!['Resolved','Closed'].includes(r.status)).length, critical=all.filter(r=>r.priority==='Critical'&&!['Resolved','Closed'].includes(r.status)).length;
    $("designIssueKpis").innerHTML='<div><span>Open</span><b>'+all.filter(r=>!['Resolved','Closed'].includes(r.status)).length+'</b></div><div><span>Awaiting Response</span><b>'+all.filter(r=>r.status==='Awaiting Response').length+'</b></div><div><span>Overdue</span><b>'+overdue+'</b></div><div><span>Critical</span><b>'+critical+'</b></div>';
    if(!a.length){statusMessage("No design issues recorded for this view.");return;}
    $("designIssueTable").innerHTML='<div class="design-issue-table-wrap"><table><thead><tr><th>Ref.</th><th>Issue / Clarification</th><th>Category</th><th>Location</th><th>Responsible</th><th>Priority</th><th>Status</th><th>Target</th><th>Impact</th><th></th></tr></thead><tbody>'+a.sort((x,y)=>String(x.target||'9999').localeCompare(String(y.target||'9999'))).map(r=>'<tr><td><b>'+esc(r.ref)+'</b></td><td>'+esc(r.title)+'</td><td>'+esc(r.category)+'</td><td>'+esc([r.tower,r.floor].filter(Boolean).join(' / ')||'-')+'</td><td>'+esc(r.responsible)+'</td><td><span class="di-priority '+String(r.priority||'Normal').toLowerCase()+'">'+esc(r.priority||'Normal')+'</span></td><td><span class="di-status">'+esc(r.status||'Open')+'</span></td><td class="'+(r.target&&r.target<today()&&!['Resolved','Closed'].includes(r.status)?'di-overdue':'')+'">'+esc(r.target||'-')+'</td><td>'+esc(r.impact||'-')+'</td><td><button class="di-edit" data-id="'+esc(r.id)+'">Edit</button></td></tr>').join('')+'</tbody></table></div>';
    $("designIssueTable").querySelectorAll('.di-edit').forEach(b=>b.onclick=()=>openModal(b.dataset.id));
  }

  window.refreshDesignIssues=loadIssues;
  window.addEventListener('load',()=>setTimeout(install,700));
})();