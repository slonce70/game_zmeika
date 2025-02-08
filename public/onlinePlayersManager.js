import { db } from "./firebaseConfig.js";
import { ref, onValue, get, set, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import gsap from "gsap";

export class OnlinePlayersManager {
    constructor() {
        this.onlinePlayers = new Map();
        this.currentPlayer = null;
        this.sidebarVisible = window.innerWidth > 768;
        this.lastRender = new Map(); // Для отслеживания изменений
        
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
            const newPlayers = new Map();
            
            // Обновляем список игроков
            Object.entries(data).forEach(([username, status]) => {
                newPlayers.set(username, {
                    username,
                    lastActive: status.lastActive || Date.now(),
                    isPlaying: status.isPlaying || false
                });
            });
            
            // Проверяем, действительно ли есть изменения
            if (this.hasPlayersChanged(newPlayers)) {
                this.onlinePlayers = newPlayers;
                this.updatePlayersList();
            }
        });
    }

    hasPlayersChanged(newPlayers) {
        if (this.onlinePlayers.size !== newPlayers.size) return true;
        
        for (const [username, newData] of newPlayers) {
            const currentData = this.onlinePlayers.get(username);
            if (!currentData) return true;
            if (currentData.isPlaying !== newData.isPlaying) return true;
            if (currentData.lastActive !== newData.lastActive) return true;
        }
        
        return false;
    }

    updatePlayersList() {
        if (!this.playersList) return;

        // Сортируем игроков
        const sortedPlayers = Array.from(this.onlinePlayers.values())
            .sort((a, b) => {
                if (a.isPlaying !== b.isPlaying) {
                    return b.isPlaying ? 1 : -1;
                }
                return b.lastActive - a.lastActive;
            });

        // Обновляем счетчик плавно
        const playerCount = document.querySelector('.player-count');
        if (playerCount) {
            const currentCount = parseInt(playerCount.textContent);
            const newCount = sortedPlayers.length;
            if (currentCount !== newCount) {
                gsap.to(playerCount, {
                    textContent: newCount,
                    duration: 0.3,
                    snap: { textContent: 1 },
                    ease: "power2.out"
                });
            }
        }

        // Создаем Map текущих элементов для быстрого поиска
        const currentElements = new Map();
        Array.from(this.playersList.children).forEach(el => {
            currentElements.set(el.dataset.username, el);
        });

        // Обновляем или создаем элементы
        sortedPlayers.forEach((player, index) => {
            const existingElement = currentElements.get(player.username);
            const playerElement = existingElement || document.createElement('div');
            
            if (!existingElement) {
                // Новый элемент
                playerElement.style.opacity = '0';
                playerElement.style.transform = 'translateX(-10px)';
            }
            
            playerElement.className = `online-player${player.isPlaying ? ' playing' : ''}${player.username === this.currentPlayer ? ' current' : ''}`;
            playerElement.dataset.username = player.username;
            
            const newHtml = `
                <div class="player-status${player.isPlaying ? '' : ' idle'}"></div>
                <div class="player-name">${this.escapeHtml(player.username)}</div>
            `;

            if (playerElement.innerHTML !== newHtml) {
                playerElement.innerHTML = newHtml;
            }

            if (!existingElement) {
                this.playersList.appendChild(playerElement);
                gsap.to(playerElement, {
                    opacity: 1,
                    x: 0,
                    duration: 0.3,
                    ease: "power2.out"
                });
            }
            
            currentElements.delete(player.username);
        });

        // Удаляем отсутствующие элементы с анимацией
        currentElements.forEach(element => {
            gsap.to(element, {
                opacity: 0,
                x: 10,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => element.remove()
            });
        });
    }

    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        if (this.sidebarVisible) {
            this.sidebar.style.display = 'block';
            gsap.fromTo(this.sidebar, 
                { x: '-100%' },
                { x: '0%', duration: 0.3, ease: "power2.out" }
            );
        } else {
            gsap.to(this.sidebar, {
                x: '-100%',
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => {
                    this.sidebar.style.display = 'none';
                }
            });
        }
        this.toggleButton.classList.toggle('collapsed', this.sidebarVisible);
    }

    handleResize() {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile && !this.sidebarVisible) {
            this.sidebarVisible = true;
            this.sidebar.style.display = 'block';
            gsap.fromTo(this.sidebar,
                { x: '-100%' },
                { x: '0%', duration: 0.3, ease: "power2.out" }
            );
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