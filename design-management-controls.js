/* Design Management controls - exclusive tabs + dashboard drawing register export */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const escCsv=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const activeProject=()=>{try{return typeof getActiveProject==='function'?String(getActiveProject()||'').trim():'';}catch(e){return'';}};

  function parseMeta(r){
    const raw=String(r&&r.remarks||'');
    const m=raw.match(/^\[\[DM1:([^\]]+)\]\](?:\r?\n)?/);
    let meta={};
    if(m){try{meta=JSON.parse(decodeURIComponent(m[1]))||{};}catch(e){meta={};}}
    return {meta,remarks:raw.replace(/^\[\[DM1:([^\]]+)\]\](?:\r?\n)?/,'')};
  }
  function revParts(v){
    let s=String(v||'').trim().toUpperCase().replace(/^REV(?:ISION)?[\s._-]*/,'').replace(/^R(?=\d)/,'');
    let m=s.match(/^(\d+)([A-Z]*)$/);if(m)return{kind:3,n:+m[1],tail:m[2]};
    m=s.match(/^([A-Z]+)(\d*)$/);if(m)return{kind:2,n:m[2]?+m[2]:0,tail:m[1]};
    return{kind:1,n:0,tail:s};
  }
  function cmpRev(a,b){const x=revParts(a),y=revParts(b);if(x.kind!==y.kind)return x.kind-y.kind;if(x.n!==y.n)return x.n-y.n;return x.tail.localeCompare(y.tail);}
  function currentRows(){
    const p=activeProject(),groups={};
    (window.drawingsData||[]).forEach(r=>{
      if(p&&String(r.project||'').trim()!==p)return;
      const k=[r.project,r.drawingNo].map(x=>String(x||'').trim().toLowerCase()).join('||');
      (groups[k]||(groups[k]=[])).push(r);
    });
    const out=[];
    Object.values(groups).forEach(arr=>{
      let best=arr[0];
      arr.forEach(r=>{const c=cmpRev(r.revision,best.revision);if(c>0||(c===0&&String(r.issueDate||'')>String(best.issueDate||'')))best=r;});
      const same=arr.filter(r=>cmpRev(r.revision,best.revision)===0);
      out.push(same.find(r=>String(r.status||'').toLowerCase()!=='superseded')||same[0]||best);
    });
    return out.sort((a,b)=>String(a.drawingNo||'').localeCompare(String(b.drawingNo||''),undefined,{numeric:true,sensitivity:'base'}));
  }
  function inferCategory(r,m){
    if(m.mainCategory)return m.mainCategory;
    const d=String(r.discipline||'').toLowerCase();
    if(d.includes('struct'))return'Structural';
    if(['mep','electrical','plumbing','hvac','fire fighting','fire alarm','elv','ict','bms','lift'].some(x=>d.includes(x)))return'MEP';
    return'Architecture / Finishes';
  }
  function downloadRegister(){
    const rows=currentRows();
    if(!rows.length){alert('No current drawings are available for this project.');return;}
    const headers=['Project','Category','Sub-Discipline','Drawing No.','Title','Revision','Status','Drawing Type','Tower / Block','Floor / Area','Issue Date','Required at Site','Response Date','Priority','Impact','Consultant','Remarks','PDF Link','DWG Link','DXF Link'];
    const body=rows.map(r=>{const p=parseMeta(r),m=p.meta||{};return[
      r.project||'',inferCategory(r,m),m.subDiscipline||'',r.drawingNo||'',r.title||'',r.revision||'',r.status||'',m.drawingType||'',r.tower||'',r.floor||'',r.issueDate||'',m.requiredAtSite||'',m.responseDate||'',m.priority||'Normal',m.impact||'None',r.consultant||'',p.remarks||'',r.pdfLink||'',r.dwgLink||'',r.dxfLink||''
    ];});
    const csv='\uFEFF'+[headers].concat(body).map(row=>row.map(escCsv).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    const project=(activeProject()||'All Projects').replace(/[^a-z0-9_-]+/gi,'_');
    a.href=url;a.download=project+'_Current_Drawing_Register.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function hideAllPanels(){
    ['designDashboardPanel','designDrawingsViewHead','designIssuesPanel','designChangesPanel','designLookAheadPanel'].forEach(id=>{const e=$(id);if(e)e.style.display='none';});
    const f=document.querySelector('#drawingsPage .drawings-filters'),i=document.querySelector('#drawingsPage .drawings-info'),c=$('drawingsContainer');
    if(f)f.style.display='none';if(i)i.style.display='none';if(c)c.style.display='none';
  }
  function enforceTab(btn){
    if(!btn)return;
    const label=String(btn.textContent||'').trim();
    document.querySelectorAll('#designManagementTabs .design-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    if(label==='Dashboard'){
      const d=$('designDashboardPanel');if(d)d.style.display='block';
    }else if(label==='Drawings'){
      const h=$('designDrawingsViewHead'),f=document.querySelector('#drawingsPage .drawings-filters'),i=document.querySelector('#drawingsPage .drawings-info'),c=$('drawingsContainer');
      if(h)h.style.display='flex';if(f)f.style.display='';if(i)i.style.display='';if(c)c.style.display='';
    }else if(label==='Design Issues'){
      const e=$('designIssuesPanel');if(e)e.style.display='block';
    }else if(label==='Design Changes'){
      const e=$('designChangesPanel');if(e)e.style.display='block';
    }else if(label==='Look-Ahead'){
      const e=$('designLookAheadPanel');if(e)e.style.display='block';
    }
  }
  function installExclusiveTabs(){
    const tabs=$('designManagementTabs');if(!tabs||tabs.dataset.exclusiveTabs==='1')return false;
    tabs.dataset.exclusiveTabs='1';
    tabs.addEventListener('click',e=>{
      const btn=e.target.closest('.design-tab');if(!btn||btn.disabled)return;
      setTimeout(()=>{hideAllPanels();enforceTab(btn);},0);
      setTimeout(()=>{hideAllPanels();enforceTab(btn);},80);
    },true);
    return true;
  }
  function installExport(){
    const dash=$('designDashboardPanel');if(!dash||$('downloadDrawingRegisterBtn'))return false;
    const bar=document.createElement('div');bar.className='design-dashboard-actions';
    bar.innerHTML='<div><b>Current Drawing Register</b><span>Latest active revision only for the selected project.</span></div><button id="downloadDrawingRegisterBtn" type="button">↓ Download Register</button>';
    dash.insertBefore(bar,dash.firstChild);
    $('downloadDrawingRegisterBtn').onclick=downloadRegister;
    return true;
  }
  function compactToolbar(){
    const toolbar=document.querySelector('#drawingsPage .admin-toolbar');if(!toolbar)return false;
    toolbar.classList.add('design-compact-toolbar');
    const bulk=$('bulkDrawingsButton');if(bulk)bulk.textContent='↑ Bulk Upload';
    const add=toolbar.querySelector('.admin-primary-btn:not(#bulkDrawingsButton)');if(add&&/add drawing/i.test(add.textContent||''))add.textContent='+ Add Drawing';
    return true;
  }
  function boot(){
    installExclusiveTabs();installExport();compactToolbar();
    if(!$('designManagementTabs')||!$('designDashboardPanel'))setTimeout(boot,250);
  }
  window.addEventListener('load',()=>setTimeout(boot,1100));
})();