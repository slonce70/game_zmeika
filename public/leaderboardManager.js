import { db } from "./firebaseConfig.js";
import { ref, onValue, get, set, update, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

export class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentPlayer = null;
    this.maxEntries = 10;
    this.activePlayers = 0;
    
    // References using modular API
    this.leaderboardRef = ref(db, 'leaderboard');
    this.onlineRef = ref(db, 'online');
    
    // Subscribe to leaderboard changes
    onValue(this.leaderboardRef, (snapshot) => {
      const data = snapshot.val() || {};
      this.leaderboard = Object.values(data)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxEntries);
      this.updateLeaderboardDisplay();
      localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
    });
    
    // Subscribe to online players count
    onValue(this.onlineRef, (snapshot) => {
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
      const playerRef = ref(db, 'leaderboard/' + username);
      const snapshot = await get(playerRef);
      const currentData = snapshot.val();

      if (!currentData || score > currentData.score) {
        await set(playerRef, {
          username,
          score,
          date: new Date().toISOString()
        });
      }
      
      return this.getPlayerRank(username);
    } catch (error) {
      console.error('Error saving score:', error);
      return this.addLocalScore(username, score);
    }
  }

  markPlayerOnline(username) {
    if (!username) return;
    
    this.currentPlayer = username;
    const userRef = ref(db, 'online/' + username);
    
    // Mark player as online
    set(userRef, true);
    
    // Remove from online list when disconnected
    onDisconnect(userRef).remove();
    
    // Update lastActive in leaderboard
    const playerRef = ref(db, 'leaderboard/' + username);
    update(playerRef, {
      lastActive: serverTimestamp()
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

  cleanup() {
    if (this.currentPlayer) {
      const userRef = ref(db, 'online/' + this.currentPlayer);
      set(userRef, null);
    }
    // Off functions not needed with modular API in this simple case
  }
} 