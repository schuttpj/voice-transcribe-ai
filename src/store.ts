import { app } from 'electron';
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(app.getPath('userData'), 'settings.json');

interface Settings {
    openaiApiKey: string;
    language: 'en' | 'nl';
}

class Store {
    private data: Settings;

    constructor() {
        this.data = this.loadStore();
    }

    private loadStore(): Settings {
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                return {
                    openaiApiKey: data.openaiApiKey || '',
                    language: data.language || 'en'
                };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return {
            openaiApiKey: '',
            language: 'en'
        };
    }

    private saveStore() {
        try {
            fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    getSettings(): Settings {
        return { ...this.data };
    }

    setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
        this.data[key] = value;
        this.saveStore();
    }

    setSettings(settings: Settings): void {
        this.data = { ...settings };
        this.saveStore();
    }
}

const store = new Store();

module.exports = {
    getSettings: () => store.getSettings(),
    setSetting: (key: keyof Settings, value: any) => store.setSetting(key, value),
    setSettings: (settings: Settings) => store.setSettings(settings)
};
