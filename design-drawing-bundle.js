/* Design Management - attachment bundle display
   Shows PDF / DWG / DXF links on one logical drawing revision row.
*/
(function(){
  "use strict";

  function parseMeta(remarks){
    const m=String(remarks||"").match(/^\[\[DM1:([^\]]+)\]\]/);
    if(!m)return {};
    try{return JSON.parse(decodeURIComponent(m[1]))||{};}catch(_e){return {};}
  }

  function linksFor(r){
    const out={pdf:String(r&&r.pdfLink||"").trim(),dwg:String(r&&r.dwgLink||"").trim(),dxf:String(r&&r.dxfLink||"").trim()};
    if(!out.pdf&&!out.dwg&&!out.dxf&&r&&r.link){
      const t=String(parseMeta(r.remarks).fileType||"PDF").toUpperCase();
      if(t==="DWG")out.dwg=r.link;
      else if(t==="DXF")out.dxf=r.link;
      else out.pdf=r.link;
    }
    return out;
  }

  function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

  function fileHtml(r){
    const x=linksFor(r),a=[];
    if(x.pdf)a.push('<a class="drawing-bundle-link pdf" href="'+esc(x.pdf)+'" target="_blank" rel="noopener">PDF</a>');
    if(x.dwg)a.push('<a class="drawing-bundle-link dwg" href="'+esc(x.dwg)+'" target="_blank" rel="noopener">DWG</a>');
    if(x.dxf)a.push('<a class="drawing-bundle-link dxf" href="'+esc(x.dxf)+'" target="_blank" rel="noopener">DXF</a>');
    return a.length?'<div class="drawing-bundle-files">'+a.join("")+'</div>':'-';
  }

  let patching=false;
  function patchRegister(){
    if(patching)return;
    patching=true;
    try{
      const table=document.querySelector('#drawingsContainer table.drawings-table');
      if(!table)return;
      const head=table.querySelector('thead tr');
      if(head){const ths=head.querySelectorAll('th');if(ths.length>=2)ths[ths.length-2].textContent='Files';}
      table.querySelectorAll('tbody tr').forEach(tr=>{
        const edit=tr.querySelector('button[data-id]');if(!edit)return;
        const id=String(edit.dataset.id||"");
        const r=(window.drawingsData||[]).find(x=>String(x.drawingId||"")===id);if(!r)return;
        const tds=tr.querySelectorAll('td');if(tds.length<2)return;
        const cell=tds[tds.length-2];
        const sig=[r.pdfLink,r.dwgLink,r.dxfLink,r.link].join('|');
        if(cell.dataset.bundleSig===sig)return;
        cell.dataset.bundleSig=sig;
        cell.innerHTML=fileHtml(r);
      });
    } finally {patching=false;}
  }

  function install(){
    patchRegister();
    const c=document.getElementById('drawingsContainer');
    if(!c)return;
    const obs=new MutationObserver(function(){setTimeout(patchRegister,0);});
    obs.observe(c,{childList:true,subtree:true});
  }

  window.addEventListener('load',()=>setTimeout(install,350));
})();