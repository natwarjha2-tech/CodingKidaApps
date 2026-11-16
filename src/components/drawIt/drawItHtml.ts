/**
 * "Draw it" — kids CHANGE VALUES in code that already works and watch a picture
 * draw itself (turtle graphics). No typing code, no internet, no server.
 *
 * ONE self-contained WebView page. The code shown on screen is the code that
 * really runs (variable lines at the top are the ones the kid changes with
 * − / + buttons or colour dots), so what they see is real JavaScript — the same
 * ideas (variables, loops, conditions) as the C / Java / Python / JS courses.
 *
 * NOTE for editors of this file: it is a template literal, so the embedded
 * JavaScript must not contain backticks or "${"; "\n" must be written "\\n".
 */
export function buildDrawItHtml(): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
html,body{margin:0;height:100%;overflow:hidden;background:#0f0f1a;color:#e2e8f0;font-family:-apple-system,Roboto,sans-serif}
#app{display:flex;flex-direction:column;height:100%}
#top{flex:0 0 auto;display:flex;gap:8px;overflow-x:auto;padding:10px 10px 8px;background:#16162a;border-bottom:1px solid rgba(255,255,255,.08);scrollbar-width:none}
#top::-webkit-scrollbar{display:none}
.pic{flex:0 0 auto;border:0;border-radius:14px;padding:8px 14px;font-weight:800;font-size:13px;color:#cbd5e1;background:rgba(255,255,255,.07);white-space:nowrap}
.pic.on{background:#6c47ff;color:#fff}
#stage{flex:0 0 auto;height:38vh;min-height:210px;background:#fffdf7;position:relative}
#cv{display:block;width:100%;height:100%}
#msg{position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:12px;font-weight:700;color:#7a6a5c}
#sheet{flex:1 1 auto;overflow-y:auto;padding:12px 12px 16px}
.h{font-size:12px;font-weight:900;letter-spacing:.5px;color:#a78bfa;margin:2px 0 8px;text-transform:uppercase}
.tips{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:13px;line-height:1.55;color:#fde68a}
.code{background:#0b0b14;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 10px;font:13px/1.9 Menlo,Consolas,monospace;color:#cbd5e1;white-space:pre}
.ln{min-height:24px;white-space:pre-wrap}
.kw{color:#c084fc}.fn{color:#60a5fa}.num{color:#fbbf24}.str{color:#86efac}.cm{color:#6b7280}
.row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;background:rgba(108,71,255,.12);border:1px solid rgba(108,71,255,.35);border-radius:10px;padding:5px 8px;margin:3px 0;white-space:normal}
.row .nm{color:#fff;font-weight:700}
.st{width:34px;height:34px;border:0;border-radius:10px;font-size:20px;font-weight:900;color:#fff;background:#6c47ff}
.val{min-width:40px;text-align:center;font-weight:900;font-size:17px;color:#fbbf24}
.dots{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 6px 6px}
.dot{width:30px;height:30px;border-radius:15px;border:3px solid transparent}
.dot.on{border-color:#fff}
.learn{margin-top:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.55;color:#bbf7d0}
#foot{flex:0 0 auto;display:flex;gap:8px;padding:10px;background:#16162a;border-top:1px solid rgba(255,255,255,.08)}
#foot button{border:0;border-radius:12px;padding:13px 10px;font-weight:900;font-size:14px;color:#fff}
#bDraw{flex:2;background:#22c55e}#bShare{flex:1.3;background:#3b82f6}#bReset{flex:.6;background:rgba(255,255,255,.12)}
</style></head>
<body><div id="app">
<div id="top"></div>
<div id="stage"><canvas id="cv"></canvas><div id="msg"></div></div>
<div id="sheet"><div id="tips"></div><div class="h">✏️ Change the numbers</div><div id="code" class="code"></div><div id="learn"></div></div>
<div id="foot"><button id="bDraw">▶ Watch it draw</button><button id="bShare">📤 Share</button><button id="bReset">↺</button></div>
</div>
<script>
(function(){
var post=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}};
var $=function(id){return document.getElementById(id);};

var COLORS=[['Pink','hotpink'],['Red','crimson'],['Orange','orange'],['Yellow','gold'],['Green','limegreen'],['Blue','dodgerblue'],['Purple','mediumpurple']];
function num(k,label,v,min,max,step){return {k:k,label:label,v:v,min:min,max:max,step:step||1};}
function col(k,v){return {k:k,type:'color',v:v};}

var PICS=[
 {id:'shape',emoji:'🔷',name:'Shape Maker',
  params:[num('sides','sides',4,3,12),num('size','size',70,30,120,10),col('paint','hotpink')],
  body:['color(paint);','for (let i = 0; i < sides; i++) {','  forward(size);','  turn(360 / sides);','}'],
  tips:['Make sides 3 → a triangle!','Make sides 6 → a hexagon','Make sides 12 → almost a circle'],
  learn:'sides is a variable. The loop repeats the lines inside { } that many times, and each time it turns 360 ÷ sides degrees.'},
 {id:'star',emoji:'⭐',name:'Star',
  params:[num('points','points',5,5,11,2),num('size','size',100,40,160,10),num('thick','thickness',3,1,8),col('paint','gold')],
  body:['color(paint);','width(thick);','for (let i = 0; i < points; i++) {','  forward(size);','  turn(180 - 180 / points);','}'],
  tips:['Make points 7 → a spiky star','Make thickness 8 → a bold star','Try a different colour'],
  learn:'The loop draws one line and turns, again and again. A small change to the turn number makes a very different star!'},
 {id:'flower',emoji:'🌸',name:'Flower',
  params:[num('petals','petals',8,3,16),num('size','petal size',30,15,60,5),col('paint','hotpink')],
  body:['color(paint);','for (let i = 0; i < petals; i++) {','  circle(size);','  turn(360 / petals);','}'],
  tips:['Make petals 16 → a full bloom','Make petals 3 → a tiny flower','Make petal size 60 → a giant flower'],
  learn:'circle(size) is a ready-made helper. The loop draws one petal, turns a little, and repeats - 360 ÷ petals makes them go all the way round.'},
 {id:'house',emoji:'🏠',name:'House',
  params:[num('size','size',70,30,110,10),col('wall','orange'),col('roof','crimson')],
  body:['beginFill(wall);','for (let i = 0; i < 4; i++) {','  forward(size);','  turn(90);','}','endFill();','','forward(size);','beginFill(roof);','turn(30);','forward(size);','turn(120);','forward(size);','turn(120);','forward(size);','endFill();'],
  tips:['Give the house a blue wall and a green roof','Make size 110 → a big house','Make size 30 → a tiny house'],
  learn:'A program runs line by line, from top to bottom. First the walls (a loop), then the roof. Change the order and the picture changes!'},
 {id:'rainbow',emoji:'🌈',name:'Rainbow',
  params:[num('bands','colour bands',6,3,7),num('radius','size',140,100,180,20),num('thick','band width',14,6,16,2)],
  body:['let colors = ["crimson", "orange", "gold",','  "limegreen", "dodgerblue",','  "mediumpurple", "hotpink"];','width(thick);','for (let i = 0; i < bands; i++) {','  color(colors[i]);','  goTo(-radius + i * thick, 0);','  arc(radius - i * thick, 180);','}'],
  tips:['Make colour bands 3 → a small rainbow','Make band width 16 → a fat rainbow','Make size 180 → a huge rainbow'],
  learn:'colors is a list. colors[0] is the first colour, colors[1] the second... The loop picks the next colour each time round.'}
];

var cur=0, P=null; // P = working copy of current picture's params
function loadPic(i){cur=i;P=PICS[i].params.map(function(q){return Object.assign({},q);});}

// ── Turtle: runs the code that is shown on screen ──
function runTurtle(code){
  var T={x:0,y:0,h:0,pen:true,c:'#2d2d3a',w:3,cmds:[],fill:null,minx:1e9,maxx:-1e9,miny:1e9,maxy:-1e9,len:0,steps:0};
  function pt(x,y){if(x<T.minx)T.minx=x;if(x>T.maxx)T.maxx=x;if(y<T.miny)T.miny=y;if(y>T.maxy)T.maxy=y;}
  function move(d){
    var r=T.h*Math.PI/180,nx=T.x+d*Math.sin(r),ny=T.y+d*Math.cos(r);
    if(++T.steps>20000)throw new Error('too many steps');
    if(T.pen){T.cmds.push({k:'l',x1:T.x,y1:T.y,x2:nx,y2:ny,c:T.c,w:T.w});pt(T.x,T.y);pt(nx,ny);T.len+=Math.abs(d);}
    if(T.fill)T.fill.pts.push([nx,ny]);
    T.x=nx;T.y=ny;
  }
  var api={
    forward:function(d){move(+d||0);},
    back:function(d){move(-(+d||0));},
    turn:function(a){T.h+=(+a||0);},
    left:function(a){T.h-=(+a||0);},
    color:function(c){T.c=String(c);},
    width:function(w){T.w=Math.max(1,Math.min(30,+w||1));},
    penUp:function(){T.pen=false;},
    penDown:function(){T.pen=true;},
    goTo:function(x,y){T.x=+x||0;T.y=+y||0;T.h=0;},
    arc:function(r,deg){
      r=Math.abs(+r||0);deg=+deg||0;if(!r||!deg)return;
      var n=Math.max(1,Math.ceil(Math.abs(deg)/6)),th=deg/n,chord=2*r*Math.sin(Math.abs(th)*Math.PI/360);
      for(var i=0;i<n;i++){T.h+=th/2;move(chord);T.h+=th/2;}
    },
    circle:function(r){api.arc(r,360);},
    beginFill:function(c){var f={k:'f',pts:[[T.x,T.y]],c:String(c)};T.cmds.push(f);T.fill=f;},
    endFill:function(){if(T.fill){T.fill.pts.forEach(function(p){pt(p[0],p[1]);});T.fill=null;}}
  };
  var names=Object.keys(api);
  new Function(names.join(','),code).apply(null,names.map(function(n){return api[n];}));
  if(T.minx>T.maxx){T.minx=T.maxx=T.miny=T.maxy=0;}
  return T;
}

function codeLines(){
  var pic=PICS[cur];
  var decl=P.map(function(q){return 'let '+q.k+' = '+(q.type==='color'?JSON.stringify(q.v):q.v)+';';});
  return decl.concat([''],pic.body).join('\\n');
}

// ── Drawing ──
var cv=$('cv'),cx=cv.getContext('2d'),W=300,H=300,DPR=window.devicePixelRatio||1;
var TR=null,raf=0,view={sc:1,ox:0,oy:0};
function fit(){
  var r=cv.getBoundingClientRect();W=Math.max(120,r.width);H=Math.max(120,r.height);
  cv.width=W*DPR;cv.height=H*DPR;cx.setTransform(DPR,0,0,DPR,0,0);
}
function setView(){
  var pad=22,bw=(TR.maxx-TR.minx)||1,bh=(TR.maxy-TR.miny)||1;
  var sc=Math.min(1,(W-2*pad)/bw,(H-2*pad)/bh);
  view={sc:sc,ox:W/2-((TR.minx+TR.maxx)/2)*sc,oy:H/2+((TR.miny+TR.maxy)/2)*sc,scaled:sc<0.999};
}
function sx(x){return view.ox+x*view.sc;}
function sy(y){return view.oy-y*view.sc;}
// Draw the picture up to "limit" distance (Infinity = all). Returns {done, x, y}.
function render(limit,withTurtle){
  cx.setTransform(DPR,0,0,DPR,0,0);
  cx.fillStyle='#fffdf7';cx.fillRect(0,0,W,H);
  cx.lineCap='round';cx.lineJoin='round';
  var left=limit,pos=null,done=true;
  for(var i=0;i<TR.cmds.length;i++){
    var c=TR.cmds[i];
    if(c.k==='f'){
      if(left<=0){done=false;break;}
      cx.beginPath();c.pts.forEach(function(p,j){var X=sx(p[0]),Y=sy(p[1]);if(j)cx.lineTo(X,Y);else cx.moveTo(X,Y);});
      cx.closePath();cx.fillStyle=c.c;cx.fill();continue;
    }
    var L=Math.hypot(c.x2-c.x1,c.y2-c.y1);
    if(left<=0){done=false;break;}
    var f=L>0?Math.min(1,left/L):1;
    var ex=c.x1+(c.x2-c.x1)*f,ey=c.y1+(c.y2-c.y1)*f;
    cx.strokeStyle=c.c;cx.lineWidth=c.w*Math.max(0.6,view.sc);
    cx.beginPath();cx.moveTo(sx(c.x1),sy(c.y1));cx.lineTo(sx(ex),sy(ey));cx.stroke();
    pos={x:ex,y:ey};
    left-=L;
    if(f<1){done=false;break;}
  }
  if(withTurtle&&pos&&!done){cx.font='24px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillStyle='#000';cx.fillText('🐢',sx(pos.x),sy(pos.y)-12);}
  return done;
}

function rebuild(){
  var err='';
  try{TR=runTurtle(codeLines());}catch(e){TR=null;err='Oops! Something is not right with these numbers.';}
  $('msg').textContent=err;
  if(TR){setView();if(view.scaled)$('msg').textContent='(Big picture! It was shrunk to fit the screen.)';}
}
function drawNow(){cancelAnimationFrame(raf);if(!TR){cx.fillStyle='#fffdf7';cx.fillRect(0,0,W,H);return;}render(Infinity,false);}
function animate(){
  cancelAnimationFrame(raf);
  if(!TR)return;
  var speed=Math.max(450,TR.len/3.2),dist=0,last=performance.now();
  function step(t){
    var dt=Math.min(0.05,(t-last)/1000);last=t;dist+=speed*dt;
    var done=render(dist,true);
    if(!done)raf=requestAnimationFrame(step);
    else $('msg').textContent=view.scaled?'(Big picture! It was shrunk to fit the screen.)':'✅ Done! Now change a number and draw again.';
  }
  raf=requestAnimationFrame(step);
}

// ── UI ──
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function hi(line){
  var s=esc(line);
  s=s.replace(/\\b(let|for|const)\\b/g,'<span class="kw">$1</span>');
  s=s.replace(/\\b(forward|back|turn|left|color|width|penUp|penDown|goTo|arc|circle|beginFill|endFill)\\b(?=\\()/g,'<span class="fn">$1</span>');
  s=s.replace(/(&quot;[^&]*&quot;|"[^"]*")/g,'<span class="str">$1</span>');
  s=s.replace(/(\\/\\/.*)$/,'<span class="cm">$1</span>');
  return s;
}
function renderPicker(){
  $('top').innerHTML=PICS.map(function(p,i){return '<button class="pic'+(i===cur?' on':'')+'" data-pic="'+i+'">'+p.emoji+' '+p.name+'</button>';}).join('');
}
function renderSheet(){
  var pic=PICS[cur];
  $('tips').innerHTML='<div class="tips"><b>💡 Try this:</b><br>'+pic.tips.map(function(t){return '• '+esc(t);}).join('<br>')+'</div>';
  var h='';
  P.forEach(function(q){
    if(q.type==='color'){
      h+='<div class="row"><span class="kw">let</span> <span class="nm">'+q.k+'</span> = <span class="str">"'+esc(q.v)+'"</span>;</div>';
      h+='<div class="dots">'+COLORS.map(function(c){return '<button class="dot'+(c[1]===q.v?' on':'')+'" style="background:'+c[1]+'" data-col="'+q.k+'" data-v="'+c[1]+'" aria-label="'+c[0]+'"></button>';}).join('')+'</div>';
    }else{
      h+='<div class="row"><span class="kw">let</span> <span class="nm">'+q.k+'</span> = <button class="st" data-k="'+q.k+'" data-d="-1">−</button><span class="val">'+q.v+'</span><button class="st" data-k="'+q.k+'" data-d="1">+</button>;</div>';
    }
  });
  h+='<div class="ln"> </div>';
  pic.body.forEach(function(l){h+='<div class="ln">'+(hi(l)||' ')+'</div>';});
  $('code').innerHTML=h;
  $('learn').innerHTML='<div class="learn"><b>🧠 What is happening?</b><br>'+esc(pic.learn)+'</div>';
}
function select(i){loadPic(i);renderPicker();renderSheet();fit();rebuild();drawNow();animate();$('sheet').scrollTop=0;}

$('top').addEventListener('click',function(e){var b=e.target.closest('[data-pic]');if(b)select(Number(b.getAttribute('data-pic')));});
$('code').addEventListener('click',function(e){
  var s=e.target.closest('[data-k]'),d=e.target.closest('[data-col]');
  if(s){
    var q=P.filter(function(x){return x.k===s.getAttribute('data-k');})[0];
    var step=q.step||1,nv=q.v+Number(s.getAttribute('data-d'))*step;
    nv=Math.max(q.min,Math.min(q.max,Math.round(nv*100)/100));
    if(nv!==q.v){q.v=nv;renderSheet();rebuild();drawNow();}
  }else if(d){
    var c=P.filter(function(x){return x.k===d.getAttribute('data-col');})[0];
    c.v=d.getAttribute('data-v');renderSheet();rebuild();drawNow();
  }
});
$('bDraw').onclick=function(){rebuild();animate();};
$('bReset').onclick=function(){loadPic(cur);renderSheet();rebuild();drawNow();};
$('bShare').onclick=function(){
  if(!TR)return;
  cancelAnimationFrame(raf);render(Infinity,false);
  var out=document.createElement('canvas'),k=2,w=cv.width,h=cv.height,foot=48*DPR;
  out.width=w;out.height=h+foot;var o=out.getContext('2d');
  o.fillStyle='#fffdf7';o.fillRect(0,0,out.width,out.height);o.drawImage(cv,0,0);
  o.fillStyle='#6c47ff';o.fillRect(0,h,w,foot);
  o.fillStyle='#fff';o.font='bold '+(18*DPR)+'px sans-serif';o.textAlign='center';o.textBaseline='middle';
  o.fillText('🎨 I made this with code on CodingKida!',w/2,h+foot/2);
  var url=out.toDataURL('image/png');
  post({t:'share',png:url.replace(/^data:image\\/png;base64,/,''),name:PICS[cur].name});
};
window.addEventListener('resize',function(){fit();rebuild();drawNow();});
window.__dt={PICS:PICS,runTurtle:runTurtle};
select(0);
post({t:'ready'});
})();
</script></body></html>`;
}
