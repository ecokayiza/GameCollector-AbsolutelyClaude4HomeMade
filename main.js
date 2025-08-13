const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// 使用应用程序目录作为数据存储位置
const dataDir = path.join(__dirname, 'data');
const imagesDir = path.join(dataDir, 'images');
const gamesJsonPath = path.join(dataDir, 'games.json');

// 确保数据目录存在
function ensureDataDirectories() {
  try {
    console.log('🔧 检查数据目录:', dataDir);
    
    if (!fs.existsSync(dataDir)) {
      console.log('🔧 数据目录不存在，正在创建...');
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ 创建数据目录:', dataDir);
    } else {
      console.log('✅ 数据目录已存在:', dataDir);
    }
    
    if (!fs.existsSync(imagesDir)) {
      console.log('🔧 图片目录不存在，正在创建...');
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log('✅ 创建图片目录:', imagesDir);
    } else {
      console.log('✅ 图片目录已存在:', imagesDir);
    }
    
    // 创建初始的games.json文件（如果不存在）
    if (!fs.existsSync(gamesJsonPath)) {
      console.log('🔧 创建初始游戏数据文件...');
      fs.writeFileSync(gamesJsonPath, '[]', 'utf8');
      console.log('✅ 创建初始游戏数据文件:', gamesJsonPath);
    }
    
  } catch (error) {
    console.error('❌ 创建数据目录失败:', error);
    console.error('当前工作目录:', process.cwd());
    console.error('__dirname:', __dirname);
  }
}

function createWindow() {
  // 确保数据目录存在
  ensureDataDirectories();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile('index.html');

  // 开发模式下打开调试工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理器
ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  return result;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    console.log('🔧 读取文件:', fullPath);
    const data = fs.readFileSync(fullPath, 'utf8');
    console.log('✅ 文件读取成功, 大小:', data.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 文件读取失败:', fullPath, error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const dir = path.dirname(fullPath);
    
    console.log('🔧 写入文件:', fullPath);
    console.log('🔧 目标目录:', dir);
    
    // 确保目录存在
    if (!fs.existsSync(dir)) {
      console.log('🔧 创建缺失的目录:', dir);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, data);
    console.log('✅ 文件写入成功, 大小:', data.length);
    return { success: true };
  } catch (error) {
    console.error('❌ 文件写入失败:', fullPath, error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('show-error-box', async (event, title, content) => {
  dialog.showErrorBox(title, content);
});

ipcMain.handle('get-app-path', async (event, name) => {
  return app.getPath(name);
});

ipcMain.handle('save-image', async (event, imageData, filename) => {
  try {
    console.log('🔧 开始保存图片:', filename);
    console.log('🔧 图片数据长度:', imageData ? imageData.length : 'undefined');
    
    console.log('🔧 目标目录:', imagesDir);
    
    // 确保images目录存在
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log('🔧 创建 images 目录');
    }
    
    const fullPath = path.join(imagesDir, filename);
    console.log('🔧 完整文件路径:', fullPath);
    
    // 从base64数据中提取实际的图片数据
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    console.log('🔧 Buffer 大小:', buffer.length);
    
    fs.writeFileSync(fullPath, buffer);
    
    console.log('✅ 图片已保存:', fullPath);
    console.log('✅ 文件是否存在:', fs.existsSync(fullPath));
    
    return { success: true, path: `./data/images/${filename}` };
  } catch (error) {
    console.error('❌ 保存图片失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-image', async (event, filename) => {
  try {
    const fullPath = path.join(imagesDir, filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
