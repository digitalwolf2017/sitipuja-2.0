# Background music

The player looks for the file named in `CONFIG.music.src` in `script.js`:

    assets/audio/background.mp3

Drop the track there (keep the name, or change `src` to match yours) and the
dock appears bottom-left. If the file is missing or the browser can't decode
it, the dock removes itself — the page never shows a dead control.

Notes for choosing a track:

- **MP3** is the safest single format; every current browser plays it.
- Keep it small. This loads on top of the page, so aim for **under ~1.5 MB**
  (a 60–90 second loop at 96–128 kbps mono is plenty for ambience).
- It loops seamlessly only if the audio itself loops — trim silence off both
  ends before exporting.
- Use something you have the rights to. Dhak/ambient beds are widely
  available under Creative Commons; check the licence before shipping.

To remove the player entirely, set `CONFIG.music.src` to `''`.
