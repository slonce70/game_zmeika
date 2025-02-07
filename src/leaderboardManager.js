class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentPlayer = null;
    this.maxEntries = 100;
    // В продакшене API будет доступно по тому же домену
    this.apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api'
      : 'http://localhost:3000/api';
  }

  // Загрузка результатов с сервера
  async loadLeaderboard() {
    try {
      const response = await fetch(`${this.apiUrl}/leaderboard`);
      if (!response.ok) throw new Error('Failed to load leaderboard');
      this.leaderboard = await response.json();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Используем локальное хранилище как резервный вариант
      const stored = localStorage.getItem('snakeLeaderboard');
      if (stored) {
        this.leaderboard = JSON.parse(stored);
      }
    }
  }

  // Сохранение результатов на сервере
  async saveScore(username, score) {
    try {
      const response = await fetch(`${this.apiUrl}/leaderboard`, {
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

  // Локальное сохранение результата (резервный вариант)
  addLocalScore(username, score) {
    // Ищем существующий результат игрока
    const existingPlayerIndex = this.leaderboard.findIndex(entry => entry.username === username);
    
    if (existingPlayerIndex !== -1) {
      // Обновляем только если новый результат лучше
      if (score > this.leaderboard[existingPlayerIndex].score) {
        this.leaderboard[existingPlayerIndex] = {
          username,
          score,
          date: new Date().toISOString()
        };
      }
    } else {
      // Добавляем новый результат
      this.leaderboard.push({
        username,
        score,
        date: new Date().toISOString()
      });
    }

    // Сортируем и обрезаем до maxEntries
    this.leaderboard.sort((a, b) => b.score - a.score);
    if (this.leaderboard.length > this.maxEntries) {
      this.leaderboard = this.leaderboard.slice(0, this.maxEntries);
    }

    localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
    return this.getPlayerRank(username);
  }

  // Проверка, попадает ли счет в топ
  isHighScore(score) {
    const playerCurrentScore = this.getPlayerScore(this.currentPlayer);
    return this.leaderboard.length < this.maxEntries || 
           score > this.leaderboard[this.leaderboard.length - 1].score ||
           (playerCurrentScore && score > playerCurrentScore);
  }

  // Получение текущего счета игрока
  getPlayerScore(username) {
    const playerEntry = this.leaderboard.find(entry => entry.username === username);
    return playerEntry ? playerEntry.score : null;
  }

  // Получение ранга игрока
  getPlayerRank(username) {
    return this.leaderboard.findIndex(entry => entry.username === username) + 1;
  }

  // Получение топ N результатов
  getTopScores(limit = this.maxEntries) {
    return this.leaderboard.slice(0, limit);
  }
}

export default LeaderboardManager; 