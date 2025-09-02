export class Food {
  constructor(gridSize, canvasSize) {
    this.position = { x: 0, y: 0 };
    this.animationFrame = 0;
    this.glowIntensity = 0;
    this.glowDirection = 1;
    this.respawn(gridSize, canvasSize);
  }

  respawn(gridSize, canvasSize) {
    this.position = {
      x: Math.floor(Math.random() * (canvasSize.width / gridSize)),
      y: Math.floor(Math.random() * (canvasSize.height / gridSize))
    };
    this.animationFrame = 0;
    this.glowIntensity = 0;
  }

  draw(ctx, gridSize) {
    const x = this.position.x * gridSize;
    const y = this.position.y * gridSize;
    const size = gridSize - 4;

    // Update glow animation
    this.glowIntensity += 0.05 * this.glowDirection;
    if (this.glowIntensity >= 1) {
      this.glowDirection = -1;
    } else if (this.glowIntensity <= 0) {
      this.glowDirection = 1;
    }

    // Draw glow
    const glow = ctx.createRadialGradient(
      x + size/2 + 2, 
      y + size/2 + 2,
      0,
      x + size/2 + 2,
      y + size/2 + 2,
      size * 1.5
    );
    glow.addColorStop(0, `rgba(255, 0, 0, ${0.3 * this.glowIntensity})`);
    glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    
    ctx.fillStyle = glow;
    ctx.fillRect(x - size/2, y - size/2, size * 2, size * 2);

    // Draw main food
    const gradient = ctx.createRadialGradient(
      x + size/2 + 2,
      y + size/2 + 2,
      size * 0.2,
      x + size/2 + 2,
      y + size/2 + 2,
      size
    );
    gradient.addColorStop(0, '#ff5555');
    gradient.addColorStop(0.7, '#ff0000');
    gradient.addColorStop(1, '#8b0000');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, size, size, 5);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(
      x + size/3 + 2,
      y + size/3 + 2,
      size/6,
      size/6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    this.animationFrame++;
  }
}
