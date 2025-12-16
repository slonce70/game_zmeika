import { Food } from './food.js';
import { roundRect } from './canvasUtils.js';

export class BonusFood extends Food {
  constructor(gridSize, canvasSize) {
    super(gridSize, canvasSize);
    this.active = false;
    this.expiresAt = 0;
    this.glow = 1;
    this._tween = null;
  }

  spawn(gridSize, canvasSize, lifetimeMs = 8000) {
    this.respawn(gridSize, canvasSize);
    this.active = true;
    this.expiresAt = performance.now() + lifetimeMs;

    if (this._tween) this._tween.kill();
    this.glow = 1;
    this._tween = gsap.to(this, {
      glow: 1.5,
      duration: 0.7,
      ease: 'power1.inOut',
      yoyo: true,
      repeat: -1
    });
  }

  deactivate() {
    this.active = false;
    if (this._tween) {
      this._tween.kill();
      this._tween = null;
    }
    this.glow = 1;
  }

  maybeExpire(now) {
    if (this.active && now >= this.expiresAt) {
      this.deactivate();
    }
  }

  draw(ctx, gridSize) {
    if (!this.active) return;
    // Golden glowing square
    const x = this.position.x * gridSize;
    const y = this.position.y * gridSize;
    const size = gridSize - 4;

    // Glow
    const glowSize = size * 1.2 * this.glow;
    const glow = ctx.createRadialGradient(
      x + size/2 + 2, y + size/2 + 2, 0,
      x + size/2 + 2, y + size/2 + 2, glowSize
    );
    glow.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
    glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + size/2 + 2 - glowSize, y + size/2 + 2 - glowSize, glowSize * 2, glowSize * 2);

    // Main golden square
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, '#ffe680');
    gradient.addColorStop(0.5, '#ffd700');
    gradient.addColorStop(1, '#b8860b');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    roundRect(ctx, x + 2, y + 2, size, size, 6);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x + size/3 + 2, y + size/3 + 2, size/6, size/6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
