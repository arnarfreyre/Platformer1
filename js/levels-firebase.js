/**
 * Level Loader - Firebase Version
 * This file handles loading and managing game levels from Firebase
 */

class LevelLoader {
    constructor() {
        // Level data
        this.levels = [];
        this.levelNames = [];
        this.playerStartPositions = [];
        this.spikeRotations = [];
        
        // Track default level count
        this.defaultLevelCount = 0;

        // Game state
        this.currentLevel = 0;
        this.unlockedLevels = 1; // Start with only the first level unlocked
        
        // Loading state
        this.isLoading = true;
        this.loadingPromise = null;

        // Initialize loading
        this.initialize();
    }

    /**
     * Initialize the level loader
     */
    initialize() {
        // Start loading from Firebase
        this.loadingPromise = this.loadLevelsFromFirebase();
    }
    
    /**
     * Load levels (for compatibility)
     */
    async loadLevels() {
        await this.ensureLoaded();
    }
    
    /**
     * Ensure levels are loaded before accessing
     */
    async ensureLoaded() {
        if (this.loadingPromise) {
            await this.loadingPromise;
        }
    }

    /**
     * Load levels from Firebase
     */
    async loadLevelsFromFirebase() {
        try {
            console.log('Loading levels from Firebase...');
            
            // Load default levels from Firebase
            const defaultSnapshot = await db.collection('defaultLevels')
                .orderBy('order')
                .get();
            
            // Clear existing levels
            this.levels = [];
            this.levelNames = [];
            this.playerStartPositions = [];
            
            // Process default levels
            defaultSnapshot.forEach(doc => {
                const data = doc.data();
                const grid = typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid;
                
                this.levels.push(grid);
                this.levelNames.push(data.name || `Level ${this.levels.length}`);
                this.playerStartPositions.push(data.startPosition || { x: 1, y: 12 });
            });
            
            this.defaultLevelCount = this.levels.length;
            
            // Load custom levels from localStorage (temporary until Firebase integration)
            this.loadCustomLevels();
            
            // Load progress
            this.loadProgress();
            
            // Check if a test level is being requested
            this.checkTestLevel();
            
            console.log(`Loaded ${this.levels.length} levels (${this.defaultLevelCount} from Firebase)`);
            this.isLoading = false;
            
        } catch (error) {
            console.error('Error loading levels from Firebase:', error);
            // Load minimal fallback level
            this.loadFallbackLevel();
            this.isLoading = false;
        }
    }
    
    /**
     * Load a minimal fallback level if Firebase fails
     */
    loadFallbackLevel() {
        console.log('Loading fallback level...');
        const fallbackLevel = Array(16).fill(null).map(() => Array(25).fill(0));
        
        // Add floor
        for (let x = 0; x < 25; x++) {
            fallbackLevel[15][x] = 1;
        }
        
        // Add goal
        fallbackLevel[13][20] = 3;
        
        this.levels = [fallbackLevel];
        this.levelNames = ['Fallback Level'];
        this.playerStartPositions = [{ x: 1, y: 14 }];
        this.defaultLevelCount = 1;
    }

    /**
     * Load custom levels from localStorage
     */
    loadCustomLevels() {
        try {
            const customLevels = localStorage.getItem('customLevels');
            const customNames = localStorage.getItem('customLevelNames');
            const customPositions = localStorage.getItem('customStartPositions');
            
            if (customLevels) {
                const parsedLevels = JSON.parse(customLevels);
                const parsedNames = customNames ? JSON.parse(customNames) : [];
                const parsedPositions = customPositions ? JSON.parse(customPositions) : [];
                
                // Append custom levels to the main arrays
                parsedLevels.forEach((level, index) => {
                    this.levels.push(level);
                    this.levelNames.push(parsedNames[index] || `Custom Level ${index + 1}`);
                    this.playerStartPositions.push(parsedPositions[index] || { x: 1, y: 12 });
                });
            }
        } catch (error) {
            console.error('Error loading custom levels:', error);
        }
    }

    /**
     * Save custom level to localStorage (temporary)
     */
    saveCustomLevel(level, name, startPosition) {
        // Get existing custom levels
        let customLevels = [];
        let customNames = [];
        let customPositions = [];
        
        try {
            const saved = localStorage.getItem('customLevels');
            if (saved) {
                customLevels = JSON.parse(saved);
                customNames = JSON.parse(localStorage.getItem('customLevelNames') || '[]');
                customPositions = JSON.parse(localStorage.getItem('customStartPositions') || '[]');
            }
        } catch (error) {
            console.error('Error loading existing custom levels:', error);
        }
        
        // Add new level
        customLevels.push(level);
        customNames.push(name);
        customPositions.push(startPosition);
        
        // Save back to localStorage
        localStorage.setItem('customLevels', JSON.stringify(customLevels));
        localStorage.setItem('customLevelNames', JSON.stringify(customNames));
        localStorage.setItem('customStartPositions', JSON.stringify(customPositions));
        
        // Reload levels
        this.loadLevelsFromFirebase();
    }

    /**
     * Check if a test level is being requested
     */
    checkTestLevel() {
        const urlParams = new URLSearchParams(window.location.search);
        const testLevel = urlParams.get('testLevel');
        
        if (testLevel !== null) {
            const levelIndex = parseInt(testLevel);
            if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < this.levels.length) {
                this.currentLevel = levelIndex;
                console.log('Starting at test level:', levelIndex);
            }
        }
        
        // Also check localStorage
        const storedTestLevel = localStorage.getItem('testPlayLevel');
        if (storedTestLevel !== null) {
            const levelIndex = parseInt(storedTestLevel);
            if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < this.levels.length) {
                this.currentLevel = levelIndex;
                localStorage.removeItem('testPlayLevel'); // Clear after use
            }
        }
    }

    /**
     * Load game progress
     */
    loadProgress() {
        const savedProgress = localStorage.getItem(STORAGE_KEYS.PROGRESS);
        if (savedProgress) {
            try {
                const progress = JSON.parse(savedProgress);
                this.unlockedLevels = Math.max(1, Math.min(progress.unlockedLevels || 1, this.levels.length));
            } catch (error) {
                console.error('Error loading progress:', error);
            }
        }
    }

    /**
     * Save game progress
     */
    saveProgress() {
        const progress = {
            unlockedLevels: this.unlockedLevels,
            lastPlayed: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    }

    /**
     * Get the current level data
     */
    getCurrentLevel() {
        return this.levels[this.currentLevel] || null;
    }

    /**
     * Get the current level name
     */
    getCurrentLevelName() {
        return this.levelNames[this.currentLevel] || `Level ${this.currentLevel + 1}`;
    }

    /**
     * Get player start position for current level
     */
    getPlayerStartPosition() {
        const pos = this.playerStartPositions[this.currentLevel];
        return pos || { x: 1, y: 12 }; // Default position if not specified
    }

    /**
     * Move to the next level
     */
    nextLevel() {
        if (this.currentLevel < this.levels.length - 1) {
            this.currentLevel++;
            
            // Unlock the next level
            if (this.currentLevel + 1 > this.unlockedLevels) {
                this.unlockedLevels = this.currentLevel + 1;
                this.saveProgress();
            }
            
            return true;
        }
        return false;
    }

    /**
     * Check if a level is unlocked
     */
    isLevelUnlocked(levelIndex) {
        return levelIndex < this.unlockedLevels;
    }

    /**
     * Get the total number of levels
     */
    getLevelCount() {
        return this.levels.length;
    }
}

// Create and export a singleton instance
const levelLoader = new LevelLoader();

// Export both the class and instance
export { LevelLoader, levelLoader };