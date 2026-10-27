/* PMC V23 local-only Site Operations dashboard; uses existing read-only API views. */
(()=>{'use strict';
if(!['localhost','127.0.0.1'].includes(location.hostname))return;
const parent=document.querySelector('#pmc-tenant-bridge .pmc-bridge-inner');
const confirm=document.getElementById('pmc-bridge-check');
if(!parent||!confirm)return;
const tabs=[
{key:'activities',id:'pmc-v23-activities',label:'Activities / My Reports'},
{key:'summary',id:'pmc-v23-daily-summary',label:'Daily Summary'},
{key:'inspections',id:'pmc-v23-inspections',label:'Pending Inspections'}
];
const shell=document.createElement('section');shell.id='pmc-v23-site-ops';
const heading=document.createElement('h2');heading.textContent='Site Operations — Staging Dashboard';
const note=document.createElement('p');note.textContent='Project-scoped, read-only snapshot. No live Apps Script access.';
const nav=document.createElement('nav');nav.setAttribute('aria-label','Site Operations modules');
const tools=document.createElement('div');tools.className='pmc-site-ops-tools';
const search=document.createElement('input');search.type='search';search.placeholder='Search activity rows';search.setAttribute('aria-label','Filter activities');
const count=document.createElement('span');count.setAttribute('role','status');tools.append(search,count);
shell.append(heading,note,nav,tools);
const marker=document.getElementById('pmc-v23-activities');
if(marker)parent.insertBefore(shell,marker);else parent.append(shell);
function activate(key){
 tabs.forEach(t=>{const section=document.getElementById(t.id);if(section)section.hidden=t.key!==key;const b=document.getElementById('pmc-tab-'+t.key);if(b){b.setAttribute('aria-pressed',String(t.key===key));}});
 tools.hidden=key!=='activities';if(key==='activities')filterRows();
}
tabs.forEach(t=>{
 const b=document.createElement('button');b.id='pmc-tab-'+t.key;b.type='button';b.textContent=t.label;b.addEventListener('click',()=>activate(t.key));nav.append(b);
});
function filterRows(){
 const table=document.querySelector('#pmc-v23-activities table');
 if(!table){count.textContent='';return;}
 const rows=[...table.querySelectorAll('tbody tr')];let shown=0;
 const q=search.value.trim().toLowerCase();
 for(const row of rows){const visible=!q||row.textContent.toLowerCase().includes(q);row.hidden=!visible;if(visible)shown++;}
 count.textContent=rows.length?shown+' of '+rows.length+' reports':'';
}
search.addEventListener('input',filterRows);
confirm.addEventListener('click',()=>{search.value='';activate('activities')});
const activities=document.getElementById('pmc-v23-activities');
if(activities)new MutationObserver(filterRows).observe(activities,{childList:true,subtree:true});
activate('activities');
})();