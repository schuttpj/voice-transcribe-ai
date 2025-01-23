export interface AudioLevel {
    timestamp: number;
    level: number;
}

export interface Settings {
    openaiApiKey: string;
    language: 'en' | 'nl';
    rephrasePrompt: string;
    rephraseModel: string;
}

export interface API {
    startRecording: () => Promise<void>;
    stopRecording: (buffer: ArrayBuffer) => Promise<string>;
    rephraseText: (text: string) => Promise<string>;
    openSettings: () => Promise<void>;
    close: () => Promise<void>;
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<void>;
    testApiKey: (apiKey: string) => Promise<boolean>;
    onTranscriptionData: (callback: (text: string) => void) => void;
    onRephrasedText: (callback: (text: string) => void) => void;
    onAudioLevel: (callback: (level: { timestamp: number; level: number }) => void) => void;
    writeToClipboard: (text: string) => Promise<boolean>;
    readFromClipboard: () => Promise<string>;
    quit: () => Promise<void>;
}

declare global {
    interface Window {
        api: API;
    }
}

export {};
