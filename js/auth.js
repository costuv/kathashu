import { auth, db, rtdb, storage } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import {
    ref,
    set,
    get,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

// Check if user is authenticated and update UI accordingly
const checkAuthState = () => {
    const authLinks = document.getElementById('auth-links');
    const userMenu = document.getElementById('user-menu');
    const usernameDisplay = document.getElementById('username-display');
    const adminLink = document.getElementById('admin-link');
    const createStoryBtn = document.getElementById('create-story-btn');
    const homeCreateStoryBtn = document.getElementById('home-create-story-btn');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            if (authLinks) authLinks.classList.add('hidden');
            if (userMenu) {
                userMenu.classList.remove('hidden');
                
                // Get user data from Realtime Database
                const userRef = ref(rtdb, `users/${user.uid}`);
                onValue(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        if (usernameDisplay) usernameDisplay.textContent = userData.username;
                        
                        // Check if user is admin
                        if (userData.isAdmin && adminLink) {
                            adminLink.classList.remove('hidden');
                        }
                        
                        // Check if user can post stories (both on profile and homepage)
                        const canPost = userData.canPost || userData.isAdmin;
                        
                        if (createStoryBtn && canPost) {
                            createStoryBtn.classList.remove('hidden');
                        } else if (createStoryBtn) {
                            createStoryBtn.classList.add('hidden');
                        }
                        
                        // For homepage create story button
                        if (homeCreateStoryBtn && canPost) {
                            homeCreateStoryBtn.classList.remove('hidden');
                        } else if (homeCreateStoryBtn) {
                            homeCreateStoryBtn.classList.add('hidden');
                        }
                        
                        // Dispatch custom event for other components to update
                        document.dispatchEvent(new CustomEvent('authStateChanged', { 
                            detail: { loggedIn: true, userData: userData }
                        }));
                    }
                });
            }
        } else {
            // User is signed out
            if (authLinks) authLinks.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
            
            // Hide create story buttons
            if (createStoryBtn) createStoryBtn.classList.add('hidden');
            if (homeCreateStoryBtn) homeCreateStoryBtn.classList.add('hidden');
            
            // Dispatch custom event for other components to update
            document.dispatchEvent(new CustomEvent('authStateChanged', { 
                detail: { loggedIn: false }
            }));
            
            // Redirect to login if trying to access protected pages
            const protectedPages = ['profile.html', 'admin.html', 'create-story.html'];
            const currentPage = window.location.pathname.split('/').pop();
            
            if (protectedPages.includes(currentPage)) {
                window.location.href = 'login.html';
            }
        }
    });
};

