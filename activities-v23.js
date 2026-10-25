/* PMC V23 — authorized staging activity viewer, read-only. */
(() => {
'use strict';
if (!['localhost','127.0.0.1'].includes(location.hostname)) return;
const panel=document.getElementById('pmc-tenant-bridge');
const btn=document.getElementById('pmc-bridge-check');
const select=document.getElementById('pmc-bridge-project');
if(!panel||!btn||!select)return;
const section=document.createElement('section');section.id='pmc-v23-activities';
const h=document.createElement('h3');h.textContent='Activities & Daily Progress — Read-only Staging';
const msg=document.createElement('p');msg.setAttribute('role','status');msg.textContent='Verify a project above to view staged reports.';
const table=document.createElement('table');table.className='pmc-v23-report-table';
section.append(h,msg,table);panel.querySelector('.pmc-bridge-inner').append(section);
btn.addEventListener('click',async()=>{
const id=select.value;table.replaceChildren();if(!id)return;
msg.textContent='Loading authorized staging activities…';
try{
const r=await fetch('/api/reporting-v23/projects/'+encodeURIComponent(id)+'/activities',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
if(!r.ok)throw new Error('Activity API returned '+r.status);
const d=await r.json();
if(!d||d.read_only!==true||!d.project||d.project.id!==id||!Array.isArray(d.records))throw new Error('Unexpected report response');
msg.textContent=d.records.length?d.records.length+' staged activity reports.':'No staged reports available for this project.';
if(!d.records.length)return;
const keys=['report_date','activity','tower','floor','work_status','contractor','remarks'];
const head=document.createElement('thead'),hr=document.createElement('tr');
keys.forEach(k=>{const th=document.createElement('th');th.textContent=k.replaceAll('_',' ');hr.append(th)});head.append(hr);table.append(head);
const body=document.createElement('tbody');for(const record of d.records){const row=document.createElement('tr');for(const key of keys){const td=document.createElement('td');td.textContent=String(record[key]??'');row.append(td)}body.append(row)}table.append(body)
}catch(e){msg.textContent='Unable to load reports: '+e.message}
});
})();