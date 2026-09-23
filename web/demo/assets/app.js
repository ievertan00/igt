const labels = { dashboard: '总览', grammar: '语法检查', coach: 'Coach 计划', review: '词汇复习', ask: 'Ask' };
const views = document.querySelectorAll('.view');
function showView(name) {
  const target = labels[name] ? name : 'dashboard';
  views.forEach((view) => view.classList.toggle('active', view.id === `view-${target}`));
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.dataset.view === target;
    item.classList.toggle('active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelector('#page-label').textContent = labels[target];
  history.replaceState(null, '', `#${target}`);
  document.querySelector('.sidebar')?.classList.remove('open');
}
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
showView(location.hash.slice(1) || 'dashboard');
document.querySelector('.mobile-menu')?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));
document.querySelector('#check-button')?.addEventListener('click', (event) => {
  const button = event.currentTarget; const original = button.innerHTML;
  button.disabled = true; button.innerHTML = '分析中…';
  setTimeout(() => { button.disabled = false; button.innerHTML = original; document.querySelector('#grammar-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 650);
});
document.querySelector('#reveal-button')?.addEventListener('click', (event) => { event.currentTarget.classList.add('hidden'); document.querySelector('#review-actions')?.classList.remove('hidden'); });
document.querySelector('#save-ask')?.addEventListener('click', (event) => { event.currentTarget.textContent = '已保存 ✓'; event.currentTarget.disabled = true; document.querySelector('#saved-message')?.classList.add('show'); });
