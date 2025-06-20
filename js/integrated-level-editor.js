/**
 * Integrated Level Editor - Simple and Visual
 * This replaces the complex level editor with a simpler, more visual approach
 */

class IntegratedLevelEditor {
    constructor() {
        this.currentTileType = 0;
        this.currentLevel = 0;
        this.levels = [];
        this.levelNames = [];
        this.isDragging = false;
        this.playerStartX = 1;
        this.playerStartY = 12;
        this.defaultLevelCount = 0; // Will track how many levels are default
        
        // Visual tile categories
        this.tileCategories = {
            'Basic': [0, 1],
            'Terrain': [4, 5, 6],
            'Special': [7, 8],
            'Hazards': [10, 11, 12, 13],
            'Goal': [3]
        };
    }

    init() {
        this.loadLevels();
        this.setupUI();
        this.createVisualTilePalette();
        this.createLevelGrid();
        this.displayLevel(this.currentLevel);
        this.setupEventListeners();
        this.startPreviewAnimation();
    }

    // Load levels from storage or defaults
    loadLevels() {
        const savedLevels = localStorage.getItem(STORAGE_KEYS.LEVELS);
        const savedNames = localStorage.getItem(STORAGE_KEYS.LEVEL_NAMES);
        const savedPositions = localStorage.getItem(STORAGE_KEYS.START_POSITIONS);
        
        if (savedLevels && savedNames) {
            this.levels = JSON.parse(savedLevels);
            this.levelNames = JSON.parse(savedNames);
            
            // Determine how many default levels there are
            const defaultLevels = window.defaultLevels || [];
            this.defaultLevelCount = Math.min(defaultLevels.length, this.levels.length);
            
            if (savedPositions) {
                const positions = JSON.parse(savedPositions);
                if (positions[this.currentLevel]) {
                    this.playerStartX = positions[this.currentLevel].x;
                    this.playerStartY = positions[this.currentLevel].y;
                }
            }
        } else {
            // Load default levels
            const defaultLevels = window.defaultLevels || [];
            this.levels = JSON.parse(JSON.stringify(defaultLevels));
            this.levelNames = this.levels.map((_, i) => `Level ${i + 1}`);
            this.defaultLevelCount = this.levels.length;
        }
    }

    // Setup UI elements
    setupUI() {
        // Get DOM elements
        this.elements = {
            levelSelect: document.getElementById('editor-level-select'),
            levelGrid: document.getElementById('level-grid'),
            tileGrid: document.getElementById('tile-grid'),
            tileInfo: document.getElementById('tile-info'),
            levelNameInput: document.getElementById('level-name-input'),
            previewCanvas: document.getElementById('editorPreviewCanvas'),
            previewCtx: document.getElementById('editorPreviewCanvas')?.getContext('2d')
        };

        // Update level selector
        this.updateLevelSelector();
    }

    // Create visual tile palette with categories
    createVisualTilePalette() {
        const tileGrid = this.elements.tileGrid;
        if (!tileGrid) return;
        
        tileGrid.innerHTML = '';
        
        // Add categories
        Object.entries(this.tileCategories).forEach(([category, tiles]) => {
            // Category header
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'tile-category-header';
            categoryHeader.textContent = category;
            categoryHeader.style.gridColumn = '1 / -1';
            categoryHeader.style.textAlign = 'center';
            categoryHeader.style.marginTop = '10px';
            categoryHeader.style.marginBottom = '5px';
            categoryHeader.style.fontWeight = 'bold';
            categoryHeader.style.color = '#6d8ad0';
            tileGrid.appendChild(categoryHeader);
            
            // Tiles in category
            tiles.forEach(tileId => {
                this.createVisualTile(tileId);
            });
        });
        
        // Add player start position tile
        this.createPlayerStartTile();
    }

    // Create a visual tile option
    createVisualTile(tileId) {
        const tileElement = document.createElement('div');
        tileElement.className = 'tile-option visual-tile';
        tileElement.dataset.tileId = tileId;
        
        const tileType = TILE_TYPES[tileId];
        
        if (tileId === 0) {
            // Empty tile
            tileElement.style.backgroundColor = '#222';
            tileElement.innerHTML = '<div style="color: #666; font-size: 20px;">×</div>';
            tileElement.classList.add('selected');
        } else if (tileType) {
            // Set background color
            tileElement.style.backgroundColor = tileType.editorColor || tileType.color;
            tileElement.style.border = `2px solid ${tileType.editorBorder || tileType.color}`;
            
            // Add visual elements
            if (tileType.editorSymbol) {
                tileElement.innerHTML = `<div style="font-size: 24px; color: white;">${tileType.editorSymbol}</div>`;
            } else if (tileType.editorPattern) {
                this.addPatternToTile(tileElement, tileType.editorPattern);
            }
            
            // Add name tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tile-tooltip';
            tooltip.textContent = tileType.name;
            tileElement.appendChild(tooltip);
        }
        
        // Click handler
        tileElement.addEventListener('click', () => this.selectTile(tileId));
        
        this.elements.tileGrid.appendChild(tileElement);
    }

