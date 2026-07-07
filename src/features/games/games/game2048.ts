// Jeu 2048 — E10-05 (#296)
//
// HTML5 auto-contenu (Canvas-free, DOM grid), thème DOUMASSI (fond noir,
// accent vert neon). Contrôle : swipe tactile (+ flèches clavier pour test
// navigateur). Score = somme des fusions. En game over, envoie le score à
// l'app via window.ReactNativeWebView.postMessage.
//
// 2048 est open-source (MIT, Gabriele Cirulli) — mécanique réimplémentée ici.

export const GAME_2048_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
  html, body { margin: 0; height: 100%; background: #000; color: #fff;
    font-family: -apple-system, system-ui, Roboto, sans-serif; overflow: hidden; }
  #wrap { height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 14px; padding: 16px; }
  #top { width: 100%; max-width: 420px; display: flex; align-items: center; justify-content: space-between; }
  #score { font-size: 15px; font-weight: 800; }
  #score span { color: #10D970; }
  #best { font-size: 13px; color: #A0A0A0; }
  #board { position: relative; width: 90vw; max-width: 380px; aspect-ratio: 1;
    background: #1A1A1A; border-radius: 12px; padding: 8px; touch-action: none; }
  .grid { position: absolute; inset: 8px; display: grid;
    grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 8px; }
  .cell { background: #262626; border-radius: 8px; }
  .tiles { position: absolute; inset: 8px; }
  .tile { position: absolute; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; font-weight: 800; transition: transform .12s ease, opacity .12s ease;
    color: #fff; }
  #over { position: absolute; inset: 8px; background: rgba(0,0,0,.78); border-radius: 8px;
    display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  #over.show { display: flex; }
  #over h2 { margin: 0; font-size: 24px; }
  .btn { background: #10D970; color: #000; font-weight: 800; border: none;
    border-radius: 999px; padding: 12px 22px; font-size: 15px; }
  #hint { font-size: 12px; color: #666; }
</style>
</head>
<body>
<div id="wrap">
  <div id="top">
    <div id="score">Score <span id="s">0</span></div>
    <div id="best">Meilleur : <b id="b">0</b></div>
  </div>
  <div id="board">
    <div class="grid" id="grid"></div>
    <div class="tiles" id="tiles"></div>
    <div id="over">
      <h2>Partie terminée</h2>
      <button class="btn" id="again">Rejouer</button>
    </div>
  </div>
  <div id="hint">Glisse pour fusionner les tuiles</div>
</div>
<script>
(function(){
  var N = 4, score = 0, best = 0, board = [], gameOver = false;
  var tilesEl = document.getElementById('tiles');
  var scoreEl = document.getElementById('s');
  var bestEl = document.getElementById('b');
  var overEl = document.getElementById('over');
  var boardEl = document.getElementById('board');

  var COLORS = {
    2:'#3a3a3a',4:'#4a463a',8:'#8a5a2a',16:'#9a5320',32:'#a5431f',64:'#b5321a',
    128:'#2b6e4a',256:'#2b7e50',512:'#10995f',1024:'#10b06a',2048:'#10D970'
  };

  function gridEl(){
    var g = document.getElementById('grid');
    for(var i=0;i<N*N;i++){ var c=document.createElement('div'); c.className='cell'; g.appendChild(c); }
  }
  function empty(){ var a=[]; for(var r=0;r<N;r++){a.push([0,0,0,0]);} return a; }
  function cells(){ var res=[]; for(var r=0;r<N;r++)for(var c=0;c<N;c++)if(board[r][c]===0)res.push([r,c]); return res; }
  function spawn(){ var e=cells(); if(!e.length)return; var p=e[(Math.random()*e.length)|0];
    board[p[0]][p[1]] = Math.random()<0.9?2:4; }

  function render(){
    tilesEl.innerHTML='';
    var size = (boardEl.clientWidth - 16 - 24) / 4; // padding 8*2 + 3 gaps*8
    for(var r=0;r<N;r++)for(var c=0;c<N;c++){
      var v=board[r][c]; if(!v)continue;
      var t=document.createElement('div'); t.className='tile';
      t.style.width=size+'px'; t.style.height=size+'px';
      t.style.transform='translate('+(c*(size+8))+'px,'+(r*(size+8))+'px)';
      t.style.background=COLORS[v]||'#10D970';
      t.style.fontSize=(v<100?size*0.42:v<1000?size*0.34:size*0.26)+'px';
      t.textContent=v;
      tilesEl.appendChild(t);
    }
    scoreEl.textContent=score;
    if(score>best){best=score;bestEl.textContent=best;}
  }

  function slide(row){
    var arr=row.filter(function(x){return x;});
    for(var i=0;i<arr.length-1;i++){
      if(arr[i]===arr[i+1]){ arr[i]*=2; score+=arr[i]; arr[i+1]=0; }
    }
    arr=arr.filter(function(x){return x;});
    while(arr.length<N)arr.push(0);
    return arr;
  }
  function rotate(b){ var n=empty(); for(var r=0;r<N;r++)for(var c=0;c<N;c++)n[c][N-1-r]=b[r][c]; return n; }
  function equal(a,b){ for(var r=0;r<N;r++)for(var c=0;c<N;c++)if(a[r][c]!==b[r][c])return false; return true; }
  function clone(b){ return b.map(function(r){return r.slice();}); }

  function move(dir){ // 0 left,1 up,2 right,3 down
    if(gameOver)return;
    var before=clone(board), b=board;
    for(var i=0;i<dir;i++)b=rotate(b);
    for(var r=0;r<N;r++)b[r]=slide(b[r]);
    for(var j=0;j<(4-dir)%4;j++)b=rotate(b);
    board=b;
    if(!equal(before,board)){ spawn(); render(); checkOver(); }
  }

  function canMove(){
    if(cells().length)return true;
    for(var r=0;r<N;r++)for(var c=0;c<N;c++){
      var v=board[r][c];
      if(c<N-1&&board[r][c+1]===v)return true;
      if(r<N-1&&board[r+1][c]===v)return true;
    }
    return false;
  }
  function checkOver(){
    if(!canMove()){
      gameOver=true; overEl.classList.add('show');
      try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score})); }catch(e){}
    }
  }

  function reset(){ board=empty(); score=0; gameOver=false; overEl.classList.remove('show'); spawn(); spawn(); render(); }

  // Contrôles tactiles
  var sx=0, sy=0;
  boardEl.addEventListener('touchstart',function(e){ var t=e.touches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  boardEl.addEventListener('touchend',function(e){
    var t=e.changedTouches[0]; var dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<20&&Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy)) move(dx>0?2:0); else move(dy>0?3:1);
  },{passive:true});
  document.addEventListener('keydown',function(e){
    var k={ArrowLeft:0,ArrowUp:1,ArrowRight:2,ArrowDown:3}[e.key];
    if(k!==undefined){ e.preventDefault(); move(k); }
  });
  document.getElementById('again').addEventListener('click',reset);
  window.addEventListener('resize',render);

  gridEl(); reset();
})();
</script>
</body>
</html>`;
