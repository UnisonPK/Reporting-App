/* Design Management - Design Changes Stage 2.1
   Shared Apps Script data with controlled local fallback.
   Reads may retry; writes are single-shot to prevent duplicate records.
*/
(function(){
  "use strict";
  const KEY="pmcDesignChangesV1";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  const today=()=>new Date().toISOString().slice(0,10);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let rows=[],editId="",backendAvailable=null,loading=false,saving=false;

  function activeProject(){try{return typeof getActiveProject==="function"?getActiveProject():"";}catch(e){return"";}}
  function loadLocal(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[];}catch(e){return[];}}
  function saveLocal(a){localStorage.setItem(KEY,JSON.stringify(a||[]));}
  function api(action,data){if(!window.LCRG_API||typeof window.LCRG_API.call!=="function")return Promise.reject(new Error("API not ready"));return window.LCRG_API.call(action,data||{});}
  async function apiRetry(action,data){try{return await api(action,data);}catch(first){await wait(800);try{return await api(action,data);}catch(second){throw second||first;}}}

  function install(){
    const tabs=$("designManagementTabs");
    if(!tabs||$("designChangesPanel"))return;
    const btn=[...tabs.querySelectorAll("button")].find(b=>b.textContent.trim()==="Design Changes");
    if(!btn)return;
    btn.disabled=false;btn.title="";btn.id="designChangesTab";

    const panel=document.createElement("div");
    panel.id="designChangesPanel";panel.style.display="none";
    panel.innerHTML='<div class="design-changes-head"><div><b>Design Changes Register</b><span>Track proposed, instructed and approved design changes with cost and programme visibility.</span></div><button id="addDesignChangeBtn" type="button">+ Add Design Change</button></div><div id="designChangeKpis" class="design-change-kpis"></div><div class="design-change-tools"><input id="designChangeSearch" placeholder="Search change, reference, location or responsible party..."><select id="designChangeStatus"><option value="">All Statuses</option><option>Proposed</option><option>Under Review</option><option>Pending Approval</option><option>Approved</option><option>Rejected</option><option>Implemented</option></select><select id="designChangeImpact"><option value="">All Impacts</option><option>None</option><option>Cost</option><option>Programme</option><option>Cost + Programme</option></select></div><div id="designChangeTable"></div>';

    const anchor=$("designIssuesPanel")||$("designDrawingsViewHead")||$("designDashboardPanel");
    anchor.insertAdjacentElement("afterend",panel);
    btn.onclick=show;
    $("addDesignChangeBtn").onclick=()=>openModal();
    $("designChangeSearch").oninput=render;
    $("designChangeStatus").onchange=render;
    $("designChangeImpact").onchange=render;
    makeModal();
  }

  function hideOtherViews(){
    document.querySelectorAll("#designManagementTabs .design-tab").forEach(b=>b.classList.remove("active"));
    ["designDashboardPanel","designDrawingsViewHead","designIssuesPanel"].forEach(id=>{if($(id))$(id).style.display="none";});
    const f=document.querySelector("#drawingsPage .drawings-filters"),i=document.querySelector("#drawingsPage .drawings-info");
    if(f)f.style.display="none";if(i)i.style.display="none";if($("drawingsContainer"))$("drawingsContainer").style.display="none";
  }

  function show(){
    hideOtherViews();
    $("designChangesTab").classList.add("active");
    $("designChangesPanel").style.display="block";
    loadChanges();
  }

  async function loadChanges(){
    if(loading)return;loading=true;statusMessage("Loading design changes...");
    try{
      const r=await apiRetry("designChanges",{project:activeProject()});
      rows=Array.isArray(r)?r:(r&&Array.isArray(r.rows)?r.rows:[]);
      backendAvailable=true;saveLocal(rows);render();
    }catch(e){
      backendAvailable=false;rows=loadLocal();render();
      const msg=e&&e.message?e.message:String(e||"Unknown backend error");
      statusMessage("Shared Design Changes could not be loaded. "+msg+" You can still press + Add Design Change; the app will retry the shared backend when you save.");
      console.warn("Design Changes backend load failed:",e);
    }finally{loading=false;}
  }

  function statusMessage(text){if($("designChangeTable"))$("designChangeTable").innerHTML='<div class="design-change-empty">'+esc(text)+'</div>';}

  function makeModal(){
    if($("designChangeModal"))return;
    const d=document.createElement("div");d.id="designChangeModal";d.className="design-change-modal";
    d.innerHTML='<div class="design-change-dialog"><div class="design-change-modal-head"><b id="designChangeModalTitle">Add Design Change</b><button id="closeDesignChange">×</button></div><div class="design-change-form"><div><label>Change Ref. *</label><input id="dcRef"></div><div><label>Category *</label><select id="dcCategory"><option>Architecture / Finishes</option><option>Structural</option><option>MEP</option><option>Coordination</option></select></div><div class="span2"><label>Change Description *</label><textarea id="dcTitle" rows="2"></textarea></div><div><label>Tower / Area</label><input id="dcTower"></div><div><label>Floor / Location</label><input id="dcFloor"></div><div><label>Source</label><select id="dcSource"><option>Client Instruction</option><option>Consultant Instruction</option><option>RFI / Clarification</option><option>Site Coordination</option><option>Value Engineering</option><option>Statutory / Authority</option><option>Other</option></select></div><div><label>Initiated By *</label><input id="dcInitiatedBy" placeholder="Client / Architect / PMC / Contractor"></div><div><label>Responsible Party *</label><input id="dcResponsible"></div><div><label>Status</label><select id="dcStatus"><option>Proposed</option><option>Under Review</option><option>Pending Approval</option><option>Approved</option><option>Rejected</option><option>Implemented</option></select></div><div><label>Raised Date</label><input id="dcRaised" type="date"></div><div><label>Target Approval</label><input id="dcTarget" type="date"></div><div><label>Impact</label><select id="dcImpact"><option>None</option><option>Cost</option><option>Programme</option><option>Cost + Programme</option></select></div><div><label>Cost Impact (PKR)</label><input id="dcCost" type="number" min="0" step="0.01"></div><div><label>Programme Impact (Days)</label><input id="dcDays" type="number" min="0" step="1"></div><div><label>Linked Issue / RFI Ref.</label><input id="dcLinkedIssue"></div><div><label>Drawing Revision Required?</label><select id="dcDrawingRevision"><option>No</option><option>Yes</option></select></div><div class="span2"><label>Approval / Decision Required</label><textarea id="dcDecision" rows="2"></textarea></div><div class="span2"><label>Remarks</label><textarea id="dcRemarks" rows="2"></textarea></div></div><div class="design-change-modal-foot"><button id="cancelDesignChange">Cancel</button><button id="saveDesignChange">Save Change</button></div></div>';
    document.body.appendChild(d);
    $("closeDesignChange").onclick=closeModal;$("cancelDesignChange").onclick=closeModal;$("saveDesignChange").onclick=saveChange;
  }

  function openModal(id){
    editId=id||"";const r=rows.find(x=>x.id===editId)||{};
    $("designChangeModalTitle").textContent=editId?"Edit Design Change":"Add Design Change";
    $("dcRef").value=r.ref||"";$("dcCategory").value=r.category||"Architecture / Finishes";$("dcTitle").value=r.title||"";$("dcTower").value=r.tower||"";$("dcFloor").value=r.floor||"";$("dcSource").value=r.source||"Client Instruction";$("dcInitiatedBy").value=r.initiatedBy||"";$("dcResponsible").value=r.responsible||"";$("dcStatus").value=r.status||"Proposed";$("dcRaised").value=r.raised||today();$("dcTarget").value=r.target||"";$("dcImpact").value=r.impact||"None";$("dcCost").value=r.costImpact||"";$("dcDays").value=r.programmeDays||"";$("dcLinkedIssue").value=r.linkedIssue||"";$("dcDrawingRevision").value=r.drawingRevision||"No";$("dcDecision").value=r.decision||"";$("dcRemarks").value=r.remarks||"";$("designChangeModal").classList.add("show");
  }
  function closeModal(){$("designChangeModal").classList.remove("show");}

  function collectChange(){
    const ref=$("dcRef").value.trim(),title=$("dcTitle").value.trim(),initiatedBy=$("dcInitiatedBy").value.trim(),responsible=$("dcResponsible").value.trim();
    if(!ref||!title||!initiatedBy||!responsible)throw new Error("Change reference, description, initiated by and responsible party are required.");
    const r={project:activeProject(),ref,category:$("dcCategory").value,title,tower:$("dcTower").value.trim(),floor:$("dcFloor").value.trim(),source:$("dcSource").value,initiatedBy,responsible,status:$("dcStatus").value,raised:$("dcRaised").value,target:$("dcTarget").value,impact:$("dcImpact").value,costImpact:Number($("dcCost").value||0),programmeDays:Number($("dcDays").value||0),linkedIssue:$("dcLinkedIssue").value.trim(),drawingRevision:$("dcDrawingRevision").value,decision:$("dcDecision").value.trim(),remarks:$("dcRemarks").value.trim()};
    if(editId)r.id=editId;
    return r;
  }

  async function saveChange(){
    if(saving)return;
    let r;try{r=collectChange();}catch(e){alert(e.message);return;}
    const btn=$("saveDesignChange");saving=true;btn.disabled=true;btn.textContent="Saving...";
    try{
      /* IMPORTANT: writes are intentionally NOT retried. A delayed response from
         Apps Script must never cause the same new record to be posted twice. */
      const result=await api("saveDesignChange",r);
      backendAvailable=true;
      if(result&&result.id)r.id=result.id;
      closeModal();
      await loadChanges();
      alert((result&&result.message)||"Design Change saved to the shared register successfully.");
    }catch(e){
      backendAvailable=false;
      const msg=e&&e.message?e.message:String(e||"Unknown backend error");
      console.error("Design Change shared save failed:",e);
      if(confirm("Shared Design Changes save failed: "+msg+"\n\nSave this change locally on this device instead?")){
        const local=Object.assign({id:editId||("LOCAL-DC-"+Date.now())},r,{updatedAt:new Date().toISOString()});
        let a=loadLocal(),n=a.findIndex(x=>x.id===local.id);if(n>=0)a[n]=local;else a.push(local);saveLocal(a);rows=a;closeModal();render();
        alert("Saved locally on this device only. It is not yet in the shared Google Sheet.");
      }
    }finally{saving=false;btn.disabled=false;btn.textContent="Save Change";}
  }

  function render(){
    const p=activeProject(),q=($("designChangeSearch")&&$("designChangeSearch").value||"").toLowerCase(),st=$("designChangeStatus")?$("designChangeStatus").value:"",im=$("designChangeImpact")?$("designChangeImpact").value:"";
    let a=(rows||[]).filter(r=>!p||!r.project||r.project===p),all=a.slice();
    a=a.filter(r=>(!q||[r.ref,r.title,r.responsible,r.initiatedBy,r.tower,r.floor,r.linkedIssue].join(" ").toLowerCase().includes(q))&&(!st||r.status===st)&&(!im||r.impact===im));
    const pending=all.filter(r=>["Proposed","Under Review","Pending Approval"].includes(r.status)).length;
    const approved=all.filter(r=>["Approved","Implemented"].includes(r.status)).length;
    const cost=all.filter(r=>r.costImpact>0||["Cost","Cost + Programme"].includes(r.impact)).length;
    const prog=all.filter(r=>r.programmeDays>0||["Programme","Cost + Programme"].includes(r.impact)).length;
    $("designChangeKpis").innerHTML='<div><span>Pending Approval</span><b>'+pending+'</b></div><div><span>Approved / Implemented</span><b>'+approved+'</b></div><div><span>Cost Impact</span><b>'+cost+'</b></div><div><span>Programme Impact</span><b>'+prog+'</b></div>';
    if(!a.length){statusMessage("No design changes recorded for this view.");return;}
    $("designChangeTable").innerHTML='<div class="design-change-table-wrap"><table><thead><tr><th>Ref.</th><th>Change Description</th><th>Category</th><th>Location</th><th>Initiated By</th><th>Responsible</th><th>Status</th><th>Impact</th><th>Target</th><th></th></tr></thead><tbody>'+a.sort((x,y)=>String(x.target||"9999").localeCompare(String(y.target||"9999"))).map(r=>'<tr><td><b>'+esc(r.ref)+'</b></td><td>'+esc(r.title)+'</td><td>'+esc(r.category)+'</td><td>'+esc([r.tower,r.floor].filter(Boolean).join(" / ")||"-")+'</td><td>'+esc(r.initiatedBy)+'</td><td>'+esc(r.responsible)+'</td><td><span class="dc-status">'+esc(r.status)+'</span></td><td>'+esc(r.impact)+(r.costImpact?'<small>PKR '+Number(r.costImpact).toLocaleString()+'</small>':'')+(r.programmeDays?'<small>'+esc(r.programmeDays)+' day(s)</small>':'')+'</td><td>'+esc(r.target||"-")+'</td><td><button class="dc-edit" data-id="'+esc(r.id)+'">Edit</button></td></tr>').join("")+'</tbody></table></div>';
    $("designChangeTable").querySelectorAll(".dc-edit").forEach(b=>b.onclick=()=>openModal(b.dataset.id));
  }

  window.refreshDesignChanges=loadChanges;
  window.addEventListener("load",()=>setTimeout(install,850));
})();