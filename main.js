// Simple Slither-like single-player clone (no networking).
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

let dpr = Math.max(1, window.devicePixelRatio || 1);
function resize(){
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

// Game state
const state = {
  score: 0,
  running: true,
  speedMultiplier: 4,
};

const uiScore = document.getElementById('score');
const restartBtn = document.getElementById('restartBtn');
const speedRange = document.getElementById('speedRange');

speedRange.addEventListener('input', e => {
  state.speedMultiplier = Number(e.target.value);
});

restartBtn.addEventListener('click', init);

let mouse = {x: window.innerWidth/2, y: window.innerHeight/2};
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('touchmove', e => { if(e.touches[0]){ mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } }, {passive:true});

function rand(min,max){ return Math.random()*(max-min)+min; }

const pelletCount = 160;
const pellets = [];
const snake = { segments: [], dir: 0, speed: 2.4, size: 12 };

function spawnPellets(){
  pellets.length = 0;
  for(let i=0;i<pelletCount;i++){
    pellets.push({
      x: rand(40, window.innerWidth-40),
      y: rand(40, window.innerHeight-40),
      r: rand(3,7),
      hue: Math.floor(rand(0,360)),
    });
  }
}

function init(){
  state.score = 0;
  uiScore.textContent = 'Score: 0';
  snake.segments = [];
  const startLen = 8;
  const cx = window.innerWidth/2, cy = window.innerHeight/2;
  for(let i=0;i<startLen;i++){
    snake.segments.push({x: cx - i*snake.size, y: cy});
  }
  snake.dir = 0;
  snake.speed = 2.4;
  spawnPellets();
  state.running = true;
}
init();

// Helpers
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// Game loop
let last = performance.now();
function step(now){
  const dt = Math.min(40, now - last) / 16.6667; // normalize to 60fps ticks
  last = now;
  update(dt);
  render();
  if(state.running) requestAnimationFrame(step);
}
requestAnimationFrame(step);

function update(dt){
  // head steering toward mouse
  const head = snake.segments[0];
  const angleToMouse = Math.atan2(mouse.y - head.y, mouse.x - head.x);
  // smooth turn
  const turnSpeed = 0.18 * state.speedMultiplier/4;
  const dx = Math.cos(angleToMouse), dy = Math.sin(angleToMouse);
  // move head
  head.x += dx * snake.speed * state.speedMultiplier * dt * 0.6;
  head.y += dy * snake.speed * state.speedMultiplier * dt * 0.6;

  // move body by following previous segment
  for(let i=1;i<snake.segments.length;i++){
    const prev = snake.segments[i-1];
    const cur = snake.segments[i];
    const d = Math.hypot(prev.x-cur.x, prev.y-cur.y);
    if(d > snake.size){
      const t = (d - snake.size)/d;
      cur.x = prev.x - (prev.x - cur.x) * (1 - t);
      cur.y = prev.y - (prev.y - cur.y) * (1 - t);
    }
  }

  // keep head on screen (wrap)
  if(head.x < -20) head.x = window.innerWidth + 20;
  if(head.x > window.innerWidth + 20) head.x = -20;
  if(head.y < -20) head.y = window.innerHeight + 20;
  if(head.y > window.innerHeight + 20) head.y = -20;

  // eat pellets
  for(let i = pellets.length-1; i>=0; i--){
    const p = pellets[i];
    const d = Math.hypot(p.x - head.x, p.y - head.y);
    if(d < p.r + snake.size*0.6){
      // eat
      pellets.splice(i,1);
      state.score += Math.round(p.r);
      uiScore.textContent = 'Score: ' + state.score;
      // grow by adding segments at tail
      const tail = snake.segments[snake.segments.length-1];
      for(let k=0;k<Math.ceil(p.r/2);k++){
        snake.segments.push({x: tail.x - Math.random()*2, y: tail.y - Math.random()*2});
      }
      // spawn a new pellet
      pellets.push({x: rand(20, window.innerWidth-20), y: rand(20, window.innerHeight-20), r: rand(3,7), hue: Math.floor(rand(0,360))});
    }
  }

  // self-collision: if head hits any segment after some initial safe length
  for(let i=6;i<snake.segments.length;i++){
    const s = snake.segments[i];
    if(Math.hypot(s.x - head.x, s.y - head.y) < snake.size*0.75){
      // cut tail from collision point and spawn pellets from cut pieces
      const removed = snake.segments.splice(i);
      // convert removed segments to pellets
      for(let j=0;j<removed.length;j++){
        const seg = removed[j];
        pellets.push({x: seg.x + rand(-10,10), y: seg.y + rand(-10,10), r: rand(3,7), hue: Math.floor(rand(0,360))});
      }
      // small score penalty
      state.score = Math.max(0, state.score - Math.floor(removed.length/2));
      uiScore.textContent = 'Score: ' + state.score;
      break;
    }
  }

  // slow automatic shrinking if extremely long
  if(snake.segments.length > 200 && Math.random() < 0.02 * dt){
    snake.segments.pop();
  }
}

function render(){
  // background
  ctx.fillStyle = '#07101a';
  ctx.fillRect(0,0,canvas.width/dpr, canvas.height/dpr);

  // draw pellets
  for(const p of pellets){
    ctx.beginPath();
    ctx.fillStyle = `hsl(${p.hue} 70% 60%)`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  }

  // draw snake segments (tail to head for nicer blending)
  for(let i = snake.segments.length-1; i>=0; i--){
    const s = snake.segments[i];
    const t = i / Math.max(1, snake.segments.length-1);
    const size = snake.size * (1 - 0.5 * Math.pow(t, 1.2));
    ctx.beginPath();
    const hue = Math.floor(120 + 120 * (1 - t));
    ctx.fillStyle = `hsl(${hue} 60% ${30 + 40*(1-t)}%)`;
    ctx.arc(s.x, s.y, size, 0, Math.PI*2);
    ctx.fill();
    // outline
    ctx.lineWidth = Math.max(1, 2 * (1 - t));
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }

  // head glow
  const head = snake.segments[0];
  ctx.beginPath();
  ctx.arc(head.x, head.y, snake.size*1.1, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 6;
  ctx.stroke();
}

// initialize snake segments positions if empty
if(snake.segments.length === 0) {
  const cx = window.innerWidth/2, cy = window.innerHeight/2;
  for(let i=0;i<10;i++) snake.segments.push({x: cx - i*snake.size, y: cy});
}

// simple touch to restart
window.addEventListener('keydown', e => {
  if(e.key === 'r') init();
});
