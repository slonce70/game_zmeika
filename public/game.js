import { LeaderboardManager } from "./leaderboardManager.js";
import { ScoreManager } from "./scoreManager.js";
import { Snake } from "./snake.js";
import { Food } from "./food.js";
import { OnlinePlayersManager } from "./onlinePlayersManager.js";

class Game {
  constructor() {
    this.leaderboardManager = new LeaderboardManager();
    this.onlinePlayersManager = new OnlinePlayersManager();
    
    setTimeout(() => {
      this.updateSidebarLeaderboard();
    }, 2000);
    
    // Инициализация модальных окон
    this.initializeModals();
    
    // Показываем окно логина
    this.showLoginModal();

    // Запускаем периодическое обновление таблицы лидеров
    this.startLeaderboardUpdates();

    // Добавляем обработчик перед закрытием страницы
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  initializeModals() {
    // Обработчики для логина
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      if (username) {
        this.leaderboardManager.currentPlayer = username;
        this.leaderboardManager.markPlayerOnline(username);
        this.onlinePlayersManager.setCurrentPlayer(username);
        this.onlinePlayersManager.updatePlayerStatus(username, true);
        document.getElementById('loginModal').style.display = 'none';
        this.initializeGame();
      }
    });

    // Обработчики для таблицы лидеров
    const leaderboardBtn = document.querySelector('.leaderboard-btn');
    const closeLeaderboardBtn = document.getElementById('closeLeaderboard');
    const leaderboardModal = document.getElementById('leaderboardModal');

    leaderboardBtn.addEventListener('click', () => {
      this.showLeaderboard();
      this.isPaused = true;
    });

