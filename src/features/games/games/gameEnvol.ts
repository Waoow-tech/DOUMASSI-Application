// Jeu Envol — E10-09 (#300)
// Mécanique tap-to-fly (générique). Tap pour donner de l'élan, gravité,
// éviter les obstacles. Score = obstacles franchis. Collision = game over.

export const GAME_ENVOL_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,Roboto,sans-serif;overflow:hidden;}
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;}
  #hud{width:100%;max-width:440px;text-align:center;font-size:15px;font-weight:800;}
  #hud span{color:#10D970;}
  #board{position:relative;width:94vw;max-width:440px;aspect-ratio:.66;background:#0b1622;border-radius:12px;touch-action:none;overflow:hidden;}
  canvas{width:100%;height:100%;display:block;}
  #ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,.55);}
  #ov.hide{display:none;}
  .btn{background:#10D970;color:#000;font-weight:800;border:none;border-radius:999px;padding:12px 22px;font-size:15px;}
  #ov p{margin:0;font-size:14px;color:#cfe;}
</style></head><body>
<div id="wrap">
  <div id="hud">Score <span id="s">0</span></div>
  <div id="board"><canvas id="c"></canvas>
    <div id="ov"><h2 id="t" style="margin:0;">Envol</h2><p id="msg">Tape pour voler</p><button class="btn" id="go">Jouer</button></div>
  </div>
</div>
<script>(function(){
  var cv=document.getElementById('c'),ctx=cv.getContext('2d'),board=document.getElementById('board'),ov=document.getElementById('ov');
  var W,H,bird,pipes,score,best=0,dead,raf,gap,speed,frame;
  function size(){W=cv.width=board.clientWidth;H=cv.height=board.clientHeight;}
  function reset(){bird={x:W*0.28,y:H/2,v:0,r:W*0.03};pipes=[];score=0;dead=false;gap=H*0.32;speed=W*0.006;frame=0;document.getElementById('s').textContent=0;}
  function start(){reset();ov.classList.add('hide');loop();}
  function flap(){if(dead)return;bird.v=-H*0.011;}
  function addPipe(){var min=H*0.12,top=min+Math.random()*(H-gap-min*2);pipes.push({x:W+20,top:top,passed:false});}
  function loop(){if(dead)return;update();draw();raf=requestAnimationFrame(loop);}
  function update(){
    frame++;if(frame%90===0)addPipe();
    bird.v+=H*0.0006;bird.y+=bird.v;
    if(bird.y>H-bird.r||bird.y<bird.r)return over();
    for(var i=pipes.length-1;i>=0;i--){var p=pipes[i];p.x-=speed*60/60*2;
      if(!p.passed&&p.x+30<bird.x){p.passed=true;score++;document.getElementById('s').textContent=score;if(score>best)best=score;}
      if(bird.x+bird.r>p.x&&bird.x-bird.r<p.x+40&&(bird.y-bird.r<p.top||bird.y+bird.r>p.top+gap))return over();
      if(p.x<-50)pipes.splice(i,1);
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#10D970';for(var i=0;i<pipes.length;i++){var p=pipes[i];ctx.fillRect(p.x,0,40,p.top);ctx.fillRect(p.x,p.top+gap,40,H-p.top-gap);}
    ctx.fillStyle='#FFD54A';ctx.beginPath();ctx.arc(bird.x,bird.y,bird.r,0,7);ctx.fill();
    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(bird.x+bird.r*0.4,bird.y-bird.r*0.2,bird.r*0.18,0,7);ctx.fill();
  }
  function over(){dead=true;document.getElementById('t').textContent='Perdu !';document.getElementById('msg').textContent='Score : '+score;document.getElementById('go').textContent='Rejouer';ov.classList.remove('hide');try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score}));}catch(e){}}
  board.addEventListener('touchstart',function(e){e.preventDefault();if(dead||ov.classList.contains('hide')===false)return;flap();},{passive:false});
  board.addEventListener('touchend',function(){},{passive:true});
  // tap sur le board pendant le jeu = flap
  board.addEventListener('pointerdown',function(){if(!dead&&ov.classList.contains('hide'))flap();});
  document.getElementById('go').addEventListener('click',function(e){e.stopPropagation();start();});
  window.addEventListener('resize',function(){size();});
  size();reset();
})();</script>
</body></html>`;
