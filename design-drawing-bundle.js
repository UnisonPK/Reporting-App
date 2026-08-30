/* Design Management - logical drawing bundle display V2
   One Project + Drawing No. + Revision is rendered as one row with PDF/DWG/DXF attachments.
*/
(function(){
  "use strict";
  function meta(r){const m=String(r&&r.remarks||"").match(/^\[\[DM1:([^\]]+)\]\]/);if(!m)return{};try{return JSON.parse(decodeURIComponent(m[1]))||{};}catch(e){return{};}}
  function key(r){return [r&&r.project,r&&r.drawingNo,r&&r.revision].map(v=>String(v||"").trim().toLowerCase()).join("||");}
  function links(r){const x={pdf:String(r&&r.pdfLink||"").trim(),dwg:String(r&&r.dwgLink||"").trim(),dxf:String(r&&r.dxfLink||"").trim()};if(r&&r.link){const t=String(meta(r).fileType||"PDF").toUpperCase();if(t==="DWG"&&!x.dwg)x.dwg=r.link;else if(t==="DXF"&&!x.dxf)x.dxf=r.link;else if(t==="PDF"&&!x.pdf)x.pdf=r.link;}return x;}
  function esc(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function html(x){const a=[];if(x.pdf)a.push('<a class="drawing-bundle-link pdf" href="'+esc(x.pdf)+'" target="_blank" rel="noopener">PDF</a>');if(x.dwg)a.push('<a class="drawing-bundle-link dwg" href="'+esc(x.dwg)+'" target="_blank" rel="noopener">DWG</a>');if(x.dxf)a.push('<a class="drawing-bundle-link dxf" href="'+esc(x.dxf)+'" target="_blank" rel="noopener">DXF</a>');return a.length?'<div class="drawing-bundle-files">'+a.join("")+'</div>':'-';}
  let busy=false;
  function patch(){if(busy)return;busy=true;try{const table=document.querySelector('#drawingsContainer table.drawings-table');if(!table)return;const data=window.drawingsData||[],groups={};data.forEach(r=>{const k=key(r);if(!groups[k])groups[k]={rows:[],files:{pdf:"",dwg:"",dxf:""}};groups[k].rows.push(r);const l=links(r);groups[k].files.pdf=groups[k].files.pdf||l.pdf;groups[k].files.dwg=groups[k].files.dwg||l.dwg;groups[k].files.dxf=groups[k].files.dxf||l.dxf;});const th=table.querySelectorAll('thead th');if(th.length>=2)th[th.length-2].textContent='Files';const shown={};table.querySelectorAll('tbody tr').forEach(tr=>{const btn=tr.querySelector('button[data-id]');if(!btn)return;const r=data.find(x=>String(x.drawingId||"")===String(btn.dataset.id||""));if(!r)return;const k=key(r),g=groups[k];if(shown[k]){tr.style.display='none';tr.dataset.bundleDuplicate='1';return;}shown[k]=true;tr.style.display='';delete tr.dataset.bundleDuplicate;const td=tr.querySelectorAll('td');if(td.length>=2)td[td.length-2].innerHTML=html(g.files);});}finally{busy=false;}}
  function install(){patch();const c=document.getElementById('drawingsContainer');if(!c)return;new MutationObserver(()=>setTimeout(patch,0)).observe(c,{childList:true,subtree:true});}
  window.addEventListener('load',()=>setTimeout(install,350));
})();