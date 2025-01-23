import './types';

// UI Elements
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;
const rephrasePromptInput = document.getElementById('rephrasePrompt') as HTMLTextAreaElement;
const rephraseModelInput = document.getElementById('rephraseModel') as HTMLInputElement;
const apiKeyStatus = document.getElementById('apiKeyStatus') as HTMLDivElement;
const testApiKeyButton = document.getElementById('testApiKey') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('saveSettings') as HTMLButtonElement;

// Default values
const DEFAULT_REPHRASE_PROMPT = "You are a professional editor who helps rephrase text to make it more clear, concise, and professional. Maintain the original meaning and details but improve the clarity and professionalism.";
const DEFAULT_REPHRASE_MODEL = "gpt-4o-mini";

// Load settings
async function loadSettings() {
    try {
        const settings = await window.api.getSettings();
        apiKeyInput.value = settings.openaiApiKey || '';
        languageSelect.value = settings.language || 'en';
        rephrasePromptInput.value = settings.rephrasePrompt || DEFAULT_REPHRASE_PROMPT;
        rephraseModelInput.value = settings.rephraseModel || DEFAULT_REPHRASE_MODEL;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Test API key
async function testApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        apiKeyStatus.textContent = 'Please enter an API key';
        apiKeyStatus.className = 'mt-1 text-sm text-red-600';
        return;
    }

    testApiKeyButton.disabled = true;
    apiKeyStatus.textContent = 'Testing...';
    apiKeyStatus.className = 'mt-1 text-sm text-gray-600';

    try {
        const isValid = await window.api.testApiKey(apiKey);
        apiKeyStatus.textContent = isValid ? 'API key is valid!' : 'Invalid API key';
        apiKeyStatus.className = `mt-1 text-sm ${isValid ? 'text-green-600' : 'text-red-600'}`;
    } catch (error) {
        apiKeyStatus.textContent = 'Failed to test API key';
        apiKeyStatus.className = 'mt-1 text-sm text-red-600';
    } finally {
        testApiKeyButton.disabled = false;
    }
}

// Save settings
async function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    const language = languageSelect.value as 'en' | 'nl';
    const rephrasePrompt = rephrasePromptInput.value.trim() || DEFAULT_REPHRASE_PROMPT;
    const rephraseModel = rephraseModelInput.value.trim() || DEFAULT_REPHRASE_MODEL;

    if (!apiKey) {
        apiKeyStatus.textContent = 'Please enter an API key';
        apiKeyStatus.className = 'mt-1 text-sm text-red-600';
        return;
    }

    saveSettingsButton.disabled = true;
    
    try {
        await window.api.saveSettings({ 
            openaiApiKey: apiKey, 
            language,
            rephrasePrompt,
            rephraseModel
        });
        window.close();
    } catch (error) {
        console.error('Failed to save settings:', error);
    } finally {
        saveSettingsButton.disabled = false;
    }
}

// Event listeners
testApiKeyButton.addEventListener('click', testApiKey);
saveSettingsButton.addEventListener('click', saveSettings);

// Load settings on page load
loadSettings();
