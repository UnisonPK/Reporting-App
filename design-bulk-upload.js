/* Design Management - Smart Bulk Drawing Upload V1 */
(function(){
  "use strict";

  const MAIN=["Architecture / Finishes","Structural","MEP"];
  const SUB={
    "Architecture / Finishes":["Architectural","Interior / Finishes","Façade","Joinery / Woodwork","Landscape","External Development","Other Architectural"],
    "Structural":["Foundation","Columns / Walls","Beams / Slabs","Staircases","Steel Structure","Expansion Joints","Structural Details","Other Structural"],
    "MEP":["Electrical","Plumbing","HVAC","Fire Fighting","Fire Alarm","ELV / ICT","BMS","Vertical Transportation / Lifts","Other MEP"]
  };
  let rows=[];

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
  const project=()=>typeof getActiveProject==="function"?getActiveProject():"";

  function infer(name){
    const stem=String(name||"").replace(/\.pdf$/i,"").trim();
    const up=stem.toUpperCase();
    let main="Architecture / Finishes",sub="Architectural";
    if(/(^|[-_ ])(STR|ST|STRUCT|STRUCTURAL)([-_ ]|$)/.test(up)){main="Structural";sub="Structural Details";}
    else if(/(^|[-_ ])(MEP|ELEC|EL|ELECT|PLB|PLUMB|HVAC|FF|FA|ELV|ICT|BMS)([-_ ]|$)/.test(up)){
      main="MEP";
      if(/ELEC|ELECT|(^|[-_ ])EL([-_ ]|$)/.test(up))sub="Electrical";
      else if(/PLB|PLUMB/.test(up))sub="Plumbing";
      else if(/HVAC/.test(up))sub="HVAC";
      else if(/(^|[-_ ])FF([-_ ]|$)|FIRE.?FIGHT/.test(up))sub="Fire Fighting";
      else if(/(^|[-_ ])FA([-_ ]|$)|FIRE.?ALARM/.test(up))sub="Fire Alarm";
      else if(/ELV|ICT/.test(up))sub="ELV / ICT";
      else if(/BMS/.test(up))sub="BMS";
      else sub="Other MEP";
    } else if(/INT|INTERIOR|FINISH/.test(up)){main="Architecture / Finishes";sub="Interior / Finishes";}
    else if(/LAND|LANDSCAPE/.test(up)){main="Architecture / Finishes";sub="Landscape";}
    else if(/FACADE|FAÇADE/.test(up)){main="Architecture / Finishes";sub="Façade";}

    let rev="";
    const rm=stem.match(/(?:^|[-_ ])(?:REV(?:ISION)?[-_ ]?|R)([A-Z0-9]+)$/i) || stem.match(/(?:^|[-_ ])(R\d+)(?:[-_ ]|$)/i);
    if(rm)rev=(rm[0].trim().replace(/^[-_ ]+/,"").replace(/^REV(?:ISION)?[-_ ]?/i,"R")).toUpperCase();
    if(!rev){const x=stem.match(/(?:^|[-_ ])R\d+[A-Z]?(?:$|[-_ ])/i);if(x)rev=x[0].trim().replace(/^[-_ ]+|[-_ ]+$/g,"").toUpperCase();}
    let drawingNo=stem;
    if(rev)drawingNo=stem.replace(new RegExp("[-_ ]*"+rev.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$","i"),"");
    return {drawingNo:drawingNo||stem,revision:rev||"R0",title:stem,mainCategory:main,subDiscipline:sub};
  }

  function towersForProject(){
    const md=window.masterData||{};
    return [...new Set((md.towers||[]).filter(x=>String(x["Project"]||"")===project()).map(x=>x["Tower / Block"]).filter(Boolean))].sort();
  }
  function floorsFor(tower){
    const md=window.masterData||{};
    return [...new Set((md.floors||[]).filter(x=>(!x["Project"]||String(x["Project"])===project())&&(!tower||String(x["Tower / Block"]||"")===tower)).map(x=>x["Floor"]).filter(Boolean))].sort();
  }
  function opts(vals,cur,blank){return '<option value="">'+esc(blank||"Select")+'</option>'+vals.map(v=>'<option '+(v===cur?'selected':'')+'>'+esc(v)+'</option>').join("");}

  function duplicateKey(r){return [project(),r.drawingNo,r.revision].map(x=>String(x||"").trim().toLowerCase()).join("||");}
  function markDuplicates(){
    const existing=new Set((window.drawingsData||[]).map(r=>[r.project,r.drawingNo,r.revision].map(x=>String(x||"").trim().toLowerCase()).join("||")));
    const seen=new Set();
    rows.forEach(r=>{const k=duplicateKey(r);r.duplicate=existing.has(k)||seen.has(k);seen.add(k);});
  }

  function render(){
    markDuplicates();
    const body=$("bulkDrawingRows");if(!body)return;
    if(!rows.length){body.innerHTML='<div class="bulk-empty">Select PDF files to begin.</div>';updateSummary();return;}
    body.innerHTML=rows.map((r,i)=>{
      const subs=SUB[r.mainCategory]||[];
      return '<div class="bulk-row '+(r.duplicate?'duplicate':'')+'">'+
        '<div class="bulk-check"><input type="checkbox" '+(r.selected?'checked':'')+' onchange="bulkDrawingSelect('+i+',this.checked)"></div>'+
        '<div class="bulk-file"><b title="'+esc(r.file.name)+'">'+esc(r.file.name)+'</b><span>'+Math.max(1,Math.round(r.file.size/1024))+' KB</span>'+(r.duplicate?'<em>Duplicate</em>':'')+'</div>'+
        '<input value="'+esc(r.drawingNo)+'" oninput="bulkDrawingSet('+i+',\'drawingNo\',this.value)" placeholder="Drawing No.">'+
        '<input value="'+esc(r.revision)+'" oninput="bulkDrawingSet('+i+',\'revision\',this.value)" placeholder="Rev.">'+
        '<input value="'+esc(r.title)+'" oninput="bulkDrawingSet('+i+',\'title\',this.value)" placeholder="Title">'+
        '<select onchange="bulkDrawingCategory('+i+',this.value)">'+opts(MAIN,r.mainCategory,"Category")+'</select>'+
        '<select onchange="bulkDrawingSet('+i+',\'subDiscipline\',this.value)">'+opts(subs,r.subDiscipline,"Sub-Discipline")+'</select>'+
        '<select onchange="bulkDrawingTower('+i+',this.value)">'+opts(towersForProject(),r.tower,"Tower / Area")+'</select>'+
        '<select onchange="bulkDrawingSet('+i+',\'floor\',this.value)">'+opts(floorsFor(r.tower),r.floor,"Floor / Area")+'</select>'+
        '<select onchange="bulkDrawingSet('+i+',\'status\',this.value)">'+opts(["Draft","Submitted","Under Review","Approved with Comments","Approved","Revise & Resubmit","Superseded"],r.status,"Status")+'</select>'+
      '</div>';
    }).join("");
    updateSummary();
  }

  function updateSummary(){
    const s=$("bulkDrawingSummary");if(!s)return;
    const dup=rows.filter(r=>r.duplicate).length,sel=rows.filter(r=>r.selected).length;
    s.textContent=rows.length+" files • "+sel+" selected"+(dup?" • "+dup+" duplicate(s) blocked":"");
  }

  function inject(){
    if($("bulkDrawingModal"))return;
    const addBtn=document.querySelector('#drawingsPage .admin-toolbar .admin-primary-btn');
    if(addBtn && !$("bulkDrawingsButton")){
      const b=document.createElement("button");b.id="bulkDrawingsButton";b.className="admin-primary-btn bulk-drawing-open";b.type="button";b.textContent="⬆ Bulk Upload Drawings";b.onclick=openBulk;
      addBtn.parentElement.insertBefore(b,addBtn);
    }
    const m=document.createElement("div");m.id="bulkDrawingModal";m.className="admin-modal bulk-drawing-modal";
    m.innerHTML='<div class="bulk-card" onclick="event.stopPropagation()">'+
      '<div class="bulk-head"><div><b>Bulk Upload Drawings</b><span id="bulkProjectLabel"></span></div><button onclick="closeBulkDrawingUpload()">Close</button></div>'+
      '<div class="bulk-body">'+
        '<div class="bulk-drop"><input id="bulkDrawingFiles" type="file" multiple accept="application/pdf,.pdf"><div><b>Select multiple PDF drawings</b><span>Filename lookup will suggest drawing number, revision and discipline.</span></div></div>'+
        '<div class="bulk-actions"><button onclick="bulkSelectAll(true)">Select All</button><button onclick="bulkSelectAll(false)">Clear</button><span class="bulk-divider"></span><b>Assign Category:</b><button class="arch" onclick="bulkApplyCategory(\'Architecture / Finishes\')">Architecture / Finishes</button><button class="struct" onclick="bulkApplyCategory(\'Structural\')">Structural</button><button class="mep" onclick="bulkApplyCategory(\'MEP\')">MEP</button></div>'+
        '<div class="bulk-apply"><select id="bulkTowerApply"></select><select id="bulkFloorApply"></select><select id="bulkStatusApply"><option value="">Status</option><option>Draft</option><option selected>Submitted</option><option>Under Review</option><option>Approved with Comments</option><option>Approved</option><option>Revise & Resubmit</option><option>Superseded</option></select><button onclick="bulkApplyCommon()">Apply to Selected</button></div>'+
        '<div class="bulk-table-head"><span></span><span>File</span><span>Drawing No.</span><span>Rev.</span><span>Title</span><span>Category</span><span>Sub-Discipline</span><span>Tower</span><span>Floor</span><span>Status</span></div>'+
        '<div id="bulkDrawingRows" class="bulk-rows"></div>'+
      '</div>'+
      '<div class="bulk-footer"><span id="bulkDrawingSummary">0 files</span><div><button class="bulk-cancel" onclick="closeBulkDrawingUpload()">Cancel</button><button id="bulkUploadSave" class="bulk-save" onclick="uploadBulkDrawings()">Upload & Save All</button></div></div>'+
    '</div>';
    m.onclick=e=>{if(e.target===m)closeBulk();};document.body.appendChild(m);
    $("bulkDrawingFiles").addEventListener("change",filesChanged);
    $("bulkTowerApply").addEventListener("change",()=>fillBulkFloorApply());
  }

  function fillBulkControls(){
    $("bulkProjectLabel").textContent=project()?"Active Project: "+project():"No active project";
    $("bulkTowerApply").innerHTML=opts(towersForProject(),"","Tower / Area");fillBulkFloorApply();
  }
  function fillBulkFloorApply(){const t=$("bulkTowerApply").value;$("bulkFloorApply").innerHTML=opts(floorsFor(t),"","Floor / Area");}
  function openBulk(){rows=[];fillBulkControls();$("bulkDrawingFiles").value="";render();$("bulkDrawingModal").style.display="flex";document.body.style.overflow="hidden";}
  function closeBulk(){if($("bulkUploadSave").disabled)return;$("bulkDrawingModal").style.display="none";document.body.style.overflow="";}

  function filesChanged(e){
    const files=[...(e.target.files||[])].filter(f=>f.type==="application/pdf"||/\.pdf$/i.test(f.name));
    rows=files.map(file=>Object.assign({file,selected:true,tower:"",floor:"",status:"Submitted",drawingType:"For Approval",issueDate:today(),priority:"Normal",impact:"None"},infer(file.name)));
    render();
  }

  window.bulkDrawingSelect=(i,v)=>{rows[i].selected=v;updateSummary();};
  window.bulkDrawingSet=(i,k,v)=>{rows[i][k]=v;render();};
  window.bulkDrawingCategory=(i,v)=>{rows[i].mainCategory=v;rows[i].subDiscipline=(SUB[v]||[])[0]||"";render();};
  window.bulkDrawingTower=(i,v)=>{rows[i].tower=v;rows[i].floor="";render();};
  window.bulkSelectAll=v=>{rows.forEach(r=>r.selected=v);render();};
  window.bulkApplyCategory=cat=>{rows.filter(r=>r.selected&&!r.duplicate).forEach(r=>{r.mainCategory=cat;r.subDiscipline=(SUB[cat]||[])[0]||"";});render();};
  window.bulkApplyCommon=()=>{const t=$("bulkTowerApply").value,f=$("bulkFloorApply").value,s=$("bulkStatusApply").value;rows.filter(r=>r.selected&&!r.duplicate).forEach(r=>{if(t){r.tower=t;if(!f)r.floor="";}if(f)r.floor=f;if(s)r.status=s;});render();};
  window.closeBulkDrawingUpload=closeBulk;

  function file64(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=e=>resolve({base64:String(e.target.result).split(",")[1],mimeType:file.type||"application/pdf",name:file.name});fr.onerror=()=>reject(new Error("Unable to read "+file.name));fr.readAsDataURL(file);});}
  function saveOne(r,pdf){
    const meta={mainCategory:r.mainCategory,subDiscipline:r.subDiscipline,drawingType:r.drawingType,impact:r.impact,priority:r.priority,requiredAtSite:"",responseDate:""};
    const remarks="[[DM1:"+encodeURIComponent(JSON.stringify(meta))+"]]\nBulk uploaded from "+r.file.name;
    const record={drawingId:"",project:project(),tower:r.tower,floor:r.floor,drawingNo:r.drawingNo.trim(),revision:r.revision.trim(),title:r.title.trim(),discipline:r.mainCategory+" — "+r.subDiscipline,status:r.status,issueDate:r.issueDate,consultant:"",remarks,actorUserId:window.loggedInUser?loggedInUser.userId:"",actorUsername:window.loggedInUser?loggedInUser.username:""};
    return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).saveDrawingWithPdf({record,pdf}));
  }

  window.uploadBulkDrawings=async function(){
    markDuplicates();
    const todo=rows.filter(r=>r.selected&&!r.duplicate);
    if(!todo.length){alert("No eligible drawings selected. Duplicate drawings are blocked.");return;}
    const bad=todo.find(r=>!r.drawingNo||!r.revision||!r.title||!r.mainCategory||!r.subDiscipline||!r.tower||!r.floor||!r.status);
    if(bad){alert("Please complete Drawing No., Revision, Title, Category, Sub-Discipline, Tower, Floor and Status for every selected drawing.");return;}
    const btn=$("bulkUploadSave"),sum=$("bulkDrawingSummary");btn.disabled=true;
    let ok=0,failed=[];
    for(let i=0;i<todo.length;i++){
      const r=todo[i];sum.textContent="Uploading "+(i+1)+" of "+todo.length+": "+r.file.name;
      try{const pdf=await file64(r.file);await saveOne(r,pdf);ok++;}
      catch(e){failed.push(r.file.name+": "+(e.message||e));}
    }
    btn.disabled=false;
    if(failed.length){sum.textContent=ok+" saved • "+failed.length+" failed";alert("Bulk upload completed with errors:\n\n"+failed.join("\n"));}
    else{sum.textContent=ok+" drawings uploaded successfully";setTimeout(()=>{closeBulk();if(typeof loadDrawings==="function")loadDrawings();},700);}
  };

  window.addEventListener("load",()=>setTimeout(inject,400));
})();
