// Advanced Pong — Clean visuals, mouse + arrow controls, CPU paddle, sounds, effects
(() => {
  const canvas = document.getElementById('gameCanvas');
  const playerScoreEl = document.getElementById('playerScore');
  const cpuScoreEl = document.getElementById('cpuScore');
  const ctx = canvas.getContext('2d', { alpha: false });

  // Hi-DPI support
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Game constants
  const WIDTH = () => canvas.clientWidth;
  const HEIGHT = () => canvas.clientHeight;
  const PADDING = 24;
  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = Math.max(80, HEIGHT() * 0.14);
  const BALL_RADIUS = 8;
  const MAX_SCORE = 11;

  // Game state
  let playerScore = 0;
  let cpuScore = 0;
  let running = true;
  let paused = false;

  // Input state
  const keys = { ArrowUp: false, ArrowDown: false };
  let mouseY = null;

  // Audio: simple beep & pop using WebAudio
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq = 330, duration = 0.06, type = 'sine', gain = 0.06) {
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.stop(now + duration + 0.02);
  }

  // Helper: clamp
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Trail & particles
  const trails = [];
  const particles = [];

  class Paddle {
    constructor(x, isLeft = true) {
      this.x = x;
      this.isLeft = isLeft;
      this.width = PADDLE_WIDTH;
      this.height = PADDLE_HEIGHT;
      this.y = (HEIGHT() - this.height) / 2;
      this.speed = 6;
      this.targetY = this.y;
    }
    update(dt) {
      // Smooth movement toward targetY
      const dy = this.targetY - this.y;
      this.y += dy * clamp(0.12 * dt, 0, 1);
      // clamp
      this.y = clamp(this.y, PADDING, HEIGHT() - PADDING - this.height);
    }
    draw(ctx) {
      // glow rect
      const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
      grad.addColorStop(0, 'rgba(102,160,255,0.08)');
      grad.addColorStop(1, 'rgba(80,227,194,0.06)');
      ctx.fillStyle = grad;
      roundRect(ctx, this.x, this.y, this.width, this.height, 6);
      ctx.fill();
      // inner accent
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, this.x + 2, this.y + 2, this.width - 4, this.height - 4, 4);
      ctx.fill();
    }
  }

  class Ball {
    constructor() {
      this.reset(true);
      this.trail = [];
    }
    reset(toRight = Math.random() < 0.5) {
      this.x = WIDTH() / 2;
      this.y = HEIGHT() / 2;
      const speed = 6 + Math.random() * 2;
      const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // slight angle
      this.vx = toRight ? speed * Math.cos(angle) : -speed * Math.cos(angle);
      this.vy = speed * Math.sin(angle);
      this.radius = BALL_RADIUS;
      this.speed = speed;
      this.trail = [];
    }
    update(dt, paddles) {
      this.x += this.vx * (dt);
      this.y += this.vy * (dt);

      // Wall collisions (top/bottom)
      if (this.y - this.radius <= PADDING) {
        this.y = PADDING + this.radius;
        this.vy *= -1;
        beep(420, 0.045, 'sine', 0.02);
        createWallParticles(this.x, this.y);
      } else if (this.y + this.radius >= HEIGHT() - PADDING) {
        this.y = HEIGHT() - PADDING - this.radius;
        this.vy *= -1;
        beep(420, 0.045, 'sine', 0.02);
        createWallParticles(this.x, this.y);
      }

      // Paddle collisions
      for (let p of paddles) {
        if (this.collidesWithPaddle(p)) {
          // compute relative intersection
          const intersectY = (this.y - (p.y + p.height / 2));
          const normalized = intersectY / (p.height / 2);
          const bounceAngle = normalized * (Math.PI / 3); // max 60deg

          const direction = p.isLeft ? 1 : -1;
          const speedIncrease = 1.08;
          this.speed = Math.min(18, this.speed * speedIncrease);
          this.vx = direction * this.speed * Math.cos(bounceAngle);
          this.vy = this.speed * Math.sin(bounceAngle);

          // nudge ball out of paddle to avoid sticking
          if (p.isLeft) this.x = p.x + p.width + this.radius + 0.5;
          else this.x = p.x - this.radius - 0.5;

          // sound & particles
          beep(880 - Math.abs(normalized) * 280, 0.06, 'square', 0.06);
          createPaddleParticles(this.x, this.y, normalized, p.isLeft);

          break;
        }
      }

      // append to trail
      this.trail.push({ x: this.x, y: this.y, r: this.radius, alpha: 0.5 });
      if (this.trail.length > 18) this.trail.shift();
    }

    collidesWithPaddle(p) {
      // AABB vs circle
      const closestX = clamp(this.x, p.x, p.x + p.width);
      const closestY = clamp(this.y, p.y, p.y + p.height);
      const dx = this.x - closestX;
      const dy = this.y - closestY;
      return (dx * dx + dy * dy) <= (this.radius * this.radius);
    }

    draw(ctx) {
      // draw trail
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const alpha = (i / this.trail.length) * 0.35;
        ctx.beginPath();
        ctx.fillStyle = `rgba(80,227,194,${alpha})`;
        ctx.arc(t.x, t.y, t.r + i * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // core ball
      const g = ctx.createRadialGradient(this.x - 3, this.y - 3, this.radius * 0.1, this.x, this.y, this.radius);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, 'rgba(102,160,255,0.4)');
      g.addColorStop(1, 'rgba(80,227,194,0.9)');

      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // subtle outer glow
      ctx.beginPath();
      ctx.fillStyle = 'rgba(80,227,194,0.06)';
      ctx.arc(this.x, this.y, this.radius * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Utility - rounded rect draw
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // Particles for hits & walls
  function createPaddleParticles(x, y, norm, left) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * (left ? 2 : -2),
        vy: (Math.random() * 2 - 1) * 2 + norm * 4,
        life: 60 + Math.random() * 30,
        color: `rgba(${80 + Math.random() * 40}, ${200 + Math.random() * 55}, ${180 + Math.random() * 40}, 0.95)`,
        size: 1 + Math.random() * 2
      });
    }
  }
  function createWallParticles(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * 4,
        vy: (Math.random() * 2 - 1) * 2,
        life: 40 + Math.random() * 30,
        color: `rgba(150,200,255,0.9)`,
        size: 1 + Math.random() * 2
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity-like
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles(ctx) {
    for (let p of particles) {
      ctx.beginPath();
      ctx.fillStyle = p.color.replace('0.9', Math.max(0.05, p.life / 120).toFixed(2));
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Game objects
  let leftPaddle = new Paddle(PADDING, true);
  let rightPaddle = new Paddle(() => WIDTH() - PADDING - PADDLE_WIDTH, false);
  // fix paddle X after resize
  function updatePaddlesX() {
    leftPaddle.x = PADDING;
    rightPaddle.x = WIDTH() - PADDING - PADDLE_WIDTH;
  }
  updatePaddlesX();

  let ball = new Ball();

  // CPU AI
  function updateAI(dt) {
    // CPU tracks the ball with some lag and max speed
    const target = ball.y - rightPaddle.height / 2;
    // move towards target but limit speed
    const diff = target - rightPaddle.y;
    const maxStep = 4.6 * dt;
    rightPaddle.targetY = rightPaddle.y + clamp(diff, -maxStep, maxStep);
  }

  // Input handlers
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      paused = !paused;
      if (!paused) audioCtx.resume();
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      keys[e.key] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      keys[e.key] = false;
    }
  });

  // Mouse control: move paddle based on y relative to canvas
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top;
  });
  // Click to serve if paused or after score
  canvas.addEventListener('click', (e) => {
    audioCtx.resume();
    if (!running) {
      // reset full game
      playerScore = 0;
      cpuScore = 0;
      playerScoreEl.textContent = playerScore;
      cpuScoreEl.textContent = cpuScore;
      running = true;
    }
    if (paused) paused = false;
    // if ball near center and stopped, serve toward mouse side
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    ball.reset(clickX > WIDTH() / 2);
  });

  // Game loop
  let last = performance.now();
  function loop(now) {
    const dtms = Math.min(40, now - last);
    const dt = dtms / (1000 / 60); // normalized to 60fps steps
    last = now;

    if (!paused && running) {
      // Input: keyboard moves left paddle
      const kbSpeed = 6;
      if (keys.ArrowUp) leftPaddle.targetY -= kbSpeed * dt;
      if (keys.ArrowDown) leftPaddle.targetY += kbSpeed * dt;

      // Mouse moves override target to a degree
      if (mouseY !== null) {
        const rect = canvas.getBoundingClientRect();
        // mouseY is in CSS pixels; convert directly to target center
        const desired = mouseY - leftPaddle.height / 2;
        // blend keyboard and mouse: mouse sets stronger target
        leftPaddle.targetY = leftPaddle.targetY * 0.08 + desired * 0.92;
      }

      // Update AI
      updateAI(dt);

      // Update objects
      leftPaddle.update(dt);
      rightPaddle.update(dt);
      ball.update(dt, [leftPaddle, rightPaddle]);
      updateParticles();

      // Score conditions
      if (ball.x < -40) {
        // CPU scores
        cpuScore++;
        cpuScoreEl.textContent = cpuScore;
        beep(120, 0.18, 'sine', 0.08);
        if (cpuScore >= MAX_SCORE) {
          running = false;
          paused = true;
        }
        ball.reset(true);
      } else if (ball.x > WIDTH() + 40) {
        // Player scores
        playerScore++;
        playerScoreEl.textContent = playerScore;
        beep(420, 0.18, 'sine', 0.08);
        if (playerScore >= MAX_SCORE) {
          running = false;
          paused = true;
        }
        ball.reset(false);
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  function drawField(ctx) {
    // background already set via CSS; draw side paddings
    ctx.clearRect(0, 0, WIDTH(), HEIGHT());

    // subtle border lines (top / bottom)
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, WIDTH(), PADDING);
    ctx.fillRect(0, HEIGHT() - PADDING, WIDTH(), PADDING);

    // dotted center line
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const dashH = 12;
    const gap = 10;
    const cx = WIDTH() / 2 - 1;
    for (let y = PADDING + 12; y < HEIGHT() - PADDING - 12; y += dashH + gap) {
      ctx.fillRect(cx, y, 2, dashH);
    }
    ctx.restore();
  }

  function draw() {
    drawField(ctx);

    // draw trail backgrounds (glows)
    // paddles
    leftPaddle.draw(ctx);
    rightPaddle.draw(ctx);

    // ball and effects
    drawParticles(ctx);
    ball.draw(ctx);

    // small HUD overlays (paused or end)
    if (paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(2,6,10,0.6)';
      ctx.fillRect(WIDTH() / 2 - 170, HEIGHT() / 2 - 48, 340, 96);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '18px Inter, Arial';
      ctx.textAlign = 'center';
      if (!running) {
        ctx.fillText('Game Over', WIDTH() / 2, HEIGHT() / 2 - 4);
        ctx.font = '14px Inter, Arial';
        ctx.fillText('Click to restart', WIDTH() / 2, HEIGHT() / 2 + 18);
      } else {
        ctx.fillText('Paused', WIDTH() / 2, HEIGHT() / 2 - 4);
        ctx.font = '14px Inter, Arial';
        ctx.fillText('Press Space to resume • Click to serve', WIDTH() / 2, HEIGHT() / 2 + 18);
      }
      ctx.restore();
    }
  }

  // Kick off
  requestAnimationFrame(loop);

  // Ensure responsive paddle sizes and positions on load & resize
  function reflow() {
    resizeCanvas();
    updatePaddlesX();
    leftPaddle.height = Math.max(60, HEIGHT() * 0.14);
    rightPaddle.height = leftPaddle.height;
    leftPaddle.y = clamp(leftPaddle.y, PADDING, HEIGHT() - PADDING - leftPaddle.height);
    rightPaddle.y = clamp(rightPaddle.y, PADDING, HEIGHT() - PADDING - rightPaddle.height);
    ball.x = WIDTH() / 2;
    ball.y = HEIGHT() / 2;
  }
  window.addEventListener('resize', reflow);

  // initial focus for keyboard
  canvas.focus();

  // Expose small API on window for debugging (optional)
  window.__pong = { canvas, leftPaddle, rightPaddle, ball, play: () => (paused = false) };

})();
