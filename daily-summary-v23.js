/* PMC V23: read-only authorized daily summary; local staging only. */
(() => {
'use strict';
if(!['127.0.0.1','localhost'].includes(location.hostname))return;
const panel=document.getElementById('pmc-tenant-bridge');
const button=document.getElementById('pmc-bridge-check');
const selector=document.getElementById('pmc-bridge-project');
if(!panel||!button||!selector)return;
const target=panel.querySelector('.pmc-bridge-inner');
const section=document.createElement('section');section.id='pmc-v23-daily-summary';
const title=document.createElement('h3');title.textContent='Daily Summary — Read-only Staging';
const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Verify an assigned project to load its daily summary.';
const table=document.createElement('table');table.className='pmc-v23-daily-table';
section.append(title,status,table);target.append(section);
button.addEventListener('click',async()=>{
 const id=selector.value;table.replaceChildren();if(!id)return;
 status.textContent='Loading authorized daily totals…';
 try{
  const response=await fetch('/api/reporting-v23/projects/'+encodeURIComponent(id)+'/daily-summary',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('Daily Summary API returned '+response.status);
  const data=await response.json();
  if(data.read_only!==true||!data.project||data.project.id!==id||!Array.isArray(data.days))throw new Error('Invalid summary response');
  status.textContent=data.days.length?data.total+' reports across '+data.days.length+' day(s).':'No staged daily totals found.';
  if(!data.days.length)return;
  const headers=['Date','Reports','Work status','Tower','Contractor'];
  const columns=['date','total','statuses','towers','contractors'];
  const thead=document.createElement('thead'),tr=document.createElement('tr');
  headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th)});thead.append(tr);table.append(thead);
  const tbody=document.createElement('tbody');
  for(const day of data.days){
   const row=document.createElement('tr');
   for(const key of columns){
    const td=document.createElement('td');
    const val=day[key];td.textContent=typeof val==='object' && val!==null?Object.entries(val).map(([label,count])=>label+': '+count).join('; '):String(val??'');
    row.append(td);
   }tbody.append(row);
  }table.append(tbody);
 }catch(e){status.textContent=e.message}
});
})();