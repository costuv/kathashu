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
    
    // Get all possible create story buttons and links
    const createStoryElements = [
        document.getElementById('create-story-btn'),
        document.getElementById('home-create-story-btn'),
        document.getElementById('create-story-link'),
        document.getElementById('mobile-create-story-link')
    ];
    
    // Hide all create story elements by default
    createStoryElements.forEach(element => {
        if (element) {
            element.classList.add('hidden');
            element.style.display = 'none'; // Add display:none for extra safety
        }
    });
    
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
                        } else if (adminLink) {
                            adminLink.classList.add('hidden');
                        }
                        
                        // Check if user can post stories (both on profile and homepage)
                        const canPost = userData.canPost === true || userData.isAdmin === true;
                        console.log("User can post:", canPost, "canPost:", userData.canPost, "isAdmin:", userData.isAdmin);
                        
                        // Only show create story elements if user can post
                        createStoryElements.forEach(element => {
                            if (element) {
                                if (canPost) {
                                    element.classList.remove('hidden');
                                    element.style.removeProperty('display');
                                } else {
                                    element.classList.add('hidden');
                                    element.style.display = 'none';
                                }
                            }
                        });
                        
                        // Dispatch custom event for other components to update
                        document.dispatchEvent(new CustomEvent('authStateChanged', { 
                            detail: { loggedIn: true, userData: userData, canPost: canPost }
                        }));
                    } else {
                        // Hide all create story elements if no user data
                        createStoryElements.forEach(element => {
                            if (element) {
                                element.classList.add('hidden');
                                element.style.display = 'none';
                            }
                        });
                    }
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    // Hide all create story elements on error
                    createStoryElements.forEach(element => {
                        if (element) {
                            element.classList.add('hidden');
                            element.style.display = 'none';
                        }
                    });
                });
            }
        } else {
            // User is signed out
            if (authLinks) authLinks.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
            
            // Hide all create story elements for signed-out users
            createStoryElements.forEach(element => {
                if (element) {
                    element.classList.add('hidden');
                    element.style.display = 'none';
                }
            });
            
            // Dispatch custom event for other components to update
            document.dispatchEvent(new CustomEvent('authStateChanged', { 
                detail: { loggedIn: false, canPost: false }
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
    const usernameInput = document.getElementById('username');
    
    if (form) {
        // Add real-time username validation
        if (usernameInput) {
            usernameInput.addEventListener('blur', async () => {
                const username = usernameInput.value.trim().toLowerCase();
                if (username.length < 3) return; // Don't check too short usernames
                
                // Reset username field styling
                usernameInput.classList.remove('border-red-500', 'border-green-500');
                
                // Clear any existing username error
                const existingError = document.getElementById('username-error');
                if (existingError) {
                    existingError.remove();
                }
                
                try {
                    console.log("Checking username:", username);
                    
                    // Check if username exists in the database
                    const usernameCheckRef = ref(rtdb, 'usernames');
                    const usernameSnapshot = await get(usernameCheckRef);
                    
                    if (usernameSnapshot.exists()) {
                        // Convert all keys to lowercase for case-insensitive comparison
                        const usernames = usernameSnapshot.val();
                        const usernameExists = Object.keys(usernames).some(
                            existingName => existingName.toLowerCase() === username.toLowerCase()
                        );
                        
                        console.log("Username exists:", usernameExists, "Usernames in DB:", Object.keys(usernames));
                        
                        if (usernameExists) {
                            // Username is taken - show error immediately
                            usernameInput.classList.add('border-red-500');
                            
                            // Create username-specific error message
                            const usernameError = document.createElement('p');
                            usernameError.id = 'username-error';
                            usernameError.className = 'text-red-600 text-sm mt-1';
                            usernameError.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Username is taken.';
                            usernameInput.parentNode.appendChild(usernameError);
                        } else {
                            // Username is available - show success
                            usernameInput.classList.add('border-green-500');
                        }
                    } else {
                        // No usernames in database, so this one is available
                        usernameInput.classList.add('border-green-500');
                    }
                } catch (error) {
                    console.error("Error checking username:", error);
                    // Don't show any validation indicators if there's an error
                }
            });
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('fullName').value;
            const username = usernameInput.value.trim().toLowerCase(); // Normalize username
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Reset error message and styling
            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');
            errorMessage.classList.remove('bg-red-100', 'border', 'border-red-400', 'text-red-700', 'px-4', 'py-3', 'rounded', 'relative');
            usernameInput.classList.remove('border-red-500');
            
            // Form validation
            if (!fullName || !username || !email || !password || !confirmPassword) {
                errorMessage.textContent = 'All fields are required';
                errorMessage.classList.remove('hidden');
                return;
            }
            
            // Username validation
            if (!/^[a-z0-9_]{3,20}$/.test(username)) {
                errorMessage.textContent = 'Username must be 3-20 characters and can only contain lowercase letters, numbers and underscores';
                errorMessage.classList.remove('hidden');
                usernameInput.classList.add('border-red-500');
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
                // Check if username already exists BEFORE creating auth user
                const usernameCheckRef = ref(rtdb, 'usernames');
                const usernameSnapshot = await get(usernameCheckRef);
                
                if (usernameSnapshot.exists()) {
                    const usernames = usernameSnapshot.val();
                    // Case insensitive check by normalizing to lowercase
                    if (usernames[username]) {
                        // Highlight the username field with red border
                        usernameInput.classList.add('border-red-500');
                        
                        // Display prominent error message
                        errorMessage.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 mr-2"></i><strong>Username already taken!</strong> Please choose a different username.';
                        errorMessage.classList.remove('hidden');
                        errorMessage.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700', 'px-4', 'py-3', 'rounded', 'relative');
                        
                        // Focus back on the username field
                        usernameInput.focus();
                        return;
                    }
                }
                
                // Create user in Firebase Auth first
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                try {
                    // Double-check username availability (in case of race condition)
                    const latestSnapshot = await get(usernameCheckRef);
                    if (latestSnapshot.exists() && latestSnapshot.val()[username]) {
                        // Username was taken in the milliseconds between our checks
                        await deleteUser(user);
                        
                        errorMessage.textContent = 'Username was just taken. Please choose another one.';
                        errorMessage.classList.remove('hidden');
                        return;
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
