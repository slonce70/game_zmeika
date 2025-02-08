export class ScoreManager {
  constructor() {
    this.score = 0;
  }

  incrementScore() {
    this.score++;
  }

  reset() {
    this.score = 0;
  }

  draw(ctx) {
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + this.score, 10, 20);
  }
} 