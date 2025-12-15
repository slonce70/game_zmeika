export class InputHandler {
  constructor(game) {
    this.game = game;
    this.bindEvents();
    this.setupMobileControls();
    this.addSwipeControls();
  }

  bindEvents() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    if (e.key === ' ') {
      this.game.togglePause();
      return;
    }

    const key = e.key.replace('Arrow', '').toLowerCase();
    this.updateDirection(key);
  }

  updateDirection(direction) {
    if (this.game.isPaused) return;

    const directions = {
      right: ['up', 'down'],
      left: ['up', 'down'],
      up: ['left', 'right'],
      down: ['left', 'right']
    };

    if (directions[this.game.snake.direction] && directions[this.game.snake.direction].includes(direction)) {
      this.game.snake.newDirection = direction;
    }
  }

  setupMobileControls() {
    const mobileControls = document.querySelector('.mobile-controls');
    if (mobileControls) {
      const buttons = mobileControls.querySelectorAll('.control-btn');
      buttons.forEach(button => {
        ['touchstart', 'mousedown'].forEach(eventType => {
          button.addEventListener(eventType, (e) => {
            e.preventDefault();
            const direction = button.dataset.direction;
            if (direction) {
              this.updateDirection(direction);
            }
          });
        });
      });
    }
  }

  addSwipeControls() {
    const el = this.game.canvas;
    if (!el) return;
    let sx = 0, sy = 0, st = 0;
    const threshold = 24; // px
    const maxTapTime = 400; // ms

    const onStart = (e) => {
      const t = e.touches ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY; st = Date.now();
    };

    const onEnd = (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
      const dx = (t.clientX - sx);
      const dy = (t.clientY - sy);
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const dt = Date.now() - st;

      if (dt > maxTapTime && adx < threshold && ady < threshold) return;
      if (adx < threshold && ady < threshold) return;
      e.preventDefault();

      if (adx > ady) {
        this.updateDirection(dx > 0 ? 'right' : 'left');
      } else {
        this.updateDirection(dy > 0 ? 'down' : 'up');
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: false });
  }

  cleanup() {
    document.removeEventListener('keydown', this.handleKeyDown);
    // Note: Touch listeners on elements could be cleaned up if we stored references,
    // but usually DOM removal handles it. For strictness we could, but skipping for now as game instance persists.
  }
}
