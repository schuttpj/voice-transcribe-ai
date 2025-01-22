import './types';

// UI Elements
const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
const testApiKeyButton = document.getElementById('testApiKey') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('saveSettings') as HTMLButtonElement;
const apiKeyStatus = document.getElementById('apiKeyStatus') as HTMLParagraphElement;

// Load current settings
async function loadSettings() {
    try {
        const settings = await window.api.getSettings();
        apiKeyInput.value = settings.openaiApiKey;
        languageSelect.value = settings.language;
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
        if (isValid) {
            apiKeyStatus.textContent = 'API key is valid';
            apiKeyStatus.className = 'mt-1 text-sm text-green-600';
        } else {
            apiKeyStatus.textContent = 'Invalid API key';
            apiKeyStatus.className = 'mt-1 text-sm text-red-600';
        }
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

    if (!apiKey) {
        apiKeyStatus.textContent = 'Please enter an API key';
        apiKeyStatus.className = 'mt-1 text-sm text-red-600';
        return;
    }

    saveSettingsButton.disabled = true;
    
    try {
        await window.api.saveSettings({ openaiApiKey: apiKey, language });
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
