// Ativa a folha de fontes sem bloquear a renderização (CSP não permite handlers inline).
document.querySelectorAll('link[data-async-font]').forEach(function (l) {
  l.media = 'all';
});
