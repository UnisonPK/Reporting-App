/* PMC V23 staging-only tenant integration.
   Read-only session/project bridge. Operational APIs remain disabled. */
(() => {
  'use strict';
  if (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') return;
  const root = document.createElement('section');
  root.id='pmc-tenant-bridge';
  root.setAttribute('aria-label','Tenant project access');
  root.innerHTML='<div class="pmc-bridge-inner"><h2>PMC Tenant Project Access — Staging</h2><p id="pmc-bridge-status" role="status">Verifying tenant session…</p><label for="pmc-bridge-project">Assigned project</label><select id="pmc-bridge-project" disabled><option>Checking assignments…</option></select><div class="pmc-bridge-actions"><button type="button" id="pmc-bridge-check" disabled>Verify project selection</button><a href="/tenant">Tenant sign in</a></div><p id="pmc-bridge-result" role="status"></p><small>Read-only staging preview. Project verification does not authorize Reporting App modules or Google Apps Script access.</small></div>';
  document.body.prepend(root);
  const $ = id => document.getElementById(id);
  let projects=[];
  async function get(path){
    const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error(r.status===401?'Not signed in. Open Tenant sign in.':'Tenant API unavailable ('+r.status+').');
    return r.json();
  }
  async function reload(){
    $('pmc-bridge-check').disabled=true;
    $('pmc-bridge-project').disabled=true;
    try{
      const [me,rows]=await Promise.all([get('/api/tenant/me'),get('/api/tenant/projects')]);
      if(!Array.isArray(rows))throw new Error('Unexpected assigned-project response.');
      projects=rows.filter(p=>p && typeof p.id==='string' && p.id.length<256);
      $('pmc-bridge-status').textContent='Signed in: '+String(me.name||me.email||'Tenant');
      $('pmc-bridge-project').replaceChildren(new Option('Select an assigned project',''));
      for(const p of projects){
        $('pmc-bridge-project').add(new Option([p.name,p.code,p.permission].filter(Boolean).join(' — '),p.id));
      }
      $('pmc-bridge-project').disabled=projects.length===0;
      $('pmc-bridge-check').disabled=projects.length===0;
      if(!projects.length)$('pmc-bridge-result').textContent='No assigned projects.';
    }catch(e){
      $('pmc-bridge-status').textContent=e.message;
      $('pmc-bridge-project').replaceChildren(new Option('Sign in to view projects',''));
      $('pmc-bridge-result').textContent='';
    }
  }
  $('pmc-bridge-check').addEventListener('click',async()=>{
    const id=$('pmc-bridge-project').value;
    $('pmc-bridge-result').textContent='';
    if(!id)return;
    try{
      const data=await get('/api/reporting-v23/projects/'+encodeURIComponent(id)+'/context');
      if(!data || data.read_only!==true || !data.project || data.project.id!==id){
        throw new Error('Unexpected authorized project response.');
      }
      $('pmc-bridge-result').textContent='Authenticated project context: '+[data.project.name,data.project.code,data.project.permission].filter(Boolean).join(' — ')+'. Operational reports remain disabled.';
    }catch(e){$('pmc-bridge-result').textContent=e.message; await reload();}
  });
  reload();
})();