/* Design Management - generic drawing file support (PDF/DWG/DXF) */
(function(){
  "use strict";

  function fileType(name){
    const m=String(name||"").match(/\.([^.]+)$/);
    return m?m[1].toUpperCase():"FILE";
  }

  function mimeFor(file){
    const t=fileType(file&&file.name);
    if(file&&file.type)return file.type;
    if(t==="PDF")return "application/pdf";
    if(t==="DWG")return "application/acad";
    if(t==="DXF")return "application/dxf";
    return "application/octet-stream";
  }

  function valid(file){
    return !!file&&/\.(pdf|dwg|dxf)$/i.test(file.name||"");
  }

  function genericFileToBase64(file){
    return new Promise((resolve,reject)=>{
      if(!file){resolve(null);return;}
      if(!valid(file)){
        reject(new Error("Please select a PDF, DWG or DXF drawing file."));
        return;
      }
      const reader=new FileReader();
      reader.onload=e=>resolve({
        base64:String(e.target.result).split(",")[1],
        mimeType:mimeFor(file),
        name:file.name||"drawing-file"
      });
      reader.onerror=()=>reject(new Error("Unable to read the selected drawing file."));
      reader.readAsDataURL(file);
    });
  }

  function patchSingleForm(){
    const input=document.getElementById("drawingPdf");
    if(!input)return false;

    const wantedAccept=".pdf,.dwg,.dxf,application/pdf";
    if(input.getAttribute("accept")!==wantedAccept){
      input.setAttribute("accept",wantedAccept);
    }

    const wrap=input.parentElement;
    if(wrap){
      const label=wrap.querySelector("label");
      if(label&&label.childNodes.length){
        const first=label.childNodes[0];
        if(first&&first.nodeType===Node.TEXT_NODE&&first.nodeValue!=="Drawing File "){
          first.nodeValue="Drawing File ";
        }
      }
    }

    const note=document.getElementById("drawingPdfNote");
    const wantedNote="Select a PDF, DWG or DXF file. It will upload to Google Drive when you save.";
    if(note&&note.textContent!==wantedNote){
      note.textContent=wantedNote;
    }
    return true;
  }

  window.addEventListener("load",function(){
    try{
      window.pdfFileToBase64=genericFileToBase64;
    }catch(e){
      console.warn("Drawing file converter override warning",e);
    }

    /* The drawing form already exists in the large index.html baseline.
       Patch it once after startup. Do not observe the whole document: the
       previous observer repeatedly rewrote text and could create a mutation
       loop that made login inputs appear frozen. */
    setTimeout(patchSingleForm,200);
    setTimeout(patchSingleForm,1000);
  });
})();
