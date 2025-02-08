import { db } from "./firebaseConfig.js";
import { ref, onValue, get, set, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

export class OnlinePlayersManager {
    constructor() {
        this.onlinePlayers = new Map();
        this.currentPlayer = null;
        this.sidebarVisible = window.innerWidth > 768;
        
        // DOM элементы
        this.sidebar = document.getElementById('onlinePlayersSidebar');
        this.playersList = document.getElementById('onlinePlayersList');
        this.toggleButton = document.getElementById('toggleSidebar');
        this.mobileIndicator = document.getElementById('mobileOnlineIndicator');
        
        // Firebase референс
        this.onlineRef = ref(db, 'online');
        
        this.initializeUI();
        this.setupEventListeners();
        this.startOnlinePlayersSubscription();
    }

    initializeUI() {
        // Установка начального состояния сайдбара
        if (this.sidebarVisible) {
            this.sidebar.classList.add('visible');
            this.toggleButton.classList.add('collapsed');
        }

        // Обработка мобильного индикатора
        this.mobileIndicator.addEventListener('click', () => this.toggleSidebar());
    }

    setupEventListeners() {
        // Обработчик кнопки сворачивания
        this.toggleButton.addEventListener('click', () => this.toggleSidebar());

        // Обработчик изменения размера окна
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    startOnlinePlayersSubscription() {
        onValue(this.onlineRef, (snapshot) => {
            const data = snapshot.val() || {};
            
            // Очищаем старые данные
            this.onlinePlayers.clear();
            
            // Обновляем список игроков
            Object.entries(data).forEach(([username, status]) => {
                this.onlinePlayers.set(username, {
                    username,
                    lastActive: status.lastActive || Date.now(),
                    isPlaying: status.isPlaying || false
                });
            });
            
            this.updatePlayersList();
        });
    }

    updatePlayersList() {
        if (!this.playersList) return;

        // Очищаем список
        this.playersList.innerHTML = '';

        // Сортируем игроков: сначала играющие, потом по времени последней активности
        const sortedPlayers = Array.from(this.onlinePlayers.values())
            .sort((a, b) => {
                if (a.isPlaying !== b.isPlaying) {
                    return b.isPlaying ? 1 : -1;
                }
                return b.lastActive - a.lastActive;
            });

        // Обновляем счетчик на мобильном индикаторе
        const playerCount = document.querySelector('.player-count');
        if (playerCount) {
            playerCount.textContent = sortedPlayers.length;
        }

        // Создаем элементы для каждого игрока
        sortedPlayers.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `online-player${player.isPlaying ? ' playing' : ''}${player.username === this.currentPlayer ? ' current' : ''}`;
            
            playerElement.innerHTML = `
                <div class="player-status${player.isPlaying ? '' : ' idle'}"></div>
                <div class="player-name">${this.escapeHtml(player.username)}</div>
            `;

            this.playersList.appendChild(playerElement);
        });
    }

    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        this.sidebar.classList.toggle('visible', this.sidebarVisible);
        this.toggleButton.classList.toggle('collapsed', this.sidebarVisible);
    }

    handleResize() {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile && !this.sidebarVisible) {
            this.sidebarVisible = true;
            this.sidebar.classList.add('visible');
            this.toggleButton.classList.add('collapsed');
        }
    }

    setCurrentPlayer(username) {
        this.currentPlayer = username;
        this.updatePlayersList();
    }

    updatePlayerStatus(username, isPlaying) {
        const userRef = ref(db, `online/${username}`);
        set(userRef, {
            lastActive: serverTimestamp(),
            isPlaying
        });
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

    cleanup() {
        if (this.currentPlayer) {
            const userRef = ref(db, `online/${this.currentPlayer}`);
            set(userRef, null);
        }
    }
} 