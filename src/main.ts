import { BrowserWindow, globalShortcut, ipcMain } from 'electron';
const { app } = require('electron');
const path = require('path');
const store = require('./store');
import { TranscriptionService } from './services/transcription';

interface Settings {
    openaiApiKey: string;
    language: 'en' | 'nl';
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let lastCtrlPress = 0;
const DOUBLE_TAP_THRESHOLD = 250; // ms
let transcriptionService: TranscriptionService | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,  // Default width increased
    height: 180,  // Default height increased
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true, // Hide from taskbar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true  // Ensure dev tools are enabled
    }
  });

  // Register keyboard shortcut for DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
  });

  // Add right-click menu for DevTools
  mainWindow.webContents.on('context-menu', () => {
    mainWindow?.webContents.openDevTools({ mode: 'detach' });
  });

  // Handle window visibility
  ipcMain.handle('hide-window', () => {
    mainWindow?.hide();
  });

  // Handle window focus
  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window-focused');
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'"
        ].join('; ')
      }
    });
  });

  const indexPath = path.join(__dirname, '..', 'index.html');
  mainWindow.loadFile(indexPath)
    .then(() => {
      mainWindow?.show();
      mainWindow?.focus();
    })
    .catch(e => console.error('Failed to load index.html:', e));

  // Handle window close properly
  mainWindow.on('close', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 280,  // Reduced from 400
    height: 200,  // Reduced from 400
    frame: true,
    backgroundColor: '#ffffff',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    parent: mainWindow!,
    modal: true,
    title: 'Settings',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const settingsPath = path.join(__dirname, '..', 'settings.html');
  settingsWindow.loadFile(settingsPath)
    .catch(e => console.error('Failed to load settings.html:', e));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// IPC handlers
ipcMain.handle('start-recording', async () => {
  const settings = store.getSettings();
  console.log('Recording requested. Settings:', settings);
  if (!settings.openaiApiKey) {
    console.log('No API key found, opening settings window');
    createSettingsWindow();
    throw new Error('OpenAI API key not set');
  }

  try {
    // Initialize transcription service if needed
    if (!transcriptionService) {
      transcriptionService = new TranscriptionService(
        settings.openaiApiKey,
        (level) => {
          if (mainWindow) {
            mainWindow.webContents.send('audio-level', level);
          }
        }
      );
    }

    console.log('Starting recording with API key:', settings.openaiApiKey.substring(0, 4) + '...');
    await transcriptionService.startRecording();
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
});

ipcMain.handle('stop-recording', async () => {
  console.log('Stop recording requested');
  if (!transcriptionService) {
    throw new Error('Transcription service not initialized');
  }

  try {
    const transcription = await transcriptionService.stopRecording();
    console.log('Transcription received:', transcription);
    mainWindow?.webContents.send('transcription-data', transcription);
    return transcription;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    throw error;
  }
});

ipcMain.handle('rephrase-text', async (_event, text: string) => {
  const settings = store.getSettings();
  if (!settings.openaiApiKey) {
    createSettingsWindow();
    throw new Error('OpenAI API key not set');
  }
  console.log('Rephrase requested for:', text);
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Settings handlers
ipcMain.handle('get-settings', () => {
  return store.getSettings();
});

ipcMain.handle('save-settings', (_event, settings: Settings) => {
  store.setSettings(settings);
  return true;
});

ipcMain.handle('test-api-key', async (_event, apiKey: string) => {
  try {
    // TODO: Implement actual API key testing with OpenAI
    return true;
  } catch (error) {
    console.error('API key test failed:', error);
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();

  // Register Ctrl double-tap detection using a modifier key combination
  globalShortcut.unregisterAll(); // Clear any existing shortcuts
  globalShortcut.register('Control+D', () => {
    console.log('Ctrl+D pressed, toggling window');
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(e => console.error('Failed to initialize app:', e));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
