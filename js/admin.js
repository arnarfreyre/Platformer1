/**
 * Admin Panel JavaScript
 * Handles authentication and admin functionality
 */

// Admin configuration
const ADMIN_PASSWORD = 'platformer2024'; // In production, this should be stored securely
let isAuthenticated = false;
let currentEditingLevel = null;
let currentEditingType = null;

// Authentication
function authenticate() {
    const password = document.getElementById('adminPassword').value;
    const authError = document.getElementById('authError');
    
    if (password === ADMIN_PASSWORD) {
        isAuthenticated = true;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('adminPanel').classList.add('active');
        authError.style.display = 'none';
        
        // Load initial data
        loadDefaultLevels();
        loadOnlineLevels();
        refreshStats();
    } else {
        authError.style.display = 'block';
    }
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Load data for the selected tab
    if (tabName === 'default') {
        loadDefaultLevels();
    } else if (tabName === 'online') {
        loadOnlineLevels();
    } else if (tabName === 'stats') {
        refreshStats();
    }
}

// Load default levels
async function loadDefaultLevels() {
    const levelsList = document.getElementById('defaultLevelsList');
    const status = document.getElementById('defaultStatus');
    
    try {
        levelsList.innerHTML = '<li>Loading...</li>';
        
        const snapshot = await db.collection('defaultLevels')
            .orderBy('order')
            .get();
        
        levelsList.innerHTML = '';
        
        snapshot.forEach((doc, index) => {
            const data = doc.data();
            const levelItem = createDefaultLevelItem(doc.id, data, index, snapshot.size);
            levelsList.appendChild(levelItem);
        });
        
        showStatus('defaultStatus', `Loaded ${snapshot.size} default levels`, 'success');
    } catch (error) {
        console.error('Error loading default levels:', error);
        showStatus('defaultStatus', 'Error loading levels: ' + error.message, 'error');
    }
}

// Create default level list item
function createDefaultLevelItem(id, data, index, total) {
    const li = document.createElement('li');
    li.className = 'level-item';
    li.innerHTML = `
        <div class="level-info">
            <div class="level-name">${data.name || 'Unnamed Level'}</div>
            <div class="level-meta">Order: ${data.order + 1} | Created: ${formatDate(data.createdAt)}</div>
        </div>
        <div class="level-actions">
            <div class="move-buttons">
                <button class="move-btn" onclick="moveDefaultLevel('${id}', ${data.order}, -1)" 
                        ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="move-btn" onclick="moveDefaultLevel('${id}', ${data.order}, 1)" 
                        ${index === total - 1 ? 'disabled' : ''}>↓</button>
            </div>
            <button class="btn btn-primary" onclick="editLevel('${id}', 'default')">Edit</button>
            <button class="btn btn-secondary" onclick="previewLevel('${id}', 'default')">Preview</button>
        </div>
    `;
    return li;
}

// Move default level
async function moveDefaultLevel(levelId, currentOrder, direction) {
    try {
        const newOrder = currentOrder + direction;
        
        // Get all default levels
        const snapshot = await db.collection('defaultLevels')
            .orderBy('order')
            .get();
        
        const batch = db.batch();
        
        // Find the level to swap with
        let swapDoc = null;
        snapshot.forEach(doc => {
            if (doc.data().order === newOrder) {
                swapDoc = doc;
            }
        });
        
        if (swapDoc) {
            // Swap the orders
            batch.update(db.collection('defaultLevels').doc(levelId), { order: newOrder });
            batch.update(swapDoc.ref, { order: currentOrder });
            
            await batch.commit();
            showStatus('defaultStatus', 'Level order updated successfully', 'success');
            loadDefaultLevels();
        }
    } catch (error) {
        console.error('Error moving level:', error);
        showStatus('defaultStatus', 'Error moving level: ' + error.message, 'error');
    }
}