    // Add visual patterns to tiles
    addPatternToTile(element, pattern) {
        switch(pattern) {
            case 'dirt':
                element.innerHTML = '<div style="background: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px);"></div>';
                break;
            case 'wood':
                element.innerHTML = '<div style="background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 6px);"></div>';
                break;
            case 'stone':
                element.innerHTML = '<div style="background: repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px);"></div>';
                break;
            case 'ice':
                element.innerHTML = '<div style="background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.3) 100%);"></div>';
                break;
            case 'bounce':
                element.innerHTML = '<div style="background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%);"></div>';
                break;
        }
    }

    // Create player start position tile
    createPlayerStartTile() {
        const playerTile = document.createElement('div');
        playerTile.className = 'tile-option visual-tile player-start-tile';
        playerTile.dataset.tileId = 'player-start';
        playerTile.style.backgroundColor = '#FFA500';
        playerTile.style.border = '2px solid #FF8C00';
        playerTile.innerHTML = '<div style="font-size: 20px; font-weight: bold;">P</div>';
        
        const tooltip = document.createElement('div');
        tooltip.className = 'tile-tooltip';
        tooltip.textContent = 'Player Start';
        playerTile.appendChild(tooltip);
        
        playerTile.addEventListener('click', () => this.selectTile('player-start'));
        
        this.elements.tileGrid.appendChild(playerTile);
    }

    // Select a tile
    selectTile(tileId) {
        // Remove previous selection
        document.querySelectorAll('.tile-option').forEach(tile => {
            tile.classList.remove('selected');
        });
        
        // Select new tile
        const selectedTile = document.querySelector(`[data-tile-id="${tileId}"]`);
        if (selectedTile) {
            selectedTile.classList.add('selected');
        }
        
        if (tileId === 'player-start') {
            this.currentTileType = -1;
            this.updateTileInfo('Player Start Position', 'P');
        } else {
            this.currentTileType = parseInt(tileId);
            const tileType = TILE_TYPES[tileId];
            this.updateTileInfo(tileType?.name || 'Empty', tileId);
        }
    }

    // Update tile info display
    updateTileInfo(name, id) {
        if (this.elements.tileInfo) {
            this.elements.tileInfo.innerHTML = `<p>Selected: <strong>${name}</strong> (${id})</p>`;
        }
    }

