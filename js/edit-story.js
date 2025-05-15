import { db, rtdb } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
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
    const auth = getAuth();
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const editForm = document.getElementById('edit-story-form');
    
    // Form fields - make sure these match the IDs in the HTML
    const storyIdInput = document.getElementById('story-id');
    const titleInput = document.getElementById('story-title');
    const summaryInput = document.getElementById('story-summary'); // this was changed to match the HTML
    const contentInput = document.getElementById('story-content');
    const tagsInput = document.getElementById('story-tags');
    const statusInput = document.getElementById('story-status');
    
    // Check authentication
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Get story ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const storyId = urlParams.get('id');
        
        if (!storyId) {
            showError("No story ID provided. Please go back and select a story to edit.");
            return;
        }
        
        // Check if user is admin or author
        checkEditPermission(user.uid, storyId);
    });
    
    // Check if user has permission to edit this story
    const checkEditPermission = async (userId, storyId) => {
        try {
            // Check if user is admin
            const userRef = ref(rtdb, `users/${userId}`);
            const userSnapshot = await get(userRef);
            
            if (!userSnapshot.exists()) {
                showError("User data not found. Please log in again.");
                return;
            }
            
            const userData = userSnapshot.val();
            let isAuthor = false;
            let authorData = null;
            let storyData;
            
            // Get story data regardless of permissions
            storyData = await getStoryData(storyId);
            
            if (!storyData) {
                showError("Story not found.");
                return;
            }
            
            // Determine if current user is the author
            isAuthor = storyData.authorId === userId;
            
            // Get author data - always do this for all users
            authorData = await getAuthorData(storyData.authorId);
            
            // REMOVED: No longer showing author info banner
            // Instead of displaying author info, just store it for form population
            
            // Check edit permission
            const hasEditPermission = userData.isAdmin || isAuthor;
            
            if (!hasEditPermission) {
                // Instead of error and rejection, make the form read-only
                makeFormReadOnly();
                document.getElementById('error-message').textContent = 
                    "View-only mode: You don't have permission to edit this story.";
                document.getElementById('error-message').classList.remove('hidden');
                document.getElementById('error-message').classList.add('bg-yellow-100', 'dark:bg-yellow-900', 'text-yellow-700', 'dark:text-yellow-200');
            }
            
            // Always populate the form for viewing, regardless of permissions
            populateForm(storyId, storyData, authorData);
            
        } catch (error) {
            console.error("Error checking edit permission:", error);
            showError("Failed to load story: " + error.message);
        }
    };
    
    // Function to retrieve story data from either database
    const getStoryData = async (storyId) => {
        let storyData = null;
        
        // Try Firestore first
        try {
            const storyDoc = await getDoc(doc(db, "stories", storyId));
            if (storyDoc.exists()) {
                storyData = storyDoc.data();
                console.log("Story data from Firestore:", storyData);
            }
        } catch (error) {
            console.log("Error fetching from Firestore:", error);
        }
        
        // If Firestore fails, try RTDB
        if (!storyData) {
            try {
                const rtdbSnapshot = await get(ref(rtdb, `stories/${storyId}`));
                if (rtdbSnapshot.exists()) {
                    storyData = rtdbSnapshot.val();
                    console.log("Story data from RTDB:", storyData);
                }
            } catch (error) {
                console.log("Error fetching from RTDB:", error);
            }
        }
        
        return storyData;
    };
    
    // Function to get author data
    const getAuthorData = async (authorId) => {
        if (!authorId) return null;
        
        let authorData = null;
        
        // Try RTDB first
        try {
            const authorRef = ref(rtdb, `users/${authorId}`);
            const authorSnapshot = await get(authorRef);
            if (authorSnapshot.exists()) {
                authorData = authorSnapshot.val();
                console.log("Author data from RTDB:", authorData);
            }
        } catch (error) {
            console.log("Error fetching author from RTDB:", error);
        }
        
        // Try Firestore as fallback
        if (!authorData) {
            try {
                const authorDoc = await getDoc(doc(db, "users", authorId));
                if (authorDoc.exists()) {
                    authorData = authorDoc.data();
                    console.log("Author data from Firestore:", authorData);
                }
            } catch (error) {
                console.log("Error fetching author from Firestore:", error);
            }
        }
        
        return authorData;
    };
    
    // Make the form read-only for non-editors
    const makeFormReadOnly = () => {
        // Disable all form inputs
        const inputs = editForm.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.setAttribute('readonly', true);
            input.classList.add('bg-gray-100', 'dark:bg-gray-750', 'cursor-not-allowed');
        });
        
        // Hide submit button
        const submitButton = editForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.style.display = 'none';
        }
        
        // Add a view-only notice
        editForm.insertAdjacentHTML('beforeend', `
            <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-lg text-center">
                This story is displayed in view-only mode. You don't have permission to edit it.
            </div>
        `);
    };
    
    // Helper function to get the author display name
    const getAuthorDisplayName = (storyData, authorData) => {
        // Try all possible places where author name might be stored
        if (authorData) {
            return authorData.username || authorData.displayName || authorData.name || 'Unknown user';
        }
        
        if (storyData) {
            return storyData.authorName || storyData.author || storyData.username || 'Unknown author';
        }
        
        return 'Unknown author';
    };
    
    // Populate form with story data
    const populateForm = (storyId, storyData, authorData) => {
        console.log("Populating form with data:", storyData);
        
        // REMOVED: No longer adding an author display section to the form
        // Just keep the hidden inputs for data preservation
        
        storyIdInput.value = storyId;
        titleInput.value = storyData.title || '';
        
        // Handle all possible summary field variants
        summaryInput.value = storyData.summary || storyData.description || 
                            storyData.excerpt || storyData.shortDescription || 
                            storyData.preview || storyData.snippet || 
                            storyData.brief || storyData.teaser || '';
        
        contentInput.value = storyData.content || '';
        
        // Handle tags - could be string, array, or object format
        if (storyData.tags) {
            if (Array.isArray(storyData.tags)) {
                tagsInput.value = storyData.tags.join(', ');
            } else if (typeof storyData.tags === 'object') {
                // If tags are stored as object with keys (Firebase style)
                tagsInput.value = Object.keys(storyData.tags).join(', ');
            } else if (typeof storyData.tags === 'string') {
                tagsInput.value = storyData.tags;
            }
        } else {
            tagsInput.value = '';
        }
        
        statusInput.value = storyData.status || 'published';
        
        // Store author information in hidden form fields
        const authorName = authorData ? 
            (authorData.username || authorData.displayName || authorData.name || 'Unknown user') : 
            (storyData.authorName || storyData.author || storyData.username || 'Unknown author');
        
        // Create hidden inputs if they don't exist yet
        if (!document.getElementById('story-author-id')) {
            const authorIdInput = document.createElement('input');
            authorIdInput.type = 'hidden';
            authorIdInput.id = 'story-author-id';
            authorIdInput.name = 'authorId';
            editForm.appendChild(authorIdInput);
        }
        
        if (!document.getElementById('story-author-name')) {
            const authorNameInput = document.createElement('input');
            authorNameInput.type = 'hidden';
            authorNameInput.id = 'story-author-name';
            authorNameInput.name = 'authorName';
            editForm.appendChild(authorNameInput);
        }
        
        document.getElementById('story-author-id').value = storyData.authorId || '';
        document.getElementById('story-author-name').value = authorName;
        
        // Store complete author information for saving
        window.originalStoryData = {
            ...storyData,
            authorName: authorName,
            authorId: storyData.authorId || null
        };
        
        // Show form, hide loading indicator
        loadingIndicator.classList.add('hidden');
        editForm.classList.remove('hidden');
    };
    
    // Show error message
    const showError = (message) => {
        loadingIndicator.classList.add('hidden');
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    };
    
    // Handle form submission
    editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const storyId = storyIdInput.value;
        if (!storyId) return;
        
        try {
            const summaryText = summaryInput.value;
            
            // Process tags - convert comma-separated string to array and trim whitespace
            const tagsString = tagsInput.value;
            let tagsArray = [];
            let tagsObject = {};
            
            if (tagsString.trim()) {
                tagsArray = tagsString.split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
                
                // Also create an object format for Firebase
                tagsArray.forEach(tag => {
                    tagsObject[tag] = true;
                });
            }
            
            // Preserve the original author data
            const originalData = window.originalStoryData || {};
            
            // Get author info from hidden fields
            const authorId = document.getElementById('story-author-id')?.value || originalData.authorId;
            const authorName = document.getElementById('story-author-name')?.value || originalData.authorName;
            
            // Create updated data object with all field names
            const updatedData = {
                title: titleInput.value,
                content: contentInput.value,
                status: statusInput.value,
                updatedAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                
                // Enhanced author information preservation
                authorId: authorId,
                authorName: authorName,
                author: authorName, // For compatibility
                username: authorName, // For compatibility
                authorUsername: authorName, // For compatibility
                
                // Include both formats of tags
                tags: tagsObject,
                tagsArray: tagsArray,
                
                // Add ALL possible summary field names
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
            
            console.log("Updating story with data:", updatedData);
            
            // Try updating in Firestore first
            try {
                await updateDoc(doc(db, "stories", storyId), updatedData);
                console.log("Firestore update successful");
            } catch (firestoreError) {
                console.error("Firestore update failed, trying RTDB:", firestoreError);
            }
            
            // Always update RTDB to ensure consistency
            try {
                await update(ref(rtdb, `stories/${storyId}`), updatedData);
                console.log("RTDB update successful");
            } catch (rtdbError) {
                console.error("RTDB update failed:", rtdbError);
            }
            
            // Redirect to admin page with success message
            window.location.href = 'admin.html?updated=' + storyId;
            
        } catch (error) {
            console.error("Error updating story:", error);
            showError("Failed to update story: " + error.message);
        }
    });
});
