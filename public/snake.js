import { roundRect } from './canvasUtils.js';

export class Snake {
  constructor() {
    this.reset();
  }

  reset() {
    if (this.tweens) {
      this.tweens.forEach(t => t.kill());
    }
    gsap.killTweensOf(this);
    this.tweens = [];

    this.body = [
      { x: 10, y: 10, renderX: 10, renderY: 10 }
    ];
    this.direction = 'right';
    this.newDirection = 'right';
    this.pendingGrowth = 0;

    // Restore original colors
    gsap.killTweensOf(this.colors);
    this.colors = {
      head: '#50c878',
      body: '#3cb371',
      border: '#2e8b57'
    };
    this.headScaleX = 1;
    this.headScaleY = 1;
    this.isDead = false;
  }

  update(interval) {
    if (this.isDead) return;
    const directionChanged = this.newDirection !== this.direction;

    // Apply queued direction
    this.direction = this.newDirection;
    const head = this.body[0];

    // The new head starts at the same render position as the old head
    let newHead = { x: head.x, y: head.y, renderX: head.renderX, renderY: head.renderY };

    switch(this.direction) {
      case 'right': newHead.x += 1; break;
      case 'left': newHead.x -= 1; break;
      case 'up': newHead.y -= 1; break;
      case 'down': newHead.y += 1; break;
    }
    
    this.body.unshift(newHead);

    if (this.pendingGrowth > 0) {
      this.pendingGrowth--;
    } else {
      this.body.pop();
    }

    // Animate everything to its new logical position
    if (this.tweens) {
        this.tweens.forEach(t => t.kill());
    }
    this.tweens = [];
    this.body.forEach((segment) => {
        const tween = gsap.to(segment, {
            duration: interval / 1000,
            renderX: segment.x,
            renderY: segment.y,
            ease: 'linear'
        });
        this.tweens.push(tween);
    });

    if (directionChanged) {
        this.triggerTurnAnimation(interval);
    }
  }

  triggerTurnAnimation(interval) {
    gsap.killTweensOf(this);
    this.headScaleX = this.direction === 'left' || this.direction === 'right' ? 1.3 : 0.7;
    this.headScaleY = this.direction === 'up' || this.direction === 'down' ? 1.3 : 0.7;
    gsap.to(this, {
        duration: interval / 2000,
        headScaleX: 1,
        headScaleY: 1,
        ease: 'elastic.out(1, 0.5)'
    });
  }

  grow() {
    this.pendingGrowth++;
  }

  draw(ctx, gridSize) {
    // Draw each segment
    this.body.forEach((segment, index) => {
      const x = segment.renderX * gridSize;
      const y = segment.renderY * gridSize;
      const size = gridSize - 2;

      ctx.save();

      if (index === 0) {
        // Apply squash and stretch to head
        ctx.translate(x + size/2, y + size/2);
        ctx.scale(this.headScaleX, this.headScaleY);
        ctx.translate(-(x + size/2), -(y + size/2));
      }

      // Create gradient for segment
      const gradient = ctx.createRadialGradient(
        x + size/2, y + size/2, 0,
        x + size/2, y + size/2, size
      );

      if (index === 0) {
        // Head
        gradient.addColorStop(0, this.colors.head);
        gradient.addColorStop(1, this.colors.border);
      } else {
        // Body
        const colorStop = Math.max(0.2, 1 - (index / this.body.length));
        gradient.addColorStop(0, this.colors.body);
        gradient.addColorStop(colorStop, this.colors.border);
      }

      // Draw rounded segment
      ctx.fillStyle = gradient;
      ctx.beginPath();
      roundRect(ctx, x + 1, y + 1, size, size, 5);
      ctx.fill();

      // Highlight for head
      if (index === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
          x + size/3,
          y + size/3,
          size/6,
          size/6,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    });
  }

  checkSelfCollision() {
    const [head, ...body] = this.body;
    return body.some(segment => segment.x === head.x && segment.y === head.y);
  }

  flash(onComplete) {
    gsap.to(this.colors, {
      head: '#ff0000',
      body: '#ff0000',
      duration: 0.1,
      yoyo: true,
      repeat: 3,
      onComplete
    });
  }

  breakApart() {
    this.isDead = true;
    this.body.forEach((segment, i) => {
      const delay = i * 0.02;
      gsap.to(segment, {
        duration: 0.6 + Math.random() * 0.4,
        renderX: segment.renderX + (Math.random() - 0.5) * 20,
        renderY: segment.renderY + (Math.random() - 0.5) * 20,
        opacity: 0,
        ease: 'power2.out',
        delay
      });
    });
  }
}
