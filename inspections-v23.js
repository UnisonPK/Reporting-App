(()=>{'use strict';
if(!['localhost','127.0.0.1'].includes(location.hostname))return;
const panel=document.getElementById('pmc-tenant-bridge'),btn=document.getElementById('pmc-bridge-check'),sel=document.getElementById('pmc-bridge-project');
if(!panel||!btn||!sel)return;
const box=document.createElement('section');box.id='pmc-v23-inspections';
const h=document.createElement('h3');h.textContent='Pending Inspections — Read-only Staging';
const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Verify an assigned project to view inspection statuses.';
const cards=document.createElement('div');cards.className='pmc-inspections-grid';const table=document.createElement('table');
box.append(h,status,cards,table);panel.querySelector('.pmc-bridge-inner').append(box);
btn.addEventListener('click',async()=>{
const id=sel.value;if(!id)return;cards.replaceChildren();table.replaceChildren();status.textContent='Loading inspections…';
try{
const r=await fetch('/api/reporting-v23/projects/'+encodeURIComponent(id)+'/inspections',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
if(!r.ok)throw new Error('Inspection API returned '+r.status);
const d=await r.json();if(d.read_only!==true||d.project?.id!==id||!Array.isArray(d.records)||!d.counts)throw new Error('Unexpected inspection response');
status.textContent=d.records.length+' inspection records from staged reports.';
for(const [key,label] of [['requested','Requested'],['approved','Approved'],['required_not_requested','Required but not requested'],['not_required','Not required']]){const el=document.createElement('div');el.textContent=label+': '+String(d.counts[key]??0);cards.append(el)}
const cols=[['activity','Activity'],['tower','Tower'],['floor','Floor'],['inspection_required','Required'],['inspection_status','Inspection status'],['inspection_date','Inspection date'],['inspection_remarks','Remarks']];
if(!d.records.length)return;const head=document.createElement('thead'),row=document.createElement('tr');
for(const [,label] of cols){const cell=document.createElement('th');cell.textContent=label;row.append(cell)}head.append(row);table.append(head);
const body=document.createElement('tbody');
for(const rec of d.records){const tr=document.createElement('tr');for(const [key] of cols){const cell=document.createElement('td');cell.textContent=String(rec[key]??'');tr.append(cell)}body.append(tr)}table.append(body)
}catch(e){status.textContent=e.message}
});
})();