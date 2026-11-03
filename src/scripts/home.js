const feed = document.getElementById('feed');
const button = document.querySelector('.more-button');

if (feed && button) {
  let loading = false;
  let done = false;
  button.hidden = false;
  const load = async () => {
    if (loading || done) return;
    loading = true;
    button.disabled = true;
    const last = feed.lastElementChild;
    const after = last ? last.dataset.id : '';
    try {
      const res = await fetch(`/feed?after=${encodeURIComponent(after)}`);
      if (!res.ok) throw new Error('feed');
      const html = (await res.text()).trim();
      if (html) {
        feed.insertAdjacentHTML('beforeend', html);
      } else {
        done = true;
        button.parentElement.remove();
      }
    } catch {
      // do nothing lol
    }
    loading = false;
    if (!done) button.disabled = false;
  };
  button.addEventListener('click', load);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: '400px' },
    ).observe(button);
  }
}

if (feed) {
  let rev = 0;
  const tick = async () => {
    try {
      const next = (await (await fetch('/api/live')).json()).rev;
      if (!rev) {
        rev = next;
        return;
      }
      if (next === rev) return;
      rev = next;
      const res = await fetch('/feed');
      if (!res.ok) return;
      const template = document.createElement('template');
      template.innerHTML = (await res.text()).trim();
      const rows = [...template.content.children].reverse();
      for (const row of rows) {
        const current = feed.querySelector(`[data-id="${row.dataset.id}"]`);
        if (!current) {
          feed.prepend(row);
          continue;
        }
        for (const part of ['.thumb', '.body', '.verdict']) {
          const next = row.querySelector(part);
          const prev = current.querySelector(part);
          if (next && prev && next.outerHTML !== prev.outerHTML) prev.replaceWith(next);
        }
      }
    } catch {}
  };
  tick();
  setInterval(tick, 15000);
}
