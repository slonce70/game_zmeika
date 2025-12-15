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

}
