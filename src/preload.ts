import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        startRecording: () => ipcRenderer.invoke('start-recording'),
        stopRecording: () => ipcRenderer.invoke('stop-recording'),
        rephraseText: (text: string) => ipcRenderer.invoke('rephrase-text', text),
        onTranscriptionData: (callback: (text: string) => void) => {
            ipcRenderer.on('transcription-data', (_event, text) => callback(text));
        },
        onAudioLevel: (callback: (level: { timestamp: number; level: number }) => void) => {
            ipcRenderer.on('audio-level', (_event, level) => callback(level));
        },
        // Window management
        hideWindow: () => ipcRenderer.invoke('hide-window'),
        onWindowFocus: (callback: () => void) => {
            ipcRenderer.on('window-focused', () => callback());
        },
        // Settings API
        getSettings: () => ipcRenderer.invoke('get-settings'),
        saveSettings: (settings: { openaiApiKey: string; language: string }) => 
            ipcRenderer.invoke('save-settings', settings),
        testApiKey: (apiKey: string) => ipcRenderer.invoke('test-api-key', apiKey),
        openSettings: () => ipcRenderer.invoke('open-settings'),
        close: () => ipcRenderer.invoke('close-window')
    }
);
