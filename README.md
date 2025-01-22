# Voice Transcribe AI

A lightweight desktop application that provides real-time voice transcription using OpenAI's Whisper API. The app sits in a floating window that can be quickly toggled with Ctrl+D, making it perfect for quick voice-to-text needs.

## Features

- 🎤 Real-time voice recording with audio level visualization
- 🔄 Instant transcription using OpenAI's Whisper API
- 💬 Text rephrasing capabilities (coming soon)
- ⌨️ Global shortcut (Ctrl+D) to toggle the app
- 🎨 Modern, minimal UI with dark/light mode support
- 📋 Easy copy-paste functionality
- 🔒 Secure API key management

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/schuttpj/voice-transcribe-ai.git
cd voice-transcribe-ai
```

2. Install dependencies:
```bash
npm install
```

3. Create a settings file (on first run) and add your OpenAI API key through the settings interface.

## Development

Start the application in development mode:
```bash
npm run start
```

Build the application:
```bash
npm run build
```

## Usage

1. Launch the application
2. Press Ctrl+D to show/hide the floating window
3. Click the microphone button to start/stop recording
4. Your speech will be automatically transcribed
5. Double-click the microphone to expand/collapse the window
6. Use the copy button to copy the transcribed text

## Tech Stack

- Electron
- TypeScript
- OpenAI Whisper API
- Tailwind CSS
- node-record-lpcm16

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
