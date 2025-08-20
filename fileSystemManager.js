/**
 * 文件系统管理器
 * 在Electron环境中直接处理本地文件，在Web环境中通过API服务器处理
 */
class FileSystemManager {
    // 分类配置缓存
    categoryConfig = null;
    categoryCodes = null;
    async loadCategoryConfig() {
        if (this.categoryConfig && this.categoryCodes) return;
        try {
            const response = await fetch('./config.json');
            if (!response.ok) throw new Error('无法加载分类配置文件');
            const config = await response.json();
            this.categoryConfig = {};
            this.categoryCodes = [];
            if (Array.isArray(config.categories)) {
                config.categories.forEach(cat => {
                    this.categoryConfig[cat.code] = cat.name;
                    this.categoryCodes.push(cat.code);
                });
            }
            this.categoryConfig['OTHER'] = '其他';
            this.categoryCodes.push('OTHER');
        } catch (e) {
            this.categoryConfig = {
                'ADV': '冒险游戏',
                'ACT': '动作游戏',
                'RPG': '角色扮演',
                'SLG': '策略游戏',
                '3DSIM': '3D模拟',
                'OTHER': '其他'
            };
            this.categoryCodes = Object.keys(this.categoryConfig);
        }
    }
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.games = [];
        this.initialized = false;
        this.isElectron = typeof window !== 'undefined' && window.require && window.require('electron');
        this.dataFilePath = './data/games.json';
        this.imagesDir = './data/images/';
        
