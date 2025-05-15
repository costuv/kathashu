import { auth, db, rtdb, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { 
    ref, 
    get, 
    update,
    onValue,
    set
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";
import { 
    collection, 
    query, 
    getDocs, 
    deleteDoc, 
    doc 
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Initialize admin dashboard
const initAdminDashboard = () => {
    const adminErrorMsg = document.getElementById('admin-error-message');
    
    // Check if user is an admin
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check if the user is an admin
        const userRef = ref(rtdb, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists() || !snapshot.val().isAdmin) {
            window.location.href = 'index.html';
            return;
        }
        
        // User is an admin, load admin dashboard
        loadUsers();
        loadStories();
        setupAdminFormToggle();
        setupAddAdminForm();
    });
    
    // Load all users
    const loadUsers = () => {
        const usersTableBody = document.getElementById('users-table-body');
        const adminErrorMsg = document.getElementById('admin-error-message');
        
        if (usersTableBody) {
            // Clear table body and show loading state
            usersTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Loading users...</td></tr>';
            
            // Get all users from the Realtime Database
            const usersRef = ref(rtdb, 'users');
            
            get(usersRef).then((snapshot) => {
                // Clear loading state
                usersTableBody.innerHTML = '';
                
                if (!snapshot.exists()) {
                    usersTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">No users found</td></tr>';
                    return;
                }
                
                // Display each user
                const users = snapshot.val();
                Object.entries(users).forEach(([userId, userData]) => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                    
                    const adminBadge = userData.isAdmin ? 
                        `<span class="admin-badge relative" title="Admin">
                            <i class="fas fa-check-circle"></i>
                            <span class="tooltip-text">Admin</span>
                         </span>` : '';
                    
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">${userData.fullName || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${userData.username || 'N/A'}
                            ${adminBadge}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">${userData.email || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${userData.isAdmin 
                                ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100">Admin</span>' 
                                : userData.canPost
                                    ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100">Author</span>'
                                    : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">User</span>'
                            }
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            ${!userData.isAdmin ? `
                                <button class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 mr-3 toggle-role-btn" data-user-id="${userId}" data-role="admin">
                                    Make Admin
                                </button>
                            ` : ''}
                            <button class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 mr-3 toggle-permission-btn" data-user-id="${userId}" data-can-post="${userData.canPost ? 'true' : 'false'}">
                                ${userData.canPost ? 'Remove Posting' : 'Allow Posting'}
                            </button>
                        </td>
                    `;
                    
                    usersTableBody.appendChild(tr);
                });
                
                // Add event listeners for role toggles
                document.querySelectorAll('.toggle-role-btn').forEach(btn => {
                    btn.addEventListener('click', handleRoleToggle);
                });
                
                // Add event listeners for permission toggles
                document.querySelectorAll('.toggle-permission-btn').forEach(btn => {
                    btn.addEventListener('click', handlePermissionToggle);
                });
            }).catch(error => {
                console.error("Error loading users:", error);
                
                // Show detailed error message for permission issues
                if (error.message && error.message.includes('Permission denied')) {
                    usersTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-600 dark:text-red-400">Permission denied. Please update your database rules.</td></tr>';
                    
                    if (adminErrorMsg) {
                        adminErrorMsg.classList.remove('hidden');
                        adminErrorMsg.innerHTML = `
                            <strong>Database Permission Error:</strong> You need to update your Firebase Realtime Database rules.<br>
                            Go to the Firebase console, select your project, navigate to Realtime Database > Rules, and use the following rules:
                            <pre class="bg-gray-100 dark:bg-gray-700 p-2 mt-2 overflow-auto text-xs">
{
  "rules": {
    "users": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('isAdmin').val() == true",
      ".write": "auth != null && root.child('users').child(auth.uid).child('isAdmin').val() == true",
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('isAdmin').val() == true)",
        ".write": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('isAdmin').val() == true)"
      }
    },
    "usernames": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "stories": {
      ".read": true,
      "$storyId": {
        ".write": "auth != null && (root.child('users').child(auth.uid).child('canPost').val() == true || root.child('users').child(auth.uid).child('isAdmin').val() == true)"
      }
    }
  }
}
                            </pre>
                        `;
                    }
                } else {
                    usersTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-600 dark:text-red-400">Failed to load users. Please try again later.</td></tr>';
                }
            });
        }
    };
    
    // Handle toggling user role (make admin)
    const handleRoleToggle = async (e) => {
        try {
            const userId = e.target.getAttribute('data-user-id');
            
            // Update user role in Realtime Database
            const userRef = ref(rtdb, `users/${userId}`);
            await update(userRef, {
                isAdmin: true,
                canPost: true // Admins automatically get posting permission
            });
            
            // Reload users to reflect changes
            loadUsers();
            
        } catch (error) {
            console.error("Error updating user role:", error);
            if (adminErrorMsg) {
                adminErrorMsg.textContent = "Failed to update user role. Please try again.";
                adminErrorMsg.classList.remove('hidden');
            }
        }
    };
    
    // Handle toggling posting permission
    const handlePermissionToggle = async (e) => {
        try {
            const userId = e.target.getAttribute('data-user-id');
            const currentPermission = e.target.getAttribute('data-can-post') === 'true';
            
            // Update user posting permission in Realtime Database
            const userRef = ref(rtdb, `users/${userId}`);
            await update(userRef, {
                canPost: !currentPermission
            });
            
            // Update button text and data attribute immediately
            e.target.textContent = !currentPermission ? 'Remove Posting' : 'Allow Posting';
            e.target.setAttribute('data-can-post', (!currentPermission).toString());
            
            // Highlight the row to indicate change
            const row = e.target.closest('tr');
            row.classList.add('bg-yellow-50', 'dark:bg-yellow-900', 'transition-colors');
            setTimeout(() => {
                row.classList.remove('bg-yellow-50', 'dark:bg-yellow-900', 'transition-colors');
            }, 1500);
            
        } catch (error) {
            console.error("Error updating posting permission:", error);
            if (adminErrorMsg) {
                adminErrorMsg.textContent = "Failed to update posting permission. Please try again.";
                adminErrorMsg.classList.remove('hidden');
            }
        }
    };
    
    // Load all stories
    const loadStories = async () => {
        const storiesTableBody = document.getElementById('stories-table-body');
        
        if (storiesTableBody) {
            try {
                // Clear table body
                storiesTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Loading stories...</td></tr>';
                
                // Try loading from Realtime Database first
                await loadStoriesFromRTDB(storiesTableBody);
            } catch (rtdbError) {
                console.error("Error loading stories from RTDB:", rtdbError);
                
                try {
                    // Fallback to Firestore with simplified query
                    const storiesQuery = query(collection(db, "stories"));
                    const querySnapshot = await getDocs(storiesQuery);
                    
                    // Clear loading message
                    storiesTableBody.innerHTML = '';
                    
                    if (querySnapshot.empty) {
                        storiesTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">No stories found</td></tr>';
                        return;
                    }
                    
                    // Get all users for author lookup
                    const usersRef = ref(rtdb, 'users');
                    const usersSnapshot = await get(usersRef);
                    const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
                    
                    // Display each story
                    querySnapshot.forEach(async (doc) => {
                        renderStoryRow(doc.id, doc.data(), storiesTableBody, users);
                    });
                } catch (firestoreError) {
                    console.error("Error loading stories:", firestoreError);
                    storiesTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-600 dark:text-red-400">Failed to load stories. Please check your database permissions.</td></tr>';
                }
            }
        }
    };
    
    // Load stories from Realtime Database
    const loadStoriesFromRTDB = (storiesTableBody) => {
        return new Promise((resolve, reject) => {
            // Get all stories from RTDB
            const storiesRef = ref(rtdb, 'stories');
            
            get(storiesRef).then(async (snapshot) => {
                // Clear loading message
                storiesTableBody.innerHTML = '';
                
                if (!snapshot.exists()) {
                    storiesTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">No stories found</td></tr>';
                    resolve();
                    return;
                }
                
                // Get all users for author lookup
                const usersRef = ref(rtdb, 'users');
                const usersSnapshot = await get(usersRef);
                const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
                
                // Convert snapshot to array and sort by creation date (newest first)
                const stories = [];
                snapshot.forEach((childSnapshot) => {
                    stories.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                
                stories.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                
                // Display each story
                stories.forEach((story) => {
                    renderStoryRow(story.id, story, storiesTableBody, users);
                });
                
                // Add event listeners for delete buttons
                document.querySelectorAll('.delete-story-btn').forEach(btn => {
                    btn.addEventListener('click', handleStoryDelete);
                });
                
                resolve();
            }).catch(error => {
                reject(error);
            });
        });
    };
    
    // Render a story row in the table
    const renderStoryRow = (storyId, story, container, users) => {
        const authorId = story.authorId;
        const author = users[authorId] ? users[authorId].username : 'Unknown';
        const storyDate = story.createdAt ? 
            (typeof story.createdAt === 'string' ? 
                new Date(story.createdAt).toLocaleDateString() : 
                new Date(story.createdAt.toDate()).toLocaleDateString()) 
            : 'Unknown';
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <a href="story.html?id=${storyId}" class="text-blue-600 dark:text-blue-400 hover:underline">
                    ${story.title || 'Untitled'}
                </a>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${author}</td>
            <td class="px-6 py-4 whitespace-nowrap">${storyDate}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${story.status === 'published' 
                    ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100">Published</span>' 
                    : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100">Draft</span>'
                }
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a 
                    href="edit-story.html?id=${storyId}" 
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                >
                    <i class="fas fa-edit mr-1"></i> Edit
                </a>
                <button class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200 delete-story-btn" data-story-id="${storyId}" data-db-type="${story._rtdb ? 'rtdb' : 'firestore'}">
                    Delete
                </button>
            </td>
        `;
        
        container.appendChild(tr);
        
        // Add event listener to this specific delete button
        tr.querySelector('.delete-story-btn').addEventListener('click', handleStoryDelete);
    };
    
    // Handle story deletion
    const handleStoryDelete = async (e) => {
        if (confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
            try {
                const storyId = e.target.getAttribute('data-story-id');
                const dbType = e.target.getAttribute('data-db-type') || 'firestore';
                
                // Delete story from the appropriate database
                if (dbType === 'rtdb') {
                    // Delete from Realtime Database
                    await set(ref(rtdb, `stories/${storyId}`), null);
                } else {
                    // Delete from Firestore
                    try {
                        await deleteDoc(doc(db, "stories", storyId));
                    } catch (firestoreError) {
                        console.error("Error deleting from Firestore, trying RTDB:", firestoreError);
                        // Fallback to RTDB if Firestore delete fails
                        await set(ref(rtdb, `stories/${storyId}`), null);
                    }
                }
                
                // Remove the row from the table
                const row = e.target.closest('tr');
                row.remove();
                
            } catch (error) {
                console.error("Error deleting story:", error);
                if (adminErrorMsg) {
                    adminErrorMsg.textContent = "Failed to delete story. Please try again.";
                    adminErrorMsg.classList.remove('hidden');
                }
            }
        }
    };
    
    // Toggle admin form visibility
    const setupAdminFormToggle = () => {
        const addAdminBtn = document.getElementById('add-admin-btn');
        const addAdminForm = document.getElementById('add-admin-form');
        const cancelAdminAdd = document.getElementById('cancel-admin-add');
        
        if (addAdminBtn && addAdminForm) {
            addAdminBtn.addEventListener('click', () => {
                addAdminForm.classList.remove('hidden');
            });
            
            if (cancelAdminAdd) {
                cancelAdminAdd.addEventListener('click', () => {
                    addAdminForm.classList.add('hidden');
                });
            }
        }
    };
    
    // Handle add admin form submission
    const setupAddAdminForm = () => {
        const addAdminFormElement = document.getElementById('add-admin-form-element');
        const adminErrorMessage = document.getElementById('admin-error-message');
        
        if (addAdminFormElement) {
            addAdminFormElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('admin-email').value;
                
                // Reset error message
                adminErrorMessage.textContent = '';
                adminErrorMessage.classList.add('hidden');
                
                try {
                    // Find user by email
                    const usersRef = ref(rtdb, 'users');
                    const snapshot = await get(usersRef);
                    
                    if (snapshot.exists()) {
                        const users = snapshot.val();
                        let userFound = false;
                        
                        // Look for user with matching email
                        for (const [userId, userData] of Object.entries(users)) {
                            if (userData.email === email) {
                                // Update user to be admin
                                const userRef = ref(rtdb, `users/${userId}`);
                                await update(userRef, {
                                    isAdmin: true,
                                    canPost: true // Admins can always post
                                });
                                
                                userFound = true;
                                
                                // Show success message
                                adminErrorMessage.textContent = `User ${userData.username} has been made an admin`;
                                adminErrorMessage.classList.remove('hidden', 'bg-red-100', 'dark:bg-red-900', 'text-red-700', 'dark:text-red-200');
                                adminErrorMessage.classList.add('bg-green-100', 'dark:bg-green-900', 'text-green-700', 'dark:text-green-200');
                                
                                // Clear the form and hide it
                                document.getElementById('admin-email').value = '';
                                document.getElementById('add-admin-form').classList.add('hidden');
                                
                                // Reload users
                                loadUsers();
                                
                                break;
                            }
                        }
                        
                        if (!userFound) {
                            adminErrorMessage.textContent = 'User with that email not found';
                            adminErrorMessage.classList.remove('hidden');
                        }
                    } else {
                        adminErrorMessage.textContent = 'No users found in the database';
                        adminErrorMessage.classList.remove('hidden');
                    }
                } catch (error) {
                    console.error("Error adding admin:", error);
                    adminErrorMessage.textContent = 'Failed to add admin. Please try again.';
                    adminErrorMessage.classList.remove('hidden');
                }
            });
        }
    };
};

// Run initialization when DOM content is loaded
document.addEventListener('DOMContentLoaded', initAdminDashboard);
