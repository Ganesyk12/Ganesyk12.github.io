/* Bekasi Explorer — interaksi desktop, dock, jendela & routing hash */
(() => {
  "use strict";

  const PLACES = Array.isArray(window.PLACES) ? window.PLACES : [];
  const PLACE_MAP = new Map(PLACES.map((place) => [place.id, place]));
  const TOTAL = PLACES.length;
  const BASE_TITLE = "Bekasi Explorer — 10 Tempat Instagramable";
  const BASE_HASH = "#/tempat/";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isMobile = () => window.matchMedia("(max-width: 820px)").matches;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pad = (number) => String(number).padStart(2, "0");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, ms))]);

  const els = {
    desktopIcons: $("#desktopIcons"),
    dock: $("#dock"),
    windowLayer: $("#windowLayer"),
    template: $("#appWindowTemplate"),
    clock: $("#clock"),
    themeToggle: $('[data-action="toggle-theme"]'),
    osToggle: $('[data-action="toggle-os"]'),
    toast: $("#toast")
  };

  const state = {
    places: PLACES,
    currentId: null,
    win: null,
    detail: null,
    list: null,
    search: null,
    empty: null,
    dockItems: new Map(),
    closing: false,
    toastTimer: 0,
    dockRaf: 0,
    dockX: 0
  };

  /* ---------- helpers ---------- */
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  const safeGet = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeSet = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage bisa diblokir di mode privat */
    }
  };

  const mapsUrl = (place) =>
    place.maps ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapsQuery || `${place.name} Bekasi`)}`;

  const dockFor = (id) => state.dockItems.get(id) || null;

  const setHash = (hash) => {
    if (location.hash === hash) return;
    try {
      history.pushState(null, "", hash);
    } catch {
      location.hash = hash;
    }
  };

  /* ---------- render shortcut icons ---------- */
  function renderShortcuts() {
    const desktopFragment = document.createDocumentFragment();
    const dockFragment = document.createDocumentFragment();

    PLACES.forEach((place, index) => {
      const desktop = document.createElement("button");
      desktop.type = "button";
      desktop.className = "desk-icon";
      desktop.dataset.place = place.id;
      desktop.style.setProperty("--a", place.accent);
      desktop.style.setProperty("--b", place.accent2);
      desktop.style.setProperty("--i", String(index));
      desktop.setAttribute("aria-label", `Buka info ${place.name}`);
      desktop.innerHTML = `
        <span class="desk-tile" aria-hidden="true">
          ${escapeHtml(place.emoji)}
          <span class="desk-num">${pad(place.no)}</span>
        </span>
        <span class="desk-label">${escapeHtml(place.name)}</span>`;
      desktopFragment.append(desktop);

      const dock = document.createElement("button");
      dock.type = "button";
      dock.className = "dock-item";
      dock.dataset.place = place.id;
      dock.style.setProperty("--a", place.accent);
      dock.style.setProperty("--b", place.accent2);
      dock.setAttribute("aria-label", `Buka info ${place.name}`);
      dock.innerHTML = `
        <span aria-hidden="true">${escapeHtml(place.emoji)}</span>
        <span class="dock-tip">${escapeHtml(place.name)}</span>`;
      dockFragment.append(dock);
      state.dockItems.set(place.id, dock);
    });

    els.desktopIcons.append(desktopFragment);
    els.dock.append(dockFragment);
  }

  /* ---------- theme & OS style ---------- */
  function setTheme(theme, persist = true) {
    const dark = theme === "dark";
    document.body.classList.toggle("theme-dark", dark);
    document.body.classList.toggle("theme-light", !dark);

    if (els.themeToggle) {
      const label = dark ? "Aktifkan mode terang" : "Aktifkan mode gelap";
      els.themeToggle.setAttribute("aria-label", label);
      els.themeToggle.setAttribute("title", label);
      els.themeToggle.setAttribute("aria-pressed", String(dark));
    }

    $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#070b18" : "#e7edf8");
    if (persist) safeSet("bekasi-theme", theme);
  }

  function setOs(os, persist = true) {
    const windows = os === "windows";
    document.body.classList.toggle("os-windows", windows);
    document.body.classList.toggle("os-mac", !windows);

    const label = $(".os-label");
    if (label) label.textContent = windows ? "Windows" : "macOS";

    const next = windows ? "macOS" : "Windows";
    els.osToggle?.setAttribute("aria-label", `Ganti antarmuka ke gaya ${next}`);
    els.osToggle?.setAttribute("title", `Ganti antarmuka ke gaya ${next}`);

    if (persist) safeSet("bekasi-os", os);
  }

  function tickClock() {
    const now = new Date();
    const day = new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(now);
    const time = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    })
      .format(now)
      .replace(/\./g, ":");

    if (els.clock) {
      els.clock.textContent = `${day} · ${time}`;
      els.clock.dateTime = now.toISOString();
    }
  }

  /* ---------- toast & clipboard ---------- */
  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Alamat disalin ke clipboard");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      try {
        document.execCommand("copy");
        toast("Alamat disalin ke clipboard");
      } catch {
        toast("Gagal menyalin alamat");
      }
      field.remove();
    }
  }

  /* ---------- sidebar ---------- */
  function attachThumbFallback(image) {
    const remove = () => image.remove();
    image.addEventListener("error", remove, { once: true });
    if (image.complete && image.naturalWidth === 0) remove();
  }

  function populateSidebar() {
    if (!state.list) return;
    const fragment = document.createDocumentFragment();

    PLACES.forEach((place) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "place-item";
      item.dataset.place = place.id;
      item.style.setProperty("--a", place.accent);
      item.style.setProperty("--b", place.accent2);
      item.setAttribute("aria-label", `Tampilkan ${place.name}`);
      item.innerHTML = `
        <span class="place-thumb" aria-hidden="true">
          <span class="place-emoji">${escapeHtml(place.emoji)}</span>
          <img src="${escapeHtml(place.image)}" alt="" loading="lazy" decoding="async">
        </span>
        <span class="place-info">
          <span class="place-name">${escapeHtml(place.name)}</span>
          <span class="place-cat">${escapeHtml(place.category)}</span>
        </span>
        <span class="place-num" aria-hidden="true">${pad(place.no)}</span>`;
      fragment.append(item);
    });

    state.list.append(fragment);
    $$("img", state.list).forEach(attachThumbFallback);
  }

  function bindSearch() {
    if (!state.search) return;

    state.search.addEventListener("input", () => {
      const query = state.search.value.trim().toLowerCase();
      let shown = 0;

      $$(".place-item", state.list).forEach((item) => {
        const place = PLACE_MAP.get(item.dataset.place);
        if (!place) return;
        const haystack = `${place.name} ${place.category} ${place.area}`.toLowerCase();
        const match = !query || haystack.includes(query);
        item.hidden = !match;
        if (match) shown += 1;
      });

      if (state.empty) state.empty.hidden = shown !== 0;
    });

    state.search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const first = state.list?.querySelector(".place-item:not([hidden])");
      if (first) navigate(first.dataset.place, first);
    });
  }

  function setActiveState(id) {
    $$("[data-place]").forEach((element) => {
      const active = element.dataset.place === id;
      element.classList.toggle("is-active", active);
      if (active) {
        element.setAttribute("aria-current", "true");
      } else {
        element.removeAttribute("aria-current");
      }
    });
  }

  /* ---------- detail view ---------- */
  function renderDetail(place, { animate = false } = {}) {
    if (!state.detail) return;

    const index = PLACES.indexOf(place);
    const previous = PLACES[(index - 1 + TOTAL) % TOTAL];
    const next = PLACES[(index + 1) % TOTAL];
    const photo = escapeHtml(place.image);
    const name = escapeHtml(place.name);
    const address = escapeHtml(place.address);

    state.detail.innerHTML = `
      <figure class="hero" style="--a:${place.accent};--b:${place.accent2}">
        <div class="hero-fallback" aria-hidden="true">${escapeHtml(place.emoji)}</div>
        <img class="hero-img" src="${photo}" alt="Foto ${name}" loading="eager" decoding="async">
        <div class="hero-scrim" aria-hidden="true"></div>
        <span class="hero-index">${pad(place.no)} <i>/ ${pad(TOTAL)}</i></span>
        <div class="hero-copy">
          <span class="hero-kicker">${escapeHtml(place.category)} · ${escapeHtml(place.area)}</span>
          <h2>${name}</h2>
          <div class="hero-chips">
            <span class="chip"><span aria-hidden="true">🕒</span>${escapeHtml(place.hours)}</span>
            <span class="chip"><span aria-hidden="true">🎟️</span>${escapeHtml(place.ticket)}</span>
          </div>
        </div>
      </figure>

      <div class="detail-content">
        <p class="lede">${escapeHtml(place.description)}</p>

        <div class="meta-grid">
          <div class="meta-card">
            <span class="meta-label">Jam buka</span>
            <p>${escapeHtml(place.hours)}</p>
          </div>
          <div class="meta-card">
            <span class="meta-label">HTM</span>
            <p>${escapeHtml(place.ticket)}</p>
          </div>
          <div class="meta-card wide">
            <span class="meta-label">Alamat</span>
            <p>${address}</p>
            <div class="meta-actions">
              <button class="btn btn-ghost btn-small" type="button" data-copy="${address}">Salin alamat</button>
              <a class="btn btn-ghost btn-small" href="${mapsUrl(place)}" target="_blank" rel="noopener">
                Buka di Maps <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>

        <nav class="pager" aria-label="Navigasi tempat">
          <button class="pager-btn" type="button" data-go="${previous.id}">
            <span class="pager-dir">← Sebelumnya</span>
            <span class="pager-name">${escapeHtml(previous.name)}</span>
          </button>
          <span class="pager-count">${place.no} / ${TOTAL}</span>
          <button class="pager-btn pager-next" type="button" data-go="${next.id}">
            <span class="pager-dir">Berikutnya →</span>
            <span class="pager-name">${escapeHtml(next.name)}</span>
          </button>
        </nav>
      </div>`;

    state.detail.scrollTop = 0;
    state.detail.setAttribute("aria-label", `Info ${place.name}`);
    setActiveState(place.id);

    const heroImage = $(".hero-img", state.detail);
    const hideImage = () => $(".hero", state.detail)?.classList.add("img-failed");
    if (heroImage) {
      heroImage.addEventListener("error", hideImage, { once: true });
      if (heroImage.complete && heroImage.naturalWidth === 0) hideImage();
    }

    const activeItem = $(`.place-item[data-place="${place.id}"]`, state.list);
    activeItem?.scrollIntoView({ block: "nearest", inline: "nearest" });

    const title = $(".win-title-text", state.win);
    if (title) title.textContent = place.name;
    document.title = `${place.name} — Bekasi Explorer`;

    if (animate && !reduceMotion.matches) {
      state.detail.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 340, easing: "cubic-bezier(.22, 1, .36, 1)" }
      );
      heroImage?.animate(
        [{ transform: "scale(1.06)" }, { transform: "scale(1)" }],
        { duration: 700, easing: "cubic-bezier(.22, 1, .36, 1)" }
      );
    }
  }

  /* ---------- window animation ---------- */
  function animateWindowIn(trigger) {
    const win = state.win;
    if (!win) return;

    win.style.setProperty("--tx", "0px");
    win.style.setProperty("--ty", "0px");

    if (reduceMotion.matches || isMobile()) {
      win.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
      return;
    }

    const winRect = win.getBoundingClientRect();
    const targetRect = trigger?.getBoundingClientRect();
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth / 2;
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : window.innerHeight / 2;
    const dx = targetX - (winRect.left + winRect.width / 2);
    const dy = targetY - (winRect.top + winRect.height / 2);

    win.animate(
      [
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.14)` },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }
      ],
      { duration: 560, easing: "cubic-bezier(.16, 1, .3, 1)" }
    );
  }

  function animateWindowOut(win) {
    const target = dockFor(state.currentId) || els.dock;
    const tx = parseFloat(win.style.getPropertyValue("--tx")) || 0;
    const ty = parseFloat(win.style.getPropertyValue("--ty")) || 0;

    if (reduceMotion.matches || isMobile()) {
      return win.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: "ease-in",
        fill: "forwards"
      }).finished;
    }

    const winRect = win.getBoundingClientRect();
    const targetRect = target?.getBoundingClientRect();
    const dx = targetRect ? targetRect.left + targetRect.width / 2 - (winRect.left + winRect.width / 2) : 0;
    const dy = targetRect ? targetRect.top + targetRect.height / 2 - (winRect.top + winRect.height / 2) : 0;

    return win.animate(
      [
        { opacity: 1, transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1)` },
        {
          opacity: 0,
          transform: `translate(calc(-50% + ${tx + dx}px), calc(-50% + ${ty + dy}px)) scale(.1)`
        }
      ],
      { duration: 360, easing: "cubic-bezier(.4, 0, .7, .2)", fill: "forwards" }
    ).finished;
  }

  function pulseDock(id) {
    const item = dockFor(id);
    if (!item || reduceMotion.matches) return;
    item.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-10px) scale(1.14)" },
        { transform: "translateY(0) scale(1)" }
      ],
      { duration: 520, easing: "cubic-bezier(.34, 1.56, .64, 1)" }
    );
  }

  /* ---------- window lifecycle ---------- */
  function createWindow() {
    if (!els.template) return null;
    const win = els.template.content.firstElementChild.cloneNode(true);
    win.classList.add("is-preparing");
    els.windowLayer.append(win);

    state.win = win;
    state.detail = $("#placeDetail", win);
    state.list = $("#placeList", win);
    state.search = $("#placeSearch", win);
    state.empty = $("#placeEmpty", win);

    populateSidebar();
    bindSearch();
    bindWindow(win);

    return win;
  }

  function openPlace(id, trigger = null) {
    const place = PLACE_MAP.get(id);
    if (!place) return;

    if (state.closing) {
      window.setTimeout(() => openPlace(id, trigger), 420);
      return;
    }

    const previousId = state.currentId;
    const newWindow = !state.win;
    if (newWindow) createWindow();
    if (!state.win) return;

    const win = state.win;
    const interrupted = win.classList.contains("is-minimizing");

    if (interrupted) {
      win.getAnimations().forEach((animation) => animation.cancel());
      win.classList.remove("is-minimizing");
      win.style.pointerEvents = "";
    }

    const restored = win.classList.contains("is-minimized");
    if (restored) win.classList.remove("is-minimized");

    setHash(`${BASE_HASH}${id}`);
    renderDetail(place, { animate: !newWindow && !restored && !interrupted && previousId !== id && previousId !== null });
    state.currentId = id;

    if (newWindow) {
      win.classList.remove("is-preparing");
      requestAnimationFrame(() => animateWindowIn(trigger));
    } else if (restored || interrupted) {
      requestAnimationFrame(() => animateWindowIn(trigger || dockFor(id)));
    } else if (previousId && previousId !== id) {
      pulseDock(id);
    }
  }

  async function minimizeApp() {
    const win = state.win;
    if (!win || state.closing || win.classList.contains("is-minimizing")) return;

    if (win.classList.contains("is-minimized")) return;
    win.classList.add("is-minimizing");
    win.style.pointerEvents = "none";
    await withTimeout(animateWindowOut(win), 700);
    if (state.win !== win) return;
    win.getAnimations().forEach((animation) => animation.cancel());
    win.classList.add("is-minimized");
    win.classList.remove("is-minimizing");
    win.style.pointerEvents = "";
  }

  async function closeApp(options = {}) {
    const win = state.win;
    if (!win || state.closing) return;

    state.closing = true;
    win.style.pointerEvents = "none";

    if (!win.classList.contains("is-minimized")) {
      await withTimeout(animateWindowOut(win), 700);
      if (state.win !== win) {
        state.closing = false;
        return;
      }
      win.getAnimations().forEach((animation) => animation.cancel());
    }

    win.remove();
    state.win = null;
    state.detail = null;
    state.list = null;
    state.search = null;
    state.empty = null;
    state.currentId = null;
    state.closing = false;
    setActiveState(null);
    document.title = BASE_TITLE;

    if (!options.fromRoute) {
      const base = location.pathname + location.search;
      try {
        history.pushState(null, "", base);
      } catch {
        location.hash = "";
      }
    }
  }

  function toggleMaximize() {
    const win = state.win;
    if (!win) return;
    win.style.setProperty("--tx", "0px");
    win.style.setProperty("--ty", "0px");
    win.classList.toggle("is-maximized");
    const maximized = win.classList.contains("is-maximized");
    win.querySelector('[data-win="maximize"]')?.setAttribute(
      "aria-label",
      maximized ? "Kembalikan ukuran" : "Perbesar"
    );
  }

  function bindWindow(win) {
    const bar = $(".window-titlebar", win);
    let drag = null;

    bar?.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button")) return;
      if (win.classList.contains("is-maximized") || isMobile()) return;

      drag = {
        x: event.clientX,
        y: event.clientY,
        tx: parseFloat(win.style.getPropertyValue("--tx")) || 0,
        ty: parseFloat(win.style.getPropertyValue("--ty")) || 0
      };
      bar.setPointerCapture(event.pointerId);
      win.classList.add("is-dragging");
      event.preventDefault();
    });

    bar?.addEventListener("pointermove", (event) => {
      if (!drag) return;

      const width = win.offsetWidth;
      const height = win.offsetHeight;
      const left = window.innerWidth / 2 + drag.tx + (event.clientX - drag.x) - width / 2;
      const top = window.innerHeight / 2 + drag.ty + (event.clientY - drag.y) - height / 2;

      const nextLeft = clamp(left, 140 - width, window.innerWidth - 140);
      const nextTop = clamp(top, 44, window.innerHeight - 80);

      win.style.setProperty("--tx", `${nextLeft + width / 2 - window.innerWidth / 2}px`);
      win.style.setProperty("--ty", `${nextTop + height / 2 - window.innerHeight / 2}px`);
    });

    const endDrag = () => {
      if (!drag) return;
      drag = null;
      win.classList.remove("is-dragging");
    };

    bar?.addEventListener("pointerup", endDrag);
    bar?.addEventListener("pointercancel", endDrag);

    bar?.addEventListener("dblclick", (event) => {
      if (event.target.closest("button")) return;
      toggleMaximize();
    });
  }

  /* ---------- dock magnification ---------- */
  function applyDockMagnify() {
    state.dockRaf = 0;
    if (document.body.classList.contains("os-windows")) return;

    state.dockItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - state.dockX);
      const strength = Math.max(0, 1 - distance / 110);
      item.style.setProperty("--s", (1 + strength * 0.32).toFixed(3));
      item.style.setProperty("--lift", `${(-strength * 12).toFixed(1)}px`);
    });
  }

  function initDockMagnify() {
    if (!els.dock) return;

    els.dock.addEventListener("pointermove", (event) => {
      state.dockX = event.clientX;
      if (!state.dockRaf) state.dockRaf = requestAnimationFrame(applyDockMagnify);
    });

    els.dock.addEventListener("pointerleave", () => {
      state.dockItems.forEach((item) => {
        item.style.setProperty("--s", "1");
        item.style.setProperty("--lift", "0px");
      });
    });
  }

  /* ---------- routing ---------- */
  function parseHash() {
    const match = location.hash.match(/^#\/tempat\/([A-Za-z0-9_-]+)$/);
    return match ? match[1] : null;
  }

  function navigate(id, trigger = null) {
    if (!PLACE_MAP.has(id)) return;
    setHash(`${BASE_HASH}${id}`);
    openPlace(id, trigger);
  }

  function syncRoute() {
    const id = parseHash();

    if (id && PLACE_MAP.has(id)) {
      if (!state.win || state.currentId !== id) openPlace(id, dockFor(id));
      return;
    }

    if (!id) {
      if (state.win) closeApp({ fromRoute: true });
      return;
    }

    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch {
      location.hash = "";
    }
  }

  /* ---------- actions ---------- */
  function handleAction(action) {
    if (!TOTAL) return;

    switch (action) {
      case "open-first":
        navigate(PLACES[0].id, dockFor(PLACES[0].id) || els.desktopIcons?.firstElementChild);
        break;
      case "random": {
        const pool = PLACES.filter((place) => place.id !== state.currentId);
        const place = (pool.length ? pool : PLACES)[Math.floor(Math.random() * (pool.length || TOTAL))];
        navigate(place.id, dockFor(place.id));
        break;
      }
      case "toggle-theme":
        setTheme(document.body.classList.contains("theme-dark") ? "light" : "dark");
        break;
      case "toggle-os":
        setOs(document.body.classList.contains("os-mac") ? "windows" : "mac");
        break;
      case "close":
        closeApp();
        break;
      case "minimize":
        minimizeApp();
        break;
      case "maximize":
        toggleMaximize();
        break;
      default:
        break;
    }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (event) => {
    const winControl = event.target.closest("[data-win]");
    if (winControl) {
      event.preventDefault();
      handleAction(winControl.dataset.win);
      return;
    }

    const go = event.target.closest("[data-go]");
    if (go) {
      navigate(go.dataset.go, dockFor(go.dataset.go));
      return;
    }

    const copy = event.target.closest("[data-copy]");
    if (copy) {
      copyText(copy.dataset.copy);
      return;
    }

    const placeTrigger = event.target.closest("[data-place]");
    if (placeTrigger) {
      navigate(placeTrigger.dataset.place, placeTrigger);
      return;
    }

    const actionTrigger = event.target.closest("[data-action]");
    if (actionTrigger) {
      handleAction(actionTrigger.dataset.action);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;

    if (event.key === "Escape" && state.win) {
      closeApp();
      return;
    }

    if (!state.win || state.win.classList.contains("is-minimized")) return;

    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const index = PLACES.findIndex((place) => place.id === state.currentId);
      if (index < 0) return;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = PLACES[(index + direction + TOTAL) % TOTAL];
      event.preventDefault();
      navigate(next.id, dockFor(next.id));
    }
  });

  window.addEventListener("hashchange", syncRoute);
  window.addEventListener("popstate", syncRoute);

  /* ---------- init ---------- */
  const storedTheme = safeGet("bekasi-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(storedTheme === "light" || storedTheme === "dark" ? storedTheme : prefersDark ? "dark" : "light", false);

  const storedOs = safeGet("bekasi-os");
  const detectedOs = /Windows/i.test(navigator.userAgent) ? "windows" : "mac";
  setOs(storedOs === "windows" || storedOs === "mac" ? storedOs : detectedOs, false);

  renderShortcuts();
  initDockMagnify();
  tickClock();
  window.setInterval(tickClock, 30000);
  syncRoute();
})();
