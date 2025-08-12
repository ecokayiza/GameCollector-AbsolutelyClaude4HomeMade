/**
 * 文件系统管理器
 * 通过API服务器处理本地文件的读写操作，包括游戏数据和图片文件
 */
class FileSystemManager {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.games = [];
        this.initialized = false;
    }

    /**
     * 初始化文件系统
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // 从API服务器加载数据
            await this.loadGamesFromServer();
            this.initialized = true;
            console.log('文件系统管理器初始化完成');
        } catch (error) {
            console.error('初始化文件系统失败:', error);
            this.games = [];
            this.initialized = true;
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
        try {
            // 准备发送的数据
            const dataToSend = {
                name: gameData.name,
                score: parseFloat(gameData.score),
                category: gameData.category || 'OTHER',
                playTime: gameData.playTime ? parseFloat(gameData.playTime) : null,
                recordDate: gameData.recordDate,
                comment: gameData.comment || '',
            };

            // 处理图片文件
            if (imageFile) {
                const imageData = await this.convertImageToBase64(imageFile);
                dataToSend.imageData = imageData;
            }

            // 发送到服务器
            const response = await fetch(`${this.apiBaseUrl}/api/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const newGame = await response.json();
            
            // 更新本地缓存
            this.games.push(newGame);
            
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
        try {
            // 准备发送的数据
            const dataToSend = {
                name: gameData.name,
                score: parseFloat(gameData.score),
                category: gameData.category || 'OTHER',
                playTime: gameData.playTime ? parseFloat(gameData.playTime) : null,
                recordDate: gameData.recordDate,
                comment: gameData.comment || '',
            };

            // 处理图片文件
            if (imageFile) {
                const imageData = await this.convertImageToBase64(imageFile);
                dataToSend.imageData = imageData;
            }

            // 发送到服务器
            const response = await fetch(`${this.apiBaseUrl}/api/games/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const updatedGame = await response.json();
            
            // 更新本地缓存
            const gameIndex = this.games.findIndex(game => game.id === id);
            if (gameIndex !== -1) {
                this.games[gameIndex] = updatedGame;
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
            const response = await fetch(`${this.apiBaseUrl}/api/games/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 更新本地缓存
            const gameIndex = this.games.findIndex(game => game.id === id);
            if (gameIndex !== -1) {
                const game = this.games[gameIndex];
                this.games.splice(gameIndex, 1);
                console.log('游戏记录删除成功:', game.name);
            }
            
            return true;
        } catch (error) {
            console.error('删除游戏记录失败:', error);
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
     * 生成唯一ID - 保留用于兼容性
     */
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 搜索游戏
     */
    searchGames(query, filters = {}) {
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
}

// 创建全局实例
window.fileSystemManager = new FileSystemManager();
