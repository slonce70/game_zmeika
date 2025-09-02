import { db, auth } from "./firebaseConfig.js";
import { ref, onValue, get, set, update, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";
import { detectCountry, countryCodeToFlagEmoji } from "./geo.js";

export class LeaderboardManager {
  constructor() {
    this.leaderboard = [];
    this.currentUid = null;
    this.currentPlayerName = null;
    this.maxEntries = 10;
    this.activePlayers = 0;
    this.country = { countryCode: '', countryName: '', flag: '' };
    
    // References using modular API
    this.leaderboardRef = ref(db, 'leaderboard');
    this.onlineRef = ref(db, 'online');
    
    // Track auth state
    onAuthStateChanged(auth, (user) => {
      this.currentUid = user?.uid || null;
    });

    // Resolve country early (non-blocking)
    this.initCountry();

    // Subscribe to leaderboard changes with error handling
    this._unsubLeaderboard = onValue(this.leaderboardRef, (snapshot) => {
      try {
        const data = snapshot.val() || {};
        const entries = Object.entries(data)
          .map(([uid, entry]) => ({ uid, ...(entry || {}) }))
          .filter(entry => entry && entry.username && (entry.score || 0) >= 0);

        // Deduplicate by normalized username, keep highest score
        const bestByName = new Map();
        for (const e of entries) {
          const key = (e.username || '').trim().toLowerCase();
          const cur = bestByName.get(key);
          if (!cur || (e.score || 0) > (cur.score || 0)) bestByName.set(key, e);
        }

        const filteredData = Array.from(bestByName.values())
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, this.maxEntries);

        // Only update if data actually changed
        const currentDataString = JSON.stringify(this.leaderboard);
        const newDataString = JSON.stringify(filteredData);

        if (currentDataString !== newDataString) {
          this.leaderboard = filteredData;
          this.updateLeaderboardDisplay();
          localStorage.setItem('snakeLeaderboard', JSON.stringify(this.leaderboard));
        }
      } catch (error) {
        console.error('Error processing leaderboard data:', error);
      }
    }, (error) => {
      console.error('Error in leaderboard subscription:', error);
    });
    
    // Subscribe to online players count
    this._unsubOnline = onValue(this.onlineRef, (snapshot) => {
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
    if (typeof score !== 'number' || score <= 0) return null; // Skip zero/negative
    const uid = this.currentUid;
    if (!uid) return null;

    try {
      const playerRef = ref(db, 'leaderboard/' + uid);
      const snapshot = await get(playerRef);
      const currentData = snapshot.val();

      // Check if existing best is higher or equal
      if (currentData && (currentData.score || 0) >= score) {
        return this.getPlayerRank(uid);
      }

      // Save only if it's a new personal best
      const newScore = {
        username: username || this.currentPlayerName || 'Player',
        score,
        date: new Date().toISOString(),
        lastActive: serverTimestamp(),
        countryCode: this.country?.countryCode || '',
        countryName: this.country?.countryName || ''
      };

      await set(playerRef, newScore);
      // Update local list
      const leaderboardSnapshot = await get(this.leaderboardRef);
      const leaderboardData = leaderboardSnapshot.val() || {};
      const entries = Object.entries(leaderboardData)
        .map(([id, entry]) => ({ uid: id, ...(entry || {}) }))
        .filter(entry => entry && entry.username && (entry.score || 0) >= 0);

      const bestByName = new Map();
      for (const e of entries) {
        const key = (e.username || '').trim().toLowerCase();
        const cur = bestByName.get(key);
        if (!cur || (e.score || 0) > (cur.score || 0)) bestByName.set(key, e);
      }
      this.leaderboard = Array.from(bestByName.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, this.maxEntries);
      
      this.updateLeaderboardDisplay();
      return this.getPlayerRank(uid);
    } catch (error) {
      console.error('Error saving score:', error);
      return null;
    }
  }

  async setUsername(username) {
    this.currentPlayerName = username;
    const uid = this.currentUid;
    if (!uid || !username) return;
    try {
      const playerRef = ref(db, 'leaderboard/' + uid);
      const snapshot = await get(playerRef);
      const currentData = snapshot.val() || {};
      await set(playerRef, {
        ...currentData,
        username,
        lastActive: serverTimestamp(),
        countryCode: this.country?.countryCode || currentData?.countryCode || '',
        countryName: this.country?.countryName || currentData?.countryName || ''
      });
    } catch (e) {
      console.error('Failed to set username:', e);
    }
  }

  markPlayerOnline(username) {
    const uid = this.currentUid;
    if (!uid) {
      // Retry shortly if auth not ready yet
      setTimeout(() => this.markPlayerOnline(username), 300);
      return;
    }
    this.currentPlayerName = username || this.currentPlayerName;
    // Presence object compatible with OnlinePlayersManager
    const userRef = ref(db, 'online/' + uid);
    set(userRef, {
      username: this.currentPlayerName || 'Player',
      lastActive: serverTimestamp(),
      isPlaying: true,
      countryCode: this.country?.countryCode || ''
    });
    onDisconnect(userRef).remove();
    // Update lastActive in leaderboard
    const playerRef = ref(db, 'leaderboard/' + uid);
    update(playerRef, { 
      lastActive: serverTimestamp(), 
      username: this.currentPlayerName || 'Player',
      countryCode: this.country?.countryCode || '',
      countryName: this.country?.countryName || ''
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

    try {
      sidebarLeaderboard.innerHTML = (Array.isArray(this.leaderboard) ? this.leaderboard : [])
        .map((entry, index) => {
          if (!entry || !entry.username) return '';
          const flag = entry.countryCode ? countryCodeToFlagEmoji(entry.countryCode) : '';
          return `
            <div class="player-card ${entry.uid === this.currentUid ? 'current-player' : ''}">
              <div class="player-rank">#${index + 1}</div>
              <div class="player-info">
                <div class="player-name">${flag ? `<span class="flag-emoji" title="${this.escapeHtml(entry.countryName || entry.countryCode)}">${flag}</span> ` : ''}${this.escapeHtml(entry.username)}</div>
                <div class="player-score">${entry.score || 0}</div>
                <div class="player-date">${this.formatDate(entry.date || new Date(), (localStorage.getItem('lang') || 'en'))}</div>
              </div>
            </div>
          `;
        })
        .filter(html => html)
        .join('');
    } catch (error) {
      console.error('Error updating leaderboard display:', error);
      sidebarLeaderboard.innerHTML = '';
    }
  }

  async initCountry() {
    try {
      const data = await detectCountry();
      if (data && data.countryCode) {
        this.country = data;
      }
    } catch (e) {
      // ignore
    }
  }

  formatDate(dateString, lang = 'en') {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
      const time = date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      });

      if (date.toDateString() === today.toDateString()) {
        return `${lang === 'ru' ? 'Сегодня' : 'Today'}, ${time}`;
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return `${lang === 'ru' ? 'Вчера' : 'Yesterday'}, ${time}`;
      }
      return `${date.toLocaleDateString(locale)}, ${time}`;
    } catch (e) {
      return 'Recently';
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
    const playerCurrentScore = this.getPlayerScore(this.currentUid);
    return this.leaderboard.length < this.maxEntries || 
           score > this.leaderboard[this.leaderboard.length - 1].score ||
           (playerCurrentScore && score > playerCurrentScore);
  }

  getPlayerScore(uid) {
    const playerEntry = this.leaderboard.find(entry => entry.uid === uid);
    return playerEntry ? playerEntry.score : null;
  }

  getPlayerRank(uid) {
    return this.leaderboard.findIndex(entry => entry.uid === uid) + 1;
  }

  cleanup() {
    if (this._unsubLeaderboard) {
      try { this._unsubLeaderboard(); } catch (e) {}
      this._unsubLeaderboard = null;
    }
    if (this._unsubOnline) {
      try { this._unsubOnline(); } catch (e) {}
      this._unsubOnline = null;
    }
    if (this.currentUid) {
      const userRef = ref(db, 'online/' + this.currentUid);
      set(userRef, null);
    }
  }
} 
