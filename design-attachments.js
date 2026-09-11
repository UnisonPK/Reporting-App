/* Design Management - Optional Attachments V2
   Adds optional supporting drawing/picture upload to Design Issues and Design Changes.
   Both modules upload through the shared Apps Script backend and store files in Google Drive.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const ACCEPT=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
  let issueRows=[];
  let changeRows=[];

  function addStyles(){
    if($("designAttachmentStyles"))return;
    const s=document.createElement("style");
    s.id="designAttachmentStyles";
    s.textContent='.design-attachment-field{grid-column:1/-1;border:1px dashed #cbd5e1;background:#f8fafc;border-radius:10px;padding:10px 12px}.design-attachment-field label{display:block;font-weight:800;margin-bottom:6px}.design-attachment-note{display:block;color:#64748b;font-size:10px;margin-top:5px}.design-attachment-existing{margin-top:6px;font-size:11px}.design-attachment-existing a,.design-attachment-link{font-weight:800;color:#0b3f88;text-decoration:none}.design-attachment-link:hover{text-decoration:underline}';
    document.head.appendChild(s);
  }

  function fileToPayload(file){
    return new Promise((resolve,reject)=>{
      if(!file){resolve(null);return;}
      const reader=new FileReader();
      reader.onload=()=>{
        const result=String(reader.result||"");
        const comma=result.indexOf(",");
        resolve({name:file.name,mimeType:file.type||"application/octet-stream",base64:comma>=0?result.slice(comma+1):result});
      };
      reader.onerror=()=>reject(new Error("Could not read the selected attachment."));
      reader.readAsDataURL(file);
    });
  }

  function injectIssueField(){
    const form=document.querySelector("#designIssueModal .design-issue-form");
    if(!form||$("diAttachment"))return;
    const wrap=document.createElement("div");
    wrap.className="design-attachment-field";
    wrap.innerHTML='<label>Supporting Drawing / Picture <span style="font-weight:500">(Optional)</span></label><input id="diAttachment" type="file" accept="'+ACCEPT+'"><span class="design-attachment-note">PDF, DWG, DXF, JPG, PNG or WEBP. Leave blank if no attachment is required.</span><div id="diAttachmentExisting" class="design-attachment-existing"></div>';
    form.appendChild(wrap);
  }

  function injectChangeField(){
    const form=document.querySelector("#designChangeModal .design-change-form");
    if(!form||$("dcAttachment"))return;
    const wrap=document.createElement("div");
    wrap.className="design-attachment-field";
    wrap.innerHTML='<label>Supporting Drawing / Picture <span style="font-weight:500">(Optional)</span></label><input id="dcAttachment" type="file" accept="'+ACCEPT+'"><span class="design-attachment-note">PDF, DWG, DXF, JPG, PNG or WEBP. Files are stored in the shared Google Drive design-support folder.</span><div id="dcAttachmentExisting" class="design-attachment-existing"></div>';
    form.appendChild(wrap);
  }

  function safeHref(v){return String(v||"").replace(/"/g,"&quot;");}

  function refreshIssueExisting(){
    const box=$("diAttachmentExisting");
    if(!box)return;
    const ref=$("diRef")?$("diRef").value.trim():"";
    const r=issueRows.find(x=>String(x.ref||"").trim()===ref);
    box.innerHTML=r&&r.attachmentLink?'<a target="_blank" rel="noopener" href="'+safeHref(r.attachmentLink)+'">📎 View existing attachment'+(r.attachmentName?' — '+r.attachmentName:'')+'</a>':'';
    if($("diAttachment"))$("diAttachment").value="";
  }

  function refreshChangeExisting(){
    const box=$("dcAttachmentExisting");
    if(!box)return;
    const ref=$("dcRef")?$("dcRef").value.trim():"";
    const r=changeRows.find(x=>String(x.ref||"").trim()===ref);
    box.innerHTML=r&&r.attachmentLink?'<a target="_blank" rel="noopener" href="'+safeHref(r.attachmentLink)+'">📎 View existing attachment'+(r.attachmentName?' — '+r.attachmentName:'')+'</a>':'';
    if($("dcAttachment"))$("dcAttachment").value="";
  }

  function patchApi(){
    if(!window.LCRG_API||window.LCRG_API.__designAttachmentsPatched)return;
    const original=window.LCRG_API.call.bind(window.LCRG_API);
    window.LCRG_API.call=async function(action,data){
      if(action==="saveDesignIssue"){
        const input=$("diAttachment");
        const file=input&&input.files&&input.files[0];
        if(file)data=Object.assign({},data,{attachment:await fileToPayload(file)});
      }
      if(action==="saveDesignChange"){
        const input=$("dcAttachment");
        const file=input&&input.files&&input.files[0];
        if(file)data=Object.assign({},data,{attachment:await fileToPayload(file)});
      }
      const result=await original(action,data);
      if(action==="designIssues"){
        issueRows=Array.isArray(result)?result:(result&&Array.isArray(result.rows)?result.rows:[]);
        setTimeout(augmentIssueRegister,50);
      }
      if(action==="designChanges"){
        changeRows=Array.isArray(result)?result:(result&&Array.isArray(result.rows)?result.rows:[]);
        setTimeout(augmentChangeRegister,50);
      }
      return result;
    };
    window.LCRG_API.__designAttachmentsPatched=true;
  }

  function addAttachmentColumn(table,rows){
    if(!table||table.dataset.attachmentsAugmented==="1")return;
    const header=table.querySelector("thead tr");
    if(!header)return;
    const th=document.createElement("th");th.textContent="Attachment";
    header.insertBefore(th,header.lastElementChild);
    table.querySelectorAll("tbody tr").forEach(tr=>{
      const ref=(tr.cells[0]&&tr.cells[0].textContent||"").trim();
      const r=rows.find(x=>String(x.ref||"").trim()===ref);
      const td=document.createElement("td");
      td.innerHTML=r&&r.attachmentLink?'<a class="design-attachment-link" target="_blank" rel="noopener" href="'+safeHref(r.attachmentLink)+'">📎 View</a>':'-';
      tr.insertBefore(td,tr.lastElementChild);
    });
    table.dataset.attachmentsAugmented="1";
  }

  function augmentIssueRegister(){addAttachmentColumn(document.querySelector("#designIssueTable table"),issueRows);}
  function augmentChangeRegister(){addAttachmentColumn(document.querySelector("#designChangeTable table"),changeRows);}

  function watch(){
    addStyles();patchApi();injectIssueField();injectChangeField();
    const issueModal=$("designIssueModal");
    if(issueModal&&!issueModal.__attachWatch){issueModal.__attachWatch=true;new MutationObserver(()=>{if(issueModal.classList.contains("show"))setTimeout(refreshIssueExisting,0);}).observe(issueModal,{attributes:true,attributeFilter:["class"]});}
    const changeModal=$("designChangeModal");
    if(changeModal&&!changeModal.__attachWatch){changeModal.__attachWatch=true;new MutationObserver(()=>{if(changeModal.classList.contains("show"))setTimeout(refreshChangeExisting,0);}).observe(changeModal,{attributes:true,attributeFilter:["class"]});}
    augmentIssueRegister();augmentChangeRegister();
  }

  window.addEventListener("load",()=>{let n=0;const t=setInterval(()=>{watch();if(++n>20)clearInterval(t);},400);});
})();