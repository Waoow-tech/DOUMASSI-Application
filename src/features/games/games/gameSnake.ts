// Jeu Snake — E10-06 (#297)
// Serpent sur grille, swipe pour tourner, mange la pomme pour grandir.
// Collision mur/soi-même = game over. Score = pommes * 10.

export const GAME_SNAKE_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,Roboto,sans-serif;overflow:hidden;}
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;}
  #hud{width:100%;max-width:420px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;}
  #hud span{color:#FFFFFF;}
  #board{position:relative;width:92vw;max-width:400px;aspect-ratio:1;background:#1A1A1A;border-radius:12px;touch-action:none;}
  canvas{width:100%;height:100%;border-radius:12px;display:block;}
  #over{position:absolute;inset:0;background:rgba(0,0,0,.8);border-radius:12px;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;}
  #over.show{display:flex;}
  .btn{background:#FFFFFF;color:#000;font-weight:800;border:none;border-radius:999px;padding:12px 22px;font-size:15px;}
  #hint{font-size:12px;color:#666;}
</style></head><body>
<div id="wrap">
  <div id="hud"><div>Score <span id="s">0</span></div><div style="color:#A0A0A0;font-weight:600;">Meilleur <b id="b">0</b></div></div>
  <div id="board"><canvas id="c"></canvas>
    <div id="over"><h2 style="margin:0;">Perdu !</h2><button class="btn" id="again">Rejouer</button></div>
  </div>
  <div id="hint">Glisse pour diriger le serpent</div>
</div>
<script>(function(){
  var cv=document.getElementById('c'),ctx=cv.getContext('2d'),board=document.getElementById('board');
  var N=17,cell,snake,dir,nextDir,food,score=0,best=0,dead=false,tick,speed;
  function size(){var w=board.clientWidth;cv.width=w;cv.height=w;cell=w/N;}
  function reset(){snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];dir={x:1,y:0};nextDir=dir;score=0;dead=false;speed=130;placeFood();document.getElementById('over').classList.remove('show');document.getElementById('s').textContent=0;loop();}
  function placeFood(){do{food={x:(Math.random()*N)|0,y:(Math.random()*N)|0};}while(snake.some(function(s){return s.x===food.x&&s.y===food.y;}));}
  function step(){
    dir=nextDir;
    var h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
    if(h.x<0||h.y<0||h.x>=N||h.y>=N||snake.some(function(s){return s.x===h.x&&s.y===h.y;})){return gameOver();}
    snake.unshift(h);
    if(h.x===food.x&&h.y===food.y){score+=10;document.getElementById('s').textContent=score;if(score>best){best=score;document.getElementById('b').textContent=best;}placeFood();if(speed>60)speed-=2;}
    else snake.pop();
    draw();
  }
  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle='#E53935';var pad=cell*0.15;
    ctx.beginPath();ctx.arc(food.x*cell+cell/2,food.y*cell+cell/2,cell/2-pad,0,7);ctx.fill();
    for(var i=0;i<snake.length;i++){ctx.fillStyle=i===0?'#FFFFFF':'#0e9e54';var s=snake[i];roundRect(s.x*cell+1,s.y*cell+1,cell-2,cell-2,4);}
  }
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.fill();}
  function loop(){clearTimeout(tick);if(dead)return;step();tick=setTimeout(loop,speed);}
  function gameOver(){dead=true;document.getElementById('over').classList.add('show');try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score}));}catch(e){}}
  var sx,sy;
  board.addEventListener('touchstart',function(e){var t=e.touches[0];sx=t.clientX;sy=t.clientY;},{passive:true});
  board.addEventListener('touchend',function(e){var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)<15&&Math.abs(dy)<15)return;var nd;if(Math.abs(dx)>Math.abs(dy))nd={x:dx>0?1:-1,y:0};else nd={x:0,y:dy>0?1:-1};if(nd.x!==-dir.x||nd.y!==-dir.y)if(!(nd.x===-dir.x&&nd.y===-dir.y))if(nd.x+dir.x!==0||nd.y+dir.y!==0)nextDir=nd;},{passive:true});
  document.addEventListener('keydown',function(e){var m={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}}[e.key];if(m&&(m.x+dir.x!==0||m.y+dir.y!==0)){nextDir=m;e.preventDefault();}});
  document.getElementById('again').addEventListener('click',reset);
  window.addEventListener('resize',function(){size();draw();});
  size();reset();
})();</script>
</body></html>`;
