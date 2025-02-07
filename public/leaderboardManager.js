class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentPlayer = null;
    this.maxEntries = 100;
    this.apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
    this.activePlayers = 0;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.retryDelay = 5000; // 5 секунд между повторными попытками
    this.isHeartbeatActive = false;
  }

  async loadLeaderboard() {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) throw new Error('Failed to load leaderboard');
      const data = await response.json();
      this.leaderboard = data.scores;
      
      // Обновляем количество активных игроков только если не получаем его через heartbeat
      if (!this.isHeartbeatActive) {
        this.activePlayers = data.activePlayers;
        this.updateActivePlayersDisplay();
      }
      return true;
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Используем локальное хранилище как резервный вариант
      const stored = localStorage.getItem('snakeLeaderboard');
      if (stored) {
        this.leaderboard = JSON.parse(stored);
      }
      // Планируем повторную попытку
      setTimeout(() => this.loadLeaderboard(), this.retryDelay);
      return false;
    }
  }

  async saveScore(username, score) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, score })
      });

      if (!response.ok) throw new Error('Failed to save score');
      
      const data = await response.json();
      this.leaderboard = data.leaderboard;
      this.activePlayers = data.activePlayers;
      
      localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
      
      return data.rank;
    } catch (error) {
      console.error('Error saving score:', error);
      return this.addLocalScore(username, score);
    }
  }

  async sendHeartbeat() {
    if (!this.currentPlayer) return;

    try {
      const response = await fetch(`${this.apiUrl}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: this.currentPlayer,
          timestamp: Date.now()
        })
      });

      if (!response.ok) throw new Error('Failed to send heartbeat');
      
      const data = await response.json();
      this.activePlayers = data.activePlayers;
      this.updateActivePlayersDisplay();
      this.isHeartbeatActive = true;
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      this.isHeartbeatActive = false;
      // Пробуем перезапустить heartbeat
      this.stopHeartbeat();
      setTimeout(() => this.startHeartbeat(), this.retryDelay);
    }
  }

  startHeartbeat() {
    if (!this.currentPlayer || this.heartbeatInterval) return;

    // Отправляем первый heartbeat немедленно
    this.sendHeartbeat();

    // Устанавливаем интервал для регулярных heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000); // Каждые 15 секунд

    // Добавляем обработчики для видимости страницы
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.stopHeartbeat();
    } else {
      this.startHeartbeat();
    }
  }

  handleBeforeUnload() {
    this.stopHeartbeat();
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.currentPlayer) {
      fetch(`${this.apiUrl}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: this.currentPlayer })
      }).catch(console.error);
    }
    
    this.isHeartbeatActive = false;
  }

  updateActivePlayersDisplay() {
    const counter = document.getElementById('activePlayersCounter');
    if (counter) {
      const oldValue = parseInt(counter.textContent) || 0;
      const newValue = this.activePlayers || 0;
      
      counter.textContent = newValue;
      
      // Добавляем анимацию при изменении значения
      if (oldValue !== newValue) {
        counter.classList.remove('changed');
        void counter.offsetWidth; // Форсируем reflow
        counter.classList.add('changed');
      }
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Форматируем время
    const time = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Если сегодня
    if (date.toDateString() === today.toDateString()) {
      return `Сегодня, ${time}`;
    }
    // Если вчера
    if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера, ${time}`;
    }
    // Иначе полная дата
    return `${date.toLocaleDateString('ru-RU')}, ${time}`;
  }

  addLocalScore(username, score) {
    const existingPlayerIndex = this.leaderboard.findIndex(entry => entry.username === username);
    
    if (existingPlayerIndex !== -1) {
      if (score > this.leaderboard[existingPlayerIndex].score) {
        this.leaderboard[existingPlayerIndex] = {
          username,
          score,
          date: new Date().toISOString()
        };
      }
    } else {
      this.leaderboard.push({
        username,
        score,
        date: new Date().toISOString()
      });
    }

    this.leaderboard.sort((a, b) => b.score - a.score);
    if (this.leaderboard.length > this.maxEntries) {
      this.leaderboard = this.leaderboard.slice(0, this.maxEntries);
    }

    localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
    return this.getPlayerRank(username);
  }

  isHighScore(score) {
    const playerCurrentScore = this.getPlayerScore(this.currentPlayer);
    return this.leaderboard.length < this.maxEntries || 
           score > this.leaderboard[this.leaderboard.length - 1].score ||
           (playerCurrentScore && score > playerCurrentScore);
  }

  getPlayerScore(username) {
    const playerEntry = this.leaderboard.find(entry => entry.username === username);
    return playerEntry ? playerEntry.score : null;
  }

  getPlayerRank(username) {
    return this.leaderboard.findIndex(entry => entry.username === username) + 1;
  }

  getTopScores(limit = this.maxEntries) {
    return this.leaderboard.slice(0, limit);
  }
} 