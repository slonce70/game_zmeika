class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentPlayer = null;
    this.maxEntries = 10;
    this.activePlayers = 0;
    this.db = firebase.database();
    this.leaderboardRef = this.db.ref('leaderboard');
    this.onlineRef = this.db.ref('online');
    
    // Subscribe to leaderboard changes
    this.leaderboardRef
      .orderByChild('score')
      .limitToLast(this.maxEntries)
      .on('value', snapshot => {
        const data = snapshot.val() || {};
        this.leaderboard = Object.values(data)
          .sort((a, b) => b.score - a.score)
          .slice(0, this.maxEntries);
        this.updateLeaderboardDisplay();
        localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
      });
    
    // Subscribe to online players count
    this.onlineRef.on('value', snapshot => {
      this.activePlayers = Object.keys(snapshot.val() || {}).length;
      this.updateActivePlayersDisplay();
    });

    // Initialize from localStorage if available
    try {
      const stored = localStorage.getItem('snakeLeaderboard');
      if (stored) {
        this.leaderboard = JSON.parse(stored);
        this.updateLeaderboardDisplay();
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
      this.leaderboard = [];
    }
  }

  async saveScore(username, score) {
    if (!username || typeof score !== 'number') {
      throw new Error('Invalid score data');
    }

    try {
      const playerRef = this.leaderboardRef.child(username);
      const snapshot = await playerRef.get();
      const currentData = snapshot.val();

      if (!currentData || score > currentData.score) {
        await playerRef.update({
          username,
          score,
          date: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving score:', error);
      this.addLocalScore(username, score);
    }
  }

  markPlayerOnline(username) {
    if (!username) return;
    
    this.currentPlayer = username;
    const userRef = this.onlineRef.child(username);
    
    // Mark player as online with an object containing isPlaying and lastActive
    userRef.set({
      lastActive: firebase.database.ServerValue.TIMESTAMP,
      isPlaying: true
    });
    
    // Remove from online list when disconnected
    userRef.onDisconnect().remove();
    
    // Update lastActive in leaderboard
    const playerRef = this.leaderboardRef.child(username);
    playerRef.update({
      lastActive: firebase.database.ServerValue.TIMESTAMP
    });
  }

  updateActivePlayersDisplay() {
    const counter = document.getElementById('activePlayersCounter');
    if (counter) {
      const oldValue = parseInt(counter.textContent) || 0;
      const newValue = this.activePlayers || 0;
      
      counter.textContent = newValue;
      
      if (oldValue !== newValue) {
        counter.classList.remove('changed');
        void counter.offsetWidth;
        counter.classList.add('changed');
      }
    }
  }

  updateLeaderboardDisplay() {
    const sidebarLeaderboard = document.getElementById('sidebarLeaderboard');
    if (!sidebarLeaderboard) return;

    sidebarLeaderboard.innerHTML = this.leaderboard
      .map((entry, index) => `
        <div class="leaderboard-entry ${entry.username === this.currentPlayer ? 'current-player' : ''}">
          <span class="rank">#${index + 1}</span>
          <span class="username">${entry.username}</span>
          <span class="score">${entry.score}</span>
          <span class="date">${this.formatDate(entry.date)}</span>
        </div>
      `)
      .join('');
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const time = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (date.toDateString() === today.toDateString()) {
      return `Сегодня, ${time}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера, ${time}`;
    }
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
    this.updateLeaderboardDisplay();
  }

  getPlayerScore(username) {
    const playerEntry = this.leaderboard.find(entry => entry.username === username);
    return playerEntry ? playerEntry.score : null;
  }

  cleanup() {
    if (this.currentPlayer) {
      this.onlineRef.child(this.currentPlayer).remove();
    }
    this.leaderboardRef.off();
    this.onlineRef.off();
  }

  /**
   * Returns the personal record (best score) for the current player.
   * @returns {number} The personal best score, or 0 if none.
   */
  getPersonalRecord() {
    const score = this.getPlayerScore(this.currentPlayer);
    return score !== null ? score : 0;
  }

  /**
   * Marks the current player as offline (not playing).
   */
  markPlayerOffline() {
    if (this.currentPlayer) {
      const userRef = this.onlineRef.child(this.currentPlayer);
      userRef.set({ lastActive: firebase.database.ServerValue.TIMESTAMP, isPlaying: false });
    }
  }
} 