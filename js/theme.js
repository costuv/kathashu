// Theme toggle functionality with improved performance and accessibility
const initThemeToggle = () => {
    const themeToggle = document.getElementById('theme-toggle');
    
    // Check for OS-level preference first, then saved preference
    const getPreferredTheme = () => {
        // Check if theme was previously saved to localStorage
        if (localStorage.getItem('theme')) {
            return localStorage.getItem('theme');
        }
        
        // If not in localStorage, check system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    
    // Apply theme to document
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Save to localStorage for persistence
        localStorage.setItem('theme', theme);
        
        // Update toggle button aria-label for accessibility
        if (themeToggle) {
            themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        }
        
        // Update toggle icon
        updateToggleIcon(theme);
    };
    
    // Update icon based on current theme
    const updateToggleIcon = (theme) => {
        if (!themeToggle) return;
        
        themeToggle.innerHTML = '';
        
        const icon = document.createElement('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        icon.setAttribute('aria-hidden', 'true');
        themeToggle.appendChild(icon);
    };
    
    // Apply theme on initial load
    const currentTheme = getPreferredTheme();
    applyTheme(currentTheme);
    
    // Listen for OS theme change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            // Only auto-update if user hasn't set a preference
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
    
    // Toggle theme on button click
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(theme);
        });
    }
};

// Run initialization once DOM is fully loaded
document.addEventListener('DOMContentLoaded', initThemeToggle);

// Export in case needed elsewhere
export { initThemeToggle };
