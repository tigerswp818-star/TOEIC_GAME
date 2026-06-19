/* =====================================================================
 * app.js — TOEIC Quest game engine
 * ---------------------------------------------------------------------
 * Vanilla JS, no dependencies. Handles screen routing, the quiz loop,
 * scoring/streaks/XP, localStorage persistence, and Web Speech for the
 * listening mode.
 * ===================================================================== */

(function () {
  "use strict";

  const BANK = window.QUESTION_BANK;
  const META = window.MODE_META;

  /* --------------------------- Persistence -------------------------- */
  const STORE_KEY = "toeic-quest-v1";

  const defaultStore = () => ({
    xp: 0,
    games: 0,
    bestOverall: 0,
    best: { vocabulary: 0, grammar: 0, reading: 0, listening: 0 },
  });

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultStore();
      return Object.assign(defaultStore(), JSON.parse(raw));
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      /* storage may be unavailable (private mode) — ignore */
    }
  }

  let store = loadStore();

  /* ------------------------- Level helpers -------------------------- */
  // Level N requires 100*(N-1)*N/2 cumulative XP (gently rising curve).
  function levelFromXp(xp) {
    let lvl = 1;
    while (xp >= xpForLevel(lvl + 1)) lvl++;
    return lvl;
  }
  function xpForLevel(level) {
    return (100 * (level - 1) * level) / 2;
  }

  /* ------------------------------ DOM ------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    home: $("#screen-home"),
    quiz: $("#screen-quiz"),
    result: $("#screen-result"),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("screen--active"));
    screens[name].classList.add("screen--active");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-show"), 1800);
  }

  /* ----------------------- Home screen render ----------------------- */
  function renderHome() {
    const level = levelFromXp(store.xp);
    $("#statLevel").textContent = level;
    $("#statXp").textContent = store.xp.toLocaleString();
    $("#statGames").textContent = store.games;
    $("#statBest").textContent = store.bestOverall;

    // Level progress bar
    const curBase = xpForLevel(level);
    const nextBase = xpForLevel(level + 1);
    const into = store.xp - curBase;
    const span = nextBase - curBase;
    const pct = Math.max(0, Math.min(100, (into / span) * 100));
    $("#levelbarFill").style.width = pct + "%";
    $("#levelbarCaption").textContent = `${into} / ${span} XP to Level ${level + 1}`;

    renderModeCards();
  }

  function renderModeCards() {
    const grid = $("#modeGrid");
    grid.innerHTML = "";
    Object.keys(META).forEach((mode) => {
      const m = META[mode];
      const best = store.best[mode] || 0;
      const card = document.createElement("button");
      card.className = "modecard";
      card.style.setProperty("--accent", m.accent);
      card.type = "button";
      card.innerHTML = `
        <span class="modecard__go">→</span>
        <div class="modecard__icon">${m.icon}</div>
        <div class="modecard__title">${m.label}</div>
        <div class="modecard__th">${m.th}</div>
        <div class="modecard__desc">${m.desc}</div>
        <div class="modecard__best">★ Best: ${best}</div>`;
      card.addEventListener("click", () => startGame(mode));
      grid.appendChild(card);
    });
  }

  /* --------------------------- Game state --------------------------- */
  let game = null;

  function getSettings() {
    return {
      count: parseInt($("#setCount").value, 10),
      timer: parseInt($("#setTimer").value, 10),
    };
  }

  // Fisher–Yates shuffle (returns a new array).
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame(mode) {
    const { count, timer } = getSettings();
    const pool = shuffle(BANK[mode]).slice(0, Math.min(count, BANK[mode].length));

    game = {
      mode,
      timer,
      questions: pool,
      index: 0,
      score: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      answered: [], // { question, chosen, correct, ok }
    };

    $("#qMode").textContent = META[mode].label;
    show("quiz");
    renderQuestion();
  }

  /* ------------------------- Question render ------------------------ */
  let timerHandle = null;

  function renderQuestion() {
    const g = game;
    const q = g.questions[g.index];

    // progress + counters
    $("#progressFill").style.width = (g.index / g.questions.length) * 100 + "%";
    $("#qCount").textContent = `${g.index + 1} / ${g.questions.length}`;
    $("#streakChip").textContent = `🔥 ${g.streak}`;
    $("#liveScore").textContent = g.score;

    // passage (reading)
    const passEl = $("#passage");
    if (q.passage) {
      passEl.textContent = q.passage;
      passEl.hidden = false;
    } else {
      passEl.hidden = true;
    }

    // listening control
    const listenEl = $("#listen");
    if (q.audio) {
      listenEl.hidden = false;
      // auto-play once on render
      setTimeout(() => speak(q.audio), 350);
    } else {
      listenEl.hidden = true;
    }

    // question text (hidden for listening until they read it after? keep visible)
    $("#qText").textContent = q.q;

    // choices
    const box = $("#choices");
    box.innerHTML = "";
    const keys = ["A", "B", "C", "D"];
    q.choices.forEach((choice, i) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.type = "button";
      btn.innerHTML = `<span class="choice__key">${keys[i]}</span><span>${escapeHtml(
        choice
      )}</span>`;
      btn.addEventListener("click", () => handleAnswer(i, btn));
      box.appendChild(btn);
    });

    startTimer();
  }

  /* ------------------------------ Timer ----------------------------- */
  function startTimer() {
    clearTimeout(timerHandle);
    const bar = $("#timerBar");
    const wrap = $("#timerWrap");

    if (!game.timer) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    // reset animation
    bar.classList.remove("is-running", "is-low");
    bar.style.animationDuration = game.timer + "s";
    // force reflow so the animation restarts
    void bar.offsetWidth;
    bar.classList.add("is-running");

    // low-time warning colour
    const lowAt = Math.max(0, (game.timer - 4) * 1000);
    timerHandle = setTimeout(() => bar.classList.add("is-low"), lowAt);

    // time-out → counts as wrong
    timerHandle = setTimeout(() => {
      timeOut();
    }, game.timer * 1000);
  }

  function stopTimer() {
    clearTimeout(timerHandle);
    const bar = $("#timerBar");
    // freeze the bar where it is
    const cs = getComputedStyle(bar);
    bar.style.transform = cs.transform;
    bar.classList.remove("is-running");
  }

  function timeOut() {
    const q = game.questions[game.index];
    revealAnswer(-1, null, q);
  }

  /* --------------------------- Answering ---------------------------- */
  function handleAnswer(chosenIdx, btn) {
    const q = game.questions[game.index];
    revealAnswer(chosenIdx, btn, q);
  }

  function revealAnswer(chosenIdx, btn, q) {
    stopTimer();
    cancelSpeak();

    const ok = chosenIdx === q.answer;
    const buttons = $("#choices").querySelectorAll(".choice");
    buttons.forEach((b) => (b.disabled = true));

    // mark correct + wrong
    buttons[q.answer].classList.add("is-correct");
    if (!ok && chosenIdx >= 0) buttons[chosenIdx].classList.add("is-wrong");

    // scoring
    let gained = 0;
    if (ok) {
      game.correct++;
      game.streak++;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      const base = 100;
      const streakBonus = Math.min(game.streak - 1, 5) * 20; // up to +100
      gained = base + streakBonus;
      game.score += gained;
      floatPoints(btn, `+${gained}`);
    } else {
      game.streak = 0;
    }

    game.answered.push({
      question: q,
      chosen: chosenIdx,
      ok,
    });

    $("#streakChip").textContent = `🔥 ${game.streak}`;
    $("#liveScore").textContent = game.score;

    // advance
    setTimeout(nextQuestion, ok ? 750 : 1300);
  }

  function nextQuestion() {
    game.index++;
    if (game.index >= game.questions.length) {
      finishGame();
    } else {
      renderQuestion();
    }
  }

  /* -------------------------- +points float ------------------------- */
  function floatPoints(anchor, text) {
    const el = document.createElement("div");
    el.className = "floatpts";
    el.textContent = text;
    const rect = (anchor || $("#qText")).getBoundingClientRect();
    el.style.left = rect.left + rect.width / 2 - 14 + "px";
    el.style.top = rect.top - 10 + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* ----------------------------- Finish ----------------------------- */
  function finishGame() {
    $("#progressFill").style.width = "100%";
    cancelSpeak();

    const g = game;
    const total = g.questions.length;
    const accuracy = Math.round((g.correct / total) * 100);

    // XP earned: score-based + accuracy bonus
    const xpEarned = Math.round(g.score / 10) + (accuracy === 100 ? 50 : 0);

    // persist
    const prevLevel = levelFromXp(store.xp);
    store.xp += xpEarned;
    store.games += 1;
    store.bestOverall = Math.max(store.bestOverall, g.score);
    store.best[g.mode] = Math.max(store.best[g.mode] || 0, g.score);
    saveStore();
    const newLevel = levelFromXp(store.xp);

    // results UI
    let emoji = "🎯",
      title = "Quest complete!",
      sub = "Keep practising — you're getting there.";
    if (accuracy === 100) {
      emoji = "🏆";
      title = "Perfect run!";
      sub = "Flawless. You answered every question correctly.";
    } else if (accuracy >= 80) {
      emoji = "🌟";
      title = "Great job!";
      sub = "Strong performance — almost perfect.";
    } else if (accuracy >= 50) {
      emoji = "💪";
      title = "Nice effort!";
      sub = "Solid. Review the misses and try again.";
    } else {
      emoji = "📖";
      title = "Good start!";
      sub = "Every expert was once a beginner. Run it back!";
    }

    $("#resultEmoji").textContent = emoji;
    $("#resultTitle").textContent = title;
    $("#resultSub").textContent = sub;
    $("#resScore").textContent = g.score;
    $("#resAccuracy").textContent = accuracy + "%";
    $("#resXp").textContent = "+" + xpEarned;
    $("#resStreak").textContent = g.bestStreak;

    renderReview();
    show("result");

    if (newLevel > prevLevel) {
      setTimeout(() => toast(`🎉 Level up! You reached Level ${newLevel}`), 500);
    }
  }

  function renderReview() {
    const box = $("#review");
    box.innerHTML = "";
    game.answered.forEach((a, i) => {
      const q = a.question;
      const item = document.createElement("div");
      item.className = "reviewitem" + (a.ok ? "" : " is-wrong");
      const yours =
        a.chosen >= 0 ? escapeHtml(q.choices[a.chosen]) : "<i>No answer (time out)</i>";
      item.innerHTML = `
        <div class="reviewitem__q">${i + 1}. ${escapeHtml(q.q)}</div>
        <div class="reviewitem__row"><b>Correct:</b> ${escapeHtml(
          q.choices[q.answer]
        )}</div>
        ${
          a.ok
            ? ""
            : `<div class="reviewitem__row reviewitem__yours"><b>Your answer:</b> ${yours}</div>`
        }
        <div class="reviewitem__explain">💡 ${escapeHtml(q.explain)}</div>`;
      box.appendChild(item);
    });
    $("#reviewTitle").textContent = `Review your answers (${game.correct}/${game.questions.length} correct)`;
  }

  /* ----------------------- Web Speech (TTS) ------------------------- */
  let speaking = false;

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      toast("Listening (audio) isn't supported in this browser.");
      return;
    }
    cancelSpeak();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    // prefer an English voice if available
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => /en[-_]/i.test(v.lang));
    if (en) u.voice = en;

    const btn = $("#btnPlayAudio");
    u.onstart = () => {
      speaking = true;
      btn.classList.add("is-playing");
    };
    u.onend = u.onerror = () => {
      speaking = false;
      btn.classList.remove("is-playing");
    };
    window.speechSynthesis.speak(u);
  }

  function cancelSpeak() {
    if ("speechSynthesis" in window && speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
      $("#btnPlayAudio").classList.remove("is-playing");
    }
  }

  /* ----------------------------- Utils ------------------------------ */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ----------------------------- Events ----------------------------- */
  // Hero "start now" button — jumps straight into a random mode.
  const heroStart = $("#btnHeroStart");
  if (heroStart) {
    heroStart.addEventListener("click", () => {
      const modes = Object.keys(META);
      startGame(modes[Math.floor(Math.random() * modes.length)]);
    });
  }

  $("#btnPlayAudio").addEventListener("click", () => {
    const q = game && game.questions[game.index];
    if (q && q.audio) speak(q.audio);
  });

  $("#btnQuit").addEventListener("click", () => {
    if (confirm("Quit this quest? Your progress in this round will be lost.")) {
      stopTimer();
      cancelSpeak();
      show("home");
      renderHome();
    }
  });

  $("#btnReplay").addEventListener("click", () => {
    if (game) startGame(game.mode);
  });

  $("#btnHome").addEventListener("click", () => {
    show("home");
    renderHome();
  });

  $("#btnReset").addEventListener("click", () => {
    if (confirm("Reset all progress (XP, level, best scores)?")) {
      store = defaultStore();
      saveStore();
      renderHome();
      toast("Progress reset.");
    }
  });

  // Keyboard shortcuts during quiz: 1-4 / A-D to answer.
  document.addEventListener("keydown", (e) => {
    if (!screens.quiz.classList.contains("screen--active")) return;
    const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
    const idx = map[e.key.toLowerCase()];
    if (idx === undefined) return;
    const btns = $("#choices").querySelectorAll(".choice");
    if (btns[idx] && !btns[idx].disabled) btns[idx].click();
  });

  // Voices may load asynchronously in some browsers.
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }

  /* ------------------------------ Boot ------------------------------ */
  renderHome();
})();
