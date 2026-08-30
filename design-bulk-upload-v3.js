/* Design Management - Smart Bulk Drawing Upload V3
   One logical Drawing No. + Revision can contain PDF, DWG and DXF attachments.
*/
(function(){
  "use strict";

  const MAIN=["Architecture / Finishes","Structural","MEP"];
  const SUB={
    "Architecture / Finishes":["Architectural","Interior / Finishes","Façade","Joinery / Woodwork","Landscape","External Development","Other Architectural"],
    "Structural":["Foundation","Columns / Walls","Beams / Slabs","Staircases","Steel Structure","Expansion Joints","Structural Details","Other Structural"],
    "MEP":["Electrical","Plumbing","HVAC","Fire Fighting","Fire Alarm","ELV / ICT","BMS","Vertical Transportation / Lifts","Other MEP"]
  };
  const STATUSES=["Draft","Submitted","Under Review","Approved with Comments","Approved","Revise & Resubmit","Superseded"];
  let rows=[];

  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const project=()=>typeof getActiveProject==="function"?getActiveProject():"";
  const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
  const ext=name=>{const m=String(name||"").match(/\.([^.]+)$/);return m?m[1].toUpperCase():"FILE";};
  function mime(file){const e=ext(file.name);if(file.type)return file.type;if(e==="PDF")return "application/pdf";if(e==="DWG")return "application/acad";if(e==="DXF")return "application/dxf";return "application/octet-stream";}
  function allowed(file){return !!file&&/\.(pdf|dwg|dxf)$/i.test(file.name||"");}

  function parseMeta(remarks){
    const m=String(remarks||"").match(/^\[\[DM1:([^\]]+)\]\]/);
    if(!m)return {};
    try{return JSON.parse(decodeURIComponent(m[1]))||{};}catch(_e){return {};}
  }

  function logicalKey(p,no,rev){return [p,no,rev].map(x=>String(x||"").trim().toLowerCase()).join("||");}
  function attachmentTypes(r){
    const out=[];
    if(r&&r.pdfLink)out.push("PDF");
    if(r&&r.dwgLink)out.push("DWG");
    if(r&&r.dxfLink)out.push("DXF");
    if(!out.length&&r&&r.link){const t=String(parseMeta(r.remarks).fileType||"PDF").toUpperCase();out.push(["PDF","DWG","DXF"].includes(t)?t:"PDF");}
    return out;
  }

  function infer(name){
    const stem=String(name||"").replace(/\.(pdf|dwg|dxf)$/i,"").trim();
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
    } else if(/INT|INTERIOR|FINISH/.test(up))sub="Interior / Finishes";
    else if(/LAND|LANDSCAPE/.test(up))sub="Landscape";
    else if(/FACADE|FAÇADE/.test(up))sub="Façade";

    let rev="R0";
    const rm=stem.match(/(?:^|[-_ ])(R\d+[A-Z]?|REV[-_ ]?[A-Z0-9]+)$/i);
    if(rm)rev=rm[1].toUpperCase().replace(/^REV[-_ ]?/,"R");
    const drawingNo=stem.replace(new RegExp("[-_ ]*"+rev.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$","i"),"")||stem;
    return {drawingNo,revision:rev,title:stem,mainCategory:main,subDiscipline:sub};
  }

  function towers(){const md=window.masterData||{};return [...new Set((md.towers||[]).filter(x=>String(x["Project"]||"")===project()).map(x=>x["Tower / Block"]).filter(Boolean))].sort();}
  function floors(t){const md=window.masterData||{};return [...new Set((md.floors||[]).filter(x=>(!x["Project"]||String(x["Project"])===project())&&(!t||String(x["Tower / Block"]||"")===t)).map(x=>x["Floor"]).filter(Boolean))].sort();}
  function opts(vals,cur,label){return '<option value="">'+esc(label||"Select")+'</option>'+vals.map(v=>'<option '+(v===cur?'selected':'')+'>'+esc(v)+'</option>').join("");}

  function markDuplicates(){
    const existing=new Set();
    (window.drawingsData||[]).forEach(r=>{
      const k=logicalKey(r.project,r.drawingNo,r.revision);
      attachmentTypes(r).forEach(type=>existing.add(k+"||"+type.toLowerCase()));
    });
    const seen=new Set();
    rows.forEach(r=>{
      const k=logicalKey(project(),r.drawingNo,r.revision)+"||"+String(r.fileType||"").toLowerCase();
      r.duplicate=existing.has(k)||seen.has(k);
      seen.add(k);
    });
  }

  function summary(){
    const s=$("bulkDrawingSummary");if(!s)return;
    const dup=rows.filter(r=>r.duplicate).length,sel=rows.filter(r=>r.selected).length;
    const logical=new Set(rows.map(r=>logicalKey(project(),r.drawingNo,r.revision))).size;
    s.textContent=rows.length+" file"+(rows.length===1?"":"s")+" • "+logical+" drawing revision"+(logical===1?"":"s")+" • "+sel+" selected"+(dup?" • "+dup+" same-format duplicate(s) blocked":"");
  }

  function render(){
    markDuplicates();
    const b=$("bulkDrawingRows");if(!b)return;
    if(!rows.length){b.innerHTML='<div class="bulk-empty">Select PDF, DWG or DXF drawings to begin.</div>';summary();return;}
    b.innerHTML=rows.map((r,i)=>{
      const bundle=rows.filter(x=>logicalKey(project(),x.drawingNo,x.revision)===logicalKey(project(),r.drawingNo,r.revision)).length>1;
      return '<div class="bulk-row '+(r.duplicate?'duplicate':'')+'">'+
        '<div class="bulk-check"><input type="checkbox" '+(r.selected?'checked':'')+' onchange="bulkV3Select('+i+',this.checked)"></div>'+
        '<div class="bulk-file"><b title="'+esc(r.file.name)+'">'+esc(r.file.name)+'</b><span class="drawing-file-badge '+String(r.fileType).toLowerCase()+'">'+esc(r.fileType)+'</span><span>'+Math.max(1,Math.round(r.file.size/1024))+' KB</span>'+(bundle?'<em class="bundle-mark">Bundled</em>':'')+(r.duplicate?'<em>Duplicate</em>':'')+'</div>'+
        '<input value="'+esc(r.drawingNo)+'" oninput="bulkV3Set('+i+',\'drawingNo\',this.value)" placeholder="Drawing No.">'+
        '<input value="'+esc(r.revision)+'" oninput="bulkV3Set('+i+',\'revision\',this.value)" placeholder="Rev.">'+
        '<input value="'+esc(r.title)+'" oninput="bulkV3Set('+i+',\'title\',this.value)" placeholder="Title">'+
        '<select onchange="bulkV3Category('+i+',this.value)">'+opts(MAIN,r.mainCategory,"Category")+'</select>'+
        '<select onchange="bulkV3Set('+i+',\'subDiscipline\',this.value)">'+opts(SUB[r.mainCategory]||[],r.subDiscipline,"Sub-Discipline")+'</select>'+
        '<select onchange="bulkV3Tower('+i+',this.value)">'+opts(towers(),r.tower,"Tower / Area")+'</select>'+
        '<select onchange="bulkV3Set('+i+',\'floor\',this.value)">'+opts(floors(r.tower),r.floor,"Floor / Area")+'</select>'+
        '<select onchange="bulkV3Set('+i+',\'status\',this.value)">'+opts(STATUSES,r.status,"Status")+'</select></div>';
    }).join("");
    summary();
  }

  function inject(){
    if($("bulkDrawingModal"))return;
    const toolbar=document.querySelector('#drawingsPage .admin-toolbar');
    const add=toolbar&&toolbar.querySelector('.admin-primary-btn');
    if(add){const b=document.createElement('button');b.id='bulkDrawingsButton';b.className='admin-primary-btn bulk-drawing-open';b.type='button';b.textContent='⬆ Bulk Upload Drawings';b.onclick=open;toolbar.insertBefore(b,add);}
    const m=document.createElement('div');m.id='bulkDrawingModal';m.className='admin-modal bulk-drawing-modal';
    m.innerHTML='<div class="bulk-card" onclick="event.stopPropagation()"><div class="bulk-head"><div><b>Bulk Upload Drawings</b><span id="bulkProjectLabel"></span></div><button onclick="closeBulkDrawingUpload()">Close</button></div><div class="bulk-body"><div class="bulk-drop"><input id="bulkDrawingFiles" type="file" multiple accept=".pdf,.dwg,.dxf,application/pdf"><div><b>Select PDF / DWG / DXF drawings</b><span>Matching Drawing No. + Revision files are bundled into one register record.</span></div></div><div class="bulk-actions"><button onclick="bulkV3SelectAll(true)">Select All</button><button onclick="bulkV3SelectAll(false)">Clear</button><span class="bulk-divider"></span><b>Assign Category:</b><button class="arch" onclick="bulkV3ApplyCategory(\'Architecture / Finishes\')">Architecture / Finishes</button><button class="struct" onclick="bulkV3ApplyCategory(\'Structural\')">Structural</button><button class="mep" onclick="bulkV3ApplyCategory(\'MEP\')">MEP</button></div><div class="bulk-apply"><select id="bulkTowerApply"></select><select id="bulkFloorApply"></select><select id="bulkStatusApply">'+opts(STATUSES,"Submitted","Status")+'</select><button onclick="bulkV3ApplyCommon()">Apply to Selected</button></div><div class="bulk-table-head"><span></span><span>File</span><span>Drawing No.</span><span>Rev.</span><span>Title</span><span>Category</span><span>Sub-Discipline</span><span>Tower</span><span>Floor</span><span>Status</span></div><div id="bulkDrawingRows" class="bulk-rows"></div></div><div class="bulk-footer"><span id="bulkDrawingSummary">0 files</span><div><button class="bulk-cancel" onclick="closeBulkDrawingUpload()">Cancel</button><button id="bulkUploadSave" class="bulk-save" onclick="uploadBulkDrawingsV3()">Upload & Save All</button></div></div></div>';
    m.onclick=e=>{if(e.target===m)close();};document.body.appendChild(m);
    $("bulkDrawingFiles").addEventListener('change',e=>{const fs=[...(e.target.files||[])].filter(allowed);rows=fs.map(file=>Object.assign({file,selected:true,tower:"",floor:"",status:"Submitted",drawingType:"For Approval",issueDate:today(),priority:"Normal",impact:"None",fileType:ext(file.name)},infer(file.name)));render();});
    $("bulkTowerApply").addEventListener('change',fillFloors);
  }

  function fillControls(){$("bulkProjectLabel").textContent='Active Project: '+project();$("bulkTowerApply").innerHTML=opts(towers(),"","Tower / Area");fillFloors();}
  function fillFloors(){$("bulkFloorApply").innerHTML=opts(floors($("bulkTowerApply").value),"","Floor / Area");}
  function open(){rows=[];fillControls();$("bulkDrawingFiles").value='';render();$("bulkDrawingModal").style.display='flex';document.body.style.overflow='hidden';}
  function close(){if($("bulkUploadSave")&&$("bulkUploadSave").disabled)return;$("bulkDrawingModal").style.display='none';document.body.style.overflow='';}

  function file64(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=e=>res({base64:String(e.target.result).split(',')[1],mimeType:mime(file),name:file.name});fr.onerror=()=>rej(new Error('Unable to read '+file.name));fr.readAsDataURL(file);});}
  function saveOne(r,filePayload){
    const meta={mainCategory:r.mainCategory,subDiscipline:r.subDiscipline,drawingType:r.drawingType,impact:r.impact,priority:r.priority,requiredAtSite:"",responseDate:"",fileType:r.fileType,fileName:r.file.name};
    const remarks='[[DM1:'+encodeURIComponent(JSON.stringify(meta))+']]\nBulk uploaded from '+r.file.name;
    const record={drawingId:"",project:project(),tower:r.tower,floor:r.floor,drawingNo:r.drawingNo.trim(),revision:r.revision.trim(),title:r.title.trim(),discipline:r.mainCategory+' — '+r.subDiscipline,status:r.status,issueDate:r.issueDate,consultant:"",remarks};
    return new Promise((res,rej)=>google.script.run.withSuccessHandler(res).withFailureHandler(rej).saveDrawingWithPdf({record,pdf:filePayload}));
  }

  window.bulkV3Select=(i,v)=>{rows[i].selected=v;summary();};
  window.bulkV3Set=(i,k,v)=>{rows[i][k]=v;render();};
  window.bulkV3Category=(i,v)=>{rows[i].mainCategory=v;rows[i].subDiscipline=(SUB[v]||[])[0]||"";render();};
  window.bulkV3Tower=(i,v)=>{rows[i].tower=v;rows[i].floor="";render();};
  window.bulkV3SelectAll=v=>{rows.forEach(r=>r.selected=v);render();};
  window.bulkV3ApplyCategory=cat=>{rows.filter(r=>r.selected&&!r.duplicate).forEach(r=>{r.mainCategory=cat;r.subDiscipline=(SUB[cat]||[])[0]||"";});render();};
  window.bulkV3ApplyCommon=()=>{const t=$("bulkTowerApply").value,f=$("bulkFloorApply").value,s=$("bulkStatusApply").value;rows.filter(r=>r.selected&&!r.duplicate).forEach(r=>{if(t){r.tower=t;if(!f)r.floor="";}if(f)r.floor=f;if(s)r.status=s;});render();};
  window.closeBulkDrawingUpload=close;

  window.uploadBulkDrawingsV3=async()=>{
    markDuplicates();
    const todo=rows.filter(r=>r.selected&&!r.duplicate);
    if(!todo.length){alert('No eligible drawing files selected.');return;}
    if(todo.some(r=>!r.drawingNo||!r.revision||!r.title||!r.mainCategory||!r.subDiscipline||!r.tower||!r.floor||!r.status)){alert('Complete Drawing No., Revision, Title, Category, Sub-Discipline, Tower, Floor and Status for every selected file.');return;}
    const btn=$("bulkUploadSave"),sum=$("bulkDrawingSummary");btn.disabled=true;let ok=0,fail=[];
    for(let i=0;i<todo.length;i++){
      const r=todo[i];sum.textContent='Uploading '+(i+1)+' of '+todo.length+': '+r.file.name;
      try{await saveOne(r,await file64(r.file));ok++;}catch(e){fail.push(r.file.name+': '+(e.message||e));}
    }
    btn.disabled=false;
    if(fail.length){sum.textContent=ok+' saved • '+fail.length+' failed';alert('Bulk upload completed with errors:\n\n'+fail.join('\n'));}
    else{sum.textContent=ok+' file(s) saved into the drawing register.';setTimeout(()=>{close();if(typeof loadDrawings==='function')loadDrawings();},500);}
  };

  window.addEventListener('load',()=>setTimeout(inject,160));
})();