import { auth, rtdb } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

// Initialize admin setup utility
const initAdminSetup = () => {
    const setupForm = document.getElementById('admin-setup-form');
    const setupMessage = document.getElementById('setup-message');
    const adminPanel = document.getElementById('admin-panel');
    const setupPanel = document.getElementById('setup-panel');
    
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Not logged in, redirect to login
            window.location.href = 'login.html';
            return;
        }
        
        // Check if any admin exists
        try {
            const usersRef = ref(rtdb, 'users');
            const snapshot = await get(usersRef);
            
            let adminExists = false;
            if (snapshot.exists()) {
                const users = snapshot.val();
                adminExists = Object.values(users).some(user => user.isAdmin === true);
            }
            
            if (adminExists) {
                // Admin exists, check if current user is admin
                const userRef = ref(rtdb, `users/${user.uid}`);
                const userSnapshot = await get(userRef);
                
                if (userSnapshot.exists() && userSnapshot.val().isAdmin) {
                    // User is admin, show admin panel
                    if (setupPanel) setupPanel.classList.add('hidden');
                    if (adminPanel) adminPanel.classList.remove('hidden');
                } else {
                    // User is not admin, show message
                    if (setupMessage) {
                        setupMessage.classList.remove('hidden', 'bg-green-100', 'text-green-700');
                        setupMessage.classList.add('bg-yellow-100', 'text-yellow-700');
                        setupMessage.textContent = 'You do not have admin privileges. Please contact an existing admin.';
                    }
                }
            } else {
                // No admin exists yet, show setup form to make first admin
                if (setupPanel) setupPanel.classList.remove('hidden');
                if (adminPanel) adminPanel.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error checking admin status:", error);
            
            if (setupMessage) {
                setupMessage.classList.remove('hidden');
                
                if (error.message && error.message.includes('Permission denied')) {
                    setupMessage.innerHTML = `
                        <strong>Database Permission Error:</strong> You need to update your Firebase Realtime Database rules.<br>
                        Go to the Firebase console > Realtime Database > Rules and use these rules:
                        <pre class="bg-gray-100 dark:bg-gray-700 p-2 mt-2 overflow-auto text-xs">
{
  "rules": {
    "users": {
      ".read": "auth != null",
      ".write": "auth != null",
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
                } else {
                    setupMessage.textContent = 'Error checking admin status: ' + error.message;
                }
            }
        }
    });
    
    // Setup first admin
    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!auth.currentUser) {
                setupMessage.textContent = 'You must be logged in to become an admin';
                setupMessage.classList.remove('hidden');
                return;
            }
            
            try {
                const userId = auth.currentUser.uid;
                const userRef = ref(rtdb, `users/${userId}`);
                
                // Get current user data
                const snapshot = await get(userRef);
                if (!snapshot.exists()) {
                    setupMessage.textContent = 'User profile not found';
                    setupMessage.classList.remove('hidden');
                    return;
                }
                
                const userData = snapshot.val();
                
                // Make user an admin
                await set(userRef, {
                    ...userData,
                    isAdmin: true,
                    canPost: true
                });
                
                // Show success message
                setupMessage.textContent = 'You are now an admin! Refreshing page...';
                setupMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700');
                setupMessage.classList.add('bg-green-100', 'text-green-700');
                
                // Reload page after short delay
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                
            } catch (error) {
                console.error("Error setting up admin:", error);
                setupMessage.textContent = 'Error setting up admin: ' + error.message;
                setupMessage.classList.remove('hidden');
            }
        });
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAdminSetup);
