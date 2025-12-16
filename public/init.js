import { i18n } from './i18n.js';

i18n.apply();
const select = document.getElementById('langSelect');
if (select) {
  select.value = i18n.lang;
  select.addEventListener('change', () => i18n.setLang(select.value));
}
