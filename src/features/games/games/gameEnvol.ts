// Jeu Envol — E10-09 (#300)
// Mécanique tap-to-fly (générique). Tap pour donner de l'élan, gravité,
// éviter les obstacles. Score = obstacles franchis. Collision = game over.
//
// Fix contrôles : on ne preventDefault QUE pendant le jeu (sinon le tap sur
// le bouton "Jouer" est avalé), et un seul listener d'input (pas de double-flap).

export const GAME_ENVOL_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,Roboto,sans-serif;overflow:hidden;}
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;}
  #hud{width:100%;max-width:440px;text-align:center;font-size:15px;font-weight:800;}
  #hud span{color:#FFFFFF;}
  #board{position:relative;width:94vw;max-width:440px;aspect-ratio:.66;background:#0b1622;border-radius:12px;touch-action:none;overflow:hidden;}
  canvas{width:100%;height:100%;display:block;}
  #ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,.55);z-index:2;}
  #ov.hide{display:none;}
  .btn{background:#FFFFFF;color:#000;font-weight:800;border:none;border-radius:999px;padding:14px 28px;font-size:16px;}
  #ov p{margin:0;font-size:14px;color:#cfe;}
</style></head><body>
<div id="wrap">
  <div id="hud">Score <span id="s">0</span></div>
  <div id="board"><canvas id="c"></canvas>
    <div id="ov"><h2 id="t" style="margin:0;">Envol</h2><p id="msg">Tape l'écran pour voler</p><button class="btn" id="go">Jouer</button></div>
  </div>
</div>
<script>(function(){
  var cv=document.getElementById('c'),ctx=cv.getContext('2d'),board=document.getElementById('board'),ov=document.getElementById('ov');
  var W,H,bird,pipes,score,best=0,running,gap,frame;
  function size(){W=cv.width=board.clientWidth;H=cv.height=board.clientHeight;}
  function reset(){bird={x:W*0.28,y:H/2,v:0,r:W*0.032};pipes=[];score=0;running=false;gap=H*0.36;frame=0;document.getElementById('s').textContent=0;draw();}
  function start(){size();reset();running=true;ov.classList.add('hide');flap();requestAnimationFrame(loop);}
  function flap(){if(running)bird.v=-H*0.0115;}
  function addPipe(){var min=H*0.10,top=min+Math.random()*(H-gap-min*2);pipes.push({x:W+20,top:top,passed:false});}
  function loop(){if(!running)return;update();draw();requestAnimationFrame(loop);}
  function update(){
    frame++;if(frame%95===0)addPipe();
    bird.v+=H*0.00058;bird.y+=bird.v;
    if(bird.y>H-bird.r||bird.y<bird.r)return over();
    var pv=W*0.0075;
    for(var i=pipes.length-1;i>=0;i--){var p=pipes[i];p.x-=pv;
      if(!p.passed&&p.x+40<bird.x){p.passed=true;score++;document.getElementById('s').textContent=score;if(score>best)best=score;}
      if(bird.x+bird.r>p.x&&bird.x-bird.r<p.x+42&&(bird.y-bird.r<p.top||bird.y+bird.r>p.top+gap))return over();
      if(p.x<-60)pipes.splice(i,1);
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#FFFFFF';
    for(var i=0;i<pipes.length;i++){var p=pipes[i];ctx.fillRect(p.x,0,42,p.top);ctx.fillRect(p.x,p.top+gap,42,H-p.top-gap);}
    ctx.fillStyle='#FFD54A';ctx.beginPath();ctx.arc(bird.x,bird.y,bird.r,0,7);ctx.fill();
    ctx.fillStyle='#111';ctx.beginPath();ctx.arc(bird.x+bird.r*0.35,bird.y-bird.r*0.2,bird.r*0.2,0,7);ctx.fill();
  }
  function over(){
    if(!running)return;running=false;
    document.getElementById('t').textContent='Perdu !';
    document.getElementById('msg').textContent='Score : '+score;
    document.getElementById('go').textContent='Rejouer';
    ov.classList.remove('hide');
    try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score}));}catch(e){}
  }
  // Un SEUL input : tap sur le board = flap, uniquement pendant le jeu.
  // On ne bloque pas l'événement quand l'overlay est visible → le bouton
  // "Jouer" reçoit bien son tap.
  board.addEventListener('touchstart',function(e){ if(running){ e.preventDefault(); flap(); } },{passive:false});
  document.addEventListener('keydown',function(e){ if(e.key===' '||e.key==='ArrowUp'){ e.preventDefault(); if(running)flap(); } });
  document.getElementById('go').addEventListener('click',start);
  window.addEventListener('resize',function(){ if(!running){ size(); reset(); } });
  size();reset();
})();</script>
</body></html>`;
