class Snake {
  constructor() {
    this.body = [{ x: 10, y: 10 }];
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
    // Обновляем направление
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
    
    // Добавляем новую голову
    this.body.unshift(newHead);

    // Если нет запроса на рост, убираем последний сегмент
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
    // Рисуем каждый сегмент змеи
    this.body.forEach((segment, index) => {
      const x = segment.x * gridSize;
      const y = segment.y * gridSize;
      const size = gridSize - 2; // Немного меньше для эффекта отступов

      // Создаем градиент для сегмента
      const gradient = ctx.createRadialGradient(
        x + size/2, y + size/2, 0,
        x + size/2, y + size/2, size
      );

      if (index === 0) {
        // Голова змеи
        gradient.addColorStop(0, this.colors.head);
        gradient.addColorStop(1, this.colors.border);
      } else {
        // Тело змеи
        const colorStop = Math.max(0.2, 1 - (index / this.body.length));
        gradient.addColorStop(0, this.colors.body);
        gradient.addColorStop(colorStop, this.colors.border);
      }

      // Рисуем сегмент с градиентом
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, size, size, 5);
      ctx.fill();

      // Добавляем блик
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

  reset() {
    this.body = [{ x: 10, y: 10 }];
    this.direction = 'right';
    this.newDirection = 'right';
    this.pendingGrowth = 0;
  }
}

export default Snake; 