import './types';

// UI Elements
const app = document.getElementById('app') as HTMLDivElement;
const expandButton = document.getElementById('expandButton') as HTMLButtonElement;
const closeButton = document.getElementById('closeButton') as HTMLButtonElement;
const settingsButton = document.getElementById('settingsButton') as HTMLButtonElement;
const recordButton = document.getElementById('recordButton') as HTMLButtonElement;
const rephraseButton = document.getElementById('rephraseButton') as HTMLButtonElement;
const copyButton = document.getElementById('copyButton') as HTMLButtonElement;
const transcriptionArea = document.getElementById('transcription') as HTMLTextAreaElement;
const expandedContent = document.getElementById('expandedContent') as HTMLDivElement;
const micIcon = document.querySelector('#micIcon') as SVGElement;
const aiButton = document.getElementById('aiButton') as HTMLButtonElement;
const rephrasedContent = document.getElementById('rephrasedContent') as HTMLDivElement;
const rephrasedText = document.getElementById('rephrasedText') as HTMLTextAreaElement;
const copyRephrased = document.getElementById('copyRephrased') as HTMLButtonElement;

let isRecording = false;
let isExpanded = false;
let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let chunks: Blob[] = [];

// Audio visualization
let lastAudioLevel = 0;
const updateMicAnimation = (level: number) => {
    // Smooth the animation by interpolating between the last level and new level
    lastAudioLevel = lastAudioLevel * 0.3 + level * 0.7;
    
    // Scale factor for the mic icon (1.0 to 1.5 based on audio level)
    const scale = 1 + (lastAudioLevel / 200); // Dividing by 200 to make the effect more subtle
    
    // Update the mic icon's scale
    micIcon.style.transform = `scale(${scale})`;
    
    // Update the color based on audio level (gray to green)
    const intensity = Math.min(255, 128 + Math.floor(lastAudioLevel * 1.27)); // 128-255 range
    micIcon.style.fill = `rgb(${255-intensity}, ${intensity}, 128)`;
};

const calculateAudioLevel = (analyser: AnalyserNode): number => {
    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    let sum = 0;
    for (const value of array) {
        sum += value;
    }
    const average = sum / array.length;
    return Math.min(100, (average / 255) * 100);
};

const cleanup = () => {
    if (mediaRecorder) {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        mediaRecorder = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    analyser = null;
    chunks = [];
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer process started');

    // Debug keyboard events
    document.addEventListener('keydown', (e) => {
        console.log('Keydown event:', e.key, e.ctrlKey, e.shiftKey);
    });

    // Debug window events
    window.addEventListener('focus', () => console.log('Window focused'));
    window.addEventListener('blur', () => console.log('Window blurred'));

    // Hide text areas initially
    transcriptionArea.classList.add('hidden');
    rephrasedText.classList.add('hidden');
});

// Handle settings
settingsButton.addEventListener('click', () => {
    window.api.openSettings();
});

// Handle expand/collapse through record button
recordButton.addEventListener('dblclick', () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
        app.classList.add('expanded');
        expandedContent.classList.remove('hidden');
    } else {
        app.classList.remove('expanded');
        expandedContent.classList.add('hidden');
    }
});

// Handle close
closeButton.addEventListener('click', () => {
    isExpanded = false;
    app.classList.remove('expanded');
    expandedContent.classList.add('hidden');
    copyRephrased.classList.add('hidden');
    window.api.close();
});

// Handle recording
recordButton.addEventListener('click', async () => {
    console.log('Record button clicked, current state:', isRecording);
    try {
        if (!isRecording) {
            console.log('Starting recording...');
            
            // Initialize transcription service first
            await window.api.startRecording();
            
            // Request microphone access
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Initialize audio context and analyzer
            audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(mediaStream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            // Create MediaRecorder
            mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType: 'audio/webm'
            });

            chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            // Start audio level monitoring
            const monitorAudioLevel = () => {
                if (analyser && mediaRecorder?.state === 'recording') {
                    const level = calculateAudioLevel(analyser);
                    updateMicAnimation(level);
                    requestAnimationFrame(monitorAudioLevel);
                }
            };
            requestAnimationFrame(monitorAudioLevel);

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms
            isRecording = true;
            recordButton.classList.add('recording');
            micIcon.classList.add('animate-pulse');
        } else {
            console.log('Stopping recording...');
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.onstop = async () => {
                    try {
                        // Create a blob from the chunks
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        const buffer = await blob.arrayBuffer();
                        
                        // Send the audio data to the main process for transcription
                        await window.api.stopRecording(buffer);
                    } catch (error) {
                        console.error('Error during transcription:', error);
                        alert('Failed to transcribe audio. Please try again.');
                    } finally {
                        cleanup();
                    }
                };
                mediaRecorder.stop();
            }
            isRecording = false;
            recordButton.classList.remove('recording');
            micIcon.classList.remove('animate-pulse');
            // Reset mic icon
            micIcon.style.transform = '';
            micIcon.style.fill = '';
            lastAudioLevel = 0;
        }
    } catch (error: unknown) {
        console.error('Recording error:', error);
        // Reset state if there was an error
        isRecording = false;
        recordButton.classList.remove('recording');
        micIcon.classList.remove('animate-pulse');
        // Reset mic icon
        micIcon.style.transform = '';
        micIcon.style.fill = '';
        lastAudioLevel = 0;
        cleanup();
        
        // Show error to user
        const errorMessage = error instanceof Error ? error.message : 'Failed to start recording. Please check microphone permissions.';
        alert(errorMessage);
    }
});

