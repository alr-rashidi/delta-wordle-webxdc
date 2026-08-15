(function() {
  const S = window.STRINGS;
  const norm = window.normalizeFa;
  const EPOCH = Date.UTC(2024, 0, 1); // Origin day
  const STORAGE_KEY = "delta_wordle_state_v1";
  const THEME_KEY = "delta_wordle_theme";
  const WORD_LEN = 5;
  const MAX_TRIES = 5;

  const xdc =
    window.webxdc ||
    (function makeShim() {
      const key = "delta_wordle_shim_updates";
      const listeners = [];
      let self = localStorage.getItem("delta_wordle_shim_self");
      if (!self) {
        self = "player_" + Math.floor(Math.random() * 9000 + 1000);
        localStorage.setItem("delta_wordle_shim_self", self);
      }
      function read() {
        try {
          return JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
          return [];
        }
      }
      function write(a) {
        localStorage.setItem(key, JSON.stringify(a));
      }
      window.addEventListener("storage", (e) => {
        if (e.key === key) notify();
      });
      function notify() {
        const arr = read();
        for (const l of listeners) {
          for (let i = l.serial; i < arr.length; i++) {
            l.cb({ payload: arr[i], serial: i + 1, max_serial: arr.length });
          }
          l.serial = arr.length;
        }
      }
      return {
        selfAddr: self,
        selfName: self,
        sendUpdate(u) {
          const a = read();
          a.push(u.payload);
          write(a);
          notify();
        },
        setUpdateListener(cb, serial = 0) {
          listeners.push({ cb, serial });
          notify();
          return Promise.resolve();
        },
      };
    })();

  // ------- Utilities -------
  function dayIndex(ts = Date.now()) {
    const d = new Date(ts);
    const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((local - EPOCH) / 86400000);
  }
  function persianDate(ts = Date.now()) {
    try {
      return new Intl.DateTimeFormat(window.DATE_LOCALE || "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(ts));
    } catch {
      return new Date(ts).toISOString().slice(0, 10);
    }
  }

  function scoreGuess(guess, target) {
    const g = Array.from(guess);
    const t = Array.from(target);
    const result = new Array(g.length).fill("absent");
    const used = new Array(t.length).fill(false);
    for (let i = 0; i < g.length; i++) {
      if (g[i] === t[i]) {
        result[i] = "correct";
        used[i] = true;
      }
    }
    for (let i = 0; i < g.length; i++) {
      if (result[i] === "correct") continue;
      for (let j = 0; j < t.length; j++) {
        if (!used[j] && g[i] === t[j]) {
          result[i] = "present";
          used[j] = true;
          break;
        }
      }
    }
    return result;
  }

  function emojiRow(result) {
    return result
      .map((r) => (r === "correct" ? "🟩" : r === "present" ? "🟨" : "⬜"))
      .join("");
  }

  // ------- State -------
  let WORDS = [];
  let TARGET = "";
  let TODAY = dayIndex();
  let local = loadLocal(); // { dayIndex, guesses[], won, surrendered }
  const others = new Map(); // playerId -> {name, attempts, guesses, won, surrendered, word, dayIndex}

  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw && raw.dayIndex === TODAY) return raw;
    } catch { }
    return { dayIndex: TODAY, guesses: [], won: false, surrendered: false };
  }
  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
  }

  function isFinished() {
    return local.won || local.surrendered || local.guesses.length >= MAX_TRIES;
  }

  // ------- Rendering -------
  const app = document.getElementById("app");

  function renderTopBar(showSurrender, onSurrender, showTheme = false) {
    return `
      <div class="topbar">
        <h1>${S.appName}</h1>
        ${showTheme ? `<button class="icon-btn" id="btn-theme" title="${S.home.theme}">${themeIcon()}</button>` : ""}
        ${showSurrender ? `<button class="icon-btn" id="btn-surrender" title="${S.game.surrender}">🏳️ ${S.game.surrender}</button>` : ""}
      </div>
    `;
  }

  function renderHome() {
    const oldScreen = app.querySelector(".screen");
    if (oldScreen) {
      oldScreen.classList.add("exit");
      setTimeout(() => {
        oldScreen.remove();
      }, 300);
    }

    const list = Array.from(others.values())
      .filter((p) => p.dayIndex === TODAY && (p.won || p.surrendered))
      .sort((a, b) => {
        const sa = a.surrendered ? 999 : a.attempts;
        const sb = b.surrendered ? 999 : b.attempts;
        return sa - sb;
      });

    const meFinished = local.won || local.surrendered;

    if (meFinished && !others.has(xdc.selfAddr)) {
      const me = {
        name: xdc.selfName + ` (${S.player.you})`,
        attempts: local.guesses.length,
        guesses: local.guesses,
        won: local.won,
        surrendered: local.surrendered,
        word: TARGET,
        dayIndex: TODAY,
      };
      list.push(me);
      list.sort((a, b) => {
        const sa = a.surrendered ? 999 : a.attempts;
        const sb = b.surrendered ? 999 : b.attempts;
        return sa - sb;
      });
    }

    app.innerHTML = `
      ${renderTopBar(false, null, true)}
      <div class="screen">
        <div class="home-title">${S.appName}</div>
        <div class="home-actions">
          <button class="btn" id="btn-play">${S.home.enter}</button>
          <button class="btn secondary" id="btn-help">${S.home.help}</button>
        </div>
        <div class="players-title">${S.home.playersToday}</div>
        ${list.length === 0
        ? `<div class="empty">${S.home.noPlayers}</div>`
        : `<ul class="players-list">
              ${list
          .map(
            (p, i) => `
                <li data-player-id="${p.id || i}">
                  <span>${escapeHtml(p.name)}</span>
                  <span class="${p.surrendered ? "surrendered" : "attempts"}">
                    ${p.surrendered ? S.home.surrendered : `${p.attempts} ${S.home.attempts}`}
                  </span>
                </li>
              `,
          )
          .join("")}
            </ul>`
      }
      </div>
    `;

    app.querySelectorAll(".players-list li, .btn").forEach((el, i) => {
      el.classList.add("fade-in");
      el.style.animationDelay = i * 40 + "ms";
    });

    document.getElementById("btn-play").onclick = () => renderGame(true);
    document.getElementById("btn-help").onclick = showHelp;
    const themeBtn = document.getElementById("btn-theme");
    if (themeBtn) themeBtn.onclick = toggleTheme;
    document.querySelectorAll("[data-player-id]").forEach((el, i) => {
      el.onclick = () => showPlayerBoard(list[i]);
    });
  }

  // Only players who open the game screen *already* finished (i.e. they saw
  // today's word in a previous session and came back) get the compact reveal
  // row. Players who finish during the current game keep the full board.
  let revealMode = false;

  function renderGame(fromHome = false) {
    const oldScreen = app.querySelector(".screen");
    if (oldScreen) {
      oldScreen.classList.add("exit");
      setTimeout(() => {
        oldScreen.remove();
      }, 300);
    }

    const finished = isFinished();
    revealMode = fromHome && finished;
    const reveal = revealMode;
    app.innerHTML = `
      ${renderTopBar(!finished)}
      <div class="screen-game">
        <div class="board" id="board"></div>
        <div id="end-panel"></div>
        ${reveal ? "" : `<div class="keyboard" id="keyboard"></div>`}
      </div>
    `;
    if (!finished && document.getElementById("btn-surrender")) {
      document.getElementById("btn-surrender").onclick = doSurrender;
    }
    renderBoard();
    if (!reveal) {
      window.buildKeyboard(document.getElementById("keyboard"), onKey);
      refreshKeyStates();
    }
    renderEndPanel();
  }

  let currentInput = "";

  function renderBoard() {
    const board = document.getElementById("board");
    if (!board) return;

    // Reveal view: show only today's word as one row of correct letters.
    if (revealMode) {
      board.innerHTML = "";
      const rowEl = document.createElement("div");
      rowEl.className = "row reveal-row";
      for (const ch of Array.from(TARGET)) {
        const cell = document.createElement("div");
        cell.className = "cell correct";
        cell.textContent = ch;
        rowEl.appendChild(cell);
      }
      board.appendChild(rowEl);
      return;
    }

    if (board.children.length === 0) {
      for (let r = 0; r < MAX_TRIES; r++) {
        const rowEl = document.createElement("div");
        rowEl.className = "row";
        rowEl.dataset.row = r;

        for (let c = 0; c < WORD_LEN; c++) {
          const cell = document.createElement("div");
          cell.className = "cell";
          rowEl.appendChild(cell);
        }
        board.appendChild(rowEl);
      }
    }

    for (let r = 0; r < MAX_TRIES; r++) {
      const rowEl = board.querySelector(`.row[data-row="${r}"]`);
      if (!rowEl) continue;

      const guess = local.guesses[r];
      const isCurrentRow = r === local.guesses.length && !isFinished();
      const scoring = guess ? scoreGuess(guess, TARGET) : null;
      const inputArr = isCurrentRow ? Array.from(currentInput) : [];

      const cells = rowEl.children;

      if (!isFinished()) {
        for (let c = 0; c < WORD_LEN; c++) {
          const cell = cells[c];
          cell.textContent = "";

          if (guess) {
            const ch = Array.from(guess)[c] || "";
            cell.textContent = ch;
            cell.className = `cell ${scoring[c]}`;

            rowEl.classList.add("revealed");
          } else if (inputArr[c]) {
            cell.textContent = inputArr[c];
            cell.className = "cell filled";
          } else {
            cell.className = "cell";
          }
        }

        if (isCurrentRow) {
          rowEl.classList.remove("revealed");
        }
      }
    }
  }

  function refreshKeyStates() {
    const kb = document.getElementById("keyboard");
    if (!kb) return;
    const vals = {};
    for (const g of local.guesses) {
      const sc = scoreGuess(g, TARGET);
      const chars = Array.from(g);
      for (let i = 0; i < chars.length; i++) {
        const cur = vals[chars[i]];
        const nxt = sc[i];
        if (cur === "correct") continue;
        if (cur === "present" && nxt !== "correct") continue;
        vals[chars[i]] = nxt;
      }
    }
    window.applyKeyStates(kb, vals);
  }

  function onKey(k) {
    if (isFinished()) return;
    if (k === "Backspace") {
      const arr = Array.from(currentInput);
      arr.pop();
      currentInput = arr.join("");
      renderBoard();
      return;
    }
    if (k === "Enter") {
      submitGuess();
      return;
    }
    if (window.faLen(currentInput) >= WORD_LEN) return;
    currentInput += k;
    renderBoard();
  }

  function submitGuess() {
    const g = norm(currentInput);
    if (window.faLen(g) !== WORD_LEN) {
      toast(S.game.invalidLength);
      return;
    }
    if (!WORDS.includes(g)) {
      toast(S.game.notInList);
      return;
    }
    local.guesses.push(g);
    if (g === TARGET) local.won = true;
    currentInput = "";
    saveLocal();
    renderBoard();
    refreshKeyStates();
    renderEndPanel();
    if (isFinished()) {
      broadcastResult();
      const tb = app.querySelector(".topbar");
      if (tb) tb.outerHTML = renderTopBar(false);
    }
  }

  function doSurrender() {
    if (!confirm(S.game.surrenderConfirm)) return;
    local.surrendered = true;
    saveLocal();
    broadcastResult();
    renderGame();
  }

  function renderEndPanel() {
    const el = document.getElementById("end-panel");
    if (!el) return;

    if (!isFinished()) {
      el.innerHTML = "";
      return;
    }

    const status = local.won
      ? `<h3>${S.end.win}</h3>`
      : local.surrendered
        ? `<h3>${S.end.surrendered} <span style="color: var(--present)">${TARGET}</span></h3>`
        : `<h3>${S.end.lose} <span style="color: var(--present)">${TARGET}</span></h3>`;

    el.innerHTML = `
      <div class="end-panel fade-in">
        ${status}
        ${local.won ? `<button class="btn" id="btn-copy">${S.end.copy}</button>` : ""}
        <button class="btn secondary" id="btn-back">${S.end.back}</button>
      </div>
    `;

    if (local.won) document.getElementById("btn-copy").onclick = copyResult;
    document.getElementById("btn-back").onclick = renderHome;
  }

  function copyResult() {
    const lines = [`${S.appName} - ${persianDate()}`, ""];
    for (const g of local.guesses) {
      lines.push(emojiRow(scoreGuess(g, TARGET)));
    }
    const text = lines.join("\n");
    (navigator.clipboard?.writeText(text) || Promise.reject())
      .then(() => toast(S.end.copied))
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast(S.end.copied);
      });
  }

  function broadcastResult() {
    const payload = {
      type: local.surrendered ? "surrender" : "finish",
      dayIndex: TODAY,
      word: TARGET,
      playerId: xdc.selfAddr,
      playerName: xdc.selfName || xdc.selfAddr,
      guesses: local.guesses,
      attempts: local.guesses.length,
      won: local.won,
      surrendered: local.surrendered,
    };
    xdc.sendUpdate(
      {
        payload,
        info: `${payload.playerName} - ${payload.won ? payload.attempts + "/" + MAX_TRIES : payload.surrendered ? "🏳️" : "X"}`,
      },
      "",
    );
  }

  function showHelp() {
    const rows = window.GUIDE_EXAMPLE.map((e) => {
      const sc = scoreGuess(e.g, e.t);
      const chars = Array.from(e.g);
      return `<div class="row" style="">
        ${chars.map((c, i) => `<div class="cell ${sc[i]}" style="width:36px;height:36px;font-size:18px">${c}</div>`).join("")}
      </div>`;
    }).join('<div style="height:6px"></div>');
    openModal(
      `
      <h2>${S.help.title}</h2>
      <p>${S.help.intro}</p>
      <p>🟩 ${S.help.green}<br>🟨 ${S.help.yellow}<br>⬜ ${S.help.gray}</p>
      <p><b>${S.help.exampleTitle}</b></p>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center">${rows}</div>
    `,
      S.help.close,
    );
  }

  function showPlayerBoard(p) {
    const rows = (p.guesses || [])
      .map((g) => {
        const sc = scoreGuess(g, p.word);
        const chars = Array.from(g);
        return `<div class="row">
        ${chars.map((c, i) => `<div class="cell ${sc[i]}" style="width:36px;height:36px;font-size:16px">${c}</div>`).join("")}
      </div>`;
      })
      .join('<div style="height:4px"></div>');
    openModal(
      `
      <h2>${S.player.title} ${escapeHtml(p.name)}</h2>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:center">${rows || `<div class="empty">-</div>`}</div>
    `,
      S.player.close,
    );
  }
  function showPlayerBoard(p) {
    if (!isFinished()) {
      const ok = confirm(S.game.seeWordConfirm);
      if (!ok) return;

      local.surrendered = true;
      saveLocal();
      broadcastResult();
    }

    const rows = (p.guesses || [])
      .map((g) => {
        const sc = scoreGuess(g, p.word);
        const chars = Array.from(g);
        return `<div class="row">
        ${chars.map((c, i) => `<div class="cell ${sc[i]}" style="width:36px;height:36px;font-size:16px">${c}</div>`).join("")}
      </div>`;
      })
      .join('<div style="height:4px"></div>');

    openModal(
      `
    <h2>${S.player.title} ${escapeHtml(p.name)}</h2>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:center">${rows || `<div class="empty">-</div>`}</div>
  `,
      S.player.close,
    );
  }

  function openModal(inner, closeLabel) {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `<div class="modal fade-in">${inner}<div class="actions"><button class="btn secondary" id="__modal_close">${closeLabel}</button></div></div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.querySelector("#__modal_close").onclick = close;
    back.addEventListener("click", (e) => {
      if (e.target === back) close();
    });
  }

  function toast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    const span = document.createElement("span");
    span.className = "toast-content";
    span.textContent = msg;
    toast.appendChild(span);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  // ------- Peer updates -------
  function handleUpdate(u) {
    const p = u.payload;
    if (!p || !p.playerId || p.dayIndex !== TODAY) return;
    if (p.word !== TARGET) return; // Ignore if word isn't same
    if (p.playerId === xdc.selfAddr) return;
    const prev = others.get(p.playerId);
    if (prev && prev.attempts <= p.attempts && !p.surrendered) return;
    others.set(p.playerId, {
      id: p.playerId,
      name: p.playerName || p.playerId,
      attempts: p.attempts,
      guesses: p.guesses || [],
      won: !!p.won,
      surrendered: !!p.surrendered,
      word: p.word,
      dayIndex: p.dayIndex,
    });
    // If home page opened
    if (app.querySelector(".home-title")) renderHome();
  }

  window.buildKeyboard = function buildKeyboard(container, onKey) {
    container.innerHTML = "";
    for (const row of window.KEYBOARD_LAYOUT) {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      for (const key of row) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kb-key";
        btn.dataset.key = key.k;
        btn.textContent = key.label || key.k;
        btn.style.flex = String(key.flex || 1);
        btn.addEventListener("click", () => onKey(key.k));
        rowEl.appendChild(btn);
      }
      container.appendChild(rowEl);
    }
  };

  // vals: { [letter]: "correct" | "present" | "absent" }
  window.applyKeyStates = function applyKeyStates(container, vals) {
    const keys = container.querySelectorAll(".kb-key");
    keys.forEach((btn) => {
      const k = btn.dataset.key;
      if (k === "Enter" || k === "Backspace") return;
      btn.classList.remove("kb-correct", "kb-present", "kb-absent");
      btn.disabled = false;
      const v = vals[k];
      if (v === "correct") btn.classList.add("kb-correct");
      else if (v === "present") btn.classList.add("kb-present");
      else if (v === "absent") {
        btn.classList.add("kb-absent");
        btn.disabled = true;
      }
    });
  };

  // ------- Theme toggle -------
  // The app follows the system color scheme by default; the home screen's
  // toggle pins an explicit light/dark choice (persisted in localStorage).
  function savedTheme() {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  }

  function effectiveTheme() {
    const s = savedTheme();
    if (s) return s;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(scheme) {
    // "" lets the light-dark() colors follow the system again.
    document.documentElement.style.colorScheme = scheme || "";
  }

  function themeIcon() {
    return effectiveTheme() === "dark" ? "☀️" : "🌙";
  }

  function toggleTheme() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    const btn = document.getElementById("btn-theme");
    if (btn) btn.textContent = themeIcon();
  }

  // ------- Locale font -------
  // Applies the locale's custom font (see font.js). Supports a bundled font
  // file ("font.woff2"/"font.woff"/"font.ttf"/...) optionally named with a
  // custom font-family, or a system font family name without a file.
  function applyLocaleFont() {
    const cfg = window.LOCALE_FONT;
    if (!cfg) return;

    let file = null;
    let family = null;
    if (typeof cfg === "string") {
      if (/\.(woff2?|ttf|otf|eot)$/i.test(cfg)) file = cfg;
      else family = cfg;
    } else if (typeof cfg === "object") {
      file = cfg.file || null;
      family = cfg.family || null;
    }
    if (!file && !family) return;

    const style = document.createElement("style");
    let css = "";
    if (file) {
      const ext = file.split(".").pop().toLowerCase();
      const format =
        ext === "woff2" ? "woff2" :
        ext === "woff" ? "woff" :
        ext === "ttf" ? "truetype" :
        ext === "otf" ? "opentype" :
        ext;
      const fam = family || "locale-font";
      css += `@font-face{font-family:"${fam}";src:url("${file}") format("${format}");font-weight:400;font-style:normal;font-display:swap}`;
      family = fam;
    }
    css += `body{font-family:"${family}",Tahoma,"Segoe UI",sans-serif}`;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ------- Bootstrap -------
  async function boot() {
    document.title = S.appName;
    applyTheme(savedTheme());
    applyLocaleFont();
    let txt = window.WORDS_RAW || "";
    if (!txt) {
      try {
        const res = await fetch("./words.txt");
        txt = await res.text();
      } catch { }
    }
    WORDS = txt
      .split(/\r?\n/)
      .map((w) => norm(w))
      .filter((w) => window.faLen(w) === WORD_LEN);
    if (WORDS.length === 0) {
      app.innerHTML = S.game.wordsEmpty;
      return;
    }

    // The daily word is picked from a smaller, curated list (answers.js) so
    // it stays common/fair, while guesses are validated against the full WORDS
    // list above. Fall back to WORDS when no answers list is provided.
    let answersTxt = window.ANSWERS_RAW || "";
    if (!answersTxt) {
      try {
        const res = await fetch("./answers.txt");
        answersTxt = await res.text();
      } catch { }
    }
    const ANSWERS = answersTxt
      .split(/\r?\n/)
      .map((w) => norm(w))
      .filter((w) => window.faLen(w) === WORD_LEN);
    const pool = ANSWERS.length > 0 ? ANSWERS : WORDS;
    TARGET = pool[((TODAY % pool.length) + pool.length) % pool.length];

    document.documentElement.dir = window.DIRECTION;
    xdc.setUpdateListener(handleUpdate, 0);
    renderHome();
  }

  boot();
})();
