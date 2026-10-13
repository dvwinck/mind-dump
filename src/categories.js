/**
 * Mind Dump - Categories
 * Single source of truth for the note categories.
 * Adding one also needs: two columns in index.html (mobile + desktop)
 * and a color in styles/app.css (tests/categories.test.js guards the HTML part).
 */

export const CATEGORIES = [
  { id: 'unclear', name: 'Demandas com pouca clareza' },
  { id: 'feelings', name: 'Sentimentos' },
  { id: 'projects', name: 'Projetos' },
  { id: 'desires', name: 'Desejos' },
  { id: 'tasks', name: 'Tarefas' },
  { id: 'not-do', name: 'Não fazer' }
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
