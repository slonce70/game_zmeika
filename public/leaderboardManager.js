class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentPlayer = null;
    this.maxEntries = 100;
    this.apiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
      ? `http://${window.location.hostname}:3000/api` 
      : '/api';
    this.activePlayers = 0;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.retryDelay = 5000;
    this.maxRetries = 3;
    this.currentRetries = 0;
    this.isHeartbeatActive = false;
  }

  async fetchWithRetry(url, options = {}, retries = this.maxRetries) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  async loadLeaderboard() {
    try {
      const data = await this.fetchWithRetry(this.apiUrl);
      this.leaderboard = data.scores || [];
      
      if (!this.isHeartbeatActive && typeof data.activePlayers === 'number') {
        this.activePlayers = data.activePlayers;
        this.updateActivePlayersDisplay();
      }
      
      this.currentRetries = 0;
      return true;
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      const stored = localStorage.getItem('snakeLeaderboard');
      if (stored) {
        try {
          this.leaderboard = JSON.parse(stored);
        } catch (e) {
          console.error('Error parsing stored leaderboard:', e);
          this.leaderboard = [];
        }
      }
      
      if (this.currentRetries < this.maxRetries) {
        this.currentRetries++;
        setTimeout(() => this.loadLeaderboard(), this.retryDelay);
      }
      return false;
    }
  }

  async saveScore(username, score) {
    try {
      const data = await this.fetchWithRetry(this.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ username, score })
      });

      if (data.leaderboard) {
        this.leaderboard = data.leaderboard;
        if (typeof data.activePlayers === 'number') {
          this.activePlayers = data.activePlayers;
          this.updateActivePlayersDisplay();
        }
        localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
      }
      
      return data.rank || this.getPlayerRank(username);
    } catch (error) {
      console.error('Error saving score:', error);
      return this.addLocalScore(username, score);
    }
  }

  async sendHeartbeat() {
    if (!this.currentPlayer) return;

    try {
      const data = await this.fetchWithRetry(`${this.apiUrl}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ 
          username: this.currentPlayer,
          timestamp: Date.now()
        })
      });

      if (typeof data.activePlayers === 'number') {
        this.activePlayers = data.activePlayers;
        this.updateActivePlayersDisplay();
        this.isHeartbeatActive = true;
      }
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      this.isHeartbeatActive = false;
      if (this.heartbeatInterval) {
        this.stopHeartbeat();
        setTimeout(() => this.startHeartbeat(), this.retryDelay);
      }
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