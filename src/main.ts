import { BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } from 'electron';
const { app } = require('electron');
const path = require('path');
const store = require('./store');
import { TranscriptionService } from './services/transcription';
const { clipboard } = require('electron');

interface Settings {
    openaiApiKey: string;
    language: 'en' | 'nl';
    rephraseModel?: string;
    rephrasePrompt?: string;
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let lastCtrlPress = 0;
const DOUBLE_TAP_THRESHOLD = 250; // ms
let transcriptionService: TranscriptionService | null = null;

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 300,
    height: 48,
    x: screenWidth - 320,
    y: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    show: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
      spellcheck: false
    }
  });

  // Create tray icon
  const iconPath = path.join(__dirname, '..', 'assets', 'mic-16.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // If icon is empty, create a simple 16x16 icon
      trayIcon = nativeImage.createEmpty();
      const size = { width: 16, height: 16 };
      trayIcon = nativeImage.createFromBuffer(Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
        // ... minimal 16x16 PNG data for a simple icon
      ]));
      trayIcon = trayIcon.resize(size);
    }
  } catch (error) {
    console.log('Failed to load custom icon, using fallback');
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show App', 
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { 
      label: 'Settings', 
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Voice Transcribe AI');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu);
  });

  // Request microphone permissions when window is created
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true); // Grant permission
    } else {
      callback(false); // Deny other permissions
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

  // Improved window close handling
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
  });

  // Handle minimize to tray
  mainWindow.on('minimize', (event: Electron.Event) => {
    event.preventDefault();
    mainWindow?.hide();
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 320,
    height: 480,
    frame: true,
    backgroundColor: '#ffffff',
    resizable: true,
    maximizable: true,
    minimizable: false,
    fullscreenable: true,
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
      console.log('Initializing transcription service...');
      transcriptionService = new TranscriptionService(settings.openaiApiKey);
    }
    return true;
  } catch (error) {
    console.error('Failed to initialize transcription service:', error);
    throw error;
  }
});

ipcMain.handle('stop-recording', async (_event, audioData: ArrayBuffer) => {
  console.log('Stop recording requested');
  if (!transcriptionService) {
    console.error('Transcription service not initialized');
    throw new Error('Transcription service not initialized');
  }

  try {
    const transcription = await transcriptionService.transcribeAudio(audioData);
    console.log('Transcription received:', transcription);
    mainWindow?.webContents.send('transcription-data', transcription);
    return transcription;
  } catch (error) {
    console.error('Failed to transcribe audio:', error);
    throw error;
  }
});

ipcMain.handle('rephrase-text', async (_event, text: string) => {
  const settings = store.getSettings();
  console.log('\n=== Starting Text Rephrasing ===');
  console.log('Original text:', text);
  console.log('Text length:', text.length, 'characters');
  
  if (!settings.openaiApiKey) {
    console.log('Error: OpenAI API key not set, opening settings window');
    createSettingsWindow();
    throw new Error('OpenAI API key not set');
  }
  
  try {
    // Initialize OpenAI if needed
    if (!transcriptionService) {
      console.log('Initializing new transcription service...');
      transcriptionService = new TranscriptionService(settings.openaiApiKey);
    }

    console.log('Getting OpenAI client...');
    const openai = transcriptionService.getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: settings.rephraseModel || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: settings.rephrasePrompt || "You are a professional editor who helps rephrase text to make it more clear, concise, and professional. Maintain the original meaning and details but improve the clarity and professionalism."
        },
        {
          role: "user",
          content: `Please rephrase this text professionally: ${text}`
        }
      ],
      temperature: 0.2,
      max_tokens: 5000
    });

    const rephrasedText = response.choices[0]?.message?.content;
    if (!rephrasedText) {
      throw new Error('OpenAI returned empty response');
    }

    console.log('\nRephrasing complete:');
    console.log('Original length:', text.length, 'characters');
    console.log('Rephrased length:', rephrasedText.length, 'characters');
    console.log('Original text:', text);
    console.log('Rephrased text:', rephrasedText);
    console.log('=== Rephrasing Complete ===\n');
    
    mainWindow?.webContents.send('rephrased-text', rephrasedText);
    return rephrasedText;
  } catch (error) {
    console.error('\n=== Rephrasing Error ===');
    console.error('Failed to rephrase text:', error);
    console.error('Original text was:', text);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    console.error('=== Error End ===\n');
    throw error;
  }
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

// Handle IPC close request
ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
  return true;
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

// Add clipboard handlers
ipcMain.handle('write-to-clipboard', (_event, text: string) => {
    try {
        console.log('Writing to clipboard:', text); // Debug log
        clipboard.writeText(text);
        const verification = clipboard.readText();
        console.log('Clipboard verification:', verification === text); // Debug log
        return verification === text;
    } catch (error) {
        console.error('Failed to write to clipboard:', error);
        return false;
    }
});

ipcMain.handle('read-from-clipboard', () => {
    try {
        const text = clipboard.readText();
        console.log('Reading from clipboard:', text); // Debug log
        return text;
    } catch (error) {
        console.error('Failed to read from clipboard:', error);
        return '';
    }
});

// Add explicit quit handler
ipcMain.handle('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(e => console.error('Failed to initialize app:', e));

// Prevent app from closing when all windows are closed
app.on('window-all-closed', (event: Electron.Event) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Only quit when explicitly asked to
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Add isQuitting flag to app
declare global {
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}

// Initialize the flag early
app.isQuitting = false;
