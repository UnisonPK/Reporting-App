/* Programme Top Actions Layout V1
   Groups P6 Float Analysis, Import Schedule and Add Milestone into one compact toolbar.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);

  function ensureStyles(){
    if($("programmeTopActionsStyles"))return;
    const s=document.createElement("style");
    s.id="programmeTopActionsStyles";
    s.textContent=`
      #programmeTopActions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        margin-left:auto;
        flex-wrap:wrap;
      }
      #programmeTopActions > button{
        margin:0!important;
        white-space:nowrap;
      }
      @media(max-width:850px){
        #programmeTopActions{width:100%;justify-content:flex-start;margin-left:0;margin-top:10px}
      }
    `;
    document.head.appendChild(s);
  }

  function install(){
    const page=$("programmePage");
    if(!page)return false;

    const floatBtn=$("programmeFloatButton");
    const importBtn=$("programmeScheduleImportButton");
    const addBtn=[...page.querySelectorAll("button")].find(b=>/add milestone/i.test(b.textContent||""));
    if(!floatBtn||!importBtn||!addBtn)return false;

    ensureStyles();
    let group=$("programmeTopActions");
    if(!group){
      group=document.createElement("div");
      group.id="programmeTopActions";
      addBtn.parentElement.insertBefore(group,addBtn);
    }

    [floatBtn,importBtn,addBtn].forEach(b=>{
      if(b.parentElement!==group)group.appendChild(b);
    });
    return true;
  }

  function boot(){
    if(install())return;
    let n=0;
    const t=setInterval(()=>{
      n++;
      if(install()||n>60)clearInterval(t);
    },250);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
  window.addEventListener("load",boot,{once:true});
})();
