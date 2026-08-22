// Jeu Memory — E10-07 (#298)
// Grille 4x4 (8 paires d'emojis). Tap pour retourner. Score = 2000 - coups*40
// (plancher 100), envoyé quand toutes les paires sont trouvées.

export const GAME_MEMORY_HTML = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,Roboto,sans-serif;overflow:hidden;}
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;}
  #hud{width:100%;max-width:420px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;}
  #hud span{color:#FFFFFF;}
  #grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:92vw;max-width:400px;aspect-ratio:1;}
  .card{position:relative;border-radius:10px;cursor:pointer;}
  .inner{position:absolute;inset:0;border-radius:10px;transition:transform .3s;transform-style:preserve-3d;}
  .card.flip .inner{transform:rotateY(180deg);}
  .face{position:absolute;inset:0;border-radius:10px;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;font-size:30px;}
  .back{background:#1A1A1A;border:2px solid #262626;}
  .front{background:#12291D;border:2px solid #FFFFFF;transform:rotateY(180deg);}
  .card.done .inner{opacity:.35;}
  #win{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;}
  #win.show{display:flex;}
  .btn{background:#FFFFFF;color:#000;font-weight:800;border:none;border-radius:999px;padding:12px 22px;font-size:15px;}
</style></head><body>
<div id="wrap">
  <div id="hud"><div>Coups <span id="m">0</span></div><div style="color:#A0A0A0;font-weight:600;">Paires <b id="p">0</b>/8</div></div>
  <div id="grid"></div>
</div>
<div id="win"><h2 style="margin:0;">Bravo !</h2><div id="ws" style="color:#FFFFFF;font-size:22px;font-weight:900;"></div><button class="btn" id="again">Rejouer</button></div>
<script>(function(){
  var EMO=['🍎','🚀','⚽','🎸','🐱','🌙','⭐','🔥'];
  var grid=document.getElementById('grid'),moves=0,pairs=0,first=null,lock=false;
  function shuffle(a){for(var i=a.length-1;i>0;i--){var j=(Math.random()*(i+1))|0;var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function build(){
    grid.innerHTML='';moves=0;pairs=0;first=null;lock=false;
    document.getElementById('m').textContent=0;document.getElementById('p').textContent=0;
    document.getElementById('win').classList.remove('show');
    var deck=shuffle(EMO.concat(EMO));
    deck.forEach(function(sym){
      var c=document.createElement('div');c.className='card';c.dataset.sym=sym;
      c.innerHTML='<div class="inner"><div class="face back"></div><div class="face front">'+sym+'</div></div>';
      c.addEventListener('click',function(){flip(c);});
      grid.appendChild(c);
    });
  }
  function flip(c){
    if(lock||c.classList.contains('flip')||c.classList.contains('done'))return;
    c.classList.add('flip');
    if(!first){first=c;return;}
    moves++;document.getElementById('m').textContent=moves;
    if(first.dataset.sym===c.dataset.sym){
      first.classList.add('done');c.classList.add('done');first=null;pairs++;
      document.getElementById('p').textContent=pairs;
      if(pairs===8)win();
    }else{
      lock=true;var a=first,b=c;first=null;
      setTimeout(function(){a.classList.remove('flip');b.classList.remove('flip');lock=false;},650);
    }
  }
  function win(){
    var score=Math.max(100,2000-moves*40);
    document.getElementById('ws').textContent=score+' points';
    document.getElementById('win').classList.add('show');
    try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'score',value:score}));}catch(e){}
  }
  document.getElementById('again').addEventListener('click',build);
  build();
})();</script>
</body></html>`;
