export class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    const angle = options.angle != null ? options.angle : Math.random() * Math.PI * 2;
    const speed = options.speed != null ? options.speed : 1 + Math.random() * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.size = options.size != null ? options.size : 2 + Math.random() * 2;
    this.color = options.color || 'rgba(255,100,100,1)';
    this.life = 0;
    this.maxLife = options.maxLife || 600; // ms
    this.gravity = options.gravity || 0.0015;
    this.friction = options.friction || 0.98;
  }

  update(dt) {
    this.life += dt;
    this.vy += this.gravity * dt;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha = Math.max(0, 1 - this.life / this.maxLife);
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnExplosion(x, y, count = 20, color = 'rgba(255,100,100,1)') {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.7 + Math.random() * 2.5;
      this.particles.push(new Particle(x, y, {
        angle,
        speed,
        size: 1.5 + Math.random() * 2.5,
        color,
        maxLife: 500 + Math.random() * 500
      }));
    }
  }

  update(dt) {
    this.particles.forEach(p => p.update(dt));
    // Remove dead
    this.particles = this.particles.filter(p => p.life < p.maxLife && p.alpha > 0.01);
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }
}

