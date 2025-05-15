import { auth, db, rtdb, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { ref as rtdbRef, set, push, get } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";

// Initialize story creation functionality
const initStoryCreation = () => {
    const storyForm = document.getElementById('story-form');
    const errorMessage = document.getElementById('error-message');
    const saveDraftButton = document.getElementById('save-draft');
    const publishButton = document.getElementById('publish-button');
    const permissionMessage = document.getElementById('permission-message');
    
    // Check if user has permission to post
    const checkPostingPermission = async (userId) => {
        try {
            const userRef = rtdbRef(rtdb, `users/${userId}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                return userData.canPost === true || userData.isAdmin === true;
            }
            return false;
        } catch (error) {
            console.error("Error checking posting permission:", error);
            return false;
        }
    };
    
    // Ensure user is authenticated and has permission
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check if user has permission to post
        const hasPermission = await checkPostingPermission(user.uid);
        
        if (!hasPermission) {
            // Hide the form and show permission message
            if (storyForm) storyForm.classList.add('hidden');
            if (permissionMessage) {
                permissionMessage.classList.remove('hidden');
                permissionMessage.textContent = 'You do not have permission to create stories. Please contact an administrator.';
            }
            return;
        }
        
        // User has permission, show the form
        if (storyForm) storyForm.classList.remove('hidden');
        if (permissionMessage) permissionMessage.classList.add('hidden');
        
        // Set up form submission handlers
        setupFormHandlers();
    });
    
    // Setup form submission handlers
    const setupFormHandlers = () => {
        if (!storyForm) return;
        
        // Handle form submission (publish)
        storyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleStorySubmission(false);
        });
        
        // Also assign click handler to the publish button explicitly
        if (publishButton) {
            publishButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleStorySubmission(false);
            });
        }
        
        // Handle save as draft
        if (saveDraftButton) {
            saveDraftButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleStorySubmission(true);
            });
        }
    };
    
    // Handle story submission (publish or draft)
    const handleStorySubmission = async (isDraft) => {
        if (!errorMessage) return;
        
        // Show loading state
        const submitButton = isDraft ? saveDraftButton : publishButton;
        const originalText = submitButton ? submitButton.textContent : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = isDraft ? 'Saving...' : 'Publishing...';
        }
        
        const title = document.getElementById('story-title').value;
        const summary = document.getElementById('story-summary').value;
        const content = document.getElementById('story-content').value;
        const tagsInput = document.getElementById('story-tags').value;
        
        // Reset error message
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');
        
        // Basic validation
        if (!title || !summary || !content) {
            errorMessage.textContent = 'Title, summary, and content are required';
            errorMessage.classList.remove('hidden');
            
            // Reset button state
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
            return;
        }
        
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('You must be logged in to publish a story');
            
            // Double check permission
            const hasPermission = await checkPostingPermission(user.uid);
            if (!hasPermission) {
                errorMessage.textContent = 'You do not have permission to create stories';
                errorMessage.classList.remove('hidden');
                
                // Reset button state
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }
                return;
            }
            
            // Process tags
            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim().toLowerCase()) : [];
            
            // Common story data
            const storyData = {
                title,
                summary,
                content,
                tags,
                authorId: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: isDraft ? 'draft' : 'published',
                likes: 0,
                views: 0
            };
            
            // Try saving to RTDB first (more likely to succeed with permissions)
            const newStoryRef = push(rtdbRef(rtdb, "stories"));
            const storyId = newStoryRef.key;
            
            // Add the story ID to the data
            storyData.id = storyId;
            
            // Save to Realtime Database
            await set(newStoryRef, storyData);
            
            // Try to save to Firestore as well (for compatibility)
            try {
                await addDoc(collection(db, "stories"), {
                    ...storyData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            } catch (firestoreError) {
                console.error("Could not save to Firestore (continuing anyway):", firestoreError);
                // Continue even if Firestore save fails - we have the RTDB copy
            }
            
            // Clear form inputs after successful submission
            storyForm.reset();
            
            // Success message
            errorMessage.textContent = isDraft ? 'Draft saved successfully!' : 'Story published successfully!';
            errorMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700');
            errorMessage.classList.add('bg-green-100', 'text-green-700');
            
            // Redirect after a short delay
            setTimeout(() => {
                if (isDraft) {
                    window.location.href = 'profile.html';
                } else {
                    window.location.href = `story.html?id=${storyId}`;
                }
            }, 1500);
            
        } catch (error) {
            console.error('Story submission error:', error);
            
            // Show specific error message based on the error
            if (error.code === 'permission-denied' || error.message.includes('Permission denied')) {
                errorMessage.innerHTML = `
                    <strong>Permission Error:</strong> You don't have permission to save stories.<br>
                    Please ensure you have the correct permissions or contact an administrator.
                `;
            } else {
                errorMessage.textContent = error.message || 'An error occurred while saving your story';
            }
            errorMessage.classList.remove('hidden');
            
            // Reset button state
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        }
    };
    
    // Preview uploaded image
    const setupImagePreview = () => {
        const coverImageInput = document.getElementById('story-cover');
        if (!coverImageInput) return;
        
        coverImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const parent = coverImageInput.parentElement;
                    
                    // Remove existing preview if any
                    const existingPreview = parent.querySelector('.image-preview');
                    if (existingPreview) existingPreview.remove();
                    
                    // Create preview container
                    const previewContainer = document.createElement('div');
                    previewContainer.className = 'image-preview absolute inset-0 flex items-center justify-center';
                    
                    // Create image element
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'h-full w-full object-cover rounded-lg';
                    
                    previewContainer.appendChild(img);
                    parent.appendChild(previewContainer);
                    
                    // Update label style
                    parent.classList.add('relative');
                    parent.querySelector('div').classList.add('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    };
    
    // Initialize image preview
    setupImagePreview();
};

// Run initialization when DOM content is loaded
document.addEventListener('DOMContentLoaded', initStoryCreation);
