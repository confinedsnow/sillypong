// Fullscreen Pong with animated ball, ping-pong racket, mouse + arrow keys, CPU, particles and scoreboard.

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const playerScoreEl = document.getElementById('playerScore');
  const cpuScoreEl = document.getElementById('cpuScore');
  const centerMsg = document.getElementById('centerMsg');

  // DPR & resize
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(window.innerWidth, 300);
    const h = Math.max(window.innerHeight, 200);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeSizes();
    // clamp paddles if needed
    leftPaddle.y = clamp(leftPaddle.y, PADDING, H() - PADDING - leftPaddle.headR * 2);
    rightPaddle.y = clamp(rightPaddle.y, PADDING, H() - PADDING - rightPaddle.headR * 2);
  }
  window.addEventListener('resize', resize);

  function W() { return canvas.clientWidth; }
  function H() { return canvas.clientHeight; }

  // Basic helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a,b) => a + Math.random() * (b - a);

  // Game params
  let PADDING = 24;
  let BALL_RADIUS = 8;
  let MAX_SCORE = 11;

  function computeSizes() {
    PADDING = Math.max(12, H() * 0.04);
    const headR = Math.max(26, H() * 0.06);
    leftPaddle.headR = headR;
    leftPaddle.handleW = Math.max(14, headR * 0.45);
    leftPaddle.handleL = headR * 1.1;
    rightPaddle.headR = headR;
    rightPaddle.handleW = leftPaddle.handleW;
    rightPaddle.handleL = leftPaddle.handleL;
    BALL_RADIUS = Math.max(6, Math.min(14, H() * 0.02));
  }

  // Particle system
  const particles = [];

  function spawnParticles(x,y,color,count=10) {
    for (let i=0;i<count;i++){
      particles.push({
        x, y,
        vx: rand(-3,3),
        vy: rand(-2,2),
        life: rand(30,80),
        size: rand(1,3),
        color
      });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life--;
      if (p.life <= 0) particles.splice(i,1);
    }
  }
  function drawParticles(ctx) {
    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 80);
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Paddle (racket) class - head = circle, handle = rect
  class Paddle {
    constructor(isLeft=true) {
      this.isLeft = isLeft;
      this.headR = 32;
      this.handleW = 16;
      this.handleL = 36;
      this.x = isLeft ? PADDING + this.headR : W() - PADDING - this.headR;
      this.y = (H() - this.headR*2) / 2;
      this.targetY = this.y;
      this.speed = 8;
    }
    update(dt) {
      // smooth towards target
      const dy = this.targetY - this.y;
      this.y += dy * clamp(0.12 * dt, 0, 1);
      // clamp
      this.y = clamp(this.y, PADDING, H() - PADDING - this.headR*2);
    }
    center() { return { x: this.x, y: this.y + this.headR }; }
    draw(ctx) {
      // head circle
      const head = this.center();
      ctx.save();
      // subtle glow
      ctx.beginPath();
      ctx.fillStyle = 'rgba(80,227,194,0.06)';
      ctx.arc(head.x, head.y, this.headR*1.6, 0, Math.PI*2);
      ctx.fill();

      // handle rect (slightly rotated/rounded)
      const hw = this.handleW;
      const hl = this.handleL;
      const handleX = this.isLeft ? head.x + this.headR*0.25 : head.x - this.headR*0.25 - hw;
      const handleY = head.y - hw/2;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, handleX + 2, handleY + 4, hw, hl, hw*0.5);
      ctx.fill();

      // handle main
      const grad = ctx.createLinearGradient(handleX, handleY, handleX + hw, handleY + hl);
      grad.addColorStop(0, 'rgba(200,200,200,0.06)');
      grad.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = grad;
      roundRect(ctx, handleX, handleY, hw, hl, hw*0.5);
      ctx.fill();

      // head
      const g = ctx.createRadialGradient(head.x - 6, head.y - 6, this.headR*0.15, head.x, head.y, this.headR);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, 'rgba(102,160,255,0.25)');
      g.addColorStop(1, 'rgba(80,227,194,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(head.x, head.y, this.headR, 0, Math.PI*2);
      ctx.fill();

      // rim
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.arc(head.x, head.y, this.headR - 1.5, 0, Math.PI*2);
      ctx.stroke();

      ctx.restore();
    }
  }

  function roundRect(ctx,x,y,w,h,r) {
    const radius = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // Ball class
  class Ball {
    constructor() {
      this.reset(true);
      this.trail = [];
    }
    reset(toRight=true) {
      this.x = W()/2;
      this.y = H()/2;
      const base = Math.max(5.5, H()/160);
      this.speed = base + Math.random()*1.6;
      const angle = rand(-Math.PI/8, Math.PI/8);
      this.vx = (toRight ? 1 : -1) * this.speed * Math.cos(angle);
      this.vy = this.speed * Math.sin(angle);
      this.r = BALL_RADIUS;
      this.trail = [];
    }
    update(dt, paddles) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // top/bottom walls
      if (this.y - this.r <= PADDING) {
        this.y = PADDING + this.r;
        this.vy *= -1;
        spawnParticles(this.x, this.y, 'rgba(150,200,255,0.9)', 8);
      } else if (this.y + this.r >= H() - PADDING) {
        this.y = H() - PADDING - this.r;
        this.vy *= -1;
        spawnParticles(this.x, this.y, 'rgba(150,200,255,0.9)', 8);
      }

      // paddle collisions
      for (const p of paddles) {
        // head collision (circle)
        const head = p.center();
        const dx = this.x - head.x;
        const dy = this.y - head.y;
        const dist2 = dx*dx + dy*dy;
        const rsum = this.r + p.headR;
        if (dist2 <= rsum * rsum) {
          const dist = Math.sqrt(dist2) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;
          // reflect velocity
          const dot = this.vx * nx + this.vy * ny;
          this.vx = this.vx - 2 * dot * nx;
          this.vy = this.vy - 2 * dot * ny;
          // speed up a bit
          this.speed = Math.min(22, Math.hypot(this.vx, this.vy) * 1.06);
          const velNorm = Math.hypot(this.vx, this.vy);
          this.vx = (this.vx / velNorm) * this.speed;
          this.vy = (this.vy / velNorm) * this.speed;
          // push out
          const overlap = rsum - dist + 0.5;
          this.x += nx * overlap;
          this.y += ny * overlap;
          spawnParticles(this.x, this.y, 'rgba(80,227,194,0.95)', 14);
          break;
        }

        // handle collision (AABB vs circle)
        const handleX = p.isLeft ? head.x + p.headR*0.25 : head.x - p.headR*0.25 - p.handleW;
        const handleY = head.y - p.handleW/2;
        const hx = handleX, hy = handleY, hw = p.handleW, hl = p.handleL;
        // closest point
        const closestX = clamp(this.x, hx, hx + hw);
        const closestY = clamp(this.y, hy, hy + hl);
        const ddx = this.x - closestX;
        const ddy = this.y - closestY;
        if (ddx*ddx + ddy*ddy <= this.r*this.r) {
          // reflect based on side hit
          // simple normal from closest point to ball
          const dist = Math.sqrt(ddx*ddx + ddy*ddy) || 0.001;
          const nx = ddx / dist;
          const ny = ddy / dist;
          const dot = this.vx * nx + this.vy * ny;
          this.vx = this.vx - 2 * dot * nx;
          this.vy = this.vy - 2 * dot * ny;
          // speed up
          this.speed = Math.min(22, Math.hypot(this.vx, this.vy) * 1.04);
          const velNorm = Math.hypot(this.vx, this.vy);
          this.vx = (this.vx / velNorm) * this.speed;
          this.vy = (this.vy / velNorm) * this.speed;
          spawnParticles(this.x, this.y, 'rgba(200,180,160,0.95)', 8);
          break;
        }
      }

      // trail
      this.trail.push({x:this.x,y:this.y,a:1});
      if (this.trail.length > 18) this.trail.shift();
    }

    draw(ctx) {
      // trail
      for (let i = 0; i < this.trail.length; i++){
        const t = this.trail[i];
        ctx.beginPath();
        ctx.fillStyle = `rgba(80,227,194,${(i/this.trail.length)*0.35})`;
        ctx.arc(t.x, t.y, this.r + i*0.4, 0, Math.PI*2);
        ctx.fill();
      }
      // ball core
      const g = ctx.createRadialGradient(this.x - 3, this.y - 3, this.r*0.15, this.x, this.y, this.r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, 'rgba(102,160,255,0.25)');
      g.addColorStop(1, 'rgba(80,227,194,0.95)');
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fill();

      // outer glow
      ctx.beginPath();
      ctx.fillStyle = 'rgba(80,227,194,0.06)';
      ctx.arc(this.x, this.y, this.r*2.6, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Game objects
  const leftPaddle = new Paddle(true);
  const rightPaddle = new Paddle(false);
  function resetPaddles() {
    leftPaddle.x = PADDING + leftPaddle.headR;
    rightPaddle.x = W() - PADDING - rightPaddle.headR;
    leftPaddle.y = (H() - leftPaddle.headR*2)/2;
    rightPaddle.y = (H() - rightPaddle.headR*2)/2;
    leftPaddle.targetY = leftPaddle.y;
    rightPaddle.targetY = rightPaddle.y;
  }

  let ball = new Ball();

  // input
  const keys = { ArrowUp:false, ArrowDown:false };
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      paused = !paused;
      if (!paused) centerMsg.style.opacity = '0';
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') keys[e.code] = true;
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') keys[e.code] = false;
  });
  // mouse
  let mouseY = null;
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('click', e => {
    if (!running) {
      playerScore = 0; cpuScore = 0;
      playerScoreEl.textContent = playerScore;
      cpuScoreEl.textContent = cpuScore;
      running = true;
    }
    if (paused) paused = false;
    centerMsg.style.opacity = '0';
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    ball.reset(clickX > W()/2);
  });

  // simple beep using WebAudio
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq=440, t=0.05, type='sine', vol=0.04){
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    o.stop(now + t + 0.02);
  }

  // AI
  function updateAI(dt) {
    // basic tracking with clamped speed
    const target = ball.y - rightPaddle.headR;
    const diff = target - rightPaddle.y;
    const maxStep = 3.6 * dt;
    rightPaddle.targetY = rightPaddle.y + clamp(diff, -maxStep, maxStep);
  }

  // scoring
  let playerScore = 0;
  let cpuScore = 0;
  let running = true;
  let paused = false;

  // main loop
  let last = performance.now();
  function loop(now) {
    const dtms = Math.min(40, now - last);
    const dt = dtms / (1000/60);
    last = now;

    if (!paused && running) {
      // input keyboard
      const kbSpeed = 6;
      if (keys.ArrowUp) leftPaddle.targetY -= kbSpeed * dt;
      if (keys.ArrowDown) leftPaddle.targetY += kbSpeed * dt;
      // mouse moves stronger
      if (mouseY !== null) {
        const desired = mouseY - leftPaddle.headR;
        leftPaddle.targetY = leftPaddle.targetY * 0.08 + desired * 0.92;
      }

      // update
      leftPaddle.update(dt);
      updateAI(dt);
      rightPaddle.update(dt);
      ball.update(dt, [leftPaddle, rightPaddle]);
      updateParticles();

      // score checks
      if (ball.x < -60) {
        cpuScore++;
        cpuScoreEl.textContent = cpuScore;
        spawnParticles(ball.x + 60, ball.y, 'rgba(255,100,120,0.9)', 24);
        beep(120,0.12,'sine',0.08);
        if (cpuScore >= MAX_SCORE) {
          running = false; paused = true;
          centerMsg.textContent = 'CPU Wins — Click to Restart';
          centerMsg.style.opacity = '1';
        } else {
          ball.reset(true);
          paused = true;
          centerMsg.textContent = 'Click to serve';
          centerMsg.style.opacity = '1';
        }
      } else if (ball.x > W() + 60) {
        playerScore++;
        playerScoreEl.textContent = playerScore;
        spawnParticles(ball.x - 60, ball.y, 'rgba(100,255,160,0.95)', 24);
        beep(420,0.12,'sine',0.08);
        if (playerScore >= MAX_SCORE) {
          running = false; paused = true;
          centerMsg.textContent = 'You Win! — Click to Restart';
          centerMsg.style.opacity = '1';
        } else {
          ball.reset(false);
          paused = true;
          centerMsg.textContent = 'Click to serve';
          centerMsg.style.opacity = '1';
        }
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  function drawField(ctx) {
    ctx.clearRect(0,0,W(),H());
    // top/bottom padding bands
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0,0,W(),PADDING);
    ctx.fillRect(0,H()-PADDING,W(),PADDING);

    // center dashed line
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const dashH = Math.max(10, H()*0.02);
    const gap = dashH * 0.6;
    const cx = W()/2 - 1;
    for (let y = PADDING + 12; y < H() - PADDING - 12; y += dashH + gap) {
      ctx.fillRect(cx, y, 2, dashH);
    }
    ctx.restore();
  }

  function draw() {
    drawField(ctx);
    // paddles
    leftPaddle.draw(ctx);
    rightPaddle.draw(ctx);
    // particles
    drawParticles(ctx);
    // ball
    ball.draw(ctx);

    // paused overlay on canvas (light)
    if (paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(2,6,10,0.45)';
      ctx.fillRect(W()/2 - 180, H()/2 - 48, 360, 96);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '18px Inter, Arial';
      ctx.textAlign = 'center';
      if (!running) {
        ctx.fillText('Game Over', W()/2, H()/2 - 4);
        ctx.font = '14px Inter, Arial';
        ctx.fillText('Click to restart', W()/2, H()/2 + 18);
      } else {
        ctx.fillText('Paused', W()/2, H()/2 - 4);
        ctx.font = '14px Inter, Arial';
        ctx.fillText('Press Space to resume • Click to serve', W()/2, H()/2 + 18);
      }
      ctx.restore();
    }
  }

  // init
  resize();
  resetPaddles();
  ball.reset(true);
  playerScore = 0; cpuScore = 0;
  playerScoreEl.textContent = playerScore;
  cpuScoreEl.textContent = cpuScore;
  centerMsg.style.opacity = '1';

  // ensure canvas can receive keyboard
  canvas.setAttribute('tabindex', '0');
  canvas.focus();

  requestAnimationFrame(loop);

  // expose for debugging (optional)
  window.__pong = { canvas, leftPaddle, rightPaddle, ball };
})();