// Load online levels
async function loadOnlineLevels() {
    const levelsList = document.getElementById('onlineLevelsList');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const sortBy = document.getElementById('sortBy').value;
    
    try {
        levelsList.innerHTML = '<li>Loading...</li>';
        
        let query = db.collection('levels');
        
        // Apply sorting
        if (sortBy === 'plays') {
            query = query.orderBy('plays', 'desc');
        } else if (sortBy === 'reports') {
            query = query.orderBy('reports', 'desc');
        } else {
            query = query.orderBy('createdAt', 'desc');
        }
        
        const snapshot = await query.limit(50).get();
        
        levelsList.innerHTML = '';
        let count = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Apply search filter
            if (searchInput && !data.name.toLowerCase().includes(searchInput) && 
                !data.author.toLowerCase().includes(searchInput)) {
                return;
            }
            
            const levelItem = createOnlineLevelItem(doc.id, data);
            levelsList.appendChild(levelItem);
            count++;
        });
        
        if (count === 0) {
            levelsList.innerHTML = '<li style="text-align: center; padding: 20px;">No levels found</li>';
        }
        
        showStatus('onlineStatus', `Showing ${count} online levels`, 'info');
    } catch (error) {
        console.error('Error loading online levels:', error);
        showStatus('onlineStatus', 'Error loading levels: ' + error.message, 'error');
    }
}

// Create online level list item
function createOnlineLevelItem(id, data) {
    const li = document.createElement('li');
    li.className = 'level-item';
    
    const reports = data.reports || 0;
    const reportStyle = reports > 5 ? 'style="color: #ff6b6b;"' : '';
    
    li.innerHTML = `
        <div class="level-info">
            <div class="level-name">${data.name || 'Unnamed Level'}</div>
            <div class="level-meta">
                By: ${data.author} | Plays: ${data.plays || 0} | 
                <span ${reportStyle}>Reports: ${reports}</span> | 
                Created: ${formatDate(data.createdAt)}
            </div>
        </div>
        <div class="level-actions">
            <button class="btn btn-primary" onclick="editLevel('${id}', 'online')">Edit</button>
            <button class="btn btn-secondary" onclick="previewLevel('${id}', 'online')">Preview</button>
            <button class="btn btn-danger" onclick="deleteOnlineLevel('${id}')">Delete</button>
        </div>
    `;
    return li;
}

