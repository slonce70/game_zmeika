import { db, auth } from "./firebaseConfig.js";
import { ref, onValue, get, set, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { detectCountry, countryCodeToFlagEmoji } from "./geo.js";
// GSAP is loaded via CDN in index.html and available as global `gsap`

export class OnlinePlayersManager {
    constructor() {
        this.onlinePlayers = new Map();
        this.currentUid = null;
        this.currentUsername = null;
        this.sidebarVisible = window.innerWidth > 768;
        this.lastRender = new Map(); // Track changes
        this.country = { countryCode: '', countryName: '', flag: '' };
        
        // DOM elements
        this.sidebar = document.getElementById('onlinePlayersSidebar');
        this.playersList = document.getElementById('onlinePlayersList');
        this.toggleButton = document.getElementById('toggleSidebar');
        this.mobileIndicator = document.getElementById('mobileOnlineIndicator');
        
        // Firebase ref
        this.onlineRef = ref(db, 'online');
        this.currentUid = auth.currentUser?.uid || null;
        
        this.initializeUI();
        this.initCountry();
        this.setupEventListeners();
        this.startOnlinePlayersSubscription();
    }

    initializeUI() {
        // Initial sidebar state
        if (this.sidebarVisible) {
            this.sidebar.classList.add('visible');
            this.toggleButton.classList.add('collapsed');
        }

        // Mobile indicator handler
        this.mobileIndicator.addEventListener('click', () => this.toggleSidebar());

        // Auto-hide on mobile after short delay
        if (window.innerWidth <= 768) {
            clearTimeout(this._autoHideTimer);
            this._autoHideTimer = setTimeout(() => {
                if (this.sidebarVisible) this.toggleSidebar();
            }, 4000);
            // Cancel auto-hide on first interaction
            ['click','touchstart'].forEach(evt => {
                this.sidebar.addEventListener(evt, () => {
                    if (this._autoHideTimer) {
                        clearTimeout(this._autoHideTimer);
                        this._autoHideTimer = null;
                    }
                }, { once: true });
            });
        }
    }

    setupEventListeners() {
        // Toggle button handler
        this.toggleButton.addEventListener('click', () => this.toggleSidebar());

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    startOnlinePlayersSubscription() {
        this._unsubOnline = onValue(this.onlineRef, (snapshot) => {
            const data = snapshot.val() || {};
            const newPlayers = new Map();
            
            // Rebuild players map (keys are uid)
            Object.entries(data).forEach(([uid, status]) => {
                newPlayers.set(uid, {
                    uid,
                    username: status?.username || 'Player',
                    lastActive: status?.lastActive || Date.now(),
                    isPlaying: !!status?.isPlaying,
                    countryCode: status?.countryCode || ''
                });
            });
            
            // Check if there are material changes
            if (this.hasPlayersChanged(newPlayers)) {
                this.onlinePlayers = newPlayers;
                this.updatePlayersList();
            }
        });
    }

    hasPlayersChanged(newPlayers) {
        if (this.onlinePlayers.size !== newPlayers.size) return true;
        
        for (const [uid, newData] of newPlayers) {
            const currentData = this.onlinePlayers.get(uid);
            if (!currentData) return true;
            if (currentData.isPlaying !== newData.isPlaying) return true;
            if (currentData.lastActive !== newData.lastActive) return true;
        }
        
        return false;
    }

    updatePlayersList() {
        if (!this.playersList) return;

        // Sort players by status and recent activity
        const sortedPlayers = Array.from(this.onlinePlayers.values())
            .sort((a, b) => {
                if (a.isPlaying !== b.isPlaying) {
                    return b.isPlaying ? 1 : -1;
                }
                return b.lastActive - a.lastActive;
            });

        // Smoothly update player counter badge
        const playerCount = document.querySelector('.player-count');
        if (playerCount) {
            const currentCount = parseInt(playerCount.textContent);
            const newCount = sortedPlayers.length;
            if (currentCount !== newCount) {
                playerCount.textContent = newCount;
                gsap.fromTo(playerCount, { scale: 1.0 }, { scale: 1.2, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" });
            }
        }

        // Build map of existing elements for quick diff
        const currentElements = new Map();
        Array.from(this.playersList.children).forEach(el => {
            currentElements.set(el.dataset.uid, el);
        });

        // Update or create player elements
        sortedPlayers.forEach((player, index) => {
            const existingElement = currentElements.get(player.uid);
            const playerElement = existingElement || document.createElement('div');
            
            if (!existingElement) {
                // New element animation
                playerElement.style.opacity = '0';
                playerElement.style.transform = 'translateX(-10px)';
            }
            
            playerElement.className = `online-player${player.isPlaying ? ' playing' : ''}${player.uid === this.currentUid ? ' current' : ''}`;
            playerElement.dataset.uid = player.uid;
            
            const newHtml = `
                <div class="player-status${player.isPlaying ? '' : ' idle'}"></div>
                <div class="player-name">${player.countryCode ? `<span class=\"flag-emoji\" title=\"${this.escapeHtml(player.countryCode)}\">${countryCodeToFlagEmoji(player.countryCode)}</span> ` : ''}${this.escapeHtml(player.username)}</div>
            `;

            if (playerElement.innerHTML !== newHtml) {
                playerElement.innerHTML = newHtml;
            }

            if (!existingElement) {
                this.playersList.appendChild(playerElement);
                if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    gsap.to(playerElement, {
                        opacity: 1,
                        x: 0,
                        duration: 0.3,
                        ease: "power2.out"
                    });
                } else {
                    playerElement.style.opacity = '1';
                    playerElement.style.transform = 'none';
                }
            }
            
            currentElements.delete(player.uid);
        });

        // Remove missing elements with animation
        currentElements.forEach(element => {
            if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                gsap.to(element, {
                    opacity: 0,
                    x: 10,
                    duration: 0.3,
                    ease: "power2.in",
                    onComplete: () => element.remove()
                });
            } else {
                element.remove();
            }
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
        this.currentUsername = username;
        this.currentUid = auth.currentUser?.uid || this.currentUid;
        this.updatePlayersList();
    }

    updatePlayerStatus(isPlaying) {
        const uid = auth.currentUser?.uid || this.currentUid;
        if (!uid) return;
        const now = Date.now();
        if (this._lastPlayingState === isPlaying && this._lastStatusWriteTs && (now - this._lastStatusWriteTs) < 2000) {
            return;
        }
        this._lastPlayingState = isPlaying;
        this._lastStatusWriteTs = now;
        const userRef = ref(db, `online/${uid}`);
        set(userRef, {
            username: this.currentUsername || 'Player',
            lastActive: serverTimestamp(),
            isPlaying,
            countryCode: this.country?.countryCode || ''
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
        if (this._unsubOnline) {
            try { this._unsubOnline(); } catch (e) {}
            this._unsubOnline = null;
        }
        if (this.currentUid) {
            const userRef = ref(db, `online/${this.currentUid}`);
            set(userRef, null);
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
}
