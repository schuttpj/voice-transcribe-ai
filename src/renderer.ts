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
});

// Handle settings
settingsButton.addEventListener('click', () => {
    window.api.openSettings();
});

// Handle expand/collapse through record button
recordButton.addEventListener('dblclick', () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
        app.style.width = '300px';  // Increased width for better text visibility
        app.style.height = '95px';
        expandedContent.classList.remove('hidden');
    } else {
        app.style.width = '70px';
        app.style.height = '32px';
        app.classList.add('collapsed');
        // Hide expanded content after animation
        setTimeout(() => {
            if (!isExpanded) {
                expandedContent.classList.add('hidden');
                rephrasedContent.classList.add('hidden'); // Also hide rephrased content
            }
        }, 300);
    }
});

// Handle close
closeButton.addEventListener('click', () => {
    window.api.close();
});

// Handle recording
recordButton.addEventListener('click', async () => {
    console.log('Record button clicked, current state:', isRecording);
    try {
        if (!isRecording) {
            console.log('Starting recording...');
            await window.api.startRecording();
            isRecording = true;
            recordButton.classList.add('recording');
            micIcon.classList.add('animate-pulse');
        } else {
            console.log('Stopping recording...');
            await window.api.stopRecording();
            isRecording = false;
            recordButton.classList.remove('recording');
            micIcon.classList.remove('animate-pulse');
            // Reset mic icon
            micIcon.style.transform = '';
            micIcon.style.fill = '';
            lastAudioLevel = 0;
        }
    } catch (error) {
        console.error('Recording error:', error);
        // Reset state if there was an error
        isRecording = false;
        recordButton.classList.remove('recording');
        micIcon.classList.remove('animate-pulse');
        // Reset mic icon
        micIcon.style.transform = '';
        micIcon.style.fill = '';
        lastAudioLevel = 0;
        
        // Show error to user
        alert(error.message || 'Failed to start recording. Please check microphone permissions.');
    }
});

// Listen for audio levels
window.api.onAudioLevel(({ level }) => {
    if (isRecording) {
        updateMicAnimation(level);
    }
});

// Handle AI rephrase
aiButton.addEventListener('click', async () => {
    const text = transcriptionArea.value;
    if (text.trim()) {
        try {
            aiButton.disabled = true;
            aiButton.classList.add('opacity-50');
            
            // Ensure window is expanded first
            if (!isExpanded) {
                isExpanded = true;
                app.style.width = '300px';
                expandedContent.classList.remove('hidden');
            }
            
            // Show rephrased content area and adjust window height
            rephrasedContent.classList.remove('hidden');
            app.style.height = '180px';  // Increased height to accommodate both text areas
            rephrasedText.value = 'Rephrasing...';
            
            // Call API to rephrase
            await window.api.rephraseText(text);
            
            // For now, simulate the response
            setTimeout(() => {
                rephrasedText.value = "Here's your professionally rephrased text...";
                aiButton.disabled = false;
                aiButton.classList.remove('opacity-50');
            }, 1000);
        } catch (error) {
            console.error('Failed to rephrase text:', error);
            rephrasedText.value = 'Failed to rephrase text. Please try again.';
            aiButton.disabled = false;
            aiButton.classList.remove('opacity-50');
        }
    }
});

// Handle copy rephrased text
copyRephrased.addEventListener('click', () => {
    const text = rephrasedText.value;
    if (text.trim() && text !== 'Rephrasing...') {
        navigator.clipboard.writeText(text).then(() => {
            const originalColor = copyRephrased.classList.contains('text-gray-500') ? 'text-gray-500' : 'text-gray-700';
            copyRephrased.classList.remove(originalColor);
            copyRephrased.classList.add('text-green-600');
            setTimeout(() => {
                copyRephrased.classList.remove('text-green-600');
                copyRephrased.classList.add(originalColor);
            }, 1000);
        });
    }
});

// Handle copy original text
copyButton.addEventListener('click', () => {
    const text = transcriptionArea.value;
    if (text.trim()) {
        navigator.clipboard.writeText(text).then(() => {
            const originalColor = copyButton.classList.contains('text-gray-500') ? 'text-gray-500' : 'text-gray-700';
            copyButton.classList.remove(originalColor);
            copyButton.classList.add('text-green-600');
            setTimeout(() => {
                copyButton.classList.remove('text-green-600');
                copyButton.classList.add(originalColor);
            }, 1000);
        });
    }
});

// Listen for transcription updates
window.api.onTranscriptionData((text: string) => {
    if (!isExpanded) {
        isExpanded = true;
        expandedContent.classList.remove('hidden');
        app.classList.add('expanded');
    }
    transcriptionArea.value += text;
});

// Handle clicks outside the window
document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const isInsideApp = target.closest('#app') !== null;
    const isTextArea = target.tagName === 'TEXTAREA';
    const isButton = target.tagName === 'BUTTON' || target.closest('button') !== null;
    
    // Don't hide if clicking inside the app, on a text area, or on a button
    if (!isInsideApp && !isTextArea && !isButton) {
        window.api.hideWindow();
    }
});

// Handle window focus
window.api.onWindowFocus(() => {
    console.log('Window focused');
});
