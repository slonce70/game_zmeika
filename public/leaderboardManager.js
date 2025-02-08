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
        .filter(entry => entry && entry.username)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
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
    if (!username || typeof score !== 'number') return;

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
      return null;
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
      counter.textContent = this.activePlayers || 0;
    }
  }

  updateLeaderboardDisplay() {
    const sidebarLeaderboard = document.getElementById('sidebarLeaderboard');
    if (!sidebarLeaderboard) return;

    sidebarLeaderboard.innerHTML = this.leaderboard
      .map((entry, index) => `
        <div class="leaderboard-entry ${entry.username === this.currentPlayer ? 'current-player' : ''}">
          <span class="rank">#${index + 1}</span>
          <span class="username">${this.escapeHtml(entry.username)}</span>
          <span class="score">${entry.score || 0}</span>
          <span class="date">${this.formatDate(entry.date || new Date())}</span>
        </div>
      `)
      .join('');
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Недавно';
      }
      
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
    } catch (e) {
      return 'Недавно';
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
  }
} 