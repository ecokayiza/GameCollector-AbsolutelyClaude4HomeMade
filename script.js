/**
 * 游戏记录收藏应用主逻辑
 */
class GameCollectionApp {
    constructor() {
        this.currentEditingGame = null;
        this.currentFilters = {
            query: '',
            year: '',
            month: '',
            scoreMin: 0,
            scoreMax: 10,
            category: ''
        };
    this.gameCategories = {};
    this.categoryCodes = [];
    this.categoryConfigLoaded = false;
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            console.log('开始初始化游戏收藏应用...');
            
            // 初始化文件系统管理器
            await window.fileSystemManager.initialize();
            console.log('文件系统管理器初始化完成');
            
            // 加载分类配置
            await this.loadCategoryConfig();
            console.log('分类配置加载完成');

            // 初始化背景系统
            this.initializeBackground();
            console.log('背景系统初始化完成');

            // 绑定事件
            this.bindEvents();
            console.log('事件绑定完成');

            // 初始化界面
            this.initializeInterface();
            console.log('界面初始化完成');

            // 加载游戏数据
            await this.loadGames();
            console.log('游戏数据加载完成');

            console.log('游戏收藏应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showError('应用初始化失败: ' + error.message);
        }
    }

    /**
     * 加载分类配置
     */
    async loadCategoryConfig() {
        try {
            const response = await fetch('./config.json');
            if (!response.ok) throw new Error('无法加载分类配置文件');
            const config = await response.json();
            this.gameCategories = {};
            this.categoryCodes = [];
            if (Array.isArray(config.categories)) {
                config.categories.forEach(cat => {
                    this.gameCategories[cat.code] = cat.name;
                    this.categoryCodes.push(cat.code);
                });
            }
            this.gameCategories['OTHER'] = '其他';
            this.categoryCodes.push('OTHER');
            this.categoryConfigLoaded = true;
        } catch (e) {
            // 加载失败则使用默认分类
            this.gameCategories = {
                'ADV': '冒险游戏',
                'ACT': '动作游戏',
                'RPG': '角色扮演',
                'SLG': '策略游戏',
                '3DSIM': '3D模拟',
                'OTHER': '其他'
            };
            this.categoryCodes = Object.keys(this.gameCategories);
            this.categoryConfigLoaded = false;
            console.error('分类配置加载失败，使用默认分类', e);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 检查必要的DOM元素是否存在
        const requiredElements = [
            'addGameBtn', 'searchBtn', 'searchInput', 'yearFilter', 
            'monthFilter', 'categoryFilter', 'sortOrder', 
            'clearFilters', 'gameModal', 'gameDetailModal'
        ];
        
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                console.error(`缺少必要的DOM元素: ${elementId}`);
                throw new Error(`界面元素 ${elementId} 不存在`);
            }
        }

        // 添加游戏按钮
        document.getElementById('addGameBtn').addEventListener('click', () => {
            this.showGameModal();
        });