    closeLeaderboardBtn.addEventListener('click', () => {
      leaderboardModal.style.display = 'none';
      this.isPaused = false;
      requestAnimationFrame(this.gameLoop);
    });
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
      if (score.username === this.leaderboardManager.currentPlayer) {
        row.classList.add('current-player');
      }

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${this.escapeHtml(score.username)}</td>
        <td>${score.score || 0}</td>
        <td>${this.leaderboardManager.formatDate(score.date)}</td>
      `;
      leaderboardBody.appendChild(row);
    });

    leaderboardModal.style.display = 'flex';
  }

  initializeGame() {
    // Создаем canvas и устанавливаем его размеры
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 600;
    this.canvas.height = 400;
    document.querySelector('.canvas-container').appendChild(this.canvas);

    this.gridSize = 20;
    this.isPaused = false;
    
    // Создаем объекты игры
    this.snake = new Snake();
    this.food = new Food(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
    this.scoreManager = new ScoreManager();

    // Привязываем функции
    this.gameLoop = this.gameLoop.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleRestart = this.handleRestart.bind(this);
    
    // Добавляем обработчики событий
    document.addEventListener('keydown', this.handleInput);
    document.querySelector('.restart-btn').addEventListener('click', this.handleRestart);

    this.lastTime = 0;
    this.interval = 200; // интервал обновления в миллисекундах
    this.accumulator = 0;

    // Анимация появления игры
    gsap.from(this.canvas, {
      duration: 0.5,
      opacity: 0,
      scale: 0.9,
      ease: "back.out"
    });

    // Добавляем обработчики для мобильного управления
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

    requestAnimationFrame(this.gameLoop);
    this.drawGrid();
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

    if (this.accumulator >= this.interval) {
      this.update();
      this.accumulator = 0;
    }
    
    this.draw();
    this.lastTime = timestamp;
    requestAnimationFrame(this.gameLoop);
  }

  update() {
    if (this.isPaused) return;
    
    this.snake.update();
    
    // Проверка, съела ли змейка еду
    if (this.snake.body[0].x === this.food.position.x && this.snake.body[0].y === this.food.position.y) {
      this.snake.grow();
      this.scoreManager.incrementScore();
      this.food.respawn(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
      
      // Анимация счета
      const scoreElement = document.querySelector('.score-value');
      scoreElement.textContent = this.scoreManager.score;
      scoreElement.classList.remove('score-update');
      void scoreElement.offsetWidth;
      scoreElement.classList.add('score-update');
      
      // Уменьшаем интервал (увеличиваем скорость)
      this.interval = Math.max(80, 200 - this.scoreManager.score * 5);
    }
    
    // Проверка столкновений
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
    this.snake.draw(this.ctx, this.gridSize);
  }

  handleInput(e) {
    if (e.key === ' ') {
      this.isPaused = !this.isPaused;
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
    // Обновляем статус игрока
    if (this.leaderboardManager.currentPlayer) {
      this.onlinePlayersManager.updatePlayerStatus(this.leaderboardManager.currentPlayer, false);
    }

    gsap.to(this.canvas, {
      duration: 0.5,
      opacity: 0.5,
      scale: 0.95,
      ease: "power2.out"
    });

    // Проверяем, есть ли смысл сохранять результат
    if (this.scoreManager.score > 0 && this.leaderboardManager.isHighScore(this.scoreManager.score)) {
      try {
        const rank = await this.leaderboardManager.saveScore(
          this.leaderboardManager.currentPlayer,
          this.scoreManager.score
        );
        if (rank) {
          setTimeout(() => {
            alert(`New High Score! Rank: ${rank}\nScore: ${this.scoreManager.score}`);
            this.handleRestart();
          }, 500);
        } else {
          this.handleRestart();
        }
      } catch (error) {
        console.error('Failed to save score:', error);
        this.handleRestart();
      }
    } else {
      // Просто перезапускаем игру без сообщений
      this.handleRestart();
    }
  }

  handleRestart() {
    this.snake.reset();
    this.scoreManager.reset();
    this.food.respawn(this.gridSize, { width: this.canvas.width, height: this.canvas.height });
    this.interval = 200;
    this.isPaused = false;
    gsap.to(this.canvas, {
      duration: 0.5,
      opacity: 1,
      scale: 1,
      ease: "power2.out"
    });
    document.querySelector('.score-value').textContent = '0';
    document.getElementById('leaderboardModal').style.display = 'none';
    requestAnimationFrame(this.gameLoop);
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

  updateSidebarLeaderboard() {
    const sidebarLeaderboard = document.getElementById('sidebarLeaderboard');
    const topPlayers = this.leaderboardManager.leaderboard;
    
    if (!sidebarLeaderboard || !Array.isArray(topPlayers)) return;
    
    sidebarLeaderboard.innerHTML = '';
    
    // Обновляем счетчик активных игроков
    const activePlayersCounter = document.getElementById('activePlayersCounter');
    if (activePlayersCounter) {
      activePlayersCounter.textContent = this.leaderboardManager.activePlayers;
    }

    // Возвращаем стиль с карточками игроков
    topPlayers.forEach((player, index) => {
      if (!player || !player.username) return;
      
      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';
      if (player.username === this.leaderboardManager.currentPlayer) {
        playerCard.classList.add('current-player');
      }

      playerCard.innerHTML = `
        <div class="player-rank">#${index + 1}</div>
        <div class="player-info">
          <div class="player-name">${this.escapeHtml(player.username)}</div>
          <div class="player-score">${player.score || 0}</div>
          <div class="player-date">${this.leaderboardManager.formatDate(player.date)}</div>
        </div>
      `;

      // Добавляем анимацию при изменении счета
      const previousScore = this.previousScores?.get(player.username);
      if (previousScore && previousScore !== player.score) {
        gsap.from(playerCard, {
          backgroundColor: 'rgba(80, 200, 120, 0.4)',
          duration: 1,
          ease: 'power2.out'
        });
      }

      sidebarLeaderboard.appendChild(playerCard);
    });

    // Сохраняем текущие счета для сравнения
    this.previousScores = new Map(
      topPlayers.filter(player => player && player.username)
        .map(player => [player.username, player.score])
    );
  }

  startLeaderboardUpdates() {
    // Возвращаем прежний интервал обновления
    setInterval(() => {
      this.updateSidebarLeaderboard();
    }, 10000);
  }

  cleanup() {
    this.leaderboardManager.cleanup();
    this.onlinePlayersManager.cleanup();
  }
}

window.onload = () => {
  new Game();
}; 