import { auth, db, rtdb } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { ref, get, update, onValue, set } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { deleteUserAccount } from './auth.js';

// Initialize profile page
const initProfile = () => {
    // Load profile data and check permissions
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            loadProfileData(user.uid);
            loadUserStories(user.uid);
            setupProfileEdit();
            setupAccountDeletion();
            setupProfileLogout(); // Add this line to initialize the logout button
            checkPostingPermission(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });
    
    // Load user profile data
    const loadProfileData = (userId) => {
        const profileName = document.getElementById('profile-name');
        const profileUsername = document.getElementById('profile-username');
        const profileEmail = document.getElementById('profile-email');
        
        if (!profileName || !profileUsername || !profileEmail) return;
        
        // Show loading state
        profileName.textContent = "Loading...";
        profileUsername.textContent = "Loading...";
        profileEmail.textContent = "Loading...";
        
        // Get user data from Realtime Database
        const userRef = ref(rtdb, `users/${userId}`);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                profileName.textContent = userData.fullName || 'No Name';
                profileUsername.textContent = `@${userData.username}` || '@username';
                
                // Add admin badge if user is admin
                if (userData.isAdmin) {
                    const badge = document.createElement('span');
                    badge.className = 'admin-badge relative ml-1';
                    badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                    profileUsername.appendChild(badge);
                }
                
                profileEmail.textContent = userData.email || 'email@example.com';
                
                // Pre-fill edit form if it exists
                const editFullName = document.getElementById('edit-fullName');
                const editUsername = document.getElementById('edit-username');
                
                if (editFullName) editFullName.value = userData.fullName || '';
                if (editUsername) editUsername.value = userData.username || '';
            } else {
                // Handle case when user data doesn't exist
                profileName.textContent = "User Not Found";
                profileUsername.textContent = "";
                profileEmail.textContent = "";
                
                // Create a basic profile if none exists
                set(userRef, {
                    fullName: "New User",
                    username: `user${userId.substring(0, 5)}`,
                    email: auth.currentUser.email,
                    isAdmin: false,
                    canPost: false,
                    createdAt: new Date().toISOString()
                });
            }
        }, (error) => {
            console.error("Error loading profile data:", error);
            profileName.textContent = "Error Loading Profile";
            profileUsername.textContent = "";
            profileEmail.textContent = "";
        });
    };
    
    // Setup account deletion
    const setupAccountDeletion = () => {
        const deleteAccountBtn = document.getElementById('delete-account-btn');
        const deleteModal = document.getElementById('delete-modal');
        const cancelDeleteBtn = document.getElementById('cancel-delete');
        const deleteAccountForm = document.getElementById('delete-account-form');
        const deleteErrorMessage = document.getElementById('delete-error-message');
        
        if (!deleteAccountBtn || !deleteModal || !cancelDeleteBtn || !deleteAccountForm) return;
        
        // Show delete account modal
        deleteAccountBtn.addEventListener('click', () => {
            deleteModal.classList.remove('hidden');
        });
        
        // Hide delete account modal
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.classList.add('hidden');
            deleteErrorMessage.textContent = '';
            deleteErrorMessage.classList.add('hidden');
            deleteAccountForm.reset();
        });
        
        // Handle account deletion
        deleteAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('delete-password').value;
            
            if (!password) {
                deleteErrorMessage.textContent = 'Password is required';
                deleteErrorMessage.classList.remove('hidden');
                return;
            }
            
            // Disable form while processing
            const submitBtn = deleteAccountForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Deleting...';
            
            // Reset error message
            deleteErrorMessage.textContent = '';
            deleteErrorMessage.classList.add('hidden');
            
            try {
                const result = await deleteUserAccount(password);
                
                if (result.success) {
                    // Account deleted successfully, redirect to home page
                    window.location.href = 'index.html';
                } else {
                    // Show error message
                    deleteErrorMessage.textContent = result.message;
                    deleteErrorMessage.classList.remove('hidden');
                    
                    // Re-enable form
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            } catch (error) {
                console.error("Error deleting account:", error);
                deleteErrorMessage.textContent = 'An error occurred while deleting your account';
                deleteErrorMessage.classList.remove('hidden');
                
                // Re-enable form
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
        
        // Close modal when clicking outside
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                deleteModal.classList.add('hidden');
                deleteErrorMessage.textContent = '';
                deleteErrorMessage.classList.add('hidden');
                deleteAccountForm.reset();
            }
        });
    };
    
    // Setup profile logout button
    const setupProfileLogout = () => {
        const profileLogoutBtn = document.getElementById('profile-logout-btn');
        
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Failed to logout. Please try again.');
                }
            });
        }
    };
    
    // Check if user has permission to post
    const checkPostingPermission = async (userId) => {
        const createStoryBtn = document.getElementById('create-story-btn');
        const postingStatus = document.getElementById('posting-status');
        
        if (!createStoryBtn || !postingStatus) return;
        
        try {
            // Get user data from Realtime Database
            const userRef = ref(rtdb, `users/${userId}`);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    
                    if (userData.canPost || userData.isAdmin) {
                        createStoryBtn.classList.remove('hidden');
                        postingStatus.classList.add('hidden');
                    } else {
                        createStoryBtn.classList.add('hidden');
                        postingStatus.classList.remove('hidden');
                    }
                } else {
                    createStoryBtn.classList.add('hidden');
                    postingStatus.classList.remove('hidden');
                }
            });
        } catch (error) {
            console.error("Error checking posting permission:", error);
            createStoryBtn.classList.add('hidden');
            postingStatus.classList.remove('hidden');
        }
    };
    
    // Load user's stories
    const loadUserStories = async (userId) => {
        const userStories = document.getElementById('user-stories');
        const noStories = document.getElementById('no-stories');
        
        if (!userStories || !noStories) return;
        
        // Show loading state
        userStories.innerHTML = `
            <div class="col-span-1 md:col-span-2 animate-pulse">
                <div class="h-40 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
        `;
        noStories.classList.add('hidden');
        
        try {
            // First attempt to get stories from RTDB
            await loadUserStoriesFromRTDB(userId, userStories, noStories);
        } catch (rtdbError) {
            console.error("Error loading user stories from RTDB:", rtdbError);
            
            // Fallback to Firestore
            try {
                // Query stories by author ID from Firestore
                const storiesQuery = query(
                    collection(db, "stories"),
                    where("authorId", "==", userId),
                    orderBy("createdAt", "desc")
                );
                
                const querySnapshot = await getDocs(storiesQuery);
                
                // Clear loading state
                userStories.innerHTML = '';
                
                if (querySnapshot.empty) {
                    noStories.classList.remove('hidden');
                    return;
                }
                
                // Hide the "no stories" message
                noStories.classList.add('hidden');
                
                // Display each story
                querySnapshot.forEach((doc) => {
                    const story = doc.data();
                    renderStoryCard(doc.id, story, userStories);
                });
            } catch (firestoreError) {
                console.error("Error loading user stories from Firestore:", firestoreError);
                userStories.innerHTML = '<p class="col-span-1 md:col-span-2 text-red-600 dark:text-red-400">Failed to load your stories. Please try again later.</p>';
                noStories.classList.add('hidden');
            }
        }
    };
    
    // Load user stories from Realtime Database
    const loadUserStoriesFromRTDB = (userId, container, noStoriesElement) => {
        return new Promise((resolve, reject) => {
            const storiesRef = ref(rtdb, "stories");
            
            onValue(storiesRef, (snapshot) => {
                try {
                    // Clear loading state
                    container.innerHTML = '';
                    
                    if (!snapshot.exists()) {
                        noStoriesElement.classList.remove('hidden');
                        resolve();
                        return;
                    }
                    
                    const userStories = [];
                    
                    // Filter stories by author
                    snapshot.forEach((childSnapshot) => {
                        const story = childSnapshot.val();
                        if (story.authorId === userId) {
                            userStories.push({
                                id: childSnapshot.key,
                                ...story
                            });
                        }
                    });
                    
                    // Sort by date (newest first)
                    userStories.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                    
                    if (userStories.length === 0) {
                        noStoriesElement.classList.remove('hidden');
                        resolve();
                        return;
                    }
                    
                    // Hide the "no stories" message
                    noStoriesElement.classList.add('hidden');
                    
                    // Render each story
                    userStories.forEach(story => {
                        renderStoryCard(story.id, story, container);
                    });
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, (error) => {
                reject(error);
            });
        });
    };
    
    // Render a story card
    const renderStoryCard = (storyId, story, container) => {
        const storyDate = story.createdAt ? 
            (typeof story.createdAt === 'string' ? 
                new Date(story.createdAt).toLocaleDateString() : 
                new Date(story.createdAt.toDate()).toLocaleDateString()) 
            : 'Unknown date';
        
        const storyCard = document.createElement('div');
        storyCard.className = 'bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden shadow';
        
        storyCard.innerHTML = `
            <a href="story.html?id=${storyId}" class="block">
                <div class="p-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between">
                        <h3 class="text-lg font-bold">${story.title || 'Untitled'}</h3>
                        <div class="flex items-center mt-2 sm:mt-0">
                            <span class="px-2 text-xs font-semibold rounded-full ${
                                story.status === 'published' 
                                    ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100' 
                                    : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100'
                            }">
                                ${story.status === 'published' ? 'Published' : 'Draft'}
                            </span>
                            <span class="text-gray-600 dark:text-gray-400 text-sm ml-4">${storyDate}</span>
                        </div>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">${story.summary || 'No summary provided'}</p>
                    <div class="flex justify-between items-center mt-4">
                        <div class="flex items-center text-gray-600 dark:text-gray-400 text-sm">
                            <span class="mr-4"><i class="far fa-heart mr-1"></i>${story.likes || 0} likes</span>
                            <span><i class="far fa-eye mr-1"></i>${story.views || 0} views</span>
                        </div>
                        <span class="text-blue-600 dark:text-blue-400 text-sm">Read more →</span>
                    </div>
                </div>
            </a>
        `;
        
        container.appendChild(storyCard);
    };
    
    // Setup profile edit functionality
    const setupProfileEdit = () => {
        const editProfileBtn = document.getElementById('edit-profile-btn');
        const editProfileForm = document.getElementById('edit-profile-form');
        const profileForm = document.getElementById('profile-form');
        const cancelEdit = document.getElementById('cancel-edit');
        
        if (editProfileBtn && editProfileForm) {
            editProfileBtn.addEventListener('click', () => {
                editProfileForm.classList.remove('hidden');
            });
            
            if (cancelEdit) {
                cancelEdit.addEventListener('click', () => {
                    editProfileForm.classList.add('hidden');
                });
            }
            
            if (profileForm) {
                profileForm.addEventListener('submit', handleProfileUpdate);
            }
        }
    };
    
    // Handle profile update
    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('edit-fullName').value;
        const username = document.getElementById('edit-username').value;
        const editErrorMessage = document.getElementById('edit-error-message');
        
        // Reset error message
        if (editErrorMessage) {
            editErrorMessage.textContent = '';
            editErrorMessage.classList.add('hidden');
        }
        
        if (!fullName || !username) {
            if (editErrorMessage) {
                editErrorMessage.textContent = 'Name and username are required';
                editErrorMessage.classList.remove('hidden');
            }
            return;
        }
        
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('You must be logged in to update your profile');
            
            // Check if username already exists (skip check if username hasn't changed)
            const userRef = ref(rtdb, `users/${user.uid}`);
            const userSnapshot = await get(userRef);
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                
                if (userData.username !== username) {
                    // Check if the new username already exists
                    const usernameCheckRef = ref(rtdb, 'usernames');
                    const usernameSnapshot = await get(usernameCheckRef);
                    
                    if (usernameSnapshot.exists()) {
                        const usernames = usernameSnapshot.val();
                        if (usernames[username] && usernames[username] !== user.uid) {
                            if (editErrorMessage) {
                                editErrorMessage.textContent = 'Username already exists';
                                editErrorMessage.classList.remove('hidden');
                            }
                            return;
                        }
                    }
                    
                    // Update username in the usernames index
                    const updates = {};
                    updates[`usernames/${userData.username}`] = null; // Remove old username
                    updates[`usernames/${username}`] = user.uid; // Add new username
                    await update(ref(rtdb), updates);
                }
                
                // Update user profile
                await update(userRef, {
                    fullName,
                    username,
                    updatedAt: new Date().toISOString()
                });
                
                // Hide edit form and show success message
                document.getElementById('edit-profile-form').classList.add('hidden');
                
                if (editErrorMessage) {
                    editErrorMessage.textContent = 'Profile updated successfully!';
                    editErrorMessage.classList.remove('hidden', 'bg-red-100', 'dark:bg-red-900', 'text-red-700', 'dark:text-red-200');
                    editErrorMessage.classList.add('bg-green-100', 'dark:bg-green-900', 'text-green-700', 'dark:text-green-200');
                    
                    // Hide the success message after 3 seconds
                    setTimeout(() => {
                        editErrorMessage.classList.add('hidden');
                    }, 3000);
                }
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            if (editErrorMessage) {
                editErrorMessage.textContent = error.message || 'An error occurred while updating your profile';
                editErrorMessage.classList.remove('hidden');
            }
        }
    };
};

// Run initialization when DOM content is loaded
document.addEventListener('DOMContentLoaded', initProfile);