// Delete online level
async function deleteOnlineLevel(levelId) {
    if (!confirm('Are you sure you want to delete this level? This action cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('levels').doc(levelId).delete();
        showStatus('onlineStatus', 'Level deleted successfully', 'success');
        loadOnlineLevels();
    } catch (error) {
        console.error('Error deleting level:', error);
        showStatus('onlineStatus', 'Error deleting level: ' + error.message, 'error');
    }
}

// Edit level
async function editLevel(levelId, type) {
    currentEditingLevel = levelId;
    currentEditingType = type;
    
    try {
        const collection = type === 'default' ? 'defaultLevels' : 'levels';
        const doc = await db.collection(collection).doc(levelId).get();
        
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('editLevelName').value = data.name || '';
            document.getElementById('editLevelDescription').value = data.description || '';
            document.getElementById('editModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading level for edit:', error);
        alert('Error loading level: ' + error.message);
    }
}

// Save edit
async function saveEdit() {
    if (!currentEditingLevel) return;
    
    const newName = document.getElementById('editLevelName').value.trim();
    const newDescription = document.getElementById('editLevelDescription').value.trim();
    
    if (!newName) {
        alert('Level name is required');
        return;
    }
    
    try {
        const collection = currentEditingType === 'default' ? 'defaultLevels' : 'levels';
        await db.collection(collection).doc(currentEditingLevel).update({
            name: newName,
            description: newDescription,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeEditModal();
        showStatus(currentEditingType + 'Status', 'Level updated successfully', 'success');
        
        if (currentEditingType === 'default') {
            loadDefaultLevels();
        } else {
            loadOnlineLevels();
        }
    } catch (error) {
        console.error('Error saving edit:', error);
        alert('Error saving changes: ' + error.message);
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    currentEditingLevel = null;
    currentEditingType = null;
}

// Preview level
function previewLevel(levelId, type) {
    // Open the game with the specific level
    if (type === 'online') {
        // For online levels, use the playOnline parameter
        window.open(`index.html?playOnline=${levelId}`, '_blank');
    } else {
        // For default levels, use the testLevel parameter with the level index
        // First, find the level index based on the ID
        db.collection('defaultLevels').doc(levelId).get().then(doc => {
            if (doc.exists) {
                const levelOrder = doc.data().order;
                window.open(`index.html?testLevel=${levelOrder}`, '_blank');
            }
        }).catch(error => {
            console.error('Error previewing level:', error);
            alert('Failed to preview level');
        });
    }
}

// Refresh online levels
function refreshOnlineLevels() {
    loadOnlineLevels();
}

// Refresh statistics
async function refreshStats() {
    const statsGrid = document.getElementById('statsGrid');
    
    try {
        statsGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1;">Loading statistics...</div>';
        
        // Get counts
        const defaultLevelsCount = await db.collection('defaultLevels').get().then(snap => snap.size);
        const onlineLevelsCount = await db.collection('levels').get().then(snap => snap.size);
        
        // Get total plays (sum of all plays fields)
        let totalPlays = 0;
        const onlineLevels = await db.collection('levels').get();
        onlineLevels.forEach(doc => {
            totalPlays += doc.data().plays || 0;
        });
        
        // Get reported levels count
        let reportedLevels = 0;
        onlineLevels.forEach(doc => {
            if ((doc.data().reports || 0) > 0) {
                reportedLevels++;
            }
        });
        
        // Display stats
        statsGrid.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${defaultLevelsCount}</div>
                <div class="stat-label">Default Levels</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${onlineLevelsCount}</div>
                <div class="stat-label">Online Levels</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${totalPlays}</div>
                <div class="stat-label">Total Plays</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${reportedLevels}</div>
                <div class="stat-label">Reported Levels</div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading statistics:', error);
        statsGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; color: #ff6b6b;">Error loading statistics</div>';
    }
}

// Show status message
function showStatus(elementId, message, type) {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) {
        console.error(`Status element '${elementId}' not found`);
        // Fallback: show alert for important messages
        if (type === 'error') {
            alert('Error: ' + message);
        }
        return;
    }
    
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
    
    setTimeout(() => {
        if (statusElement) {
            statusElement.className = 'status-message';
        }
    }, 5000);
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Show create default level modal
function showCreateDefaultLevel() {
    document.getElementById('createDefaultModal').classList.add('active');
}

// Close create default level modal
function closeCreateDefaultModal() {
    document.getElementById('createDefaultModal').classList.remove('active');
    document.getElementById('createDefaultName').value = '';
}

// Open level editor for creating default level
function openLevelEditorForDefault() {
    const levelName = document.getElementById('createDefaultName').value.trim();
    
    if (!levelName) {
        alert('Please enter a level name first');
        return;
    }
    
    // Store the level name and admin status in localStorage
    localStorage.setItem('adminCreatingDefaultLevel', 'true');
    localStorage.setItem('pendingDefaultLevelName', levelName);
    
    // Open level editor in new tab
    window.open('level-editor.html?mode=admin-default', '_blank');
    
    // Close the modal
    closeCreateDefaultModal();
    
    // Show instructions
    showStatus('defaultStatus', 
        `Level editor opened in new tab. Design your level and click "Save as Default Level" when ready.`, 
        'info'
    );
}

// This function is no longer needed since we save directly from the level editor
// Keeping it for backward compatibility but it just shows an info message
async function importSavedAsDefault() {
    showStatus('defaultStatus', 
        'Please use the "Save as Default Level" button in the level editor to save your default level.', 
        'info'
    );
}

// Handle enter key in password field
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            authenticate();
        }
    });
    
    // Close modals when clicking outside
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });
    
    document.getElementById('createDefaultModal').addEventListener('click', (e) => {
        if (e.target.id === 'createDefaultModal') {
            closeCreateDefaultModal();
        }
    });
});