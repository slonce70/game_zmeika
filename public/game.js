import { LeaderboardManager } from "./leaderboardManager.js";
import { ScoreManager } from "./scoreManager.js";
import { Snake } from "./snake.js";
import { Food } from "./food.js";
import { BonusFood } from "./bonusFood.js";
import { ParticleSystem } from "./particles.js";
import { OnlinePlayersManager } from "./onlinePlayersManager.js";
import { i18n } from "./i18n.js";

class Game {
  constructor() {
    this.leaderboardManager = new LeaderboardManager();
    this.onlinePlayersManager = new OnlinePlayersManager();
    
    
    // Initialize modals
    this.initializeModals();
    
    // Show login modal
    this.showLoginModal();

    // Cleanup when leaving the page
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Re-apply UI on language change
    i18n.onChange(() => {
      this.leaderboardManager.updateLeaderboardDisplay();
      if (this.pauseLayer) this.pauseLayer.innerHTML = `<div class=\"pause-text\">${i18n.t('paused')}</div>`;
    });
  }

  initializeModals() {
    // Login handlers
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      if (username) {
        this.leaderboardManager.setUsername(username);
        this.leaderboardManager.markPlayerOnline(username);
        this.onlinePlayersManager.setCurrentPlayer(username);
        document.getElementById('loginModal').style.display = 'none';
        this.initializeGame();
      }
    });

    // Leaderboard modal handlers
    const leaderboardBtn = document.querySelector('.leaderboard-btn');
    const closeLeaderboardBtn = document.getElementById('closeLeaderboard');
    const leaderboardModal = document.getElementById('leaderboardModal');
    const highScoreModal = document.getElementById('highScoreModal');
    const closeHighScoreBtn = document.getElementById('closeHighScore');

    leaderboardBtn.addEventListener('click', () => {
      this.showLeaderboard();
      this.isPaused = true;
    });

    closeLeaderboardBtn.addEventListener('click', () => {
      leaderboardModal.style.display = 'none';
      this.isPaused = false;
      requestAnimationFrame(this.gameLoop);
    });

    if (closeHighScoreBtn) {
      closeHighScoreBtn.addEventListener('click', () => {
        highScoreModal.style.display = 'none';
        this.handleRestart();
      });
    }
  }

  showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    loginModal.style.display = 'flex';
    document.getElementById('username').focus();
  }

  async showLeaderboard() {
    const leaderboardModal = document.getElementById('leaderboardModal');
    const leaderboardBody = document.getElementById('leaderboardBody');
    leaderboardBody.innerHTML = '';

    const scores = this.leaderboardManager.leaderboard;
    if (!Array.isArray(scores)) return;

    scores.forEach((score, index) => {
      const row = document.createElement('tr');
      if (score.username === this.leaderboardManager.currentPlayerName) {
        row.classList.add('current-player');
      }

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${this.escapeHtml(score.username)}</td>
        <td>${score.score || 0}</td>
        <td>${this.leaderboardManager.formatDate(score.date, i18n.lang)}</td>
      `;
      leaderboardBody.appendChild(row);
    });

    leaderboardModal.style.display = 'flex';
  }

  initializeGame() {
    // Create canvas and set its size
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 600;
    this.canvas.height = 400;
    document.querySelector('.canvas-container').appendChild(this.canvas);

    this.gridSize = 20;
    this.isPaused = false;
    
    // Create game objects
    this.snake = new Snake();
    this.food = new Food(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
    this.bonusFood = new BonusFood(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
    this.scoreManager = new ScoreManager();
    this.particles = new ParticleSystem();

    // Bind methods
    this.gameLoop = this.gameLoop.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleRestart = this.handleRestart.bind(this);
    
    // Add input events
    document.addEventListener('keydown', this.handleInput);
    document.querySelector('.restart-btn').addEventListener('click', this.handleRestart);

    this.lastTime = 0;
    this.interval = 200; // update interval in ms
    this.accumulator = 0;
    this._lastFrameTs = 0;

    // Intro animation (respect reduced motion)
    if (!this.shouldReduceMotion()) {
      gsap.from(this.canvas, {
        duration: 0.5,
        opacity: 0,
        scale: 0.9,
        ease: "back.out"
      });
    }

    // Add touch/mouse handlers for mobile controls
    const mobileControls = document.querySelector('.mobile-controls');
    if (mobileControls) {
      const buttons = mobileControls.querySelectorAll('.control-btn');
      buttons.forEach(button => {
        ['touchstart', 'mousedown'].forEach(eventType => {
          button.addEventListener(eventType, (e) => {
            e.preventDefault();
            const direction = button.dataset.direction;
            if (direction) {
              this.handleMobileControl(direction);
            }
          });
        });
      });
    }

    // Add swipe controls on canvas
    this.addSwipeControls();

    // Apply user options
    this.setupOptions();

    // Try to keep screen awake on mobile
    this.requestWakeLock();

    // Create DOM overlay for floating texts and pause
    this.overlay = document.createElement('div');
    this.overlay.className = 'canvas-overlay';
    this.overlay.style.position = 'absolute';
    this.overlay.style.left = '0';
    this.overlay.style.top = '0';
    this.overlay.style.right = '0';
    this.overlay.style.bottom = '0';
    this.overlay.style.pointerEvents = 'none';
    const container = document.querySelector('.canvas-container');
    container.style.position = 'relative';
    container.appendChild(this.overlay);

    this.pauseLayer = document.createElement('div');
    this.pauseLayer.className = 'pause-overlay';
    this.pauseLayer.style.display = 'none';
    this.pauseLayer.innerHTML = `<div class="pause-text">${i18n.t('paused')}</div>`;
    this.overlay.appendChild(this.pauseLayer);

    this.scheduleBonus();
    requestAnimationFrame(this.gameLoop);
    this.drawGrid();
    // Mark player as playing now (presence)
    this.onlinePlayersManager.updatePlayerStatus(true);
  }

  drawGrid() {
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.lineWidth = 0.5;

    for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  gameLoop(timestamp) {
    if (this.isPaused) return;
    
    if (!this.lastTime) this.lastTime = timestamp;
    const delta = timestamp - this.lastTime;
    this.accumulator += delta;
    const frameDelta = timestamp - (this._lastFrameTs || timestamp);
    this._lastFrameTs = timestamp;

    if (this.accumulator >= this.interval) {
      this.update();
      this.accumulator = 0;
    }
    
    // Update particles every frame
    this.particles.update(frameDelta);
    this.draw();
    this.lastTime = timestamp;
    requestAnimationFrame(this.gameLoop);
  }

  update() {
    if (this.isPaused) return;
    
    this.snake.update();
    
    // Check if snake ate normal food
    if (this.snake.body[0].x === this.food.position.x && this.snake.body[0].y === this.food.position.y) {
      this.snake.grow();
      this.scoreManager.incrementScore();
      this.food.respawn(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
      
      // Score/UI effects
      const scoreElement = document.querySelector('.score-value');
      scoreElement.textContent = this.scoreManager.score;
      scoreElement.classList.remove('score-update');
      void scoreElement.offsetWidth;
      scoreElement.classList.add('score-update');
      
      // Increase speed as score grows
      this.interval = Math.max(80, 200 - this.scoreManager.score * 5);

      // Effects: vibration, particles, floating text
      if (this.vibrationEnabled && navigator.vibrate) navigator.vibrate(10);
      this.spawnEatParticles('#ff5555');
      this.showFloatingText('+1', '#ff8888');
    }

    // Check bonus food
    if (this.bonusFood.active &&
        this.snake.body[0].x === this.bonusFood.position.x && this.snake.body[0].y === this.bonusFood.position.y) {
      // Growth and points
      for (let i = 0; i < 5; i++) this.snake.grow();
      this.scoreManager.score += 5;
      this.updateScoreUI();
      this.bonusFood.active = false;
      if (this.vibrationEnabled && navigator.vibrate) navigator.vibrate([20, 40, 20]);
      this.spawnEatParticles('#ffd700');
      this.showFloatingText('+5', '#ffd700');
      // Temporary slow-down for 2s
      const baseInterval = Math.max(80, 200 - this.scoreManager.score * 5);
      this.interval = baseInterval + 80;
      clearTimeout(this._slowResetTimer);
      this._slowResetTimer = setTimeout(() => {
        this.interval = Math.max(80, 200 - this.scoreManager.score * 5);
      }, 2000);
    }
    
    // Collision checks
    const head = this.snake.body[0];
    if (head.x < 0 || head.x * this.gridSize >= this.canvas.width || 
        head.y < 0 || head.y * this.gridSize >= this.canvas.height || 
        this.snake.checkSelfCollision()) {
      this.gameOver();
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    this.food.draw(this.ctx, this.gridSize);
    this.bonusFood.maybeExpire(performance.now());
    this.bonusFood.draw(this.ctx, this.gridSize);
    this.snake.draw(this.ctx, this.gridSize);
    this.particles.draw(this.ctx);
  }

  handleInput(e) {
    if (e.key === ' ') {
      this.isPaused = !this.isPaused;
      if (this.pauseLayer) this.pauseLayer.style.display = this.isPaused ? 'flex' : 'none';
      if (!this.isPaused) requestAnimationFrame(this.gameLoop);
      return;
    }
    
    const key = e.key.replace('Arrow', '').toLowerCase();
    const directions = {
      right: ['up', 'down'],
      left: ['up', 'down'],
      up: ['left', 'right'],
      down: ['left', 'right']
    };
    
    if (directions[this.snake.direction] && directions[this.snake.direction].includes(key)) {
      this.snake.newDirection = key;
    }
  }

  handleMobileControl(direction) {
    if (this.isPaused) return;

    const directions = {
      right: ['up', 'down'],
      left: ['up', 'down'],
      up: ['left', 'right'],
      down: ['left', 'right']
    };
    
    if (directions[this.snake.direction] && directions[this.snake.direction].includes(direction)) {
      this.snake.newDirection = direction;
    }
  }

  async gameOver() {
    this.isPaused = true;
    // Update player status in presence
    this.onlinePlayersManager.updatePlayerStatus(false);

    if (!this.shouldReduceMotion()) {
      gsap.to(this.canvas, {
        duration: 0.5,
        opacity: 0.5,
        scale: 0.95,
        ease: "power2.out"
      });
    }
    if (this.vibrationEnabled && navigator.vibrate) navigator.vibrate(120);

    // If needed, save high score
    if (this.scoreManager.score > 0 && this.leaderboardManager.isHighScore(this.scoreManager.score)) {
      try {
        const rank = await this.leaderboardManager.saveScore(
          this.leaderboardManager.currentPlayer,
          this.scoreManager.score
        );
        if (rank) {
          // Show non-blocking modal instead of alert
          const modal = document.getElementById('highScoreModal');
          const body = document.getElementById('highScoreBody');
          if (modal && body) {
            body.innerHTML = `#${rank} — ${this.escapeHtml(this.leaderboardManager.currentPlayerName || 'Player')} — ${this.scoreManager.score}`;
            modal.style.display = 'flex';
          } else {
            this.handleRestart();
          }
        } else {
          this.handleRestart();
        }
      } catch (error) {
        console.error('Failed to save score:', error);
        this.handleRestart();
      }
    } else {
      // Otherwise restart silently
      this.handleRestart();
    }
  }

  handleRestart() {
    this.snake.reset();
    this.scoreManager.reset();
    this.food.respawn(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
    this.interval = 200;
    this.isPaused = false;
    this.onlinePlayersManager.updatePlayerStatus(true);
    if (!this.shouldReduceMotion()) {
      gsap.to(this.canvas, {
        duration: 0.5,
        opacity: 1,
        scale: 1,
        ease: "power2.out"
      });
    }
    document.querySelector('.score-value').textContent = '0';
    document.getElementById('leaderboardModal').style.display = 'none';
    requestAnimationFrame(this.gameLoop);
  }

  updateScoreUI() {
    const scoreElement = document.querySelector('.score-value');
    scoreElement.textContent = this.scoreManager.score;
    scoreElement.classList.remove('score-update');
    void scoreElement.offsetWidth;
    scoreElement.classList.add('score-update');
  }

  spawnEatParticles(color) {
    const head = this.snake.body[0];
    const cx = head.x * this.gridSize + this.gridSize / 2;
    const cy = head.y * this.gridSize + this.gridSize / 2;
    this.particles.spawnExplosion(cx, cy, 20, color);
  }

  showFloatingText(text, color = '#fff') {
    if (!this.overlay) return;
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.textContent = text;
    el.style.color = color;
    el.style.position = 'absolute';
    const head = this.snake.body[0];
    const px = head.x * this.gridSize + this.gridSize / 2;
    const py = head.y * this.gridSize + 4;
    const ox = (px / this.canvas.width) * 100;
    const oy = (py / this.canvas.height) * 100;
    el.style.left = `calc(${ox}% - 10px)`;
    el.style.top = `calc(${oy}% - 10px)`;
    this.overlay.appendChild(el);
    if (!this.shouldReduceMotion()) {
      gsap.to(el, { y: -20, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => el.remove() });
    } else {
      el.style.opacity = '0';
      el.remove();
    }
  }

  scheduleBonus() {
    clearTimeout(this._bonusTimer);
    const delay = 8000 + Math.random() * 8000; // 8–16s
    this._bonusTimer = setTimeout(() => {
      this.bonusFood.spawn(this.gridSize, { width: this.canvas.width, height: this.canvas.height }, 8000);
      if (!this.shouldReduceMotion()) {
        gsap.fromTo(this.canvas, { filter: 'brightness(1.0)' }, { filter: 'brightness(1.2)', duration: 0.2, yoyo: true, repeat: 1 });
      }
      this.scheduleBonus();
    }, delay);
  }

  shouldReduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  addSwipeControls() {
    const el = this.canvas;
    if (!el) return;
    let sx = 0, sy = 0, st = 0;
    const threshold = 24; // px
    const maxTapTime = 400; // ms
    const onStart = (e) => {
      const t = e.touches ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY; st = Date.now();
    };
    const onEnd = (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
      const dx = (t.clientX - sx);
      const dy = (t.clientY - sy);
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const dt = Date.now() - st;
      if (dt > maxTapTime && adx < threshold && ady < threshold) return;
      if (adx < threshold && ady < threshold) return;
      e.preventDefault();
      if (adx > ady) {
        this.handleMobileControl(dx > 0 ? 'right' : 'left');
      } else {
        this.handleMobileControl(dy > 0 ? 'down' : 'up');
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: false });
  }

  setupOptions() {
    // Vibration toggle
    const storedV = localStorage.getItem('optVibrate');
    this.vibrationEnabled = storedV == null ? true : storedV === '1';
    const vib = document.getElementById('optVibrate');
    if (vib) {
      vib.checked = this.vibrationEnabled;
      vib.addEventListener('change', () => {
        this.vibrationEnabled = !!vib.checked;
        localStorage.setItem('optVibrate', this.vibrationEnabled ? '1' : '0');
      });
    }

    // Left-handed toggle
    const storedL = localStorage.getItem('optLefty');
    const leftyEnabled = storedL === '1';
    document.body.classList.toggle('lefty', leftyEnabled);
    const lefty = document.getElementById('optLeftHanded');
    if (lefty) {
      lefty.checked = leftyEnabled;
      lefty.addEventListener('change', () => {
        document.body.classList.toggle('lefty', !!lefty.checked);
        localStorage.setItem('optLefty', lefty.checked ? '1' : '0');
      });
    }
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState === 'visible' && this._wakeLock && this._wakeLock.released) {
            try { this._wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
          }
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Sidebar leaderboard display is handled by LeaderboardManager subscriptions.

  cleanup() {
    this.leaderboardManager.cleanup();
    this.onlinePlayersManager.cleanup();
  }
}

window.onload = () => {
  new Game();
}; 
