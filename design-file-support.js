/* Design Management - generic drawing file support (PDF/DWG/DXF) */
(function(){
  "use strict";
  function fileType(name){const m=String(name||"").match(/\.([^.]+)$/);return m?m[1].toUpperCase():"FILE";}
  function mimeFor(file){const t=fileType(file&&file.name);if(file&&file.type)return file.type;if(t==="PDF")return "application/pdf";if(t==="DWG")return "application/acad";if(t==="DXF")return "application/dxf";return "application/octet-stream";}
  function valid(file){return !!file&&/\.(pdf|dwg|dxf)$/i.test(file.name||"");}
  function genericFileToBase64(file){return new Promise((resolve,reject)=>{if(!file){resolve(null);return;}if(!valid(file)){reject(new Error("Please select a PDF, DWG or DXF drawing file."));return;}const reader=new FileReader();reader.onload=e=>resolve({base64:String(e.target.result).split(",")[1],mimeType:mimeFor(file),name:file.name||"drawing-file"});reader.onerror=()=>reject(new Error("Unable to read the selected drawing file."));reader.readAsDataURL(file);});}
  function patchSingleForm(){const input=document.getElementById("drawingPdf");if(!input)return;input.accept=".pdf,.dwg,.dxf,application/pdf";const wrap=input.parentElement;if(wrap){const label=wrap.querySelector("label");if(label)label.childNodes[0].nodeValue="Drawing File ";}const note=document.getElementById("drawingPdfNote");if(note)note.innerText="Select a PDF, DWG or DXF file. It will upload to Google Drive when you save.";}
  window.addEventListener("load",function(){try{window.pdfFileToBase64=genericFileToBase64;}catch(e){console.warn("Drawing file converter override warning",e);}setTimeout(patchSingleForm,200);});
  const obs=new MutationObserver(()=>patchSingleForm());window.addEventListener("load",()=>obs.observe(document.body,{childList:true,subtree:true}));
})();