const DICT = {
  en: {
    title: 'Snake Game',
    online_players: 'Now playing:',
    use_arrows: 'Use arrow keys to control the snake',
    restart: 'Restart Game',
    leaderboard_full: 'Full Leaderboard',
    top10: 'Top 10 Players',
    live: 'Live',
    enter_name: 'Enter Your Name',
    start_game: 'Start Game',
    rank: 'Rank',
    player: 'Player',
    score: 'Score',
    date: 'Date',
    close: 'Close',
    paused: 'Paused',
    today: 'Today',
    yesterday: 'Yesterday',
    online_sidebar: 'Online Players',
    new_high_score: 'New High Score!',
    continue: 'Continue'
  },
  ru: {
    title: 'Snake Game',
    online_players: 'Сейчас играют:',
    use_arrows: 'Управляйте стрелками',
    restart: 'Перезапуск',
    leaderboard_full: 'Таблица лидеров',
    top10: 'Топ‑10 игроков',
    live: 'Live',
    enter_name: 'Введите имя',
    start_game: 'Начать игру',
    rank: 'Место',
    player: 'Игрок',
    score: 'Счёт',
    date: 'Дата',
    close: 'Закрыть',
    paused: 'Пауза',
    today: 'Сегодня',
    yesterday: 'Вчера',
    online_sidebar: 'Онлайн игроки',
    new_high_score: 'Новый рекорд!',
    continue: 'Продолжить'
  }
};

class I18n {
  constructor() {
    this.lang = localStorage.getItem('lang') || (navigator.language?.startsWith('ru') ? 'ru' : 'en');
    this.listeners = new Set();
  }

  t(key) {
    return (DICT[this.lang] && DICT[this.lang][key]) || key;
  }

  setLang(lang) {
    if (!DICT[lang]) return;
    this.lang = lang;
    localStorage.setItem('lang', lang);
    this.apply();
    this.listeners.forEach(cb => cb(lang));
  }

  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  apply(root = document) {
    const nodes = root.querySelectorAll('[data-i18n]');
    nodes.forEach(node => {
      const key = node.getAttribute('data-i18n');
      if (!key) return;
      if (node.tagName === 'INPUT' && node.placeholder) {
        node.placeholder = this.t(key);
      } else {
        node.textContent = this.t(key);
      }
    });
  }
}

export const i18n = new I18n();
