export function createLoginPage(spriteData,levelData){
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#101927">
<title>Lemming Rescue · Inloggen</title>
<style>
:root{color-scheme:dark;--cream:#fff5d8;--muted:#b7c5d2;--mint:#b8f2c7;--gold:#ffd66b;--ink:#101927}
*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));background:radial-gradient(ellipse at 50% 0%,#29475a 0,#152638 42%,#101927 78%);font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:var(--cream)}
.card{width:min(100%,440px);padding:36px;border:1px solid #ffffff28;border-radius:24px;background:linear-gradient(160deg,#20354adf,#111c2bef);box-shadow:0 24px 80px #0008;text-align:center}
.scene{height:136px;position:relative;margin:-5px auto 12px;overflow:hidden;border:1px solid #677889;border-bottom:4px solid #786b49;border-radius:10px;background:#000033}
.level-preview,.scene canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none}
.level-preview{object-fit:cover}.scene canvas{z-index:1}
h1{font-size:1.85rem;letter-spacing:-.04em;margin:5px 0 8px}p{color:var(--muted);margin:0 0 24px;line-height:1.5}
label{display:block;text-align:left;font-weight:650;font-size:.9rem;margin:0 0 8px}input{width:100%;min-height:48px;padding:14px 15px;border:1px solid #8295a455;border-radius:12px;background:#0d1723;color:white;font:inherit;outline:none}input:focus{border-color:var(--mint);box-shadow:0 0 0 3px #b8f2c722}
button{width:100%;min-height:48px;margin-top:14px;padding:14px;border:0;border-radius:12px;background:linear-gradient(135deg,#d0f6c9,#90e3b7);color:#153026;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 7px 22px #68c99b30}button:hover{filter:brightness(1.06);transform:translateY(-1px)}button:disabled{opacity:.65;cursor:wait;transform:none}
.error{min-height:24px;margin:10px 0 0;color:#ffaaa4;font-size:.92rem}.foot{margin-top:21px;color:#8192a1;font-size:.78rem}
@media(max-width:480px){.card{padding:28px 22px}}
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