        console.log('FileSystemManager initialized, isElectron:', this.isElectron);
    }

    /**
     * 清理文件名，移除不安全的字符
     */
    sanitizeFilename(name) {
        if (!name || typeof name !== 'string') {
            return 'unnamed';
        }
        
        // 移除不安全的文件名字符，保留中文、英文、数字、空格、短横线、下划线
        return name
            .replace(/[<>:"/\\|?*]/g, '') // 移除Windows不允许的字符
            .replace(/\s+/g, '_') // 将空格替换为下划线
            .replace(/[^\w\u4e00-\u9fa5\-_.]/g, '') // 只保留安全字符
            .substring(0, 50); // 限制长度
    }

    /**
     * 初始化文件系统
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            if (this.isElectron) {
                // Electron环境：直接读取本地文件
                await this.loadGamesFromFile();
            } else {
                // Web环境：从API服务器加载数据
                await this.loadGamesFromServer();
            }
            this.initialized = true;
            console.log('文件系统管理器初始化完成');
        } catch (error) {
            console.error('初始化文件系统失败:', error);
            this.games = [];
            this.initialized = true;
        }
    }

    /**
     * 从本地文件加载游戏数据 (Electron环境)
     */
    async loadGamesFromFile() {
        try {
            const { ipcRenderer } = require('electron');
            console.log('尝试从本地文件加载数据:', this.dataFilePath);
            const result = await ipcRenderer.invoke('read-file', this.dataFilePath);
            
            console.log('读取文件结果:', result);
            
            if (result.success) {
                const games = JSON.parse(result.data);
                if (Array.isArray(games)) {
                    this.games = games;
                    // 修复从Web版本迁移过来的数据
                    await this.migrateWebDataToElectron();
                    console.log(`✅ 从本地文件加载了 ${this.games.length} 个游戏记录`);
                } else {
                    console.warn('本地文件数据格式不正确，重置为空数组');
                    this.games = [];
                }
            } else {
                console.log('本地文件不存在或读取失败，创建空数据文件');
                this.games = [];
                await this.saveGamesToFile();
            }
        } catch (error) {
            console.error('从本地文件加载数据失败:', error);
            this.games = [];
        }
    }

    /**
     * 保存游戏数据到本地文件 (Electron环境)
     */
    async saveGamesToFile() {
        try {
            const { ipcRenderer } = require('electron');
            console.log('尝试保存游戏数据到本地文件:', this.dataFilePath);
            console.log('要保存的游戏数量:', this.games.length);
            
            const jsonData = JSON.stringify(this.games, null, 2);
            const result = await ipcRenderer.invoke('write-file', this.dataFilePath, jsonData);
            
            console.log('保存文件结果:', result);
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log('✅ 游戏数据已保存到本地文件');
            return true;
        } catch (error) {
            console.error('❌ 保存游戏数据到本地文件失败:', error);
            throw error;
        }
    }

    /**
     * 从API服务器加载游戏数据
     */
    async loadGamesFromServer() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/games`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const games = await response.json();
            
            // 验证数据格式
            if (Array.isArray(games)) {
                this.games = games;
                console.log(`从服务器加载了 ${this.games.length} 个游戏记录`);
            } else {
                console.warn('服务器返回的数据格式不正确，重置为空数组');
                this.games = [];
            }
        } catch (error) {
            console.error('从服务器加载数据失败:', error);
            this.games = [];
            throw error;
        }
    }

    /**
     * 获取所有游戏数据
     */
    async getAllGames() {
        if (!this.initialized) {
            await this.initialize();
        }
        return [...this.games];
    }

    /**
     * 添加新游戏记录
     */
    async addGame(gameData, imageFile) {
        await this.loadCategoryConfig();
        if (!this.categoryCodes.includes(gameData.category)) {
            gameData.category = 'OTHER';
        }
        try {
            // 生成唯一ID
            const id = this.generateUniqueId();
            
            // 准备游戏数据
            const newGame = {
                id: id,
                name: gameData.name,
                score: parseFloat(gameData.score),
                category: gameData.category || 'OTHER',
                playTime: gameData.playTime ? parseFloat(gameData.playTime) : null,
                recordDate: gameData.recordDate,
                comment: gameData.comment || '',
                imagePath: null
            };

            // 处理图片文件
            if (imageFile) {
                if (this.isElectron) {
                    // Electron环境：保存图片到本地文件
                    const imageData = await this.convertImageToBase64(imageFile);
                    const safeName = this.sanitizeFilename(gameData.name);
                    const filename = `${safeName}_${Date.now()}.png`;
                    
                    const { ipcRenderer } = require('electron');
                    const saveResult = await ipcRenderer.invoke('save-image', imageData, filename);
                    
                    if (saveResult.success) {
                        newGame.imagePath = filename;
                        newGame.imageUrl = `./data/images/${filename}`;
                        console.log('✅ 图片已保存到本地:', filename);
                    } else {
                        console.error('❌ 图片保存失败:', saveResult.error);
                        // fallback to base64
                        newGame.imageData = imageData;
                        newGame.imageUrl = imageData;
                    }
                } else {
                    // Web环境：转换为base64
                    const imageData = await this.convertImageToBase64(imageFile);
                    newGame.imageData = imageData;
                    newGame.imageUrl = imageData;
                }
            }

            if (this.isElectron) {
                // Electron环境：保存到本地文件
                console.log('📝 添加游戏到Electron环境，游戏数据:', newGame);
                this.games.push(newGame);
                await this.saveGamesToFile();
                console.log('✅ 游戏已添加并保存到本地文件');
            } else {
                // Web环境：发送到服务器
                const response = await fetch(`${this.apiBaseUrl}/api/games`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newGame)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const serverGame = await response.json();
                this.games.push(serverGame);
            }
            
            console.log('游戏记录添加成功:', newGame.name);
            return newGame;
        } catch (error) {
            console.error('添加游戏记录失败:', error);
            throw error;
        }
    }

    /**
     * 更新游戏记录
     */
    async updateGame(id, gameData, imageFile) {
        await this.loadCategoryConfig();
        if (!this.categoryCodes.includes(gameData.category)) {
            gameData.category = 'OTHER';
        }
    await this.loadCategoryConfig();
        try {
            // 查找要更新的游戏
            const gameIndex = this.games.findIndex(game => game.id === id);
            if (gameIndex === -1) {
                throw new Error('游戏记录不存在');
            }

            // 准备更新的数据，保持现有的图片相关字段
            const updatedGame = {
                ...this.games[gameIndex],
                name: gameData.name,
                score: parseFloat(gameData.score),
                category: gameData.category || 'OTHER',
                playTime: gameData.playTime ? parseFloat(gameData.playTime) : null,
                recordDate: gameData.recordDate,
                comment: gameData.comment || ''
            };

            // 处理图片文件
            if (imageFile) {
                if (this.isElectron) {
                    // Electron环境：保存新图片到本地文件
                    const imageData = await this.convertImageToBase64(imageFile);
                    const safeName = this.sanitizeFilename(gameData.name);
                    const filename = `${safeName}_${Date.now()}.png`;
                    
                    const { ipcRenderer } = require('electron');
                    
                    // 如果有旧图片，先删除
                    if (updatedGame.imagePath) {
                        await ipcRenderer.invoke('delete-image', updatedGame.imagePath);
                    }
                    
                    // 保存新图片
                    const saveResult = await ipcRenderer.invoke('save-image', imageData, filename);
                    
                    if (saveResult.success) {
                        updatedGame.imagePath = filename;
                        updatedGame.imageUrl = `./data/images/${filename}`;
                        // 清除旧的base64数据
                        delete updatedGame.imageData;
                        console.log('✅ 图片已更新并保存到本地:', filename);
                    } else {
                        console.error('❌ 图片保存失败:', saveResult.error);
                        // fallback to base64
                        updatedGame.imageData = imageData;
                        updatedGame.imageUrl = imageData;
                    }
                } else {
                    // Web环境：转换为base64
                    const imageData = await this.convertImageToBase64(imageFile);
                    updatedGame.imageData = imageData;
                    updatedGame.imageUrl = imageData;
                }
            } else {
                // 如果没有提供新图片，保持原有的图片数据不变
                // 这样可以确保编辑游戏时不改变图片的情况下，图片信息不会丢失
                console.log('🖼️ 保持原有图片数据不变:', updatedGame.imageUrl ? '有图片' : '无图片');
            }

            if (this.isElectron) {
                // Electron环境：更新本地文件
                this.games[gameIndex] = updatedGame;
                await this.saveGamesToFile();
            } else {
                // Web环境：发送到服务器
                const response = await fetch(`${this.apiBaseUrl}/api/games/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedGame)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const serverGame = await response.json();
                this.games[gameIndex] = serverGame;
            }
            
            console.log('游戏记录更新成功:', updatedGame.name);
            return updatedGame;
        } catch (error) {
            console.error('更新游戏记录失败:', error);
            throw error;
        }
    }

    /**
     * 删除游戏记录
     */
    async deleteGame(id) {
        try {
            const gameIndex = this.games.findIndex(game => game.id === id);
            if (gameIndex === -1) {
                throw new Error('游戏记录不存在');
            }

            const game = this.games[gameIndex];

            if (this.isElectron) {
                // Electron环境：删除关联的图片文件，然后删除游戏记录
                
                // 如果有图片文件，先删除它
                if (game.imagePath) {
                    try {
                        const { ipcRenderer } = require('electron');
                        const deleteResult = await ipcRenderer.invoke('delete-image', game.imagePath);
                        
                        if (deleteResult.success) {
                            console.log('✅ 图片文件已删除:', game.imagePath);
                        } else {
                            console.warn('⚠️ 图片文件删除失败:', deleteResult.error);
                        }
                    } catch (error) {
                        console.warn('⚠️ 删除图片文件时出错:', error);
                    }
                }
                
                // 删除游戏记录
                this.games.splice(gameIndex, 1);
                await this.saveGamesToFile();
            } else {
                // Web环境：发送删除请求到服务器
                const response = await fetch(`${this.apiBaseUrl}/api/games/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // 更新本地缓存
                this.games.splice(gameIndex, 1);
            }
            
            console.log('✅ 游戏记录删除成功:', game.name);
            return true;
        } catch (error) {
            console.error('❌ 删除游戏记录失败:', error);
            throw error;
        }
    }

    /**
     * 将图片文件转换为Base64
     */
    async convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            reader.onerror = function() {
                reject(new Error('读取图片文件失败'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 生成唯一ID
     */
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 搜索游戏
     */
    searchGames(query, filters = {}) {
        if (!this.categoryCodes) {
            // 同步加载（仅用于筛选，防止异步问题）
            this.categoryConfig = {
                'ADV': '冒险游戏',
                'ACT': '动作游戏',
                'RPG': '角色扮演',
                'SLG': '策略游戏',
                '3DSIM': '3D模拟',
                'OTHER': '其他'
            };
            this.categoryCodes = Object.keys(this.categoryConfig);
        }
        if (filters.category && !this.categoryCodes.includes(filters.category)) {
            filters.category = 'OTHER';
        }
        let filteredGames = [...this.games];

        // 按游戏名搜索
        if (query && query.trim()) {
            const searchTerm = query.trim().toLowerCase();
            filteredGames = filteredGames.filter(game => 
                game.name.toLowerCase().includes(searchTerm)
            );
        }

        // 按年份筛选
        if (filters.year) {
            filteredGames = filteredGames.filter(game => {
                const gameDate = new Date(game.recordDate);
                if (isNaN(gameDate.getTime())) return false; // 排除无效日期
                const gameYear = gameDate.getFullYear();
                return gameYear === parseInt(filters.year);
            });
        }

        // 按月份筛选
        if (filters.month) {
            filteredGames = filteredGames.filter(game => {
                const gameDate = new Date(game.recordDate);
                if (isNaN(gameDate.getTime())) return false; // 排除无效日期
                const gameMonth = gameDate.getMonth() + 1;
                return gameMonth === parseInt(filters.month);
            });
        }

        // 按评分范围筛选 (移除此功能)
        // if (filters.scoreMin !== undefined && filters.scoreMax !== undefined) {
        //     filteredGames = filteredGames.filter(game => 
        //         game.score >= filters.scoreMin && game.score <= filters.scoreMax
        //     );
        // }

        // 按分类筛选
        if (filters.category && filters.category !== '') {
            filteredGames = filteredGames.filter(game => 
                game.category === filters.category
            );
        }

        // 移除自动排序，由调用方处理排序
        return filteredGames;
    }

    /**
     * 修复无效的日期数据
     */
    fixInvalidDates() {
        let fixedCount = 0;
        this.games.forEach(game => {
            const gameDate = new Date(game.recordDate);
            if (isNaN(gameDate.getTime())) {
                // 如果日期无效，设置为当前时间
                game.recordDate = new Date().toISOString().slice(0, 16);
                fixedCount++;
                console.warn(`修复了游戏 "${game.name}" 的无效日期`);
            }
        });
        
        if (fixedCount > 0) {
            this.saveGamesToStorage();
            console.log(`修复了 ${fixedCount} 个无效日期`);
        }
        
        return fixedCount;
    }

    /**
     * 获取所有可用年份
     */
    getAvailableYears() {
        const years = new Set();
        this.games.forEach(game => {
            const gameDate = new Date(game.recordDate);
            if (!isNaN(gameDate.getTime())) { // 只处理有效日期
                years.add(gameDate.getFullYear());
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }

    /**
     * 获取游戏统计信息
     */
    getStatistics() {
        const stats = {
            totalGames: this.games.length,
            averageScore: 0,
            totalPlayTime: 0,
            categoryStats: {},
            yearStats: {}
        };

        if (this.games.length === 0) return stats;

        // 计算平均评分
        const totalScore = this.games.reduce((sum, game) => sum + game.score, 0);
        stats.averageScore = (totalScore / this.games.length).toFixed(1);

        // 计算总游戏时长
        stats.totalPlayTime = this.games.reduce((sum, game) => sum + (game.playTime || 0), 0);

        // 分类统计
        this.games.forEach(game => {
            stats.categoryStats[game.category] = (stats.categoryStats[game.category] || 0) + 1;
        });

        // 年份统计
        this.games.forEach(game => {
            const gameDate = new Date(game.recordDate);
            if (!isNaN(gameDate.getTime())) { // 只统计有效日期
                const year = gameDate.getFullYear();
                stats.yearStats[year] = (stats.yearStats[year] || 0) + 1;
            }
        });

        return stats;
    }

    /**
     * 迁移Web版本数据到Electron格式
     */
    async migrateWebDataToElectron() {
        let needsSave = false;
        
        for (let game of this.games) {
            // 检查是否有API格式的imageUrl需要转换
            if (game.imageUrl && game.imageUrl.startsWith('/api/image/')) {
                console.log('🔄 迁移游戏图片数据:', game.name);
                
                // 清除API格式的URL，在Electron中不适用
                game.imageUrl = null;
                needsSave = true;
            }
            
            // 如果有imagePath但没有imageUrl，尝试从images目录加载
            if (game.imagePath && !game.imageUrl) {
                const imagePath = `./data/images/${game.imagePath}`;
                try {
                    const { ipcRenderer } = require('electron');
                    const result = await ipcRenderer.invoke('read-file', imagePath);
                    if (result.success) {
                        // 读取图片文件并转换为base64
                        const fs = require('fs');
                        const path = require('path');
                        const fullPath = path.resolve(__dirname, imagePath);
                        const imageData = fs.readFileSync(fullPath);
                        const base64 = `data:image/png;base64,${imageData.toString('base64')}`;
                        game.imageUrl = base64;
                        game.imageData = base64;
                        needsSave = true;
                        console.log('✅ 已迁移图片:', game.imagePath);
                    }
                } catch (error) {
                    console.warn('⚠️ 无法加载图片文件:', game.imagePath, error.message);
                }
            }
        }
        
        if (needsSave) {
            await this.saveGamesToFile();
            console.log('✅ 数据迁移完成并已保存');
        }
    }
}

// 创建全局实例
window.fileSystemManager = new FileSystemManager();
