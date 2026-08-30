/* Design Management modal polish helper V2 */
(function(){
  "use strict";

  function enhanceDrawingModal(){
    var modal=document.getElementById("drawingModal");
    if(!modal)return;
    var actions=modal.querySelector(".decision-actions");
    if(actions&&!actions.querySelector(".design-modal-cancel")){
      var cancel=document.createElement("button");
      cancel.type="button";
      cancel.className="design-modal-cancel";
      cancel.textContent="Cancel";
      cancel.onclick=function(){
        if(typeof window.closeDrawingModal==="function")window.closeDrawingModal();
        else modal.style.display="none";
      };
      actions.insertBefore(cancel,actions.firstChild);
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",enhanceDrawingModal);
  }else{
    enhanceDrawingModal();
  }
  window.addEventListener("load",enhanceDrawingModal);
})();
