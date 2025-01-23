import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AudioLevel {
    timestamp: number;
    level: number;
}

export class TranscriptionService {
    private openai: OpenAI;
    private mediaRecorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private totalBytesRecorded: number = 0;
    private recordingStartTime: number = 0;
    private onAudioLevel: ((level: AudioLevel) => void) | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaStream: MediaStream | null = null;

    constructor(apiKey: string, onAudioLevel?: (level: AudioLevel) => void) {
        console.log('Initializing TranscriptionService...');
        this.openai = new OpenAI({ apiKey });
        this.onAudioLevel = onAudioLevel || null;
    }

    getOpenAIClient(): OpenAI {
        return this.openai;
    }

    private calculateAudioLevel(analyser: AnalyserNode): number {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let sum = 0;
        for (const value of array) {
            sum += value;
        }
        const average = sum / array.length;
        return Math.min(100, (average / 255) * 100);
    }

    async checkMicrophonePermission(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Error checking microphone permission:', error);
            return false;
        }
    }

    async startRecording(): Promise<void> {
        try {
            console.log('Checking microphone permission...');
            const hasPermission = await this.checkMicrophonePermission();
            if (!hasPermission) {
                throw new Error('Microphone access denied or not available');
            }

            console.log('Starting new recording session...');
            this.chunks = [];
            this.totalBytesRecorded = 0;
            this.recordingStartTime = Date.now();
            
            console.log('Initializing audio context and media stream...');
            this.audioContext = new AudioContext();
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Set up audio analysis
            if (!this.audioContext || !this.mediaStream) {
                throw new Error('Failed to initialize audio context or media stream');
            }
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            source.connect(this.analyser);

            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: 'audio/webm'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                    this.totalBytesRecorded += event.data.size;
                    console.log(`Received chunk: ${event.data.size} bytes. Total recorded: ${this.totalBytesRecorded} bytes`);
                }
            };

            // Start audio level monitoring
            if (this.onAudioLevel && this.analyser) {
                const monitorAudioLevel = () => {
                    if (this.analyser && this.mediaRecorder?.state === 'recording' && this.onAudioLevel) {
                        const level = this.calculateAudioLevel(this.analyser);
                        this.onAudioLevel({
                            timestamp: Date.now(),
                            level
                        });
                        requestAnimationFrame(monitorAudioLevel);
                    }
                };
                requestAnimationFrame(monitorAudioLevel);
            }

            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            console.log('Recording started successfully. Listening for audio...');
        } catch (error) {
            console.error('Error in startRecording:', error);
            this.cleanup();
            throw error;
        }
    }

    private cleanup() {
        if (this.mediaRecorder) {
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            this.mediaRecorder = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        this.chunks = [];
        this.totalBytesRecorded = 0;
    }

    async stopRecording(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No active recording found'));
                return;
            }

            console.log(`Stopping recording. Total duration: ${(Date.now() - this.recordingStartTime) / 1000}s`);
            console.log(`Total data collected: ${this.totalBytesRecorded} bytes in ${this.chunks.length} chunks`);

            this.mediaRecorder.onstop = async () => {
                try {
                    const tempFile = path.join(os.tmpdir(), `recording-${Date.now()}.webm`);
                    console.log(`Creating temporary file: ${tempFile}`);

                    // Create a blob from the chunks
                    const blob = new Blob(this.chunks, { type: 'audio/webm' });
                    const buffer = await blob.arrayBuffer();
                    
                    // Write to temporary file
                    fs.writeFileSync(tempFile, Buffer.from(buffer));

                    // Verify file exists and has content
                    const stats = fs.statSync(tempFile);
                    console.log(`Temporary file size: ${stats.size} bytes`);
                    
                    if (stats.size === 0) {
                        throw new Error('Generated audio file is empty');
                    }

                    // Create a readable stream from the file
                    const file = fs.createReadStream(tempFile);

                    console.log('Sending audio to OpenAI Whisper API...');
                    // Transcribe using OpenAI Whisper
                    const response = await this.openai.audio.transcriptions.create({
                        file,
                        model: 'whisper-1',
                        language: 'en'
                    });

                    console.log('Received transcription response:', response.text);

                    // Clean up
                    fs.unlink(tempFile, (err) => {
                        if (err) console.error('Failed to delete temporary file:', err);
                        else console.log('Temporary file deleted successfully');
                    });

                    this.cleanup();
                    resolve(response.text);
                } catch (error) {
                    console.error('Error during transcription:', error);
                    this.cleanup();
                    reject(error);
                }
            };

            // Stop recording
            this.mediaRecorder.stop();
        });
    }

    async transcribeAudio(audioData: ArrayBuffer): Promise<string> {
        const tempFile = path.join(os.tmpdir(), `recording-${Date.now()}.webm`);
        console.log(`Creating temporary file: ${tempFile}`);

        try {
            // Write audio data to temporary file
            fs.writeFileSync(tempFile, Buffer.from(audioData));

            // Verify file exists and has content
            const stats = fs.statSync(tempFile);
            console.log(`Temporary file size: ${stats.size} bytes`);
            
            if (stats.size === 0) {
                throw new Error('Generated audio file is empty');
            }

            // Create a readable stream from the file
            const file = fs.createReadStream(tempFile);

            console.log('Sending audio to OpenAI Whisper API...');
            // Transcribe using OpenAI Whisper
            const response = await this.openai.audio.transcriptions.create({
                file,
                model: 'whisper-1',
                language: 'en'
            });

            console.log('Received transcription response:', response.text);

            return response.text;
        } catch (error) {
            console.error('Error during transcription:', error);
            throw error;
        } finally {
            // Clean up temporary file
            try {
                fs.unlinkSync(tempFile);
                console.log('Temporary file deleted successfully');
            } catch (err) {
                console.error('Failed to delete temporary file:', err);
            }
        }
    }
} 