/* Design Management - Current Drawings / Revision Archive
   Keeps the working Drawings sheet as the audit source. Main register shows only
   the latest revision per Project + Drawing No.; older revisions are shown in Archive.
*/
(function(){
  "use strict";
  let mode="current";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const key=r=>[r&&r.project,r&&r.drawingNo].map(x=>String(x||"").trim().toLowerCase()).join("||");
  function revParts(v){
    let s=String(v||"").trim().toUpperCase().replace(/^REV(?:ISION)?[\s._-]*/,"").replace(/^R(?=\d)/,"");
    const m=s.match(/^(\d+)([A-Z]*)$/);if(m)return {kind:2,n:+m[1],tail:m[2]};
    const a=s.match(/^([A-Z]+)(\d*)$/);if(a)return {kind:1,n:a[2]?+a[2]:0,tail:a[1]};
    return {kind:0,n:0,tail:s};
  }
  function cmpRev(a,b){const x=revParts(a),y=revParts(b);if(x.kind!==y.kind)return x.kind-y.kind;if(x.n!==y.n)return x.n-y.n;return x.tail.localeCompare(y.tail);}
  function groups(){const g={};(window.drawingsData||[]).forEach(r=>(g[key(r)]||(g[key(r)]=[])).push(r));return g;}
  function latestIds(){const ids=new Set();Object.values(groups()).forEach(arr=>{arr.sort((a,b)=>{const c=cmpRev(a.revision,b.revision);if(c)return c;return String(a.issueDate||"").localeCompare(String(b.issueDate||""));});const max=arr[arr.length-1];if(max)ids.add(String(max.drawingId||""));});return ids;}
  function isCurrent(r,ids){return ids.has(String(r&&r.drawingId||""));}
  function installButtons(){
    if($("revisionArchiveSwitch"))return;
    const head=$("designDrawingsViewHead");if(!head)return;
    const box=document.createElement("div");box.id="revisionArchiveSwitch";box.className="revision-archive-switch";
    box.innerHTML='<button id="currentDrawingsBtn" type="button" class="active">Current Drawings</button><button id="revisionArchiveBtn" type="button">Revision Archive</button>';
    head.appendChild(box);
    $("currentDrawingsBtn").onclick=()=>setMode("current");$("revisionArchiveBtn").onclick=()=>setMode("archive");
  }
  function setMode(m){mode=m;$("currentDrawingsBtn")&&$("currentDrawingsBtn").classList.toggle("active",m==="current");$("revisionArchiveBtn")&&$("revisionArchiveBtn").classList.toggle("active",m==="archive");if(typeof window.renderDesignDrawings==="function")window.renderDesignDrawings();setTimeout(applyMode,0);}
  function applyMode(){
    installButtons();
    const table=document.querySelector('#drawingsContainer table.drawings-table');if(!table)return;
    const ids=latestIds();let visible=0;
    table.querySelectorAll('tbody tr').forEach(tr=>{const b=tr.querySelector('button[data-id]');if(!b)return;const r=(window.drawingsData||[]).find(x=>String(x.drawingId||"")===String(b.dataset.id||""));if(!r)return;const show=mode==="current"?isCurrent(r,ids):!isCurrent(r,ids);tr.style.display=show?"":"none";if(show){visible++;if(mode==="archive"){const status=tr.querySelector('.drawing-status');if(status){status.textContent='Superseded';status.className='drawing-status superseded';}const revCell=tr.children[6];if(revCell&&!revCell.querySelector('.archive-mark'))revCell.insertAdjacentHTML('beforeend','<span class="archive-mark">ARCHIVE</span>');}}});
    const count=$("drawingCount");if(count)count.textContent=visible+(mode==="current"?" Current Drawing":" Archived Revision")+(visible===1?"":"s");
    const sub=$("designRegisterSubtitle");if(sub)sub.textContent=mode==="current"?"Latest active revision only":"Superseded revision history — files retained";
    const latest=$("drawingLatestCount");if(latest)latest.textContent=mode==="current"?visible+" Current / Latest":visible+" Archived";
  }
  function install(){installButtons();const c=$("drawingsContainer");if(c){new MutationObserver(()=>setTimeout(applyMode,0)).observe(c,{childList:true,subtree:true});}setTimeout(applyMode,0);}
  window.designRevisionArchiveMode=()=>mode;
  window.addEventListener('load',()=>setTimeout(install,500));
})();