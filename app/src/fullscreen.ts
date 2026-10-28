type Options = { transition: () => void; notice: (message: string) => void };

/** Presentation-only mode: reuse controls and include the body-level WebGL canvas. */
export function bindFullscreen(root: HTMLElement, options: Options) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const entry = $<HTMLButtonElement>('button[data-fullscreen]');
  const exitButton = $<HTMLButtonElement>('[data-fullscreen-exit]');
  const mapButton = $<HTMLButtonElement>('[data-fullscreen-map]');
  const driver = $('.driver'), view = $('[data-view="driver"]'), overhead = $('.overhead');
  const dock = $('.practice-dock');
  const controls = ['.transmission', '.control-row', '.hold-button', '.session-buttons'].map(selector => {
    const node = $(selector), marker = document.createComment('normal control position');
    node.before(marker); return { node, marker };
  });
  let active = false, nativeOwned = false, pending = false, disposed = false;
  let mapVisible = true, scrollPosition = 0, lastExit = -Infinity;
  root.dataset.fullscreen = 'false';

  function clipOverhead() {
    if (!active || !mapVisible) { driver.style.clipPath = ''; return; }
    const bounds = driver.getBoundingClientRect(), map = overhead.getBoundingClientRect();
    const x = map.left - bounds.left, y = map.top - bounds.top;
    // Cut the entire driver's DOM, including mirrors, beneath the independent map panel.
    driver.style.clipPath = `polygon(evenodd,0px 0px,${bounds.width}px 0px,${bounds.width}px ${bounds.height}px,0px ${bounds.height}px,0px 0px,${x}px ${y}px,${x}px ${y + map.height}px,${x + map.width}px ${y + map.height}px,${x + map.width}px ${y}px,${x}px ${y}px)`;
  }
  const observer = new ResizeObserver(clipOverhead);
  observer.observe(driver); observer.observe(overhead);
  function showMap() {
    overhead.hidden = active && !mapVisible;
    mapButton.textContent = mapVisible ? '收合俯瞰' : '顯示俯瞰';
    mapButton.setAttribute('aria-expanded', String(mapVisible));
    clipOverhead();
  }
  function leave() {
    if (!active) return;
    active = false; lastExit = performance.now();
    controls.forEach(({ node, marker }) => marker.after(node));
    dock.hidden = true; overhead.hidden = false; driver.style.clipPath = '';
    root.classList.remove('practice-fullscreen'); root.dataset.fullscreen = 'false';
    document.documentElement.classList.remove('practice-open');
    entry.setAttribute('aria-expanded', 'false');
    if (!disposed) { options.transition(); window.scrollTo(0, scrollPosition); entry.focus({ preventScroll: true }); }
  }
  async function exit() {
    if (!active) return;
    if (document.fullscreenElement === document.documentElement) {
      try { await document.exitFullscreen(); }
      catch { options.notice('暫時無法退出全螢幕，請按 Esc。'); return; }
    }
    leave();
  }
  async function enter() {
    if (active || pending || disposed) return;
    pending = true; active = true; scrollPosition = window.scrollY;
    mapVisible = window.innerWidth >= 700;
    controls.forEach(({ node }) => dock.append(node)); dock.hidden = false;
    root.classList.add('practice-fullscreen'); root.dataset.fullscreen = 'true';
    document.documentElement.classList.add('practice-open');
    entry.setAttribute('aria-expanded', 'true'); window.scrollTo(0, 0);
    showMap(); options.transition(); view.focus({ preventScroll: true });
    try {
      if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) throw new Error('Unavailable');
      await document.documentElement.requestFullscreen();
      // Escape/disposal can happen while the browser is processing the request.
      if (!active || disposed) {
        if (document.fullscreenElement === document.documentElement) await document.exitFullscreen();
      }
    } catch {
      if (active && !disposed) options.notice('瀏覽器未開啟全螢幕，已改用頁面內放大；按退出可恢復。');
    } finally {
      pending = false;
      if (active && !disposed) { clipOverhead(); view.focus({ preventScroll: true }); }
    }
  }
  function changed() {
    if (document.fullscreenElement === document.documentElement) nativeOwned = true;
    else if (nativeOwned) { nativeOwned = false; leave(); }
  }
  entry.onclick = () => { void enter(); };
  exitButton.onclick = () => { void exit(); };
  mapButton.onclick = () => { mapVisible = !mapVisible; showMap(); view.focus({ preventScroll: true }); };
  document.addEventListener('fullscreenchange', changed);
  return {
    get active() { return active; }, exit,
    escape() {
      if (active) { void exit(); return true; }
      // Some browsers deliver the key after their native fullscreenchange event.
      return performance.now() - lastExit < 400;
    },
    dispose() {
      disposed = true; observer.disconnect(); document.removeEventListener('fullscreenchange', changed);
      leave(); controls.forEach(({ marker }) => marker.remove());
      if (nativeOwned && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
    },
  };
}