    // Create the level grid
    createLevelGrid() {
        const grid = this.elements.levelGrid;
        if (!grid) return;
        
        grid.innerHTML = '';
        
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                // Mouse events
                cell.addEventListener('mousedown', (e) => this.startDrawing(e));
                cell.addEventListener('mouseenter', (e) => this.continueDrawing(e));
                cell.addEventListener('mouseup', () => this.stopDrawing());
                
                grid.appendChild(cell);
            }
        }
    }

    // Drawing functions
    startDrawing(e) {
        // Check if this is a default level
        if (this.currentLevel < this.defaultLevelCount) {
            this.showNotification('Cannot edit default levels! Create a new level to edit.', 3000);
            return;
        }
        
        this.isDragging = true;
        this.placeCurrentTile(e.target);
    }

    continueDrawing(e) {
        if (this.isDragging && this.currentLevel >= this.defaultLevelCount) {
            this.placeCurrentTile(e.target);
        }
    }

    stopDrawing() {
        this.isDragging = false;
    }

    placeCurrentTile(cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        
        if (this.currentTileType === -1) {
            // Place player start
            this.playerStartX = x;
            this.playerStartY = y;
            this.displayLevel(this.currentLevel);
        } else {
            // Place regular tile
            this.levels[this.currentLevel][y][x] = this.currentTileType;
            this.updateCell(x, y);
        }
    }

    // Update a single cell's display
    updateCell(x, y) {
        const cell = this.elements.levelGrid.children[y * GRID_WIDTH + x];
        const tileType = this.levels[this.currentLevel][y][x];
        
        // Clear cell
        cell.className = 'grid-cell';
        cell.innerHTML = '';
        cell.style.backgroundColor = '';
        
        if (tileType === 0) {
            cell.style.backgroundColor = '#333';
        } else {
            const tile = TILE_TYPES[tileType];
            if (tile) {
                cell.style.backgroundColor = tile.editorColor || tile.color;
                
                if (tile.editorSymbol) {
                    cell.innerHTML = `<div style="color: white; font-size: 20px;">${tile.editorSymbol}</div>`;
                }
                
                if (tile.deadly) {
                    cell.classList.add('deadly-tile');
                }
            }
        }
        
        // Show player start
        if (x === this.playerStartX && y === this.playerStartY) {
            cell.classList.add('player-start-position');
        }
    }

    // Display current level
    displayLevel(levelIndex) {
        this.currentLevel = levelIndex;
        
        // Update level name input
        if (this.elements.levelNameInput) {
            this.elements.levelNameInput.value = this.levelNames[levelIndex] || '';
            
            // Disable editing for default levels
            if (levelIndex < this.defaultLevelCount) {
                this.elements.levelNameInput.disabled = true;
                this.elements.levelNameInput.placeholder = 'Default Level (Read-Only)';
            } else {
                this.elements.levelNameInput.disabled = false;
                this.elements.levelNameInput.placeholder = 'Level Name';
            }
        }
        
        // Update grid appearance for default levels
        const levelGrid = this.elements.levelGrid;
        if (levelGrid) {
            if (levelIndex < this.defaultLevelCount) {
                levelGrid.style.opacity = '0.7';
                levelGrid.style.cursor = 'not-allowed';
                
                // Show read-only message
                this.showNotification('This is a default level (read-only). Create a new level to edit.', 2000);
            } else {
                levelGrid.style.opacity = '1';
                levelGrid.style.cursor = 'auto';
            }
        }
        
        // Update grid
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                this.updateCell(x, y);
            }
        }
    }

    // Update level selector
    updateLevelSelector() {
        if (!this.elements.levelSelect) return;
        
        this.elements.levelSelect.innerHTML = '';
        
        // Add a separator for default levels
        if (this.defaultLevelCount > 0) {
            const defaultGroup = document.createElement('optgroup');
            defaultGroup.label = '--- Default Levels (Read-Only) ---';
            
            for (let i = 0; i < this.defaultLevelCount; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = this.levelNames[i] || `Level ${i + 1}`;
                option.style.color = '#999';
                defaultGroup.appendChild(option);
            }
            
            this.elements.levelSelect.appendChild(defaultGroup);
        }
        
        // Add custom levels
        if (this.levels.length > this.defaultLevelCount) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = '--- Custom Levels ---';
            
            for (let i = this.defaultLevelCount; i < this.levels.length; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = this.levelNames[i] || `Level ${i + 1}`;
                customGroup.appendChild(option);
            }
            
            this.elements.levelSelect.appendChild(customGroup);
        }
        
        this.elements.levelSelect.value = this.currentLevel;
    }

    // Setup event listeners
    setupEventListeners() {
        // Level selector
        if (this.elements.levelSelect) {
            this.elements.levelSelect.addEventListener('change', (e) => {
                this.displayLevel(parseInt(e.target.value));
            });
        }
        
        // Buttons
        const saveBtn = document.getElementById('save-level-btn');
        const clearBtn = document.getElementById('clear-level-btn');
        const newLevelBtn = document.getElementById('new-level-btn');
        const renameBtn = document.getElementById('rename-level-btn');
        const testPlayBtn = document.getElementById('editor-play-btn');
        
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveLevels());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearLevel());
        if (newLevelBtn) newLevelBtn.addEventListener('click', () => this.addNewLevel());
        if (renameBtn) renameBtn.addEventListener('click', () => this.renameLevel());
        if (testPlayBtn) testPlayBtn.addEventListener('click', () => this.testPlayLevel());
        
        // Prevent mouseup outside grid from keeping draw state
        document.addEventListener('mouseup', () => this.stopDrawing());
    }

    // Save levels
    saveLevels() {
        localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(this.levels));
        localStorage.setItem(STORAGE_KEYS.LEVEL_NAMES, JSON.stringify(this.levelNames));
        
        // Save player start positions
        const positions = {};
        positions[this.currentLevel] = { x: this.playerStartX, y: this.playerStartY };
        localStorage.setItem(STORAGE_KEYS.START_POSITIONS, JSON.stringify(positions));
        
        this.showNotification('Levels saved successfully!', 2000);
        
        // Update default levels in game
        if (window.levelLoader) {
            window.levelLoader.loadLevels();
        }
    }

    // Clear current level
    clearLevel() {
        if (this.currentLevel < this.defaultLevelCount) {
            this.showNotification('Cannot clear default levels!', 2000);
            return;
        }
        
        // Create empty level
        this.levels[this.currentLevel] = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
        
        // Add floor
        for (let x = 0; x < GRID_WIDTH; x++) {
            this.levels[this.currentLevel][GRID_HEIGHT - 1][x] = 1;
        }
        
        this.displayLevel(this.currentLevel);
        this.showNotification('Level cleared!', 2000);
    }

    // Add new level
    addNewLevel() {
        const newLevel = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
        
        // Add floor
        for (let x = 0; x < GRID_WIDTH; x++) {
            newLevel[GRID_HEIGHT - 1][x] = 1;
        }
        
        this.levels.push(newLevel);
        this.levelNames.push(`Level ${this.levels.length}`);
        
        this.updateLevelSelector();
        this.elements.levelSelect.value = this.levels.length - 1;
        this.displayLevel(this.levels.length - 1);
        
        this.showNotification('New level created!', 2000);
    }

    // Rename level
    renameLevel() {
        if (this.currentLevel < this.defaultLevelCount) {
            this.showNotification('Cannot rename default levels!', 2000);
            return;
        }
        
        const newName = this.elements.levelNameInput?.value.trim();
        if (newName) {
            this.levelNames[this.currentLevel] = newName;
            this.updateLevelSelector();
            this.showNotification('Level renamed!', 2000);
        }
    }

    // Test play level
    testPlayLevel() {
        this.saveLevels();
        localStorage.setItem('testPlayLevel', this.currentLevel);
        
        // Hide level editor and start game
        document.getElementById('levelEditorMenu').style.display = 'none';
        
        if (window.gameManager) {
            window.gameManager.startGame(this.currentLevel);
        }
    }

    // Show notification
    showNotification(message, duration) {
        const notification = document.createElement('div');
        notification.className = 'level-editor-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 25px;
            background-color: #4c6baf;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.opacity = '1', 10);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    // Start preview animation
    startPreviewAnimation() {
        if (!this.elements.previewCanvas || !this.elements.previewCtx) return;
        
        const animate = () => {
            this.renderPreview();
            requestAnimationFrame(animate);
        };
        animate();
    }

    // Render preview
    renderPreview() {
        const ctx = this.elements.previewCtx;
        const canvas = this.elements.previewCanvas;
        
        if (!ctx || !canvas) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = '#000022';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scale
        const scale = Math.min(canvas.width / (GRID_WIDTH * TILE_SIZE), 
                              canvas.height / (GRID_HEIGHT * TILE_SIZE));
        const scaledTileSize = TILE_SIZE * scale;
        
        // Draw tiles
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tileType = this.levels[this.currentLevel]?.[y]?.[x];
                if (tileType && TILE_TYPES[tileType]) {
                    const tile = TILE_TYPES[tileType];
                    ctx.fillStyle = tile.color;
                    ctx.fillRect(x * scaledTileSize, y * scaledTileSize, scaledTileSize, scaledTileSize);
                    
                    // Draw spike triangles
                    if (tileType >= 10 && tileType <= 13) {
                        this.drawSpike(ctx, x, y, scale, scaledTileSize, tile.rotation);
                    }
                }
            }
        }
        
        // Draw player
        ctx.fillStyle = '#4c6baf';
        ctx.fillRect(
            this.playerStartX * scaledTileSize,
            this.playerStartY * scaledTileSize,
            PLAYER_WIDTH * scale,
            PLAYER_HEIGHT * scale
        );
    }

    // Draw spike triangle
    drawSpike(ctx, x, y, scale, scaledTileSize, rotation) {
        ctx.save();
        ctx.translate(x * scaledTileSize + scaledTileSize / 2, y * scaledTileSize + scaledTileSize / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        
        ctx.fillStyle = '#FF4757';
        ctx.beginPath();
        ctx.moveTo(0, -scaledTileSize / 2);
        ctx.lineTo(-scaledTileSize / 2, scaledTileSize / 2);
        ctx.lineTo(scaledTileSize / 2, scaledTileSize / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// Export for use
window.IntegratedLevelEditor = IntegratedLevelEditor;