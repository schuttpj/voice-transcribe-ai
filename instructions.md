
Voice Transcriber Mini App – Development Instructions

Project Overview
The application is a lightweight transcriber and text rephraser:
- Double-tap Ctrl to open a small popup.
- Record audio via microphone and stream transcribed text into the active text field.
- Rephrase (AI-improved) text with a single button click, copying the improved text to the clipboard.
- No external storage—only local (in-memory) usage.

Key Features
1. Trigger on Keyboard Shortcut:
   - Double-tap Ctrl to open the app’s popup.
2. Realtime Voice-to-Text:
   - Capture audio, use OpenAI Whisper API for transcription, and stream into the current text field.
3. AI Text Rephrasing:
   - Single button sends transcribed text to OpenAI GPT for rephrasing, copying the result to the clipboard.
4. Easy Dev/Production:
   - Simple environment toggles via Electron Forge for packaging and distribution.

Proposed Tech Stack
- Electron
- OpenAI Whisper API - https://platform.openai.com/docs/guides/speech-to-text
- OpenAI GPT API - model to be used is gpt-4o-mini. https://platform.openai.com/docs/models#gpt-4o
- Node.js
- Local (In-Memory) Storage
- Electron Forge - see https://www.electronforge.io/ -use the recommended template  when initializing your app to take advantage of modern front-end JavaScript tooling.

Development Stages

Stage 1: Initial Project Setup
1. Create a New Electron Forge Project:
   - Use the following command:
     `npx create-electron-app my-voice-transcriber --template=webpack`
   - Confirm successful setup by running `npm start`.

2. Configure Environment Variables:
   - Create `.env` (development) and `.env.production` (production).
   - Example:
     ```
     OPENAI_API_KEY=your-whisper-and-gpt-key
     ```
   - Ensure `.env` files are ignored by Git.

3. Install Dependencies:
   - Example:
     ```
     npm install openai robotjs dotenv
     ```

4. Basic Directory Structure:
   - main.js / index.js: Main process entry point.
   - renderer/: Contains UI components (HTML/CSS/JS).
   - services/: Logic for API calls (Whisper, GPT).

Stage 2: Keyboard Shortcut & Popup Window
1. Global Shortcut Handling:
   - Use `globalShortcut.register` to detect “double-tap Ctrl”.

2. Popup Window Creation:
   - Create a frameless BrowserWindow with minimal dimensions.

3. Popup UI:
   - Simple HTML with:
     - Status/message area.
     - Rephrase button.
     - Close button.

4. Close Popup:
   - Detect global click outside or Esc key to close the window.

Stage 3: Realtime Voice-to-Text Transcription
1. Request Microphone Access:
   - Use `navigator.mediaDevices.getUserMedia`.

2. OpenAI Whisper Integration:
   - Implement service for chunk-based or streaming transcription.

3. Streaming Text to Active Field:
   - Simulate keystrokes with RobotJS to type transcribed text.

4. Error Handling & UX:
   - Display user-friendly errors for API or permission issues.

Stage 4: AI-Powered Text Rephrasing
1. Rephrase Button:
   - Add a button in the popup labeled “Rephrase”.

2. GPT API Integration:
   - Prompt example:
     ```
     Please rephrase this text more clearly: {transcribedText}
     ```

3. Clipboard Copy:
   - Use Electron’s clipboard module to copy the rephrased text.

4. Error Handling:
   - Display user-friendly errors for GPT-related issues.

Stage 5: Production Build & Distribution
1. Environment Variable Management:
   - Ensure `OPENAI_API_KEY` is loaded in production.

2. Electron Forge Configuration:
   - Add packaging configuration to `package.json`.

3. Build & Test:
   - Generate the installer using `npm run make`.
   - Test all functionality on a Windows machine.

4. Installer Distribution:
   - Provide the generated `.exe` to end users.