        // 搜索功能
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });

        // 筛选功能
        document.getElementById('yearFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('monthFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('sortOrder').addEventListener('change', () => {
            this.applyFilters();
        });

        // 清除筛选
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // 模态框事件
        this.bindModalEvents();

        // 表单事件
        this.bindFormEvents();

        // 图片上传事件
        this.bindImageUploadEvents();

        // 评分滑动条事件
        this.bindScoreSliderEvents();

        // 全局键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents() {
        // 关闭按钮
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // 点击背景关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // 取消按钮
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeAllModals();
        });
    }

    /**
     * 绑定表单事件
     */
    bindFormEvents() {
        document.getElementById('gameForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveGame();
        });
    }

    /**
     * 绑定图片上传事件
     */
    bindImageUploadEvents() {
        const uploadArea = document.getElementById('imageUploadArea');
        const fileInput = document.getElementById('coverImage');
        const removeBtn = document.getElementById('removeImage');

        // 点击上传区域
        uploadArea.addEventListener('click', (e) => {
            if (e.target === removeBtn || e.target.closest('.btn-remove-image')) return;
            fileInput.click();
        });

        // 文件选择
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleImageFile(e.target.files[0]);
            }
        });

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files[0] && files[0].type.startsWith('image/')) {
                this.handleImageFile(files[0]);
            }
        });

        // 删除图片
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeImage();
        });

        // 粘贴图片
        document.addEventListener('paste', (e) => {
            if (document.getElementById('gameModal').style.display === 'block') {
                const items = e.clipboardData.items;
                for (let item of items) {
                    if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        this.handleImageFile(file);
                        break;
                    }
                }
            }
        });
    }

    /**
     * 绑定评分滑动条事件
     */
    bindScoreSliderEvents() {
        const scoreSlider = document.getElementById('gameScore');
        const scoreValue = document.getElementById('scoreValue');
        const scoreStars = document.getElementById('scoreStars');

        scoreSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            scoreValue.textContent = value.toFixed(1);
            this.updateScoreStars(value, scoreStars);
        });
    }

    /**
     * 初始化界面
     */
    initializeInterface() {
        // 设置当前日期时间
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('gameDate').value = localDateTime;

        // 初始化评分显示
        this.updateScoreStars(5.0, document.getElementById('scoreStars'));

        // 确保表单中有分类选择
        this.addCategorySelect();

    // 动态渲染筛选区分类下拉框
    this.renderCategoryFilter();
    }
    /**
     * 动态渲染筛选区分类下拉框
     */
    renderCategoryFilter() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;
        let optionsHtml = '<option value="">所有分类</option>';
        for (const code of this.categoryCodes) {
            if (code === 'OTHER') continue;
            optionsHtml += `<option value="${code}">${code} - ${this.gameCategories[code]}</option>`;
        }
        optionsHtml += `<option value="OTHER">OTHER - 其他</option>`;
        categoryFilter.innerHTML = optionsHtml;
    }

    /**
     * 添加分类选择到表单(如果还没有)
     */
    addCategorySelect() {
        // 检查是否已经存在分类选择
        if (document.getElementById('gameCategory')) {
            return; // 已存在，不需要添加
        }
        const gameTimeGroup = document.getElementById('gameTime').closest('.form-group');
        // 创建分类选择表单组
        const categoryGroup = document.createElement('div');
        categoryGroup.className = 'form-group';
        let optionsHtml = '<option value="">请选择分类</option>';
        for (const code of this.categoryCodes) {
            if (code === 'OTHER') continue;
            optionsHtml += `<option value="${code}">${code} - ${this.gameCategories[code]}</option>`;
        }
        optionsHtml += `<option value="OTHER">OTHER - 其他</option>`;
        categoryGroup.innerHTML = `
            <label for="gameCategory">游戏分类 *</label>
            <select id="gameCategory" name="gameCategory" required>
                ${optionsHtml}
            </select>
        `;
        // 在游戏时长后面插入分类选择
        gameTimeGroup.parentNode.insertBefore(categoryGroup, gameTimeGroup.nextSibling);
    }

    /**
     * 处理图片文件
     */
    async handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('请选择图片文件');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB限制
            this.showError('图片文件过大，请选择小于10MB的图片');
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewImg = document.getElementById('previewImg');
                const imagePreview = document.getElementById('imagePreview');
                const uploadPlaceholder = document.querySelector('.upload-placeholder');

                previewImg.src = e.target.result;
                imagePreview.style.display = 'block';
                uploadPlaceholder.style.display = 'none';

                // 存储文件对象供后续使用
                document.getElementById('coverImage').currentFile = file;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('处理图片失败:', error);
            this.showError('处理图片失败');
        }
    }

    /**
     * 移除图片
     */
    removeImage() {
        const imagePreview = document.getElementById('imagePreview');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        const fileInput = document.getElementById('coverImage');

        imagePreview.style.display = 'none';
        uploadPlaceholder.style.display = 'block';
        fileInput.value = '';
        fileInput.currentFile = null;
    }

    /**
     * 更新评分星星显示
     */
    updateScoreStars(score, starsElement) {
        const fullStars = Math.floor(score / 2);
        const hasHalfStar = (score % 2) >= 1;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let starsHtml = '';
        
        // 满星
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '★';
        }
        
        // 半星
        if (hasHalfStar) {
            starsHtml += '☆';
        }
        
        // 空星
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '☆';
        }

        starsElement.innerHTML = starsHtml;
    }

    /**
     * 显示游戏添加/编辑模态框
     */
    showGameModal(game = null) {
        const modal = document.getElementById('gameModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('gameForm');

        this.currentEditingGame = game;

        if (game) {
            modalTitle.textContent = '编辑游戏记录';
            this.populateForm(game);
        } else {
            modalTitle.textContent = '添加游戏记录';
            form.reset();
            this.removeImage();
            
            // 设置默认值
            const now = new Date();
            const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('gameDate').value = localDateTime;
            document.getElementById('gameScore').value = 5;
            document.getElementById('scoreValue').textContent = '5.0';
            this.updateScoreStars(5.0, document.getElementById('scoreStars'));
        }

        modal.style.display = 'block';
    }

    /**
     * 填充表单数据
     */
    populateForm(game) {
        document.getElementById('gameName').value = game.name;
        document.getElementById('gameScore').value = game.score;
        document.getElementById('scoreValue').textContent = game.score.toFixed(1);
        document.getElementById('gameCategory').value = game.category;
        document.getElementById('gameTime').value = game.playTime || '';
        document.getElementById('gameDate').value = game.recordDate;
        document.getElementById('gameComment').value = game.comment;
        
        this.updateScoreStars(game.score, document.getElementById('scoreStars'));

        // 清除之前的图片文件状态
        const fileInput = document.getElementById('coverImage');
        fileInput.value = '';
        fileInput.currentFile = null;

        // 显示现有图片
        if (game.imageUrl) {
            const previewImg = document.getElementById('previewImg');
            const imagePreview = document.getElementById('imagePreview');
            const uploadPlaceholder = document.querySelector('.upload-placeholder');

            previewImg.src = game.imageUrl;
            imagePreview.style.display = 'block';
            uploadPlaceholder.style.display = 'none';
        } else {
            // 如果没有图片，确保显示上传提示
            const imagePreview = document.getElementById('imagePreview');
            const uploadPlaceholder = document.querySelector('.upload-placeholder');

            imagePreview.style.display = 'none';
            uploadPlaceholder.style.display = 'block';
        }
    }

    /**
     * 保存游戏记录
     */
    async saveGame() {
        try {
            const formData = new FormData(document.getElementById('gameForm'));
            const imageFile = document.getElementById('coverImage').currentFile;
            
            console.log('📸 图片文件:', imageFile);
            console.log('📄 图片文件名:', imageFile ? imageFile.name : '无');
            console.log('📏 图片大小:', imageFile ? imageFile.size : '无');

            const gameData = {
                name: formData.get('gameName').trim(),
                score: formData.get('gameScore'),
                category: formData.get('gameCategory'),
                playTime: formData.get('gameTime'),
                recordDate: formData.get('gameDate'),
                comment: formData.get('gameComment').trim()
            };

            // 验证必填字段
            if (!gameData.name) {
                this.showError('请输入游戏名称');
                return;
            }

            if (!gameData.category) {
                this.showError('请选择游戏分类');
                return;
            }

            let savedGame;
            if (this.currentEditingGame) {
                savedGame = await window.fileSystemManager.updateGame(
                    this.currentEditingGame.id, 
                    gameData, 
                    imageFile
                );
            } else {
                savedGame = await window.fileSystemManager.addGame(gameData, imageFile);
            }

            this.closeAllModals();
            await this.loadGames();
            
            const action = this.currentEditingGame ? '更新' : '添加';
            this.showSuccess(`游戏记录${action}成功！`);
            
        } catch (error) {
            console.error('保存游戏失败:', error);
            this.showError(`保存游戏记录失败: ${error.message}`);
        }
    }

    /**
     * 加载游戏数据
     */
    async loadGames() {
        try {
            const games = await window.fileSystemManager.getAllGames();
            
            // 自动修复无效日期
            const fixedCount = window.fileSystemManager.fixInvalidDates();
            if (fixedCount > 0) {
                this.showSuccess(`自动修复了 ${fixedCount} 个无效日期`);
            }
            
            this.updateYearFilter(games);
            
            // 应用当前排序
            const sortOrder = document.getElementById('sortOrder') ? 
                document.getElementById('sortOrder').value : 'date-desc';
            const sortedGames = this.sortGames(games, sortOrder);
            
            this.renderGames(sortedGames);
            
            // 更新动态背景
            this.updateDynamicBackground(games);
        } catch (error) {
            console.error('加载游戏数据失败:', error);
            this.showError('加载游戏数据失败');
        }
    }

    /**
     * 更新年份筛选选项
     */
    updateYearFilter(games) {
        const yearFilter = document.getElementById('yearFilter');
        const years = window.fileSystemManager.getAvailableYears();
        
        // 清空现有选项（保留"所有年份"）
        yearFilter.innerHTML = '<option value="">所有年份</option>';
        
        // 添加年份选项
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + '年';
            yearFilter.appendChild(option);
        });
    }

    /**
     * 渲染游戏列表
     */
    renderGames(games) {
        const gamesList = document.getElementById('gamesList');
        const emptyState = document.getElementById('emptyState');

        if (games.length === 0) {
            gamesList.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        gamesList.innerHTML = '';

        games.forEach((game, index) => {
            const gameItem = this.createGameItem(game, index);
            gamesList.appendChild(gameItem);
        });
    }

    /**
     * 创建游戏项元素
     */
    createGameItem(game, index) {
        const gameItem = document.createElement('div');
        gameItem.className = 'game-item';
        gameItem.style.animationDelay = `${index * 0.1}s`;

        const recordDate = new Date(game.recordDate);
        
        // 验证日期是否有效
        let formattedDate, formattedTime;
        if (isNaN(recordDate.getTime())) {
            console.warn('无效的日期格式:', game.recordDate);
            formattedDate = '未知日期';
            formattedTime = '';
        } else {
            formattedDate = recordDate.toLocaleDateString('zh-CN');
            formattedTime = recordDate.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }

        // 生成星星评分
        const stars = this.generateStars(game.score);
        
    // 分类显示名称 - 优先使用配置名，否则归为其他
    let categoryName = this.gameCategories[game.category];
    if (!categoryName) categoryName = this.gameCategories['OTHER'];

        gameItem.innerHTML = `
            <div class="timeline-node"></div>
            <div class="time-label">${formattedDate} ${formattedTime}</div>
            <div class="game-card" data-game-id="${game.id}">
                <div class="game-card-content">
                    <div class="game-cover">
                        ${game.imageUrl ? 
                            `<img src="${game.imageUrl}" alt="${game.name}" class="cover-image">` : 
                            `<img src="./assets/default.png" alt="默认封面" class="cover-image">`
                        }
                    </div>
                    <div class="game-info">
                        <h3 class="game-title">${this.escapeHtml(game.name)}</h3>
                        <div class="game-score-meta">
                            <div class="game-category-time">
                                <div class="game-category">${categoryName}</div>
                                ${game.playTime ? `<div class="game-time">${game.playTime}h</div>` : ''}
                            </div>
                            <div class="game-score">
                                <span class="score-value">${game.score.toFixed(1)}</span>
                                <span class="stars">${stars}</span>
                            </div>
                        </div>
                        <div class="game-preview">${this.escapeHtml(game.comment).substring(0, 60)}${game.comment.length > 60 ? '...' : ''}</div>
                    </div>
                </div>
            </div>
        `;

        // 绑定点击事件
        const gameCard = gameItem.querySelector('.game-card');
        gameCard.addEventListener('click', () => {
            this.showGameDetail(game);
        });

        return gameItem;
    }

    /**
     * 生成星星评分
     */
    generateStars(score) {
        const fullStars = Math.floor(score / 2);
        const hasHalfStar = (score % 2) >= 1;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '★';
        if (hasHalfStar) stars += '☆';
        for (let i = 0; i < emptyStars; i++) stars += '☆';

        return stars;
    }

    /**
     * 显示游戏详情
     */
    showGameDetail(game) {
        const modal = document.getElementById('gameDetailModal');
        const content = document.getElementById('gameDetailContent');
        
        const recordDate = new Date(game.recordDate);
        
        // 验证日期是否有效
        let formattedDate, formattedTime;
        if (isNaN(recordDate.getTime())) {
            console.warn('无效的日期格式:', game.recordDate);
            formattedDate = '未知日期';
            formattedTime = '';
        } else {
            formattedDate = recordDate.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            formattedTime = recordDate.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }

    let categoryName = this.gameCategories[game.category];
    if (!categoryName) categoryName = this.gameCategories['OTHER'];
        const stars = this.generateStars(game.score);

        content.innerHTML = `
            <div class="game-detail">
                <div class="detail-header">
                    <div class="detail-cover">
                        ${game.imageUrl ? 
                            `<img src="${game.imageUrl}" alt="${game.name}" class="detail-image clickable-image" onclick="app.showImageViewer('${game.imageUrl}', '${this.escapeHtml(game.name)}')">` : 
                            `<img src="./assets/default.png" alt="默认封面" class="detail-image">`
                        }
                    </div>
                    <div class="detail-info">
                        <h2 class="detail-title">${this.escapeHtml(game.name)}</h2>
                        <div class="detail-meta">
                            <div class="meta-item">
                                <div class="meta-label">评分</div>
                                <div class="meta-value">${game.score.toFixed(1)} ${stars}</div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-label">分类</div>
                                <div class="meta-value">${categoryName}</div>
                            </div>
                            <div class="meta-item">
                                <div class="meta-label">记录时间</div>
                                <div class="meta-value">${formattedDate} ${formattedTime}</div>
                            </div>
                            ${game.playTime ? `
                            <div class="meta-item">
                                <div class="meta-label">游戏时长</div>
                                <div class="meta-value">${game.playTime}h</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                ${game.comment ? `
                <div class="detail-comment">
                    <h3>个人评论</h3>
                    <p>${this.escapeHtml(game.comment).replace(/\n/g, '<br>')}</p>
                </div>
                ` : ''}
                <div class="edit-actions">
                    <button class="btn btn-edit" onclick="app.editGame('${game.id}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn btn-delete" onclick="app.deleteGame('${game.id}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    /**
     * 编辑游戏
     */
    async editGame(gameId) {
        try {
            const games = await window.fileSystemManager.getAllGames();
            const game = games.find(g => g.id === gameId);
            if (game) {
                this.closeAllModals();
                this.showGameModal(game);
            }
        } catch (error) {
            console.error('获取游戏数据失败:', error);
            this.showError('获取游戏数据失败');
        }
    }

    /**
     * 删除游戏
     */
    async deleteGame(gameId) {
        if (!confirm('确定要删除这个游戏记录吗？此操作不可撤销。')) {
            return;
        }

        try {
            await window.fileSystemManager.deleteGame(gameId);
            this.closeAllModals();
            await this.loadGames();
            this.showSuccess('游戏记录删除成功！');
        } catch (error) {
            console.error('删除游戏失败:', error);
            this.showError('删除游戏记录失败');
        }
    }

    /**
     * 应用筛选
     */
    async applyFilters() {
        try {
            const filters = {
                query: document.getElementById('searchInput').value.trim(),
                year: document.getElementById('yearFilter').value,
                month: document.getElementById('monthFilter').value,
                category: document.getElementById('categoryFilter').value
            };

            const sortOrder = document.getElementById('sortOrder').value;

            const filteredGames = window.fileSystemManager.searchGames(filters.query, filters);
            const sortedGames = this.sortGames(filteredGames, sortOrder);
            this.renderGames(sortedGames);
            
            this.currentFilters = filters;
        } catch (error) {
            console.error('筛选失败:', error);
            this.showError('筛选失败');
        }
    }

    /**
     * 排序游戏列表
     */
    sortGames(games, sortOrder) {
        const sortedGames = [...games];
        
        switch (sortOrder) {
            case 'date-desc':
                sortedGames.sort((a, b) => {
                    const dateA = new Date(a.recordDate);
                    const dateB = new Date(b.recordDate);
                    // 处理无效日期，将其排到最后
                    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
                    if (isNaN(dateA.getTime())) return 1;
                    if (isNaN(dateB.getTime())) return -1;
                    return dateB - dateA;
                });
                break;
            case 'date-asc':
                sortedGames.sort((a, b) => {
                    const dateA = new Date(a.recordDate);
                    const dateB = new Date(b.recordDate);
                    // 处理无效日期，将其排到最后
                    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
                    if (isNaN(dateA.getTime())) return 1;
                    if (isNaN(dateB.getTime())) return -1;
                    return dateA - dateB;
                });
                break;
            case 'score-desc':
                sortedGames.sort((a, b) => b.score - a.score);
                break;
            case 'score-asc':
                sortedGames.sort((a, b) => a.score - b.score);
                break;
            case 'name-asc':
                sortedGames.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                break;
            case 'name-desc':
                sortedGames.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
                break;
            default:
                // 默认按时间降序（最新在前）
                sortedGames.sort((a, b) => {
                    const dateA = new Date(a.recordDate);
                    const dateB = new Date(b.recordDate);
                    // 处理无效日期，将其排到最后
                    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
                    if (isNaN(dateA.getTime())) return 1;
                    if (isNaN(dateB.getTime())) return -1;
                    return dateB - dateA;
                });
        }
        
        return sortedGames;
    }

    /**
     * 清除筛选
     */
    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('yearFilter').value = '';
        document.getElementById('monthFilter').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('sortOrder').value = 'date-desc';
        
        this.loadGames();
    }

    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        this.currentEditingGame = null;
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        console.error(message);
        // 创建错误提示元素
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e53e3e;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 9999;
            max-width: 300px;
            font-size: 14px;
        `;
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        console.log(message);
        // 创建成功提示元素
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #38a169;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 9999;
            max-width: 300px;
            font-size: 14px;
        `;
        successDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(successDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示图片查看器
     */
    showImageViewer(imageUrl, title) {
        const modal = document.getElementById('imageViewer');
        const img = document.getElementById('viewerImage');
        const caption = document.getElementById('viewerCaption');
        const closeBtn = modal.querySelector('.image-viewer-close');
        
        img.src = imageUrl;
        caption.textContent = title || '';
        modal.style.display = 'block';
        
        // 关闭事件
        const closeModal = () => {
            modal.style.display = 'none';
        };
        
        closeBtn.onclick = closeModal;
        
        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 更新动态背景 - 独立网格系统
     */
    updateDynamicBackground(games) {
        const backgroundContainer = document.getElementById('dynamicBackground');
        if (!backgroundContainer) return;

        // 获取有封面的游戏
        const gamesWithCovers = games.filter(game => game.imageUrl);
        
        if (gamesWithCovers.length === 0) {
            // 如果没有封面，清空背景容器
            backgroundContainer.innerHTML = '';
            return;
        }

        // 初始化4个独立的网格单元
        this.initializeGridCells(backgroundContainer, gamesWithCovers);
        
        console.log(`独立网格背景已初始化: 4个网格单元，可用封面 ${gamesWithCovers.length} 个`);
    }

    /**
     * 初始化网格单元
     */
    initializeGridCells(container, gamesWithCovers) {
        // 创建4个网格单元
        let gridHTML = '';
        for (let i = 0; i < 4; i++) {
            gridHTML += `<div class="background-grid-cell" id="grid-cell-${i}"></div>`;
        }
        container.innerHTML = gridHTML;

        // 为每个网格单元设置独立的图片轮换
        for (let i = 0; i < 4; i++) {
            const cellElement = document.getElementById(`grid-cell-${i}`);
            const initialDelay = i * 2000; // 交错开始：0s, 2s, 4s, 6s
            
            // 延迟启动每个网格的轮换
            setTimeout(() => {
                this.startGridCellRotation(cellElement, gamesWithCovers, i);
            }, initialDelay);
        }
    }

    /**
     * 启动单个网格单元的图片轮换
     */
    startGridCellRotation(cellElement, gamesWithCovers, cellIndex) {
        if (!cellElement || gamesWithCovers.length === 0) return;

        // 全局跟踪每个网格单元当前显示的图片
        if (!this.currentGridImages) {
            this.currentGridImages = {};
        }

        const rotateImage = () => {
            // 获取所有其他网格单元正在显示/即将显示的图片
            const occupiedImages = [];
            for (let i = 0; i < 4; i++) {
                if (i !== cellIndex && this.currentGridImages[i]) {
                    occupiedImages.push(this.currentGridImages[i].split('?')[0]);
                }
            }

            // 筛选可用的游戏：排除其他网格正在显示的图片
            const availableGames = gamesWithCovers.filter(game => {
                const normalizedGameUrl = game.imageUrl.split('?')[0];
                return !occupiedImages.includes(normalizedGameUrl);
            });

            // 如果当前网格有图片，也要排除它
            if (this.currentGridImages[cellIndex]) {
                const currentInThisCell = this.currentGridImages[cellIndex].split('?')[0];
                const finalGames = availableGames.filter(game => {
                    const normalizedGameUrl = game.imageUrl.split('?')[0];
                    return normalizedGameUrl !== currentInThisCell;
                });
                
                // 如果排除当前图片后还有可选项，使用过滤后的；否则使用所有可用的
                const gamesToChooseFrom = finalGames.length > 0 ? finalGames : availableGames;
                var selectedGame = gamesToChooseFrom[Math.floor(Math.random() * gamesToChooseFrom.length)];
            } else {
                // 首次选择
                var selectedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
            }

            // 立即更新全局跟踪，防止其他网格选择相同图片
            this.currentGridImages[cellIndex] = selectedGame.imageUrl;

            console.log(`Cell ${cellIndex}: Occupied: [${occupiedImages.map(url => {
                const game = gamesWithCovers.find(g => g.imageUrl.split('?')[0] === url);
                return game ? game.name : 'unknown';
            }).join(', ')}], Available: ${availableGames.length}/${gamesWithCovers.length}, Selected: ${selectedGame.name}`);
            
            // 创建新图片元素
            const newImg = document.createElement('img');
            newImg.src = selectedGame.imageUrl;
            newImg.alt = selectedGame.name;
            newImg.className = 'background-cover';
            newImg.style.opacity = '0';
            
            // 添加到网格单元
            cellElement.appendChild(newImg);
            
            // 处理旧图片淡出
            const oldImages = cellElement.querySelectorAll('.background-cover');
            if (oldImages.length > 1) {
                const oldImg = oldImages[0];
                // 立即开始淡出旧图片
                oldImg.classList.add('fade-out');
                
                // 等待旧图片完全淡出后，再淡入新图片
                setTimeout(() => {
                    // 开始淡入新图片
                    newImg.style.opacity = '0.6';
                    
                    // 移除旧图片元素
                    setTimeout(() => {
                        if (oldImg.parentNode) {
                            oldImg.parentNode.removeChild(oldImg);
                        }
                    }, 2500); // 等待新图片淡入完成后再移除旧元素
                }, 2500); // 等待旧图片淡出完成（2.5秒）
                
                // 计算下次轮换时间：淡出(2.5s) + 淡入(2.5s) + 停留时间(8-12s)
                const stayTime = 8000 + Math.random() * 4000; // 8-12秒停留
                const nextRotationTime = 2500 + 2500 + stayTime; // 总共13-17秒
                setTimeout(rotateImage, nextRotationTime);
            } else {
                // 如果没有旧图片，直接淡入新图片
                setTimeout(() => {
                    newImg.style.opacity = '0.6';
                }, 50);
                
                // 首次图片的轮换时间：淡入(2.5s) + 停留时间(8-12s)
                const stayTime = 8000 + Math.random() * 4000;
                const nextRotationTime = 2500 + stayTime; // 总共10.5-14.5秒
                setTimeout(rotateImage, nextRotationTime);
            }
        };
        
        // 立即开始第一次轮换
        rotateImage();
    }

    /**
     * 初始化背景系统
     */
    initializeBackground() {
        // 确保有背景容器
        if (!document.getElementById('dynamicBackground')) {
            const backgroundDiv = document.createElement('div');
            backgroundDiv.id = 'dynamicBackground';
            backgroundDiv.className = 'dynamic-background';
            document.body.insertBefore(backgroundDiv, document.body.firstChild);
        }
        
        // 页面可见性改变时的处理
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.allGames.length > 0) {
                // 页面恢复可见时刷新背景
                setTimeout(() => {
                    this.updateDynamicBackground(this.allGames);
                }, 500);
            }
        });
    }

}

// 创建应用实例并初始化
const app = new GameCollectionApp();

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// 全局访问
window.app = app;
