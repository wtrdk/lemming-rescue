export function createLoginPage(spriteData,levelData){
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#83c7e9">
<title>Lemming Rescue · Inloggen</title>
<style>
:root{color-scheme:light;--cream:#fff2cf;--ink:#26384b;--muted:#43586a;--green:#497b3f;--grass:#91bd5b;--gold:#ffd64c;--stone:#e8d4a6;--stone-dark:#9b7747}
*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));background-color:#83c7e9;background-image:radial-gradient(ellipse at 12% 12%,#e9f7ff 0 4%,transparent 4.6%),radial-gradient(ellipse at 19% 11%,#e9f7ff 0 5%,transparent 5.6%),radial-gradient(ellipse at 84% 7%,#e9f7ff 0 4%,transparent 4.6%),linear-gradient(#80c9ef 0 56%,#acd576 56% 63%,#719d50 63% 100%);font-family:'Courier New',ui-monospace,monospace;color:var(--ink)}
.card{position:relative;width:min(100%,560px);padding:clamp(22px,5vw,38px);border:8px solid var(--stone-dark);border-radius:3px;background:linear-gradient(145deg,#f8e8bf,#dfc38e);box-shadow:0 0 0 5px var(--green),0 12px 0 #315b37,0 28px 70px #173c4f88,inset 0 0 0 3px #fff2d1;text-align:center}
.card::before{content:"";position:absolute;left:8px;right:8px;top:-8px;height:6px;background:repeating-linear-gradient(90deg,#497b3f 0 9px,#91bd5b 9px 15px,#356a36 15px 18px);pointer-events:none}
.scene{aspect-ratio:2;width:100%;height:auto;max-height:240px;position:relative;margin:0 auto 22px;overflow:hidden;border:8px solid #a98550;border-bottom-width:10px;border-bottom-color:#537c3b;border-radius:2px;outline:2px solid #fff0c7;background:#000033;box-shadow:0 3px 0 #3d663d}
.level-preview,.scene canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none}
.level-preview{object-fit:cover}.scene canvas{z-index:1}.scene::after{content:"";position:absolute;z-index:2;left:0;right:0;bottom:0;height:7px;background:repeating-linear-gradient(90deg,#497b3f 0 8px,#91bd5b 8px 12px,#356a36 12px 16px);border-top:2px solid #acd576;pointer-events:none}
h1{font-size:clamp(1.55rem,6vw,2rem);letter-spacing:-.05em;color:#356a36;text-shadow:2px 2px #d0dda2;margin:5px 0 8px}p{color:var(--muted);margin:0 0 22px;line-height:1.5}
label{display:block;text-align:left;font-weight:700;font-size:.9rem;margin:0 0 8px;color:#344c37}input{width:100%;min-height:48px;padding:12px 14px;border:3px solid;border-color:#9c7949 #fff0c7 #fff0c7 #9c7949;border-radius:3px;background:#fff8e5;color:#24364b;font:inherit;outline:none;box-shadow:inset 0 2px 3px #6a523522}input:focus{border-color:#477b3e;box-shadow:0 0 0 3px #91bd5b88}
button{width:100%;min-height:50px;margin-top:14px;padding:12px 14px;border:3px solid;border-color:#eaffbd #42753c #42753c #eaffbd;border-radius:3px;background:linear-gradient(#c4ed83,#75bd4c);color:#173e27;font:inherit;font-weight:800;cursor:pointer;box-shadow:0 3px 0 #365b35;text-shadow:0 1px #ffffff88;transition:filter .12s ease,transform .12s ease}button:hover{filter:brightness(1.07);transform:translateY(-1px)}button:active{transform:translateY(2px);box-shadow:0 0 0 #365b35}button:disabled{opacity:.65;cursor:wait;transform:none}
.error{min-height:24px;margin:10px 0 0;color:#a62f29;font-size:.92rem}.foot{margin-top:21px;padding-top:13px;border-top:2px dotted #a98550;color:#476544;font-size:.8rem}
@media(max-width:480px){body{padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))}.card{padding:22px 18px;border-width:6px}.scene{margin-bottom:18px;border-width:6px}.scene{border-bottom-width:9px}}
@media(prefers-reduced-motion:reduce){button{transition:none}}
</style>
</head>
<body>
<main class="card">
  <div class="scene" aria-hidden="true">
    <img class="level-preview" src="data:image/png;base64,LEVEL_DATA" alt="" draggable="false">
    <canvas id="lemmingScene"></canvas>
  </div>
  <h1>Lemming Rescue</h1>
  <p>De uitgang is dichtbij. Log in om je lemmings weer veilig door het level te loodsen.</p>
  <form id="login">
    <label for="username">Gebruikersnaam</label>
    <input id="username" name="username" autocomplete="username" required autofocus style="margin-bottom:16px">
    <label for="password">Wachtwoord</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button id="submit" type="submit">Naar het level</button>
    <div class="error" id="error" role="alert" aria-live="polite"></div>
  </form>
  <div class="foot">Een klein beetje veiligheid voor een grote reddingsmissie</div>
</main>
<script>
const sheetSource=new Image();let sheet=null;
const canvas=document.querySelector('#lemmingScene'),ctx=canvas.getContext('2d');
const walk=[[14,1,16,9,-8,-9],[30,0,16,10,-8,-10],[46,1,16,9,-8,-9],[62,1,16,9,-8,-9],[78,1,16,9,-8,-9],[94,0,16,10,-8,-10],[110,1,16,9,-8,-9],[126,1,16,9,-8,-9]];
const exit=[[16,185,16,10,-8,-10],[32,183,16,11,-8,-12],[48,182,16,10,-8,-13],[64,182,16,8,-8,-13],[80,182,16,6,-8,-13],[96,182,16,5,-8,-13],[112,183,16,4,-8,-12],[128,185,16,2,-8,-10]];
const lemmings=[{x:0,speed:18,phase:0},{x:0,speed:16,phase:2},{x:0,speed:17,phase:4}];
let width=0,height=0,ratio=1,last=0,raf=0,seeded=false;
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);if(rect.width===width&&rect.height===height&&dpr===ratio)return;width=rect.width;height=rect.height;ratio=dpr;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.imageSmoothingEnabled=false;}
function draw(now){if(!sheet)return;resize();if(!seeded){lemmings.forEach((l,i)=>l.x=width*(.10+i*.065));seeded=true;}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const floor=height*.93,doorX=width*.60,scale=width/320,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const [i,lemming] of lemmings.entries()){let frames=walk,index=reduced?0:Math.floor(now/58.8+lemming.phase)%walk.length;
    if(reduced)lemming.x=width*(.23+i*.2);
    else
    if(lemming.exitAt!==undefined){index=Math.floor((now-lemming.exitAt)/58.8);frames=exit;if(index>=exit.length){lemming.x=-36;delete lemming.exitAt;index=0;}}
    else{lemming.x+=lemming.speed*Math.min(.05,(now-last)/1000||0);if(lemming.x>=doorX){lemming.x=doorX;lemming.exitAt=now;frames=exit;index=0;}}
    const f=frames[Math.max(0,Math.min(frames.length-1,index))];ctx.drawImage(sheet,f[0],f[1],f[2],f[3],Math.round(lemming.x+f[4]*scale),Math.round(floor+f[5]*scale),f[2]*scale,f[3]*scale);
  }
  last=now;if(!reduced)raf=requestAnimationFrame(draw);
}
sheetSource.addEventListener('load',()=>{const keyed=document.createElement('canvas');keyed.width=sheetSource.naturalWidth;keyed.height=sheetSource.naturalHeight;const keyctx=keyed.getContext('2d',{willReadFrequently:true});keyctx.drawImage(sheetSource,0,0);const pixels=keyctx.getImageData(0,0,keyed.width,keyed.height);for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===0&&pixels.data[i+1]===0&&pixels.data[i+2]===0)pixels.data[i+3]=0;keyctx.putImageData(pixels,0,0);sheet=keyed;last=performance.now();draw(last);});
sheetSource.src='data:image/png;base64,SPRITE_DATA';
new ResizeObserver(resize).observe(canvas);
const form=document.querySelector('#login'),button=document.querySelector('#submit'),error=document.querySelector('#error');
form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';button.disabled=true;button.textContent='Even controleren…';try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:form.username.value,password:form.password.value})});if(!response.ok)throw new Error(response.status===429?'Te veel pogingen. Probeer over 15 minuten opnieuw.':'Gebruikersnaam of wachtwoord klopt niet.');const next=new URLSearchParams(location.search).get('next')||'/';const target=new URL(next,location.origin);location.replace(target.origin===location.origin?target.href:'/')}catch(e){error.textContent=e.message||'Inloggen is niet gelukt.';button.disabled=false;button.textContent='Naar het level';form.password.select()}});
</script>
</body>
</html>`.replace('SPRITE_DATA',spriteData).replace('LEVEL_DATA',levelData);
}
