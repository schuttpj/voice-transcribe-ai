export interface Settings {
    openaiApiKey: string;
    language: 'en' | 'nl';
}

export interface API {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    rephraseText: (text: string) => Promise<void>;
    openSettings: () => Promise<void>;
    close: () => Promise<void>;
    onTranscriptionData: (callback: (text: string) => void) => void;
    hideWindow: () => Promise<void>;
    onWindowFocus: (callback: () => void) => void;
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<boolean>;
    testApiKey: (apiKey: string) => Promise<boolean>;
}

declare global {
    interface Window {
        api: API;
    }
}
