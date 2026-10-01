export function createLoginPage(spriteData){
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
.scene{height:118px;position:relative;margin:-5px auto 12px;overflow:hidden;border-bottom:5px solid #786b49;border-radius:10px;background:linear-gradient(#334d63,#253a4a 67%,#314534 68%)}
.scene canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;z-index:2}
.hill{position:absolute;bottom:0;width:160px;height:44px;border-radius:50% 50% 0 0;background:#546b43;z-index:1}.hill.left{left:-25px}.hill.right{right:-17px;height:32px;background:#68794c}
.door{position:absolute;right:42px;bottom:4px;width:26px;height:47px;border:3px solid #d7c18d;border-bottom:0;border-radius:13px 13px 0 0;background:#283341;z-index:1}.door:after{content:"";position:absolute;right:4px;bottom:5px;width:4px;height:4px;border-radius:50%;background:var(--gold)}
.spark{position:absolute;z-index:4;left:40%;top:19px;color:#fff0a2;font-size:20px;animation:twinkle 1.8s infinite}.spark.s2{left:67%;top:37px;animation-delay:.7s}
@keyframes twinkle{50%{opacity:.25;transform:scale(.75)}}
h1{font-size:1.85rem;letter-spacing:-.04em;margin:5px 0 8px}p{color:var(--muted);margin:0 0 24px;line-height:1.5}
label{display:block;text-align:left;font-weight:650;font-size:.9rem;margin:0 0 8px}input{width:100%;min-height:48px;padding:14px 15px;border:1px solid #8295a455;border-radius:12px;background:#0d1723;color:white;font:inherit;outline:none}input:focus{border-color:var(--mint);box-shadow:0 0 0 3px #b8f2c722}
button{width:100%;min-height:48px;margin-top:14px;padding:14px;border:0;border-radius:12px;background:linear-gradient(135deg,#d0f6c9,#90e3b7);color:#153026;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 7px 22px #68c99b30}button:hover{filter:brightness(1.06);transform:translateY(-1px)}button:disabled{opacity:.65;cursor:wait;transform:none}
.error{min-height:24px;margin:10px 0 0;color:#ffaaa4;font-size:.92rem}.foot{margin-top:21px;color:#8192a1;font-size:.78rem}
@media(max-width:480px){.card{padding:28px 22px}}
@media(prefers-reduced-motion:reduce){.spark{animation:none}}
</style>
</head>
<body>
<main class="card">
  <div class="scene" aria-hidden="true">
    <canvas id="lemmingScene"></canvas>
    <div class="hill left"></div><div class="hill right"></div><div class="door"></div>
    <span class="spark">✦</span><span class="spark s2">✦</span>
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
const sheet=new Image();sheet.src='data:image/png;base64,SPRITE_DATA';
const canvas=document.querySelector('#lemmingScene'),ctx=canvas.getContext('2d');
const walk=[[14,1,16,9,-8,-9],[30,0,16,10,-8,-10],[46,1,16,9,-8,-9],[62,1,16,9,-8,-9],[78,1,16,9,-8,-9],[94,0,16,10,-8,-10],[110,1,16,9,-8,-9],[126,1,16,9,-8,-9]];
const exit=[[16,185,16,10,-8,-10],[32,183,16,11,-8,-12],[48,182,16,10,-8,-13],[64,182,16,8,-8,-13],[80,182,16,6,-8,-13],[96,182,16,5,-8,-13],[112,183,16,4,-8,-12],[128,185,16,2,-8,-10]];
const lemmings=[{x:-24,speed:25,phase:0},{x:-106,speed:21,phase:2},{x:-190,speed:23,phase:4}];
let width=0,height=0,ratio=1,last=0,raf=0,seeded=false;
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);if(rect.width===width&&rect.height===height&&dpr===ratio)return;width=rect.width;height=rect.height;ratio=dpr;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.imageSmoothingEnabled=false;}
function draw(now){resize();if(!seeded){lemmings.forEach((l,i)=>l.x=width*(.16+i*.18));seeded=true;}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const floor=height-7,doorX=width-55,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const [i,lemming] of lemmings.entries()){let frames=walk,index=reduced?0:Math.floor(now/105+lemming.phase)%walk.length;
    if(reduced)lemming.x=width*(.23+i*.2);
    else
    if(lemming.exitAt!==undefined){index=Math.floor((now-lemming.exitAt)/68);frames=exit;if(index>=exit.length){lemming.x=-36;delete lemming.exitAt;index=0;}}
    else{lemming.x+=lemming.speed*Math.min(.05,(now-last)/1000||0);if(lemming.x>=doorX){lemming.x=doorX;lemming.exitAt=now;frames=exit;index=0;}}
    const f=frames[Math.max(0,Math.min(frames.length-1,index))];ctx.drawImage(sheet,f[0],f[1],f[2],f[3],Math.round(lemming.x+f[4]*3),Math.round(floor+f[5]*3),f[2]*3,f[3]*3);
  }
  last=now;if(!reduced)raf=requestAnimationFrame(draw);
}
sheet.addEventListener('load',()=>{cancelAnimationFrame(raf);last=performance.now();draw(last);});
new ResizeObserver(resize).observe(canvas);
const form=document.querySelector('#login'),button=document.querySelector('#submit'),error=document.querySelector('#error');
form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';button.disabled=true;button.textContent='Even controleren…';try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:form.username.value,password:form.password.value})});if(!response.ok)throw new Error(response.status===429?'Te veel pogingen. Probeer over 15 minuten opnieuw.':'Gebruikersnaam of wachtwoord klopt niet.');const next=new URLSearchParams(location.search).get('next')||'/';const target=new URL(next,location.origin);location.replace(target.origin===location.origin?target.href:'/')}catch(e){error.textContent=e.message||'Inloggen is niet gelukt.';button.disabled=false;button.textContent='Naar het level';form.password.select()}});
</script>
</body>
</html>`.replace('SPRITE_DATA',spriteData);
}
