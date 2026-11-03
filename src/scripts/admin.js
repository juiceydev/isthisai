const stale = document.getElementById('stale');

if (stale) {
  let rev = 0;
  const tick = async () => {
    try {
      const next = (await (await fetch('/api/live')).json()).rev;
      if (!rev) rev = next;
      else if (next !== rev) stale.hidden = false;
    } catch {}
  };
  tick();
  setInterval(tick, 15000);
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-confirm]');
  if (target && !confirm(target.dataset.confirm)) event.preventDefault();
});
