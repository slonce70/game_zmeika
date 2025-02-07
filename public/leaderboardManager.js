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
    this.updateInterval = null;
    this.visibilityHandler = this.handleVisibilityChange.bind(this);
    this.unloadHandler = this.handleBeforeUnload.bind(this);

    // Initialize local storage
    try {
      const stored = localStorage.getItem('snakeLeaderboard');
      if (stored) {
        this.leaderboard = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
      this.leaderboard = [];
    }
  }

  async fetchWithRetry(url, options = {}, retries = this.maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

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
      if (Array.isArray(data.scores)) {
        this.leaderboard = data.scores;
        
        if (!this.isHeartbeatActive && typeof data.activePlayers === 'number') {
          this.activePlayers = data.activePlayers;
          this.updateActivePlayersDisplay();
        }
        
        this.currentRetries = 0;
        localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
        return true;
      }
      throw new Error('Invalid leaderboard data format');
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      
      if (this.currentRetries < this.maxRetries) {
        this.currentRetries++;
        setTimeout(() => this.loadLeaderboard(), this.retryDelay);
      }
      return false;
    }
  }

  async saveScore(username, score) {
    if (!username || typeof score !== 'number') {
      throw new Error('Invalid score data');
    }

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
        this.lastHeartbeat = Date.now();
      }
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      this.isHeartbeatActive = false;
      
      // Only retry if the heartbeat interval is still active
      if (this.heartbeatInterval) {
        this.stopHeartbeat();
        setTimeout(() => this.startHeartbeat(), this.retryDelay);
      }
    }
  }

  startHeartbeat() {
    if (!this.currentPlayer || this.heartbeatInterval) return;

    // Send first heartbeat immediately
    this.sendHeartbeat();

    // Set up regular heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000);

    // Add event listeners
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('beforeunload', this.unloadHandler);
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

    // Remove event listeners
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('beforeunload', this.unloadHandler);

    if (this.currentPlayer) {
      fetch(`${this.apiUrl}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Clean up all intervals and listeners
  cleanup() {
    this.stopHeartbeat();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
} 