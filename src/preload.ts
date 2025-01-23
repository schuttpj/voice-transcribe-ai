import { contextBridge, ipcRenderer, clipboard } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        startRecording: () => ipcRenderer.invoke('start-recording'),
        stopRecording: (buffer: ArrayBuffer) => ipcRenderer.invoke('stop-recording', buffer),
        rephraseText: (text: string) => ipcRenderer.invoke('rephrase-text', text),
        onTranscriptionData: (callback: (text: string) => void) => {
            ipcRenderer.on('transcription-data', (_event, value) => callback(value));
        },
        onRephrasedText: (callback: (text: string) => void) => {
            ipcRenderer.on('rephrased-text', (_event, value) => callback(value));
        },
        onAudioLevel: (callback: (level: { timestamp: number; level: number }) => void) => {
            ipcRenderer.on('audio-level', (_event, level) => callback(level));
        },
        // Settings API
        getSettings: () => ipcRenderer.invoke('get-settings'),
        saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
        testApiKey: (apiKey: string) => ipcRenderer.invoke('test-api-key', apiKey),
        openSettings: () => ipcRenderer.invoke('open-settings'),
        close: () => ipcRenderer.invoke('close-window'),
        quit: () => ipcRenderer.invoke('quit-app'),
        // Add clipboard methods
        writeToClipboard: (text: string) => ipcRenderer.invoke('write-to-clipboard', text),
        readFromClipboard: () => ipcRenderer.invoke('read-from-clipboard')
    }
);
