export class Snake {
  constructor() {
    this.reset();
  }

  reset() {
    this.body = [
      { x: 10, y: 10 }
    ];
    this.direction = 'right';
    this.newDirection = 'right';
    this.pendingGrowth = 0;
    this.colors = {
      head: '#50c878',
      body: '#3cb371',
      border: '#2e8b57'
    };
  }

  update() {
    // Apply queued direction
    this.direction = this.newDirection;
    const head = this.body[0];
    let newHead = { ...head };

    switch(this.direction) {
      case 'right':
        newHead.x += 1;
        break;
      case 'left':
        newHead.x -= 1;
        break;
      case 'up':
        newHead.y -= 1;
        break;
      case 'down':
        newHead.y += 1;
        break;
    }
    
    // Add new head
    this.body.unshift(newHead);

    // Trim tail when no growth pending
    if (this.pendingGrowth > 0) {
      this.pendingGrowth--;
    } else {
      this.body.pop();
    }
  }

  grow() {
    this.pendingGrowth++;
  }

  draw(ctx, gridSize) {
    // Draw each segment
    this.body.forEach((segment, index) => {
      const x = segment.x * gridSize;
      const y = segment.y * gridSize;
      const size = gridSize - 2; // Slightly smaller for padding effect

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
      ctx.roundRect(x + 1, y + 1, size, size, 5);
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
    });
  }

  checkSelfCollision() {
    const [head, ...body] = this.body;
    return body.some(segment => segment.x === head.x && segment.y === head.y);
  }
}
