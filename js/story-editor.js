import { db, rtdb } from './firebase-config.js';
import { 
    getDoc, 
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import {
    ref,
    get,
    update
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    const editModal = document.getElementById('edit-story-modal');
    const editForm = document.getElementById('edit-story-form');
    const closeModalBtn = document.getElementById('close-edit-modal');
    const cancelEditBtn = document.getElementById('cancel-edit');
    
    // Fields
    const storyIdInput = document.getElementById('edit-story-id');
    const titleInput = document.getElementById('edit-story-title');
    const descriptionInput = document.getElementById('edit-story-description');
    const contentInput = document.getElementById('edit-story-content');
    const statusInput = document.getElementById('edit-story-status');
    
    // Close modal function
    function closeModal() {
        editModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
    
    // Add event listeners to close modal
    closeModalBtn.addEventListener('click', closeModal);
    cancelEditBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeModal();
        }
    });
    
    // Handle form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const storyId = storyIdInput.value;
        if (!storyId) return;
        
        try {
            const summaryText = descriptionInput.value;
            
            // Create a more comprehensive updated data object to ensure all possible summary fields are updated
            const updatedData = {
                title: titleInput.value,
                content: contentInput.value,
                status: statusInput.value,
                updatedAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                
                // Add ALL possible summary field names that might be used on homepage
                description: summaryText,
                summary: summaryText,
                excerpt: summaryText,
                shortDescription: summaryText,
                preview: summaryText,
                snippet: summaryText,
                brief: summaryText,
                abstract: summaryText,
                teaser: summaryText,
                intro: summaryText,
                metaDescription: summaryText,
                shortContent: summaryText
            };
            
            console.log("Updating story with comprehensive data:", updatedData);
            
            // First, get the current story data to ensure we don't miss any fields
            let currentStoryData = {};
            
            // Try Firestore first
            try {
                const storyDoc = await getDoc(doc(db, "stories", storyId));
                if (storyDoc.exists()) {
                    currentStoryData = storyDoc.data();
                }
            } catch (error) {
                console.log("Error getting current Firestore data:", error);
            }
            
            // Try RTDB if needed
            if (Object.keys(currentStoryData).length === 0) {
                try {
                    const rtdbSnapshot = await get(ref(rtdb, `stories/${storyId}`));
                    if (rtdbSnapshot.exists()) {
                        currentStoryData = rtdbSnapshot.val();
                    }
                } catch (error) {
                    console.log("Error getting current RTDB data:", error);
                }
            }
            
            console.log("Current story data:", currentStoryData);
            
            // Merge current data with updates to ensure no fields are lost
            const mergedData = { ...currentStoryData, ...updatedData };
            console.log("Merged data to update:", mergedData);
            
            // Try updating in Firestore first
            try {
                await updateDoc(doc(db, "stories", storyId), mergedData);
                console.log("Firestore update successful");
            } catch (firestoreError) {
                console.error("Firestore update failed, trying RTDB:", firestoreError);
            }
            
            // Always update RTDB to ensure consistency
            try {
                await update(ref(rtdb, `stories/${storyId}`), mergedData);
                console.log("RTDB update successful");
            } catch (rtdbError) {
                console.error("RTDB update failed:", rtdbError);
            }
            
            closeModal();
            alert("Story updated successfully! The homepage may take a moment to reflect these changes.");
            
            // Reload stories
            if (typeof loadStories === 'function') {
                loadStories();
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error("Error updating story:", error);
            alert("Failed to update story: " + error.message);
        }
    });
});

// Make the openEditModal function available globally
window.openEditModal = async (storyId) => {
    const editModal = document.getElementById('edit-story-modal');
    const storyIdInput = document.getElementById('edit-story-id');
    const titleInput = document.getElementById('edit-story-title');
    const descriptionInput = document.getElementById('edit-story-description');
    const contentInput = document.getElementById('edit-story-content');
    const statusInput = document.getElementById('edit-story-status');
    
    try {
        let storyData;
        
        // Try Firestore first
        try {
            const storyDoc = await getDoc(doc(db, "stories", storyId));
            if (storyDoc.exists()) {
                storyData = storyDoc.data();
                console.log("Story from Firestore:", storyData);
            }
        } catch (firestoreError) {
            console.log("Firestore fetch failed, trying RTDB", firestoreError);
        }
        
        // If Firestore fails, try RTDB
        if (!storyData) {
            const rtdbSnapshot = await get(ref(rtdb, `stories/${storyId}`));
            if (rtdbSnapshot.exists()) {
                storyData = rtdbSnapshot.val();
                console.log("Story from RTDB:", storyData);
            } else {
                throw new Error("Story not found in either database");
            }
        }
        
        // Debug all summary-like fields in the data
        console.log("Summary fields in story data:");
        ["description", "summary", "excerpt", "shortDescription", "preview", "snippet", 
         "brief", "abstract", "teaser", "intro", "metaDescription", "shortContent"].forEach(field => {
            if (storyData[field]) {
                console.log(`${field}: ${storyData[field]}`);
            }
        });
        
        // Populate form fields
        storyIdInput.value = storyId;
        titleInput.value = storyData.title || '';
        
        // Handle all possible description field variants
        descriptionInput.value = storyData.description || storyData.summary || 
                                storyData.excerpt || storyData.shortDescription || 
                                storyData.preview || storyData.snippet || 
                                storyData.brief || storyData.teaser || '';
        
        contentInput.value = storyData.content || '';
        statusInput.value = storyData.status || 'published';
        
        // Show modal
        editModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    } catch (error) {
        console.error("Error loading story:", error);
        alert("Failed to load story data: " + error.message);
    }
};
