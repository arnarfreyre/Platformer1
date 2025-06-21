/**
 * Level Editor
 * This file contains all the level editor functionality
 */

// Check if Firebase is available
if (typeof firebase === 'undefined' || typeof db === 'undefined') {
    console.error('Firebase not loaded! Make sure firebase-config.js is loaded before level-editor.js');
}

// Create a LevelEditor class that can be initialized when needed
class LevelEditor {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        await this.setupEditor();
    }

    async setupEditor() {
    // Editor state
    let currentTileType = 0;
    let currentLevel = 0;
    let levels = [];
    let levelNames = [];
    let isDragging = false;
    let playerStartX = null;
    let playerStartY = null;
    let isPlacingPlayerStart = false;
    let currentSpikeRotation = 0; // 0, 90, 180, or 270 degrees
    let rotationData = []; // Will store rotation data for spikes
    let autoSaveTimeout = null;

    // Expose levels to window for testing and for copy level functionality
    window.levels = levels;
    window.currentLevel = currentLevel;

    // DOM elements - handle both standalone and integrated editor
    const previewCanvasElement = document.getElementById('previewCanvas') || document.getElementById('editorPreviewCanvas');
    const levelSelectElement = document.getElementById('level-select') || document.getElementById('editor-level-select');
    const levelNameElement = document.getElementById('level-name') || document.getElementById('level-name-input');
    
    const elements = {
        tileGrid: document.getElementById('tile-grid'),
        levelGrid: document.getElementById('level-grid'),
        tileInfo: document.getElementById('tile-info'),
        levelSelect: levelSelectElement,
        levelNameInput: levelNameElement,
        previewCanvas: previewCanvasElement,
        previewCtx: previewCanvasElement ? previewCanvasElement.getContext('2d') : null
    };

    // Button elements - handle both standalone and integrated editor
    const buttons = {
        save: document.getElementById('save-btn') || document.getElementById('save-level-btn'),
        clear: document.getElementById('clear-btn') || document.getElementById('clear-level-btn'),
        newLevel: document.getElementById('new-level-btn'),
        rename: document.getElementById('rename-btn') || document.getElementById('rename-level-btn'),
        play: document.getElementById('play-btn') || document.getElementById('editor-play-btn'),
        backToGame: document.getElementById('back-to-game-btn'),
        copyLevel: document.getElementById('copy-level-matrix-btn'),
        saveDefault: document.getElementById('save-default-btn')
    };

    // Helper function to save a new level to Firebase
    async function saveNewLevelToFirebase(levelData, levelName, order) {
        try {
            await db.collection('levels').add({
                name: levelName,
                data: levelData,
                order: order,
                rotationData: null,
                playerStart: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving new level to Firebase:', error);
        }
    }

    // Initialize the editor
    async function initEditor() {
        // Check if essential elements exist
        if (!elements.tileGrid || !elements.levelGrid) {
            console.warn('Level editor elements not found, skipping initialization');
            return;
        }
        
        // Check if in admin mode
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminMode = urlParams.get('mode') === 'admin-default';
        
        if (isAdminMode) {
            const indicator = document.getElementById('editorModeIndicator');
            if (indicator) {
                indicator.style.display = 'block';
            }
            
            // Show save as default button, hide regular save
            if (buttons.saveDefault) {
                buttons.saveDefault.style.display = 'inline-block';
            }
            if (buttons.save) {
                buttons.save.style.display = 'none';
            }
            
            // Set default level name from localStorage
            const pendingName = localStorage.getItem('pendingDefaultLevelName');
            if (pendingName && elements.levelNameInput) {
                elements.levelNameInput.value = pendingName;
                levelNames[0] = pendingName;
            }
        } else {
            // Regular user mode - hide admin features
            // Hide level selector and controls
            const levelSelector = document.getElementById('levelSelectorContainer');
            if (levelSelector) {
                levelSelector.style.display = 'none';
            }
            
            // Hide export/import buttons (they're already removed from HTML)
            const exportBtn = document.getElementById('export-btn');
            const importBtn = document.getElementById('import-btn');
            if (exportBtn) exportBtn.style.display = 'none';
            if (importBtn) importBtn.style.display = 'none';
            
            // Hide copy level matrix button
            const copyBtn = document.getElementById('copy-level-matrix-btn');
            if (copyBtn) copyBtn.style.display = 'none';
            
            // Hide rename button
            if (buttons.rename) buttons.rename.style.display = 'none';
            
            // Update save button text
            if (buttons.save) {
                buttons.save.textContent = 'Save Online';
                buttons.save.style.backgroundColor = '#4c6baf';
            }
            
            // Regular users only work with one level
            levels = [createEmptyLevel()];
            levelNames = ['My Level'];
            rotationData = [createEmptyRotationData()];
            currentLevel = 0;
        }
        
        createTilePalette();
        createGrid();
        createSpikeRotationControls();
        await loadLevels();  // Now async
        updateLevelSelector();
        updateLevelOrderControls();
        setupEventListeners();
        setupKeyboardShortcuts();
        addCopyLevelButton();
        
        // Only start preview rendering if canvas exists
        if (elements.previewCanvas && elements.previewCtx) {
            setInterval(renderPreview, 1000 / 30); // Update preview at 30fps
        }
    }

    // Add copy level matrix button
    function addCopyLevelButton() {
        const controlsContainer = document.querySelector('.controls div:first-child');
        if (!controlsContainer) return;

        // Create the button if it doesn't exist yet
        if (!document.getElementById('copy-level-matrix-btn')) {
            const copyLevelBtn = document.createElement('button');
            copyLevelBtn.id = 'copy-level-matrix-btn';
            copyLevelBtn.textContent = 'Copy Level Matrix';
            copyLevelBtn.title = 'Copy just the current level matrix to your clipboard';

            // Insert the button after the Save button
            const saveBtn = document.getElementById('save-btn');
            if (saveBtn) {
                controlsContainer.insertBefore(copyLevelBtn, saveBtn.nextSibling);
            } else {
                controlsContainer.appendChild(copyLevelBtn);
            }

            // Add event listener
            copyLevelBtn.addEventListener('click', copyLevelMatrix);
        }
    }

    // Copy level matrix to clipboard
    function copyLevelMatrix() {
        // Get the current level data
        const currentLevelData = levels[currentLevel];

        if (!currentLevelData) {
            showNotification('No level data available', 3000);
            return;
        }

        // Format the level data as a clean JavaScript array with proper indentation
        let formattedLevel = '[\n';

        for (let y = 0; y < currentLevelData.length; y++) {
            formattedLevel += '    [' + currentLevelData[y].join(',') + '],\n';
        }

        formattedLevel += ']';

        // Create a temporary textarea to copy the text
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = formattedLevel;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();

        try {
            // Copy the text to clipboard
            document.execCommand('copy');
            showNotification('Level matrix copied to clipboard!', 3000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            showNotification('Failed to copy level matrix', 3000);
        } finally {
            document.body.removeChild(tempTextArea);
        }
    }

    // Show notification
    function showNotification(message, duration = 3000) {
        // Remove any existing notification
        const existingNotification = document.querySelector('.level-editor-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'level-editor-notification';
        notification.textContent = message;

        // Style the notification
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.backgroundColor = '#4c6baf';
        notification.style.color = 'white';
        notification.style.borderRadius = '5px';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.zIndex = '9999';
        notification.style.transition = 'opacity 0.3s ease';

        // Add to document
        document.body.appendChild(notification);

        // Remove after duration
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }

    // Create the tile palette with all tile types
    function createTilePalette() {
        // Create regular tile options
        for (let tileId in TILE_TYPES) {
            // Skip deprecated regular spike (we'll use the directional ones instead)
            if (tileId === '2') continue;

            createTileOption(tileId, TILE_TYPES[tileId]);
        }

        // Add player start position option
        createPlayerStartOption();
    }

    // Create a single tile option
    function createTileOption(tileId, tileType) {
        const tileElement = document.createElement('div');
        tileElement.className = 'tile-option';
        tileElement.dataset.tileId = tileId;

        // Set appearance based on tile type
        if (tileId === '0') {
            // Empty tile
            tileElement.style.backgroundColor = '#333';
            tileElement.textContent = '0';
            tileElement.style.textAlign = 'center';
            tileElement.style.lineHeight = '32px';
            tileElement.classList.add('selected'); // Select by default
        } else if (tileId >= 10 && tileId <= 13) {
            // Directional spike tiles
            tileElement.classList.add('spike');
            tileElement.style.backgroundColor = tileType.color;
            // Apply rotation based on spike type
            tileElement.style.transform = `rotate(${tileType.rotation}deg)`;
            // Add tooltip to show direction
            tileElement.title = tileType.name;
        } else {
            // Regular tile
            tileElement.style.backgroundColor = tileType.color;
        }

        // Add click handler
        tileElement.addEventListener('click', () => {
            // Deselect all tiles
            document.querySelectorAll('.tile-option').forEach(tile => {
                tile.classList.remove('selected');
            });

            // Select this tile
            tileElement.classList.add('selected');
            currentTileType = parseInt(tileId);
            isPlacingPlayerStart = false;

            // Show/hide rotation controls based on tile type
            const rotationControls = document.querySelector('.rotation-controls');
            if (rotationControls) {
                rotationControls.style.display = currentTileType === 2 ? 'block' : 'none';
            }

            // Update info display
            updateTileInfo(tileType?.name || 'Empty', tileId);
        });

        elements.tileGrid.appendChild(tileElement);
    }

    // Create the player start position option
    function createPlayerStartOption() {
        const playerStartOption = document.createElement('div');
        playerStartOption.className = 'tile-option';
        playerStartOption.dataset.tileId = 'player-start';
        playerStartOption.style.backgroundColor = '#FFA500'; // Orange
        playerStartOption.style.display = 'flex';
        playerStartOption.style.justifyContent = 'center';
        playerStartOption.style.alignItems = 'center';
        playerStartOption.innerHTML = '<span style="color: black; font-weight: bold;">P</span>';
        playerStartOption.title = 'Player Start Position';

        playerStartOption.addEventListener('click', () => {
            document.querySelectorAll('.tile-option').forEach(tile => {
                tile.classList.remove('selected');
            });
            playerStartOption.classList.add('selected');
            isPlacingPlayerStart = true;
            currentTileType = -1; // Special value for player start

            // Hide rotation controls
            const rotationControls = document.querySelector('.rotation-controls');
            if (rotationControls) {
                rotationControls.style.display = 'none';
            }

            elements.tileInfo.textContent = `Selected: Player Start Position`;
        });

        elements.tileGrid.appendChild(playerStartOption);
    }

    // Create rotation controls for spike tiles
    function createSpikeRotationControls() {
        const rotationControls = document.createElement('div');
        rotationControls.className = 'rotation-controls';
        rotationControls.innerHTML = `
            <h3>Spike Rotation</h3>
            <div class="rotation-buttons">
                <button id="rotate-spike-0" class="rotate-button active" data-rotation="0">0°</button>
                <button id="rotate-spike-90" class="rotate-button" data-rotation="90">90°</button>
                <button id="rotate-spike-180" class="rotate-button" data-rotation="180">180°</button>
                <button id="rotate-spike-270" class="rotate-button" data-rotation="270">270°</button>
            </div>
        `;

        const tilePalette = document.querySelector('.tile-palette');
        tilePalette.appendChild(rotationControls);

        // Add event listeners for rotation buttons
        rotationControls.querySelectorAll('.rotate-button').forEach(button => {
            button.addEventListener('click', () => {
                // Only allow rotation when spike is selected
                if (currentTileType === 2) {
                    currentSpikeRotation = parseInt(button.dataset.rotation);

                    // Update active button
                    rotationControls.querySelectorAll('.rotate-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');

                    // Update tile info display
                    elements.tileInfo.textContent = `Selected: Spike (${currentSpikeRotation}°)`;
                }
            });
        });

        // Hide rotation controls initially
        rotationControls.style.display = 'none';
    }

    // Update tile info display
    function updateTileInfo(name, id) {
        let infoText = `Selected: ${name} (${id})`;
        if (currentTileType === 2) {
            infoText += ` (${currentSpikeRotation}°)`;
        }
        elements.tileInfo.textContent = infoText;
    }

    // Create the editing grid
    function createGrid() {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                // Add event listeners
                cell.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    isDragging = true;
                    updateCell(cell);
                });

                cell.addEventListener('mouseover', () => {
                    if (isDragging) {
                        updateCell(cell);
                    }
                });

                cell.addEventListener('mouseup', (e) => {
                    isDragging = false;
                    e.stopPropagation();
                });

                elements.levelGrid.appendChild(cell);
            }
        }

        // Add mouseup event to document to stop dragging
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Initialize rotation data for tiles
    function initializeRotationData() {
        // Check if rotation data already exists in localStorage
        const savedRotations = localStorage.getItem('platformerSpikeRotations');

        if (savedRotations) {
            rotationData = JSON.parse(savedRotations);
        } else {
            // Create a new array for each level
            rotationData = [];
            for (let i = 0; i < levels.length; i++) {
                rotationData.push(createEmptyRotationData());
            }
        }
    }

    // Create empty rotation data for a level
    function createEmptyRotationData() {
        const levelRotations = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                row.push(0); // Default rotation is 0 degrees
            }
            levelRotations.push(row);
        }
        return levelRotations;
    }

    // Update a cell with the selected tile
    function updateCell(cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);

        if (isPlacingPlayerStart) {
            handlePlayerStartPlacement(cell, x, y);
            return;
        }

        // Regular tile placement
        levels[currentLevel][y][x] = currentTileType;

        // Store rotation data for spikes
        if (currentTileType === 2) {
            rotationData[currentLevel][y][x] = currentSpikeRotation;
        }

        updateCellAppearance(cell, currentTileType, currentTileType === 2 ? currentSpikeRotation : 0);

        // Auto-save the changes
        triggerAutoSave();
    }

    // Handle player start position placement
    function handlePlayerStartPlacement(cell, x, y) {
        // Clear any previous player start marker
        if (playerStartX !== null && playerStartY !== null) {
            const prevCell = document.querySelector(`.grid-cell[data-x="${playerStartX}"][data-y="${playerStartY}"]`);
            if (prevCell) {
                prevCell.classList.remove('player-start-position');
            }
        }

        // Set the new player start position
        playerStartX = x;
        playerStartY = y;
        cell.classList.add('player-start-position');
        isPlacingPlayerStart = false;

        // Reselect the empty tile type
        const defaultTile = document.querySelector('.tile-option[data-tile-id="0"]');
        if (defaultTile) {
            defaultTile.click();
        }

        // Auto-save the changes
        triggerAutoSave();
    }

    // Update cell appearance based on tile type
    function updateCellAppearance(cell, tileType, rotation = 0) {
        // Reset any special styles
        cell.classList.remove('spike');
        cell.style.transform = '';
        cell.innerHTML = '';

        if (tileType === 0) {
            // Empty cell
            cell.style.backgroundColor = '#333';
        } else if (tileType === 2 || (tileType >= 10 && tileType <= 13)) {
            // Spike tile with rotation
            cell.classList.add('spike');
            cell.style.backgroundColor = TILE_TYPES[tileType].color;

            // Get the rotation for the spike
            let spikeRotation = rotation;
            if (tileType >= 10 && tileType <= 13) {
                spikeRotation = TILE_TYPES[tileType].rotation;
            }

            cell.style.transform = `rotate(${spikeRotation}deg)`;
        } else if (tileType === 3) {
            // Goal tile - add a small circle
            cell.style.backgroundColor = TILE_TYPES[tileType].color;
            cell.style.position = 'relative';
            cell.innerHTML = '<div style="position: absolute; top: 8px; left: 8px; width: 16px; height: 16px; background-color: #ffff00; border-radius: 50%;"></div>';
        } else {
            // Regular tile
            cell.style.backgroundColor = TILE_TYPES[tileType]?.color || '#333';
        }
    }

    // Load levels from Firebase instead of localStorage
    async function loadLevels() {
        // Check if in admin mode
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminMode = urlParams.get('mode') === 'admin-default';
        
        if (!isAdminMode) {
            // Regular users start with a fresh level
            levels = [createEmptyLevel()];
            levelNames = ['My Level'];
            rotationData = [createEmptyRotationData()];
            displayLevel(0);
            return;
        }
        
        // Admin mode - load from Firebase
        try {
            console.log('Admin mode: Loading levels from Firebase...');
            
            // Clear any existing levels
            levels = [];
            levelNames = [];
            
            // Load custom levels from Firebase
            const customLevelsSnapshot = await db.collection('levels')
                .orderBy('order')
                .get();
            
            customLevelsSnapshot.forEach(doc => {
                const data = doc.data();
                // Parse the level data
                let grid;
                try {
                    if (data.data) {
                        grid = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                    } else if (data.grid) {
                        grid = typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid;
                    } else {
                        console.error(`No grid data for level ${data.name}`);
                        return;
                    }
                } catch (error) {
                    console.error(`Error parsing grid for level ${data.name}:`, error);
                    return;
                }
                
                levels.push(grid);
                levelNames.push(data.name || `Level ${levels.length}`);
            });
            
            // If no levels exist, create a default empty level
            if (levels.length === 0) {
                levels = [createEmptyLevel()];
                levelNames = ["Level 1"];
            }
            
            // Initialize rotation data
            initializeRotationData();
            
            displayLevel(0);
        } catch (error) {
            console.error('Error loading levels from Firebase:', error);
            // Fallback to empty level on error
            levels = [createEmptyLevel()];
            levelNames = ["Level 1"];
            initializeRotationData();
            displayLevel(0);
        }
    }

    // Create an empty level grid
    function createEmptyLevel() {
        const level = [];

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                // Add a ground platform at the bottom
                row.push(y === GRID_HEIGHT - 1 ? 1 : 0);
            }
            level.push(row);
        }

        return level;
    }

    // Display a level in the grid
    function displayLevel(levelIndex) {
        currentLevel = levelIndex;
        // Update window.currentLevel to ensure copy level functionality works
        window.currentLevel = levelIndex;

        const level = levels[levelIndex];

        // Update level name input
        elements.levelNameInput.value = levelNames[levelIndex];

        // Ensure rotation data exists for this level
        while (rotationData.length <= levelIndex) {
            rotationData.push(createEmptyRotationData());
        }

        // Update the grid cells
        const cells = document.querySelectorAll('.grid-cell');
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const index = y * GRID_WIDTH + x;
                const cell = cells[index];
                const tileType = level[y][x];

                // Get rotation for spike tiles
                const rotation = tileType === 2 ? rotationData[currentLevel][y][x] : 0;

                updateCellAppearance(cell, tileType, rotation);

                // Remove player start marker from all cells
                cell.classList.remove('player-start-position');
            }
        }

        // Reset player start position
        playerStartX = null;
        playerStartY = null;

        // Player start position is now handled differently with Firebase
        // We'll check if there's a player start position in the loaded data
        // (This would be added when we properly load from Firebase)
    }

    // Load player start position for a level
    async function loadPlayerStartPosition(levelIndex) {
        // Player start positions are now stored with the level data in Firebase
        // This function is called after levels are loaded, so we can check the in-memory data
        // The actual loading happens in loadLevels()
        // This is just for compatibility with the existing code structure
    }

    // Update the level selector dropdown
    function updateLevelSelector() {
        elements.levelSelect.innerHTML = '';

        for (let i = 0; i < levels.length; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = levelNames[i];
            elements.levelSelect.appendChild(option);
        }

        elements.levelSelect.value = currentLevel;
    }

    // Update level order controls
    function updateLevelOrderControls() {
        const controlsContainer = document.getElementById('level-order-controls');
        if (!controlsContainer) return;

        controlsContainer.innerHTML = '';

        // Display info about current level position
        const positionInfo = document.createElement('div');
        positionInfo.className = 'level-position-info';
        positionInfo.textContent = `Level ${currentLevel + 1} of ${levels.length}`;
        controlsContainer.appendChild(positionInfo);

        // Create move up button
        const moveUpBtn = document.createElement('button');
        moveUpBtn.id = 'move-up-btn';
        moveUpBtn.innerHTML = '↑';
        moveUpBtn.title = 'Move level up in order';
        moveUpBtn.disabled = currentLevel <= 0;
        moveUpBtn.addEventListener('click', async () => await moveLevelUp(currentLevel));
        controlsContainer.appendChild(moveUpBtn);

        // Create move down button
        const moveDownBtn = document.createElement('button');
        moveDownBtn.id = 'move-down-btn';
        moveDownBtn.innerHTML = '↓';
        moveDownBtn.title = 'Move level down in order';
        moveDownBtn.disabled = currentLevel >= levels.length - 1;
        moveDownBtn.addEventListener('click', async () => await moveLevelDown(currentLevel));
        controlsContainer.appendChild(moveDownBtn);

        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'delete-level-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete this level';
        deleteBtn.addEventListener('click', async () => await deleteLevel(currentLevel));
        controlsContainer.appendChild(deleteBtn);
    }

    // Save levels to Firebase
    async function saveLevels(showAlert = true) {
        try {
            // Check if this is admin creating a default level
            const urlParams = new URLSearchParams(window.location.search);
            const isAdminMode = urlParams.get('mode') === 'admin-default';
            
            // For regular users, enforce single level with name
            if (!isAdminMode) {
                const levelName = elements.levelNameInput.value.trim();
                if (!levelName) {
                    showNotification('Please enter a level name!', 3000);
                    return;
                }
                levelNames[0] = levelName;
                
                // Save only the single level for regular users
                await saveSingleOnlineLevel();
                return;
            }
            
            // Admin mode continues with normal save logic
            // Validate level names
            for (let i = 0; i < levels.length; i++) {
                if (!levelNames[i] || levelNames[i].trim() === '') {
                    showNotification(`Level ${i + 1} must have a name!`, 3000);
                    return;
                }
            }
            
            // Get all existing custom level docs
            const existingLevels = await db.collection('levels').get();
            const batch = db.batch();
            
            // Store existing level IDs to preserve them
            const existingLevelIds = {};
            existingLevels.forEach(doc => {
                const data = doc.data();
                if (data.name && data.order !== undefined) {
                    existingLevelIds[data.order] = doc.id;
                }
            });
            
            // Delete levels that no longer exist
            existingLevels.forEach(doc => {
                const data = doc.data();
                if (data.order >= levels.length) {
                    batch.delete(doc.ref);
                }
            });
            
            // Save all current levels
            for (let i = 0; i < levels.length; i++) {
                // Use existing ID if available, otherwise create new
                const levelId = existingLevelIds[i] || db.collection('levels').doc().id;
                const levelDoc = db.collection('levels').doc(levelId);
                
                const levelData = {
                    id: levelId, // Store the ID in the document
                    name: levelNames[i].trim(),
                    data: JSON.stringify(levels[i]), // Convert to string to avoid nested array error
                    order: i,
                    rotationData: rotationData[i] ? JSON.stringify(rotationData[i]) : null,
                    playerStart: null,
                    author: 'Level Editor User', // You can implement user auth later
                    plays: 0,
                    rating: 0,
                    ratings: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Add player start position for the current level
                if (i === currentLevel && playerStartX !== null && playerStartY !== null) {
                    levelData.playerStart = { x: playerStartX, y: playerStartY };
                }
                
                // Preserve existing stats if updating
                if (existingLevelIds[i]) {
                    const existingDoc = await db.collection('levels').doc(levelId).get();
                    if (existingDoc.exists) {
                        const existing = existingDoc.data();
                        levelData.plays = existing.plays || 0;
                        levelData.rating = existing.rating || 0;
                        levelData.ratings = existing.ratings || 0;
                        levelData.createdAt = existing.createdAt;
                        levelData.author = existing.author || 'Level Editor User';
                    }
                }
                
                batch.set(levelDoc, levelData);
            }
            
            // Commit the batch
            await batch.commit();
            
            if (showAlert) {
                showNotification('Level saved to Firebase successfully!', 3000);
            }
        } catch (error) {
            console.error('Error saving levels to Firebase:', error);
            showNotification('Failed to save level to Firebase: ' + error.message, 3000);
        }
    }

    // Delete a level
    async function deleteLevel(levelIndex) {
        if (levels.length <= 1) {
            alert('Cannot delete the last level!');
            return;
        }

        if (confirm(`Are you sure you want to delete level "${levelNames[levelIndex]}"?`)) {
            // Remove the level data
            levels.splice(levelIndex, 1);
            levelNames.splice(levelIndex, 1);

            // Remove rotation data if it exists
            if (rotationData[levelIndex]) {
                rotationData.splice(levelIndex, 1);
            }

            // Adjust current level index if needed
            if (currentLevel >= levels.length) {
                currentLevel = levels.length - 1;
                window.currentLevel = currentLevel; // Update window reference
            }

            // Save changes
            await saveLevels(false);

            // Update UI
            updateLevelSelector();
            displayLevel(currentLevel);
        }
    }

    // Save player start positions
    function savePlayerStartPositions() {
        // Player start positions are now saved with the level data in saveLevels()
        // This function is kept for compatibility but doesn't need to do anything
    }

    // Trigger auto-save with debounce
    function triggerAutoSave() {
        // Check if in admin mode - if so, don't auto-save
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminMode = urlParams.get('mode') === 'admin-default';
        
        if (isAdminMode) {
            // Just update the preview, don't save
            renderPreview();
            return;
        }
        
        // Clear previous timeout
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }

        // Set a new timeout to save after 500ms of inactivity
        autoSaveTimeout = setTimeout(async () => {
            await saveLevels(false); // Save without alert
            renderPreview(); // Update the preview
        }, 500);
    }

    // Add a new level
    async function addNewLevel() {
        // Only allow in admin mode
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminMode = urlParams.get('mode') === 'admin-default';
        
        if (!isAdminMode) {
            showNotification('Creating multiple levels is only available for admins', 3000);
            return;
        }
        
        levels.push(createEmptyLevel());
        levelNames.push(`Level ${levels.length}`);
        rotationData.push(createEmptyRotationData());
        await saveLevels(false);
        updateLevelSelector();
        displayLevel(levels.length - 1);
    }

    // Clear the current level
    async function clearLevel() {
        if (confirm('Are you sure you want to clear this level?')) {
            levels[currentLevel] = createEmptyLevel();
            rotationData[currentLevel] = createEmptyRotationData();
            playerStartX = null;
            playerStartY = null;
            await saveLevels(false);
            displayLevel(currentLevel);
        }
    }

    // Move a level up in the level order
    async function moveLevelUp(levelIndex) {
        if (levelIndex <= 0 || levelIndex >= levels.length) return;

        // Swap levels
        [levels[levelIndex], levels[levelIndex - 1]] = [levels[levelIndex - 1], levels[levelIndex]];
        [levelNames[levelIndex], levelNames[levelIndex - 1]] = [levelNames[levelIndex - 1], levelNames[levelIndex]];

        // Swap rotation data if it exists
        if (rotationData[levelIndex] && rotationData[levelIndex - 1]) {
            [rotationData[levelIndex], rotationData[levelIndex - 1]] = [rotationData[levelIndex - 1], rotationData[levelIndex]];
        }

        // Save changes
        await saveLevels(false);

        // Update the current level index
        currentLevel = levelIndex - 1;
        window.currentLevel = currentLevel; // Update window reference

        // Update UI
        updateLevelSelector();
        displayLevel(currentLevel);
    }

    // Move a level down in the level order
    async function moveLevelDown(levelIndex) {
        if (levelIndex < 0 || levelIndex >= levels.length - 1) return;

        // Swap levels
        [levels[levelIndex], levels[levelIndex + 1]] = [levels[levelIndex + 1], levels[levelIndex]];
        [levelNames[levelIndex], levelNames[levelIndex + 1]] = [levelNames[levelIndex + 1], levelNames[levelIndex]];

        // Swap rotation data if it exists
        if (rotationData[levelIndex] && rotationData[levelIndex + 1]) {
            [rotationData[levelIndex], rotationData[levelIndex + 1]] = [rotationData[levelIndex + 1], rotationData[levelIndex]];
        }

        // Save changes
        await saveLevels(false);

        // Update the current level index
        currentLevel = levelIndex + 1;
        window.currentLevel = currentLevel; // Update window reference

        // Update UI
        updateLevelSelector();
        displayLevel(currentLevel);
    }

    // Render the live preview
    function renderPreview() {
        const ctx = elements.previewCtx;
        const canvas = elements.previewCanvas;
        
        // Check if canvas elements exist
        if (!ctx || !canvas) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        ctx.fillStyle = '#000022';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add stars to background
        drawBackgroundStars(ctx, canvas.width, canvas.height);

        // Calculate scale
        const scale = canvas.width / (GRID_WIDTH * TILE_SIZE);
        const scaledTileSize = TILE_SIZE * scale;

        // Draw level tiles
        drawLevelTiles(ctx, levels[currentLevel], scale, scaledTileSize);

        // Draw player start position if defined
        if (playerStartX !== null && playerStartY !== null) {
            drawPlayerPreview(ctx, playerStartX, playerStartY, scale, scaledTileSize);
        }
    }

    // Draw stars in the background
    function drawBackgroundStars(ctx, width, height) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 1;
            ctx.fillRect(x, y, size, size);
        }
    }

    // Draw all tiles in the level
    // Draw all tiles in the level
    function drawLevelTiles(ctx, level, scale, scaledTileSize) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tileType = level[y][x];

                if (tileType !== 0) {
                    const tileInfo = TILE_TYPES[tileType];
                    if (!tileInfo) continue;

                    if (tileType === 2 || (tileType >= 10 && tileType <= 13)) { // All spike types
                        drawSpikePreview(ctx, x, y, scale, scaledTileSize, tileInfo.color, tileType);
                    } else {
                        // Draw regular tile
                        ctx.fillStyle = tileInfo.color;
                        ctx.fillRect(x * scaledTileSize, y * scaledTileSize, scaledTileSize, scaledTileSize);

                        // Add details for goal tiles
                        if (tileType === 3) { // Goal
                            drawGoalCircle(ctx, x, y, scale, scaledTileSize);
                        }
                    }
                }
            }
        }
    }

    // Draw a spike in the preview
    function drawSpikePreview(ctx, x, y, scale, scaledTileSize, color, tileId) {
        // Save the current context state
        ctx.save();

        // Translate to the center of the spike
        ctx.translate(x * scaledTileSize + scaledTileSize / 2, y * scaledTileSize + scaledTileSize / 2);

        // Get rotation based on spike type
        let rotation = 0;
        if (tileId >= 10 && tileId <= 13) {
            rotation = TILE_TYPES[tileId].rotation;
        } else if (rotationData[currentLevel] && rotationData[currentLevel][y] && rotationData[currentLevel][y][x] !== undefined) {
            rotation = rotationData[currentLevel][y][x];
        }

        // Rotate
        ctx.rotate(rotation * Math.PI / 180);

        // Draw the spike triangle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -scaledTileSize / 2);
        ctx.lineTo(scaledTileSize / 2, scaledTileSize / 2);
        ctx.lineTo(-scaledTileSize / 2, scaledTileSize / 2);
        ctx.closePath();
        ctx.fill();

        // Add spike highlight
        ctx.fillStyle = '#ff5555';
        ctx.beginPath();
        ctx.moveTo(0, -scaledTileSize / 2 + 3 * scale);
        ctx.lineTo(scaledTileSize / 2 - 3 * scale, scaledTileSize / 2 - 3 * scale);
        ctx.lineTo(-scaledTileSize / 2 + 3 * scale, scaledTileSize / 2 - 3 * scale);
        ctx.closePath();
        ctx.fill();

        // Restore the context
        ctx.restore();
    }

    // Draw the goal circle in the preview
    function drawGoalCircle(ctx, x, y, scale, scaledTileSize) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(
            x * scaledTileSize + scaledTileSize / 2,
            y * scaledTileSize + scaledTileSize / 2,
            scaledTileSize * 0.3,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    // Draw the player in the preview
    function drawPlayerPreview(ctx, x, y, scale, scaledTileSize) {
        ctx.fillStyle = '#4c6baf';
        ctx.fillRect(
            x * scaledTileSize,
            y * scaledTileSize,
            PLAYER_WIDTH * scale,
            PLAYER_HEIGHT * scale
        );

        // Add eyes for visual appeal
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
            x * scaledTileSize + 5 * scale,
            y * scaledTileSize + 8 * scale,
            4 * scale,
            4 * scale
        );
        ctx.fillRect(
            x * scaledTileSize + 15 * scale,
            y * scaledTileSize + 8 * scale,
            4 * scale,
            4 * scale
        );
    }

    // Set up keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
            // Save level with Ctrl+S
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                await saveLevels();
            }

            // Test play with F5
            if (e.key === 'F5') {
                e.preventDefault();
                await testPlayLevel();
            }
        });
    }

    // Rename the current level
    async function renameLevel() {
        const name = elements.levelNameInput.value.trim();
        if (name) {
            levelNames[currentLevel] = name;
            await saveLevels(false); // Save without alert
            updateLevelSelector();
        }
    }

    // Test play the current level
    async function testPlayLevel() {
        // Check if in admin mode
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminMode = urlParams.get('mode') === 'admin-default';
        
        if (!isAdminMode) {
            // Regular users - save before testing
            const levelName = elements.levelNameInput.value.trim();
            if (!levelName) {
                showNotification('Please enter a level name before testing!', 3000);
                return;
            }
            await saveSingleOnlineLevel();
        } else {
            // Admin mode - save normally
            await saveLevels(false);
        }

        // Set test level and open game in new tab
        localStorage.setItem('testPlayLevel', currentLevel);
        window.open('index.html?testLevel=' + currentLevel, '_blank');
    }
    
    // Save single online level for regular users
    async function saveSingleOnlineLevel() {
        try {
            const levelName = elements.levelNameInput.value.trim();
            if (!levelName) {
                showNotification('Please enter a level name!', 3000);
                return;
            }
            
            // Create new level document
            const levelId = db.collection('levels').doc().id;
            const levelData = {
                id: levelId,
                name: levelName,
                data: JSON.stringify(levels[0]),
                order: 0,
                rotationData: rotationData[0] ? JSON.stringify(rotationData[0]) : null,
                playerStart: null,
                author: 'Anonymous User', // You can implement auth later
                plays: 0,
                rating: 0,
                ratings: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add player start position
            if (playerStartX !== null && playerStartY !== null) {
                levelData.playerStart = { x: playerStartX, y: playerStartY };
            }
            
            // Save to Firebase
            await db.collection('levels').doc(levelId).set(levelData);
            
            showNotification(`Level "${levelName}" saved online successfully!`, 3000);
            
            // Offer to test or create new
            if (confirm('Level saved! Would you like to test it?')) {
                testPlayLevel();
            } else if (confirm('Would you like to create a new level?')) {
                // Reset the level
                levels[0] = createEmptyLevel();
                rotationData[0] = createEmptyRotationData();
                playerStartX = null;
                playerStartY = null;
                elements.levelNameInput.value = '';
                displayLevel(0);
            }
            
        } catch (error) {
            console.error('Error saving online level:', error);
            showNotification('Failed to save level: ' + error.message, 3000);
        }
    }
    
    // Save as default level (admin only)
    async function saveAsDefaultLevel() {
        try {
            const levelName = elements.levelNameInput.value.trim();
            if (!levelName) {
                showNotification('Please enter a level name!', 3000);
                return;
            }
            
            // Get current level data
            const levelData = levels[currentLevel];
            const rotationDataForLevel = rotationData[currentLevel] || null;
            
            // Get player start position
            let startPosition = { x: 1, y: 12 };
            if (playerStartX !== null && playerStartY !== null) {
                startPosition = { x: playerStartX, y: playerStartY };
            }
            
            // Get the current count of default levels
            const defaultCount = await db.collection('defaultLevels').get().then(snap => snap.size);
            
            // Create new default level document
            const newDefaultLevel = {
                name: levelName,
                grid: JSON.stringify(levelData),
                startPosition: startPosition,
                rotationData: rotationDataForLevel ? JSON.stringify(rotationDataForLevel) : null,
                isDefault: true,
                order: defaultCount, // Add to the end
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add to defaultLevels collection
            await db.collection('defaultLevels').doc(`level_${defaultCount}`).set(newDefaultLevel);
            
            // Clean up admin mode indicators
            localStorage.removeItem('adminCreatingDefaultLevel');
            localStorage.removeItem('pendingDefaultLevelName');
            
            showNotification(`Default level "${levelName}" saved successfully!`, 3000);
            
            // Show success and offer to close
            if (confirm(`Default level "${levelName}" has been saved! Close the editor and return to admin panel?`)) {
                window.close();
            }
            
        } catch (error) {
            console.error('Error saving default level:', error);
            showNotification('Failed to save default level: ' + error.message, 3000);
        }
    }

    // Set up all event listeners
    function setupEventListeners() {
        // Level selector change
        if (elements.levelSelect) {
            elements.levelSelect.addEventListener('change', () => {
                displayLevel(parseInt(elements.levelSelect.value));
            });
        }

        // Button events
        if (buttons.save) buttons.save.addEventListener('click', async () => await saveLevels());
        if (buttons.clear) buttons.clear.addEventListener('click', async () => await clearLevel());
        if (buttons.newLevel) buttons.newLevel.addEventListener('click', async () => await addNewLevel());
        if (buttons.rename) buttons.rename.addEventListener('click', async () => await renameLevel());
        if (buttons.backToGame) {
            buttons.backToGame.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        if (buttons.play) buttons.play.addEventListener('click', testPlayLevel);
        if (buttons.saveDefault) buttons.saveDefault.addEventListener('click', async () => await saveAsDefaultLevel());

        // Remove export and import buttons if they exist (as specified)
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.style.display = 'none';
        }

        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.style.display = 'none';
        }

        // Add keyboard shortcuts for level reordering
        document.addEventListener('keydown', async (e) => {
            // Move level up with Alt+Up
            if (e.altKey && e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentLevel > 0) {
                    await moveLevelUp(currentLevel);
                }
            }

            // Move level down with Alt+Down
            if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentLevel < levels.length - 1) {
                    await moveLevelDown(currentLevel);
                }
            }
        });
    }

    // Make copyLevelMatrix available to window for external access
    window.copyLevelMatrix = copyLevelMatrix;

    // Initialize the editor
    initEditor();

    window.saveLevels = saveLevels;
    window.copyLevelMatrix = copyLevelMatrix;
    window.levels = levels;
    window.levelNames = levelNames;
    window.currentLevel = currentLevel;
    window.playerStartX = playerStartX;
    window.playerStartY = playerStartY;
    window.rotationData = rotationData;

    // Also export other functions that might be needed
    window.showNotification = showNotification;
    window.updateLevelSelector = updateLevelSelector;
    window.displayLevel = displayLevel;
    
    // Make copyLevelMatrix available globally
    window.copyLevelMatrix = copyLevelMatrix;
    }
}

// Export LevelEditor class
window.LevelEditor = LevelEditor;

// For backward compatibility, initialize on standalone editor page
document.addEventListener('DOMContentLoaded', async function() {
    // Only auto-initialize if we're on the standalone editor page
    if (document.getElementById('previewCanvas') && !document.getElementById('gameCanvas')) {
        const editor = new LevelEditor();
        await editor.init();
    }
});