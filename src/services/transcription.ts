import { OpenAI } from 'openai';
import * as recorder from 'node-record-lpcm16';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AudioLevel {
    timestamp: number;
    level: number;
}

export class TranscriptionService {
    private openai: OpenAI;
    private recording: recorder.Recorder | null = null;
    private chunks: Buffer[] = [];
    private totalBytesRecorded: number = 0;
    private recordingStartTime: number = 0;
    private onAudioLevel: ((level: AudioLevel) => void) | null = null;

    constructor(apiKey: string, onAudioLevel?: (level: AudioLevel) => void) {
        console.log('Initializing TranscriptionService...');
        this.openai = new OpenAI({ apiKey });
        this.onAudioLevel = onAudioLevel || null;
    }

    private calculateAudioLevel(chunk: Buffer): number {
        // Calculate RMS (Root Mean Square) of the audio chunk
        let sum = 0;
        for (let i = 0; i < chunk.length; i += 2) {
            // Convert 16-bit samples to numbers
            const sample = chunk.readInt16LE(i);
            sum += sample * sample;
        }
        const rms = Math.sqrt(sum / (chunk.length / 2));
        // Normalize to 0-100 range
        return Math.min(100, (rms / 32768) * 100);
    }

    async checkMicrophonePermission(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            try {
                const testRecording = recorder.record({
                    sampleRate: 16000,
                    channels: 1,
                    audioType: 'wav'
                });

                // Try to get the first chunk
                const timeout = setTimeout(() => {
                    testRecording.stop();
                    resolve(false);
                }, 1000);

                testRecording.stream().once('data', () => {
                    clearTimeout(timeout);
                    testRecording.stop();
                    resolve(true);
                });

                testRecording.stream().once('error', () => {
                    clearTimeout(timeout);
                    resolve(false);
                });
            } catch (error) {
                console.error('Error checking microphone permission:', error);
                resolve(false);
            }
        });
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
            
            console.log('Configuring recorder with 16kHz sample rate, mono channel...');
            // Start recording
            this.recording = recorder.record({
                sampleRate: 16000,
                channels: 1,
                audioType: 'wav'
            });

            // Wait for the first chunk to ensure recording has started
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Recording failed to start within 5 seconds'));
                }, 5000);

                const stream = this.recording!.stream();
                
                stream.once('data', (chunk: Buffer) => {
                    clearTimeout(timeout);
                    this.chunks.push(chunk);
                    this.totalBytesRecorded += chunk.length;
                    console.log(`Recording started. First chunk received: ${chunk.length} bytes`);
                    
                    // Continue collecting chunks
                    stream.on('data', (chunk: Buffer) => {
                        this.chunks.push(chunk);
                        this.totalBytesRecorded += chunk.length;
                        
                        // Calculate and emit audio level
                        if (this.onAudioLevel) {
                            const level = this.calculateAudioLevel(chunk);
                            this.onAudioLevel({
                                timestamp: Date.now(),
                                level
                            });
                        }
                        
                        console.log(`Received chunk: ${chunk.length} bytes. Total recorded: ${this.totalBytesRecorded} bytes`);
                    });
                    
                    resolve();
                });

                stream.on('error', (error) => {
                    console.error('Recording stream error:', error);
                    reject(error);
                });
            });

            console.log('Recording started successfully. Listening for audio...');
        } catch (error) {
            console.error('Error in startRecording:', error);
            this.recording = null;
            this.chunks = [];
            throw error;
        }
    }

    async stopRecording(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.recording) {
                reject(new Error('No active recording found'));
                return;
            }

            console.log(`Stopping recording. Total duration: ${(Date.now() - this.recordingStartTime) / 1000}s`);
            console.log(`Total data collected: ${this.totalBytesRecorded} bytes in ${this.chunks.length} chunks`);

            // Stop recording
            this.recording.stop();
            
            const tempFile = path.join(os.tmpdir(), `recording-${Date.now()}.wav`);
            console.log(`Creating temporary WAV file: ${tempFile}`);
            
            try {
                // Create a WAV file with proper headers
                const wavWriter = new (require('wav').FileWriter)(tempFile, {
                    channels: 1,
                    sampleRate: 16000,
                    bitDepth: 16
                });

                // Write the audio data
                const audioData = Buffer.concat(this.chunks);
                console.log(`Writing ${audioData.length} bytes to WAV file...`);
                wavWriter.write(audioData);
                wavWriter.end();

                let finished = false;
                
                // Handle both 'done' and 'finish' events
                const handleCompletion = async () => {
                    if (finished) return;
                    finished = true;
                    
                    try {
                        console.log('WAV file written successfully. Starting transcription...');
                        
                        // Verify file exists and has content
                        const stats = fs.statSync(tempFile);
                        console.log(`Temporary file size: ${stats.size} bytes`);
                        
                        if (stats.size === 0) {
                            throw new Error('Generated WAV file is empty');
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

                        this.chunks = [];
                        this.recording = null;
                        this.totalBytesRecorded = 0;

                        resolve(response.text);
                    } catch (error) {
                        console.error('Error during transcription:', error);
                        reject(error);
                    }
                };

                wavWriter.on('done', handleCompletion);
                wavWriter.on('finish', handleCompletion);

                wavWriter.on('error', (error: Error) => {
                    console.error('Error writing WAV file:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Error in stopRecording:', error);
                // Clean up
                fs.unlink(tempFile, (err) => {
                    if (err) console.error('Failed to delete temporary file:', err);
                });
                reject(error);
            }
        });
    }
} 