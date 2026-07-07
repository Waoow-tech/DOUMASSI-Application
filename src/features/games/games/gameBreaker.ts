// Jeu Casse-briques — E10-08 (#299)
// Raquette (drag), balle, briques. 3 vies. Score = briques * 10.
// Game over quand plus de vies, ou victoire quand toutes les briques cassées.

export const GAME_BREAKER_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,Roboto,sans-serif;overflow:hidden;}
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;}
  #hud{width:100%;max-width:440px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;}
  #hud span{color:#10D970;}
  #board{position:relative;width:94vw;max-width:440px;aspect-ratio:.72;background:#111;border-radius:12px;touch-action:none;}
  canvas{width:100%;height:100%;border-radius:12px;display:block;}
  #over{position:absolute;inset:0;background:rgba(0,0,0,.82);border-radius:12px;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;}
  #over.show{display:flex;}
  .btn{background:#10D970;color:#000;font-weight:800;border:none;border-radius:999px;padding:12px 22px;font-size:15px;}
  #hint{font-size:12px;color:#666;}
</style></head><body>
<div id="wrap">
  <div id="hud"><div>Score <span id="s">0</span></div><div style="color:#A0A0A0;font-weight:600;">Vies <b id="l">3</b></div></div>
  <div id="board"><canvas id="c"></canvas>
    <div id="over"><h2 id="ot" style="margin:0;">Perdu !</h2><button class="btn" id="again">Rejouer</button></div>
  </div>
  <div id="hint">Glisse pour déplacer la raquette</div>
</div>
<script>(function(){
  var cv=document.getElementById('c'),ctx=cv.getContext('2d'),board=document.getElementById('board');
  var W,H,ball,pad,bricks,score,lives,dead,raf,started;
  var COLS=6,ROWS=5,bw,bh;
  function size(){W=cv.width=board.clientWidth;H=cv.height=board.clientHeight;bw=(W-20)/COLS;bh=22;}
  function reset(){
    score=0;lives=3;dead=false;started=false;
    document.getElementById('s').textContent=0;document.getElementById('l').textContent=3;
    document.getElementById('over').classList.remove('show');
    pad={w:W*0.24,h:12,x:W/2};
    ball={x:W/2,y:H-40,r:8,vx:0,vy:0};
    bricks=[];for(var r=0;r<ROWS;r++)for(var col=0;col<COLS;col++)bricks.push({x:10+col*bw,y:50+r*(bh+6),alive:true,c:['#10D970','#3B82F6','#8B5CF6','#F59E0B','#EC4899'][r]});
    draw();
  }
  function launch(){if(started)return;started=true;ball.vx=(Math.random()<.5?-1:1)*4;ball.vy=-5;loop();}
  function loop(){if(dead)return;update();draw();raf=requestAnimationFrame(loop);}
  function update(){
    ball.x+=ball.vx;ball.y+=ball.vy;
    if(ball.x<ball.r||ball.x>W-ball.r)ball.vx*=-1;
    if(ball.y<ball.r)ball.vy*=-1;
    if(ball.y>H+20){lives--;document.getElementById('l').textContent=lives;if(lives<=0)return over('Perdu !');started=false;ball.x=W/2;ball.y=H-40;ball.vx=0;ball.vy=0;return;}
    if(ball.y>H-30-pad.h&&ball.y<H-18&&Math.abs(ball.x-pad.x)<pad.w/2+ball.r){ball.vy=-Math.abs(ball.vy);var d=(ball.x-pad.x)/(pad.w/2);ball.vx=d*5;}
    for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.alive)continue;if(ball.x>b.x&&ball.x<b.x+bw-4&&ball.y>b.y&&ball.y<b.y+bh){b.alive=false;ball.vy*=-1;score+=10;document.getElementById('s').textContent=score;if(bricks.every(function(x){return !x.alive;}))return over('Gagné !');break;}}
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.alive)continue;ctx.fillStyle=b.c;rr(b.x,b.y,bw-4,bh,4);}
    ctx.fillStyle='#fff';rr(pad.x-pad.w/2,H-18-pad.h,pad.w,pad.h,6);
    ctx.fillStyle='#10D970';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,7);ctx.fill();
  }
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.fill();}
  function over(t){dead=true;document.getElementById('ot').textContent=t;document.getElementById('over').classList.add('show');try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score}));}catch(e){}}
  function movePad(clientX){var rect=board.getBoundingClientRect();pad.x=Math.max(pad.w/2,Math.min(W-pad.w/2,clientX-rect.left));if(!started){ball.x=pad.x;draw();}}
  board.addEventListener('touchstart',function(e){movePad(e.touches[0].clientX);launch();},{passive:true});
  board.addEventListener('touchmove',function(e){movePad(e.touches[0].clientX);},{passive:true});
  document.getElementById('again').addEventListener('click',reset);
  window.addEventListener('resize',function(){size();reset();});
  size();reset();
})();</script>
</body></html>`;
