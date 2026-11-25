# دوّنها | Dawwenha: Arabic Voice Notes

Record voice notes or upload audio, turn it into organized Arabic text (lectures, ideas), all saved on your device. Free, no backend, no sign-up. Installable as an app (PWA).

**Live:** https://ma2803575-cyber.github.io/Portfolio-Website/dawwenha/

## Features
- Record from the mic; live Arabic transcription while recording via the browser's speech recognition (Chrome/Android)
- Upload an audio file and transcribe it fully on-device with Whisper (transformers.js), nothing leaves the phone
- "Organize with AI": title, cleaned notes, key points, tags via a keyless free API (Pollinations). Text only is sent, never the audio. Local offline structuring as automatic fallback
- Library saved on the device (localStorage + IndexedDB), search, playback, copy/share/download as .txt
- Works offline after first load (service worker)

## Privacy
Recordings and notes stay on the device. Live recognition uses the browser's own service; file transcription runs locally in the browser; AI organizing sends text only.

Built as a static site, hosted on GitHub Pages.
