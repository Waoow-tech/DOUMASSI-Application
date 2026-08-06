// Jeu Course — E10-10 (#301)
// Véhicule vue de dessus, 3 voies, esquive le trafic qui descend. Drag ou tap
// gauche/droite pour changer de voie. Score = distance parcourue. Vitesse
// croissante. Collision = game over.

export const GAME_COURSE_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,Roboto,sans-serif;overflow:hidden;}
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;}
  #hud{width:100%;max-width:440px;text-align:center;font-size:15px;font-weight:800;}
  #hud span{color:#FFFFFF;}
  #board{position:relative;width:94vw;max-width:440px;aspect-ratio:.6;background:#20232a;border-radius:12px;touch-action:none;overflow:hidden;}
  canvas{width:100%;height:100%;display:block;}
  #ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,.6);}
  #ov.hide{display:none;}
  .btn{background:#FFFFFF;color:#000;font-weight:800;border:none;border-radius:999px;padding:12px 22px;font-size:15px;}
  #ov p{margin:0;font-size:14px;color:#cfe;}
</style></head><body>
<div id="wrap">
  <div id="hud">Distance <span id="s">0</span> m</div>
  <div id="board"><canvas id="c"></canvas>
    <div id="ov"><h2 id="t" style="margin:0;">Course</h2><p id="msg">Glisse pour éviter le trafic</p><button class="btn" id="go">Jouer</button></div>
  </div>
</div>
<script>(function(){
  var cv=document.getElementById('c'),ctx=cv.getContext('2d'),board=document.getElementById('board'),ov=document.getElementById('ov');
  var W,H,LANES=3,lane,carW,carH,player,traffic,score,dead,raf,speed,frame,dash;
  function size(){W=cv.width=board.clientWidth;H=cv.height=board.clientHeight;carW=W/LANES*0.56;carH=carW*1.7;}
  function laneX(i){return (i+0.5)*(W/LANES);}
  function reset(){lane=1;player={x:laneX(1),y:H-carH-16};traffic=[];score=0;dead=false;speed=H*0.008;frame=0;dash=0;document.getElementById('s').textContent=0;}
  function start(){reset();ov.classList.add('hide');loop();}
  function spawn(){var l=(Math.random()*LANES)|0;var last=traffic[traffic.length-1];if(last&&last.y<carH*1.2&&last.lane===l)return;traffic.push({lane:l,x:laneX(l),y:-carH,c:['#E53935','#3B82F6','#F59E0B','#8B5CF6'][(Math.random()*4)|0]});}
  function loop(){if(dead)return;update();draw();raf=requestAnimationFrame(loop);}
  function update(){
    frame++;dash+=speed;score+=speed*0.15;document.getElementById('s').textContent=score|0;
    if(speed<H*0.02)speed+=0.0009;
    if(frame%42===0)spawn();
    player.x+=(laneX(lane)-player.x)*0.25;
    for(var i=traffic.length-1;i>=0;i--){var t=traffic[i];t.y+=speed;
      if(t.y>H+carH){traffic.splice(i,1);continue;}
      if(Math.abs(t.x-player.x)<carW*0.9&&Math.abs(t.y-player.y)<carH*0.9)return over();
    }
  }
  function car(x,y,c){ctx.fillStyle=c;rr(x-carW/2,y,carW,carH,7);ctx.fillStyle='rgba(255,255,255,.35)';rr(x-carW/2+carW*0.16,y+carH*0.16,carW*0.68,carH*0.24,3);rr(x-carW/2+carW*0.16,y+carH*0.6,carW*0.68,carH*0.2,3);}
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.fill();}
  function draw(){
    ctx.fillStyle='#20232a';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=3;ctx.setLineDash([18,20]);ctx.lineDashOffset=-(dash%38);
    for(var i=1;i<LANES;i++){ctx.beginPath();ctx.moveTo(i*(W/LANES),0);ctx.lineTo(i*(W/LANES),H);ctx.stroke();}
    ctx.setLineDash([]);
    for(var j=0;j<traffic.length;j++)car(traffic[j].x,traffic[j].y,traffic[j].c);
    car(player.x,player.y,'#FFFFFF');
  }
  function over(){dead=true;document.getElementById('t').textContent='Crash !';document.getElementById('msg').textContent='Distance : '+(score|0)+' m';document.getElementById('go').textContent='Rejouer';ov.classList.remove('hide');try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score|0}));}catch(e){}}
  var sx=null;
  board.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
  board.addEventListener('touchend',function(e){if(sx==null||dead||!ov.classList.contains('hide'))return;var dx=e.changedTouches[0].clientX-sx;if(dx>20&&lane<LANES-1)lane++;else if(dx<-20&&lane>0)lane--;else{var rect=board.getBoundingClientRect();var rel=e.changedTouches[0].clientX-rect.left;if(rel>W/2&&lane<LANES-1)lane++;else if(rel<W/2&&lane>0)lane--;}sx=null;},{passive:true});
  document.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'&&lane>0)lane--;if(e.key==='ArrowRight'&&lane<LANES-1)lane++;});
  document.getElementById('go').addEventListener('click',start);
  window.addEventListener('resize',function(){size();});
  size();reset();
})();</script>
</body></html>`;
