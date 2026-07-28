/* Naic OJT — Image Crop Modal
   Uses Cropper.js (loaded from CDN) to let users zoom/drag/crop a square
   (1:1) profile picture before upload. Returns a Blob via callback.

   Usage:
     openImageCropper(file, { aspectRatio: 1, round: true, filename: 'avatar.png' })
       .then(blob => { ... upload blob ... })
       .catch(() => { user cancelled });
*/
(function(){
  function ensureAssets(){
    return new Promise(function(resolve){
      var haveJs = !!window.Cropper;
      var haveCss = !!document.querySelector('link[data-cropperjs]');
      if(!haveCss){
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css';
        link.setAttribute('data-cropperjs','1');
        document.head.appendChild(link);
      }
      if(haveJs){ resolve(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js';
      s.onload = function(){ resolve(); };
      document.head.appendChild(s);
    });
  }

  function readFileAsDataURL(file){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = function(){ reject(new Error('Could not read file')); };
      r.readAsDataURL(file);
    });
  }

  function injectStylesOnce(){
    if(document.getElementById('imgcrop-inline-css')) return;
    var css = ''+
      '.imgcrop-backdrop{position:fixed;inset:0;background:rgba(10,20,45,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}'+
      '.imgcrop-modal{background:#fff;border-radius:12px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;font-family:inherit}'+
      '.imgcrop-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #eef0f5;color:#0d2b6b;font-weight:700}'+
      '.imgcrop-body{padding:14px 18px}'+
      '.imgcrop-stage{background:#111;border-radius:8px;overflow:hidden;max-height:420px}'+
      '.imgcrop-stage img{display:block;max-width:100%}'+
      '.imgcrop-controls{display:flex;align-items:center;gap:10px;margin-top:12px;color:#33477a;font-size:13px}'+
      '.imgcrop-controls input[type=range]{flex:1}'+
      '.imgcrop-hint{color:#6a7797;font-size:12px;margin-top:6px}'+
      '.imgcrop-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #eef0f5;background:#f8fafc}'+
      '.imgcrop-btn{padding:8px 14px;border-radius:8px;border:1px solid #d4dbe8;background:#fff;color:#0d2b6b;font-weight:600;cursor:pointer}'+
      '.imgcrop-btn.primary{background:#0d2b6b;color:#fff;border-color:#0d2b6b}'+
      '.imgcrop-btn:disabled{opacity:.6;cursor:not-allowed}';
    var style = document.createElement('style');
    style.id = 'imgcrop-inline-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  window.openImageCropper = async function(file, opts){
    opts = opts || {};
    var aspect = opts.aspectRatio || 1;
    var filename = opts.filename || (file && file.name) || 'avatar.png';
    var mime = opts.mimeType || 'image/png';

    await ensureAssets();
    injectStylesOnce();
    var dataUrl = await readFileAsDataURL(file);

    return new Promise(function(resolve, reject){
      var backdrop = document.createElement('div');
      backdrop.className = 'imgcrop-backdrop';
      backdrop.innerHTML = ''+
        '<div class="imgcrop-modal" role="dialog" aria-modal="true" aria-label="Crop your photo">'+
          '<div class="imgcrop-head"><span>Adjust your photo</span>'+
            '<button type="button" class="imgcrop-btn" data-act="cancel" aria-label="Close">&times;</button>'+
          '</div>'+
          '<div class="imgcrop-body">'+
            '<div class="imgcrop-stage"><img alt="" /></div>'+
            '<div class="imgcrop-controls">'+
              '<span>Zoom</span>'+
              '<input type="range" min="0" max="1" step="0.01" value="0" data-role="zoom" />'+
              '<button type="button" class="imgcrop-btn" data-act="rotate">Rotate</button>'+
            '</div>'+
            '<div class="imgcrop-hint">Drag to reposition. Use the slider to zoom.</div>'+
          '</div>'+
          '<div class="imgcrop-foot">'+
            '<button type="button" class="imgcrop-btn" data-act="cancel">Cancel</button>'+
            '<button type="button" class="imgcrop-btn primary" data-act="save">Save Photo</button>'+
          '</div>'+
        '</div>';
      document.body.appendChild(backdrop);

      var imgEl = backdrop.querySelector('img');
      imgEl.src = dataUrl;

      var cropper = new window.Cropper(imgEl, {
        aspectRatio: aspect,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        cropBoxResizable: true,
        cropBoxMovable: true,
        background: false,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: false,
        responsive: true,
        guides: false,
        highlight: false,
        modal: true
      });

      var zoom = backdrop.querySelector('[data-role=zoom]');
      var zoomBase = null;
      cropper.ready = cropper.on ? cropper.on : null; // silence lint
      imgEl.addEventListener('ready', function(){
        var data = cropper.getImageData();
        zoomBase = Math.max(0.01, data.width / data.naturalWidth);
        zoom.value = 0;
      });
      zoom.addEventListener('input', function(){
        var v = parseFloat(zoom.value); // 0..1
        var factor = 1 + v * 2.5; // up to 3.5x
        if(zoomBase) cropper.zoomTo(zoomBase * factor);
      });

      function cleanup(){ try{ cropper.destroy(); }catch(e){} backdrop.remove(); }

      backdrop.addEventListener('click', function(e){
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if(!act) return;
        if(act === 'cancel'){ cleanup(); reject(new Error('cancelled')); return; }
        if(act === 'rotate'){ cropper.rotate(90); return; }
        if(act === 'save'){
          var canvas = cropper.getCroppedCanvas({
            width: opts.outputSize || 512,
            height: opts.outputSize || 512,
            imageSmoothingQuality: 'high'
          });
          if(!canvas){ cleanup(); reject(new Error('Could not render crop')); return; }
          canvas.toBlob(function(blob){
            cleanup();
            if(!blob){ reject(new Error('Could not encode image')); return; }
            // attach a name for downstream uploaders that read file.name
            try { blob.name = filename; } catch(e){}
            resolve(blob);
          }, mime, 0.92);
        }
      });
    });
  };
})();
