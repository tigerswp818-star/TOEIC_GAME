# TOEIC Quest 🏆

A fun, **static** TOEIC practice game. No login, no server, no build step —
just open it in a browser and play. Progress (XP, level, best scores) is saved
on your device with `localStorage`.

เกมฝึก TOEIC แบบสนุก ๆ เปิดในเบราว์เซอร์เล่นได้ทันที ไม่ต้องล็อกอินหรือมีเซิร์ฟเวอร์

## Modes

| Mode | ไทย | What it tests |
|------|-----|----------------|
| 📚 **Vocabulary** | คำศัพท์ | Word choice & meaning (TOEIC Part 5 style) |
| ✏️ **Grammar** | ไวยากรณ์ | Fill in the blank with the correct form |
| 📰 **Reading** | การอ่าน | Read a short passage, then answer |
| 🎧 **Listening** | การฟัง | Listen (text-to-speech) and answer |

## Features

- ⏱️ **Timed questions** with a draining timer bar (10/15/20s, or off)
- 🔥 **Streaks** with bonus points for consecutive correct answers
- ⭐ **XP & levels** that persist across sessions
- 📊 **Results screen** with accuracy, best streak, and a full answer review + explanations
- ⌨️ **Keyboard play** — press `1`–`4` or `A`–`D` to answer
- 📱 Fully responsive, dark, gamified UI
- ♿ Honors `prefers-reduced-motion`

## Run it

It's a static site — any of these work:

```bash
# Option 1: just open the file
open web/index.html        # macOS
xdg-open web/index.html     # Linux

# Option 2: serve locally (recommended for the audio/voices to load reliably)
cd web
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Deploy to GitHub Pages

Push the repo, then in **Settings → Pages** choose the branch and set the folder
to `/web` (or move the contents of `web/` to a `/docs` folder). The site is
fully static, so it works on GitHub Pages, Netlify, Vercel, or any file host.

## Project structure

```
web/
├── index.html        # markup / screens (home, quiz, results)
├── css/style.css     # all styling (vibrant gamified theme)
└── js/
    ├── questions.js  # the question bank (4 modes) + mode metadata
    └── app.js        # game engine: routing, scoring, timer, TTS, storage
```

## Add your own questions

Open `js/questions.js` and add entries to any mode array. Shape:

```js
{
  q: "Sentence with a ____ to fill in.",
  choices: ["correct", "distractor", "distractor", "distractor"],
  answer: 0,                 // index (0-3) of the correct choice
  explain: "Why it's correct.",
  passage: "...",            // optional — reading mode only
  audio: "Spoken sentence.", // optional — listening mode only (read via TTS)
}
```

## Notes

- **Listening** uses the browser's built-in **Web Speech API** (`speechSynthesis`)
  to read the audio prompts aloud, so no audio files are needed. Voice quality
  depends on the browser/OS. If speech isn't supported, the rest of the game
  still works.
- This is a separate, self-contained build. The original Google Apps Script app
  (`Code.gs`, `Index.html`, etc.) at the repo root is unaffected.
