document.addEventListener('DOMContentLoaded', function() {
    // Get menu elements
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    // Get user elements for syncing between desktop and mobile
    const userMenu = document.getElementById('user-menu');
    const mobileUserMenu = document.getElementById('mobile-user-menu');
    const authLinks = document.getElementById('auth-links');
    const mobileAuthLinks = document.getElementById('mobile-auth-links');
    const adminLink = document.getElementById('admin-link');
    const mobileAdminLink = document.getElementById('mobile-admin-link');
    const usernameDisplay = document.getElementById('username-display');
    const mobileUsernameDisplay = document.getElementById('mobile-username-display');
    
    // Sync theme toggle between desktop and mobile
    const themeToggle = document.getElementById('theme-toggle');
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
    const mobileThemeText = document.getElementById('mobile-theme-text');
    
    // Toggle mobile menu
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
            
            // Toggle between hamburger and X icon
            const menuIcon = mobileMenuButton.querySelector('i');
            if (menuIcon) {
                if (menuIcon.classList.contains('fa-bars')) {
                    menuIcon.classList.remove('fa-bars');
                    menuIcon.classList.add('fa-times');
                } else {
                    menuIcon.classList.remove('fa-times');
                    menuIcon.classList.add('fa-bars');
                }
            }
            
            // Force sync menu state whenever mobile menu is opened
            syncMenuState();
        });
    }
    
    // Sync auth state between desktop and mobile menus
    function syncMenuState() {
        // If user is logged in (user menu is visible)
        if (userMenu && !userMenu.classList.contains('hidden')) {
            // Hide auth links on mobile
            if (mobileAuthLinks) mobileAuthLinks.classList.add('hidden');
            // Show user menu on mobile
            if (mobileUserMenu) mobileUserMenu.classList.remove('hidden');
            // Copy username to mobile
            if (usernameDisplay && mobileUsernameDisplay) {
                mobileUsernameDisplay.textContent = usernameDisplay.textContent;
            }
            // Sync admin link visibility
            if (adminLink && mobileAdminLink) {
                if (!adminLink.classList.contains('hidden')) {
                    mobileAdminLink.classList.remove('hidden');
                } else {
                    mobileAdminLink.classList.add('hidden');
                }
            }
            
            // Show create story links if they exist
            const createStoryLink = document.getElementById('create-story-link');
            const mobileCreateStoryLink = document.getElementById('mobile-create-story-link');
            
            if (createStoryLink) createStoryLink.classList.remove('hidden');
            if (mobileCreateStoryLink) mobileCreateStoryLink.classList.remove('hidden');
        } else {
            // User is not logged in
            if (mobileAuthLinks) mobileAuthLinks.classList.remove('hidden');
            if (mobileUserMenu) mobileUserMenu.classList.add('hidden');
            
            // Hide create story links if they exist
            const createStoryLink = document.getElementById('create-story-link');
            const mobileCreateStoryLink = document.getElementById('mobile-create-story-link');
            
            if (createStoryLink) createStoryLink.classList.add('hidden');
            if (mobileCreateStoryLink) mobileCreateStoryLink.classList.add('hidden');
        }
    }
    
    // Initial sync (with delay to ensure auth state is established)
    setTimeout(syncMenuState, 500);
    
    // Sync when authentication state changes
    document.addEventListener('authStateChanged', function(event) {
        console.log('Auth state changed, updating mobile menu');
        syncMenuState();
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (mobileMenu && !mobileMenu.classList.contains('hidden') && 
            !mobileMenu.contains(event.target) && 
            !mobileMenuButton.contains(event.target)) {
            mobileMenu.classList.add('hidden');
            // Reset hamburger icon
            const menuIcon = mobileMenuButton.querySelector('i');
            if (menuIcon) {
                menuIcon.classList.remove('fa-times');
                menuIcon.classList.add('fa-bars');
            }
        }
    });
    
    // Handle mobile theme toggle
    if (mobileThemeToggle && themeToggle) {
        mobileThemeToggle.addEventListener('click', function() {
            // Trigger the main theme toggle click event
            themeToggle.click();
            // Update mobile theme text based on current theme
            const isDarkMode = document.documentElement.classList.contains('dark');
            mobileThemeText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
            
            // Update icon
            const themeIcon = mobileThemeToggle.querySelector('i');
            if (themeIcon) {
                if (isDarkMode) {
                    themeIcon.classList.remove('fa-moon');
                    themeIcon.classList.add('fa-sun');
                } else {
                    themeIcon.classList.remove('fa-sun');
                    themeIcon.classList.add('fa-moon');
                }
            }
        });
        
        // Initial state of mobile theme toggle based on current theme
        const isDarkMode = document.documentElement.classList.contains('dark');
        mobileThemeText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
        const themeIcon = mobileThemeToggle.querySelector('i');
        if (themeIcon && isDarkMode) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    }
});
