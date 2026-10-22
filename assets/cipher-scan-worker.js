// A disposable owner for Tesseract and its child worker. Terminating this owner
// also stops initialization, including failed/pending language-file downloads.
self.onmessage=async ({data:image})=>{
  try {
    importScripts('./vendor/tesseract/tesseract.min.js');
    const base=new URL('./vendor/tesseract/',self.location.href).href;
    const reader=await Tesseract.createWorker('eng',1,{
      workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:false,
      workerBlobURL:false,cacheMethod:'none',
      logger:event=>self.postMessage({type:'progress',status:event.status,progress:event.progress}),
      // v6 can leave createWorker pending after a language initialization error.
      // Notify the owner immediately so it can terminate the entire worker tree.
      errorHandler:()=>self.postMessage({type:'error'})
    },{load_system_dawg:'0',load_freq_dawg:'0',load_number_dawg:'0'});
    await reader.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
    const {data}=await reader.recognize(image);
    self.postMessage({type:'result',text:data.text||'',confidence:data.confidence});
  } catch {
    self.postMessage({type:'error'});
  }
};