// Handle user signup
const handleSignup = () => {
    const form = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('fullName').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Reset error message
            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');
            
            // Form validation
            if (!fullName || !username || !email || !password || !confirmPassword) {
                errorMessage.textContent = 'All fields are required';
                errorMessage.classList.remove('hidden');
                return;
            }
            
            if (password !== confirmPassword) {
                errorMessage.textContent = 'Passwords do not match';
                errorMessage.classList.remove('hidden');
                return;
            }
            
            if (password.length < 6) {
                errorMessage.textContent = 'Password must be at least 6 characters';
                errorMessage.classList.remove('hidden');
                return;
            }
            
            try {
                // Create user in Firebase Auth first
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                try {
                    // Check if username already exists
                    const usernameCheckRef = ref(rtdb, 'usernames');
                    const usernameSnapshot = await get(usernameCheckRef);
                    
                    if (usernameSnapshot.exists()) {
                        const usernames = usernameSnapshot.val();
                        if (usernames[username]) {
                            // If username exists but we've already created the auth user, 
                            // delete the auth user to prevent orphaned accounts
                            await deleteUser(user);
                            
                            errorMessage.textContent = 'Username already exists';
                            errorMessage.classList.remove('hidden');
                            return;
                        }
                    }
                    
                    // Store additional user data in Realtime Database
                    await set(ref(rtdb, `users/${user.uid}`), {
                        fullName,
                        username,
                        email,
                        isAdmin: false,
                        canPost: false, // By default, users cannot post
                        createdAt: new Date().toISOString()
                    });
                    
                    // Store username in a separate location for quick lookup
                    await set(ref(rtdb, `usernames/${username}`), user.uid);
                    
                    // Redirect to home page
                    window.location.href = 'index.html';
                } catch (dbError) {
                    console.error('Database error during signup:', dbError);
                    
                    // If database operations fail, clean up by deleting the auth user
                    try {
                        await deleteUser(user);
                    } catch (deleteError) {
                        console.error('Error cleaning up auth user after database failure:', deleteError);
                    }
                    
                    // Check if it's a permission error
                    if (dbError.message && dbError.message.includes('Permission denied')) {
                        errorMessage.innerHTML = `
                            <strong>Database permission error:</strong> You need to update your Firebase Realtime Database rules. 
                            Go to the Firebase console, select your project, then Database > Rules, and paste the following rules:
                            <pre class="bg-gray-100 dark:bg-gray-700 p-2 mt-2 overflow-auto text-xs">
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('isAdmin').val() == true)",
        ".write": "auth != null && (auth.uid == $uid || !data.exists() || root.child('users').child(auth.uid).child('isAdmin').val() == true)"
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
                        errorMessage.textContent = 'Error saving user data. Please try again.';
                    }
                    errorMessage.classList.remove('hidden');
                }
            } catch (authError) {
                let errorText = 'An error occurred during sign up';
                
                if (authError.code === 'auth/email-already-in-use') {
                    errorText = 'Email is already in use';
                }
                
                errorMessage.textContent = errorText;
                errorMessage.classList.remove('hidden');
                console.error('Auth sign up error:', authError);
            }
        });
    }
};

// Handle user login
const handleLogin = () => {
    const form = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Reset error message
            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');
            
            try {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'index.html';
            } catch (error) {
                let errorText = 'Invalid email or password';
                
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorText = 'Invalid email or password';
                } else if (error.code === 'auth/too-many-requests') {
                    errorText = 'Too many failed login attempts. Please try again later';
                }
                
                errorMessage.textContent = errorText;
                errorMessage.classList.remove('hidden');
                console.error('Login error:', error);
            }
        });
    }
};

// Handle user logout
const handleLogout = () => {
    const logoutButton = document.getElementById('logout-button');
    
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
};

// Toggle user menu dropdown - remove this function since we no longer have a dropdown
const setupUserMenu = () => {
    // This function is now empty as we removed the dropdown functionality
    // The logout button still needs its event handler
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
};

// Check if user can post stories
const canUserPost = async (userId) => {
    if (!userId) return false;
    
    try {
        const userRef = ref(rtdb, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            return userData.canPost === true || userData.isAdmin === true;
        }
        
        return false;
    } catch (error) {
        console.error("Error checking user posting permission:", error);
        return false;
    }
};

// Delete user account and all associated data
const deleteUserAccount = async (password) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('You must be logged in to delete your account');
        
        // Re-authenticate user before deletion
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        
        // Get user data before deletion to clean up
        const userRef = ref(rtdb, `users/${user.uid}`);
        const userSnapshot = await get(userRef);
        let username = '';
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            username = userData.username;
        }
        
        // Delete data from Realtime Database
        const updates = {};
        updates[`users/${user.uid}`] = null;
        if (username) {
            updates[`usernames/${username}`] = null;
        }
        await update(ref(rtdb), updates);
        
        // Delete user auth account
        await deleteUser(user);
        
        return { success: true, message: 'Your account has been deleted successfully' };
    } catch (error) {
        console.error('Error deleting account:', error);
        
        let errorMessage = 'Failed to delete account';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many attempts. Please try again later';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Please log out and log back in before trying again';
        }
        
        return { success: false, message: errorMessage };
    }
};

// Initialize authentication features
const initAuth = () => {
    checkAuthState();
    handleSignup();
    handleLogin();
    handleLogout();
    setupUserMenu();
};

// Run initialization
document.addEventListener('DOMContentLoaded', initAuth);

export { checkAuthState, canUserPost, deleteUserAccount };
