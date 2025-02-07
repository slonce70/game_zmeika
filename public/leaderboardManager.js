class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentPlayer = null;
    this.maxEntries = 100;
    // API URL теперь всегда будет относительным
    this.apiUrl = '/api/server';
    this.activePlayers = 0;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
  }

  async loadLeaderboard() {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) throw new Error('Failed to load leaderboard');
      const data = await response.json();
      this.leaderboard = data.scores;
      this.activePlayers = data.activePlayers;
      this.updateActivePlayersDisplay();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Используем локальное хранилище как резервный вариант
      const stored = localStorage.getItem('snakeLeaderboard');
      if (stored) {
        this.leaderboard = JSON.parse(stored);
      }
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
      
      // Сохраняем локально как резервную копию
      localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
      
      return data.rank;
    } catch (error) {
      console.error('Error saving score:', error);
      // Если сервер недоступен, сохраняем локально
      return this.addLocalScore(username, score);
    }
  }

  startHeartbeat() {
    // Отправляем первый heartbeat
    this.sendHeartbeat();

    // Устанавливаем интервал для heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // каждые 30 секунд

    // Очищаем интервал при закрытии страницы
    window.addEventListener('beforeunload', () => {
      this.stopHeartbeat();
    });
  }

  async sendHeartbeat() {
    try {
      const response = await fetch(`${this.apiUrl}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: this.currentPlayer,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Failed to send heartbeat');
      
      const data = await response.json();
      this.activePlayers = data.activePlayers;
      this.updateActivePlayersDisplay();
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Отправляем уведомление о выходе
    fetch(`${this.apiUrl}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: this.currentPlayer })
    }).catch(console.error);
  }

  updateActivePlayersDisplay() {
    const activePlayersElement = document.getElementById('activePlayers');
    if (activePlayersElement) {
      activePlayersElement.textContent = this.activePlayers;
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