// Handle AI rephrase
aiButton.addEventListener('click', async () => {
    const text = transcriptionArea.value;
    if (text.trim()) {
        try {
            aiButton.disabled = true;
            aiButton.classList.add('opacity-50');
            
            // Call API to rephrase
            const rephraseResult = await window.api.rephraseText(text);
            rephrasedText.value = rephraseResult || 'Failed to rephrase text';
            
            // Show copy rephrased button
            copyRephrased.classList.remove('hidden');
            
            // Show success feedback
            aiButton.classList.remove('opacity-50');
            aiButton.classList.remove('text-gray-500', 'text-gray-700');
            aiButton.classList.add('text-green-600');
            setTimeout(() => {
                aiButton.classList.remove('text-green-600');
                aiButton.disabled = false;
                aiButton.classList.add('text-gray-500');
            }, 1000);
        } catch (error) {
            console.error('Failed to rephrase text:', error);
            aiButton.classList.remove('opacity-50');
            aiButton.classList.add('text-red-600');
            setTimeout(() => {
                aiButton.classList.remove('text-red-600');
                aiButton.disabled = false;
                aiButton.classList.add('text-gray-500');
            }, 1000);
        }
    }
});

// Handle copy rephrased text
copyRephrased.addEventListener('click', async () => {
    const text = rephrasedText.value;
    if (text.trim() && text !== 'Rephrasing...') {
        try {
            console.log('Copying rephrased text:', text); // Debug log
            const copied = await window.api.writeToClipboard(text);
            console.log('Copy result:', copied); // Debug log
            
            copyRephrased.classList.remove('text-gray-500', 'text-gray-700');
            copyRephrased.classList.add(copied ? 'text-green-600' : 'text-red-600');
            setTimeout(() => {
                copyRephrased.classList.remove('text-green-600', 'text-red-600');
                copyRephrased.classList.add('text-gray-500');
            }, 1000);
        } catch (error) {
            console.error('Failed to copy rephrased text:', error);
            copyRephrased.classList.add('text-red-600');
            setTimeout(() => {
                copyRephrased.classList.remove('text-red-600');
                copyRephrased.classList.add('text-gray-500');
            }, 1000);
        }
    }
});

// Handle copy original text
copyButton.addEventListener('click', async () => {
    const text = transcriptionArea.value;
    if (text.trim()) {
        try {
            console.log('Copying original text:', text); // Debug log
            const copied = await window.api.writeToClipboard(text);
            console.log('Copy result:', copied); // Debug log
            
            copyButton.classList.remove('text-gray-500', 'text-gray-700');
            copyButton.classList.add(copied ? 'text-green-600' : 'text-red-600');
            setTimeout(() => {
                copyButton.classList.remove('text-green-600', 'text-red-600');
                copyButton.classList.add('text-gray-500');
            }, 1000);
        } catch (error) {
            console.error('Failed to copy text:', error);
            copyButton.classList.add('text-red-600');
            setTimeout(() => {
                copyButton.classList.remove('text-red-600');
                copyButton.classList.add('text-gray-500');
            }, 1000);
        }
    }
});

// Listen for transcription updates
window.api.onTranscriptionData((text: string) => {
    if (!isExpanded) {
        isExpanded = true;
        app.classList.add('expanded');
        expandedContent.classList.remove('hidden');
    }
    transcriptionArea.value = text;
    copyButton.classList.remove('hidden');
    aiButton.classList.remove('hidden');
});

// Listen for rephrased text updates
window.api.onRephrasedText((text: string) => {
    rephrasedText.value = text;
    copyRephrased.classList.remove('hidden');
});

// Handle window focus
document.addEventListener('focus', () => {
    console.log('Window focused');
});
