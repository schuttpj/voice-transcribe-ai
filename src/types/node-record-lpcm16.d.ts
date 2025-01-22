declare module 'node-record-lpcm16' {
    interface RecordOptions {
        sampleRate?: number;
        channels?: number;
        audioType?: string;
    }

    interface Recorder {
        stream(): NodeJS.ReadableStream;
        stop(): void;
    }

    export function record(options?: RecordOptions): Recorder;
} 