// Browser-only OCR. Vendor scripts, WASM and language data are served by this site.
(() => {
  let canvas=null, previewURL='', worker=null, generation=0, timer=null, busy=false, rawDirty=false;
  const fields=['system','direction','count','shift','phrase','interval','key1','key2','text'];
  const status=text=>{$('scan-status').textContent=text;};
  const resetApproval=()=>{$('scan-confirm').checked=false;$('scan-apply').disabled=true;$('scan-review-error').textContent='';};
  function setBusy(value){busy=value;$('scan-read').disabled=$('scan-rotate').disabled=value;$('scan-progress').hidden=$('scan-cancel').hidden=!value;}
  function stop(text){generation++;clearTimeout(timer);if(worker)worker.terminate();worker=null;setBusy(false);status(text);}
  function clearImage(){stop('');canvas=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL='';$('scan-preview').removeAttribute('src');$('scan-image-panel').hidden=$('scan-review').hidden=true;$('scan-file').value='';$('scan-raw').value='';resetApproval();}
  function visibleFields(){const id=$('scan-system').value;for(const [field,show]of Object.entries({count:['dsacs','rsacs'].includes(id),shift:id==='dsacs',phrase:['keyword','decimation','numerical','playfair'].includes(id),interval:id==='decimation',key1:['single','double'].includes(id),key2:id==='double'}))$('scan-'+field+'-field').hidden=!show;resetApproval();}
  function identify(){rawDirty=false;const result=parseCipherScan($('scan-raw').value);for(const field of fields)$('scan-'+field).value=result[field];$('scan-warnings').textContent=result.warnings.join(' ')||'Suggested details found. Compare them with the image before continuing.';visibleFields();$('scan-review').hidden=false;}
  function scan(){
    if(!canvas||busy)return;
    const id=++generation;$('scan-review').hidden=true;resetApproval();setBusy(true);$('scan-progress').value=0;status('Loading the on-device reader…');
    timer=setTimeout(()=>stop('Reading timed out. Try a smaller, clearer image or enter the details manually.'),90000);
    try{
      worker=new Worker(new URL('../assets/cipher-scan-worker.js',location.href));
      const failed=()=>{if(id===generation)stop('Could not read this image. Check your connection and try again, or enter the details manually.');};
      worker.onerror=event=>{event.preventDefault();failed();};
      worker.onmessage=({data})=>{
        if(id!==generation)return;
        if(data.type==='error'){failed();return;}
        if(data.type==='progress'){if(typeof data.progress==='number')$('scan-progress').value=data.progress;status(data.status==='recognizing text'?`Reading image… ${Math.round((data.progress||0)*100)}%`:'Preparing the on-device reader…');return;}
        if(data.type!=='result')return;
        stop('');$('scan-raw').value=data.text.slice(0,12000);identify();
        if(!data.text.trim())status('No readable text found. Try a clearer, upright photo, or type the details into the review form.');
        else if(data.text.length>12000)status('Only the first 12,000 characters were kept. Crop the image to one exercise and scan again.');
        else status(data.confidence<75?'Text read, but OCR confidence is low. Check every character against the image.':'Image read. Review the suggested details below.');
      };
      worker.postMessage(canvas.toDataURL('image/png'));
    }catch{if(id===generation)stop('Could not start the image reader. Try a current browser, or enter the details manually.');}
  }
  async function receive(file){
    clearImage();$('scan-panel').open=true;
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Choose a PNG, JPG or WebP image. Convert HEIC or PDF to a screenshot first.');return;}
    if(file.size>10*1024*1024){status('This image is larger than 10 MB. Please resize it first.');return;}
    const id=generation;const url=URL.createObjectURL(file);previewURL=url;
    try{const photo=new Image();photo.src=url;await photo.decode();if(id!==generation)return;
      if(!photo.naturalWidth||photo.naturalWidth*photo.naturalHeight>32000000)throw new Error('dimensions');
      const scale=Math.min(2,2200/Math.max(photo.naturalWidth,photo.naturalHeight));
      canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(photo,0,0,canvas.width,canvas.height);
      $('scan-preview').src=url;$('scan-image-panel').hidden=false;await scan();
    }catch{if(id===generation){clearImage();status('Image could not be opened or is over 32 megapixels. Export a smaller PNG/JPG and try again.');}}
  }
  SYSTEMS.forEach(spec=>{const option=element('option',spec.name);option.value=spec.id;$('scan-system').append(option);});
  $('scan-file').addEventListener('change',event=>receive(event.target.files[0]));
  for(const type of ['dragenter','dragover'])$('scan-drop').addEventListener(type,event=>{event.preventDefault();$('scan-drop').classList.add('dragging');});
  $('scan-drop').addEventListener('dragleave',()=>$('scan-drop').classList.remove('dragging'));
  $('scan-drop').addEventListener('drop',event=>{event.preventDefault();$('scan-drop').classList.remove('dragging');receive(event.dataTransfer.files[0]);});
  document.addEventListener('paste',event=>{if(!$('scan-panel').open)return;const image=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'));if(image){event.preventDefault();receive(image.getAsFile());}});
  $('scan-read').addEventListener('click',scan);$('scan-cancel').addEventListener('click',()=>stop('Scan cancelled. Your existing desk answer has not changed.'));$('scan-remove').addEventListener('click',clearImage);
  $('scan-rotate').addEventListener('click',()=>{if(!canvas||busy)return;const rotated=document.createElement('canvas');rotated.width=canvas.height;rotated.height=canvas.width;const ctx=rotated.getContext('2d');ctx.translate(rotated.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(canvas,0,0);canvas=rotated;$('scan-preview').src=canvas.toDataURL('image/png');$('scan-review').hidden=true;resetApproval();status('Rotated. Select Read image to scan again.');});
  $('scan-detect').addEventListener('click',identify);$('scan-system').addEventListener('change',visibleFields);
  $('scan-raw').addEventListener('input',()=>{rawDirty=true;resetApproval();$('scan-warnings').textContent='Extracted text changed. Select Identify again to refresh the review fields.';});
  $('scan-review-form').addEventListener('input',event=>{if(event.target.id!=='scan-confirm')resetApproval();});
  $('scan-confirm').addEventListener('change',()=>{$('scan-apply').disabled=rawDirty||!$('scan-confirm').checked;});
  $('scan-review-form').addEventListener('submit',event=>{
    event.preventDefault();if(rawDirty||!$('scan-confirm').checked)return;
    const values=Object.fromEntries(fields.map(field=>[field,$('scan-'+field).value.trim()]));
    try{
      if(!SYSTEMS.some(s=>s.id===values.system))throw new Error('Choose the cipher system.');
      if(!values.direction)throw new Error('Choose encipher or decipher.');
      if(values.system==='dsacs'&&!values.shift)throw new Error('Choose the stated shift direction.');
      const config={...values,padding:paddingForSystem(values.system),nullLetter:$('null-letter').value};solve(config);
      choose(values.system);for(const field of ['count','shift','phrase','interval','key1','key2'])$(field).value=values[field];
      $('message').value=values.text;document.querySelector(`input[name="direction"][value="${values.direction}"]`).checked=true;pairIndex=0;update();
      status('Reviewed details applied to Cipher Desk.');$('cipher-form').scrollIntoView({block:'start',behavior:'auto'});$('message').focus({preventScroll:true});
    }catch(error){$('scan-review-error').textContent=error.message;}
  });
  window.addEventListener('pagehide',()=>{stop('');if(previewURL)URL.revokeObjectURL(previewURL);});
})();
