/**
 * Electron渲染进程工具函数
 * 提供与主进程通信的便捷方法
 */

class ElectronUtils {
    constructor() {
        this.isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
    }

    /**
     * 检查是否在Electron环境中运行
     */
    isElectronApp() {
        return this.isElectron;
    }

    /**
     * 获取应用版本
     */
    async getAppVersion() {
        if (!this.isElectron) return 'Web版本';
        
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('get-app-version');
        } catch (error) {
            console.error('获取应用版本失败:', error);
            return '未知版本';
        }
    }

    /**
     * 显示消息框
     */
    async showMessageBox(options) {
        if (!this.isElectron) {
            // Web环境下使用浏览器原生对话框
            if (options.type === 'error') {
                alert(`错误: ${options.message}\n\n${options.detail || ''}`);
            } else {
                alert(`${options.message}\n\n${options.detail || ''}`);
            }
            return { response: 0 };
        }

        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('show-message-box', options);
        } catch (error) {
            console.error('显示消息框失败:', error);
            return { response: 0 };
        }
    }

    /**
     * 显示错误框
     */
    async showErrorBox(title, content) {
        if (!this.isElectron) {
            alert(`${title}\n\n${content}`);
            return;
        }

        try {
            const { ipcRenderer } = require('electron');
            await ipcRenderer.invoke('show-error-box', title, content);
        } catch (error) {
            console.error('显示错误框失败:', error);
        }
    }

    /**
     * 获取应用路径
     */
    async getAppPath(name = 'userData') {
        if (!this.isElectron) {
            return './data'; // Web环境下返回相对路径
        }

        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('get-app-path', name);
        } catch (error) {
            console.error('获取应用路径失败:', error);
            return './data';
        }
    }

    /**
     * 检查文件系统API支持
     */
    supportsFileSystemAPI() {
        return this.isElectron || (window.File && window.FileReader && window.FileList && window.Blob);
    }

    /**
     * 获取平台信息
     */
    getPlatform() {
        if (!this.isElectron) {
            return navigator.platform;
        }

        try {
            const { remote } = require('electron');
            return remote.process.platform;
        } catch (error) {
            return process.platform;
        }
    }

    /**
     * 打开外部链接
     */
    openExternal(url) {
        if (!this.isElectron) {
            window.open(url, '_blank');
            return;
        }

        try {
            const { shell } = require('electron');
            shell.openExternal(url);
        } catch (error) {
            console.error('打开外部链接失败:', error);
            window.open(url, '_blank');
        }
    }

    /**
     * 重启应用
     */
    relaunchApp() {
        if (!this.isElectron) {
            location.reload();
            return;
        }

        try {
            const { remote } = require('electron');
            remote.app.relaunch();
            remote.app.exit();
        } catch (error) {
            console.error('重启应用失败:', error);
            location.reload();
        }
    }
}

// 创建全局实例
window.electronUtils = new ElectronUtils();

// 如果在Electron环境中，设置一些额外的功能
if (window.electronUtils.isElectronApp()) {
    // 禁用默认的右键菜单（可选）
    document.addEventListener('contextmenu', (e) => {
        // e.preventDefault(); // 取消注释以禁用右键菜单
    });

    // 阻止拖拽文件到窗口
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    console.log('Electron桌面应用环境已加载');
} else {
    console.log('Web浏览器环境已加载');
}
