import { auth, db, rtdb } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    updateDoc, 
    increment 
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { 
    ref, 
    get, 
    update, 
    onValue, 
    increment as rtdbIncrement,
    push,
    set,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

// Initialize story page
const initStoryPage = () => {
    // Get story ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const storyId = urlParams.get('id');
    
    // UI elements
    const storyLoading = document.getElementById('story-loading');
    const storyError = document.getElementById('story-error');
    const storyContainer = document.getElementById('story-container');
    const storyTitle = document.getElementById('story-title');
    const storyAuthor = document.getElementById('story-author');
    const storyDate = document.getElementById('story-date');
    const storyTags = document.getElementById('story-tags');
    const storyCoverContainer = document.getElementById('story-cover-container');
    const storyCover = document.getElementById('story-cover');
    const storyContent = document.getElementById('story-content');
    const likeButton = document.getElementById('like-button');
    const likeCount = document.getElementById('like-count');
    const viewCount = document.getElementById('view-count');
    
    // Comment section elements
    const commentForm = document.getElementById('comment-form');
    const commentFormContainer = document.getElementById('comment-form-container');
    const loginToComment = document.getElementById('login-to-comment');
    const commentsLoading = document.getElementById('comments-loading');
    const commentsList = document.getElementById('comments-list');
    const noComments = document.getElementById('no-comments');
    const commentTemplate = document.getElementById('comment-template');
    const replyFormTemplate = document.getElementById('reply-form-template');
    
    // Current user data (for comment management)
    let currentUser = null;
    let currentStory = null;
    
    // Check if we have a valid story ID
    if (!storyId) {
        showError('Story ID is missing. Please return to the homepage and try again.');
        return;
    }
    
    // Handle authentication state
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        // Load story data regardless of auth state
        loadStory(storyId, user);
        
        // Setup like button if user is logged in
        if (user && likeButton) {
            setupLikeButton(storyId, user.uid);
        }
        
        // Setup comment form based on auth state
        setupCommentForm(user);
        
        // Load comments
        loadComments(storyId);
    });
    
    // Load story data
    const loadStory = async (storyId, currentUser) => {
        try {
            // Try to get from Realtime Database first
            const storyRef = ref(rtdb, `stories/${storyId}`);
            const snapshot = await get(storyRef);
            
            if (snapshot.exists()) {
                // Story found in RTDB
                const story = snapshot.val();
                renderStory(story);
                incrementViewCount(storyId, 'rtdb');
                
                // Get author data
                if (story.authorId) {
                    loadAuthorData(story.authorId);
                }
            } else {
                // Try Firestore as fallback
                try {
                    const docRef = doc(db, "stories", storyId);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const story = docSnap.data();
                        renderStory(story);
                        incrementViewCount(storyId, 'firestore');
                        
                        // Get author data
                        if (story.authorId) {
                            loadAuthorData(story.authorId);
                        }
                    } else {
                        showError('Story not found. It may have been removed or is not available.');
                    }
                } catch (firestoreError) {
                    console.error("Error loading from Firestore:", firestoreError);
                    showError('Failed to load the story. Please try again later.');
                }
            }
        } catch (error) {
            console.error("Error loading story:", error);
            showError('Failed to load the story. Please try again later.');
        }
    };
    
    // Render story data
    const renderStory = (story) => {
        // Hide loading, show content
        storyLoading.classList.add('hidden');
        storyContainer.classList.remove('hidden');
        
        // Set story metadata
        document.title = `${story.title} - Kathashu`;
        storyTitle.textContent = story.title || 'Untitled Story';
        
        // Format and set story date
        const storyDateTime = story.createdAt ? 
            (typeof story.createdAt === 'string' ? 
                new Date(story.createdAt) : 
                new Date(story.createdAt.toDate())) 
            : new Date();
        
        storyDate.textContent = storyDateTime.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Set story tags
        storyTags.innerHTML = '';
        if (story.tags && story.tags.length > 0) {
            story.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm';
                tagElement.textContent = tag;
                storyTags.appendChild(tagElement);
            });
        }
        
        // Enhance content rendering with responsive images and proper heading structure
        storyContent.innerHTML = formatContent(story.content || '');
        
        // For responsive images within the content
        const images = storyContent.querySelectorAll('img');
        images.forEach(img => {
            img.classList.add('max-w-full', 'h-auto', 'mx-auto', 'my-4', 'rounded-lg');
            // Add loading attribute for better performance
            img.loading = 'lazy';
            // Add proper alt text if missing
            if (!img.alt) img.alt = 'Story image';
        });
        
        // Set like/view counts with added share button
        likeCount.textContent = story.likes || 0;
        viewCount.textContent = story.views || 0;
        
        // Add share button next to view count
        const viewCountContainer = viewCount.parentElement;
        if (viewCountContainer) {
            // Create share button
            const shareButton = document.createElement('span');
            shareButton.className = 'ml-4 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400';
            shareButton.innerHTML = '<i class="fas fa-share-alt mr-1"></i> Share';
            
            // Add share functionality
            shareButton.addEventListener('click', () => {
                showSharePopup(story.title);
            });
            
            // Append to the container
            viewCountContainer.appendChild(shareButton);
        }
    };
    
    // Improve content formatting with better structure
    const formatContent = (content) => {
        // First, escape any HTML to prevent XSS
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Then format with improved paragraph handling
        return escaped
            .split('\n\n')
            .filter(para => para.trim() !== '')
            .map(para => {
                // Check if paragraph starts with # for headings
                if (para.startsWith('# ')) {
                    return `<h2 class="text-2xl font-bold mt-6 mb-4">${para.substring(2)}</h2>`;
                } else if (para.startsWith('## ')) {
                    return `<h3 class="text-xl font-bold mt-5 mb-3">${para.substring(3)}</h3>`;
                } else {
                    // Regular paragraph with line break handling
                    return `<p class="mb-4 leading-relaxed">${para.replace(/\n/g, '<br>')}</p>`;
                }
            })
            .join('');
    };
    
    // Load author data with improved public access and admin detection
    const loadAuthorData = async (authorId) => {
        try {
            // First check if we have this in cache
            if (window.usernameCache && window.usernameCache[authorId]) {
                storyAuthor.textContent = window.usernameCache[authorId];
                
                // Add admin badge if we know this user is an admin (from cache)
                if (window.adminCache && window.adminCache[authorId]) {
                    const badge = document.createElement('span');
                    badge.className = 'admin-badge relative';
                    badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                    storyAuthor.appendChild(badge);
                }
                return;
            }
            
            // Try to get username from usernames collection first (publicly accessible)
            try {
                const usernamesRef = ref(rtdb, 'usernames');
                const snapshot = await get(usernamesRef);
                
                if (snapshot.exists()) {
                    // Search for the username that maps to this authorId
                    const usernames = snapshot.val();
                    for (const [username, uid] of Object.entries(usernames)) {
                        if (uid === authorId) {
                            storyAuthor.textContent = username;
                            
                            // Cache for future use
                            if (!window.usernameCache) window.usernameCache = {};
                            window.usernameCache[authorId] = username;
                            return;
                        }
                    }
                }
            } catch (err) {
                // Silent fail, continue to next method
            }
            
            // Before falling back, check if this is an admin user (in a public way)
            try {
                const adminRef = ref(rtdb, 'admin-users');
                const adminSnapshot = await get(adminRef);
                
                if (adminSnapshot.exists()) {
                    const adminUsers = adminSnapshot.val();
                    // If admin list exists and this user is in it
                    if (adminUsers && adminUsers[authorId]) {
                        // Store in cache for future reference
                        if (!window.adminCache) window.adminCache = {};
                        window.adminCache[authorId] = true;
                        
                        // If we already found a username (from previous steps), add badge
                        if (storyAuthor.textContent && storyAuthor.textContent !== 'Author') {
                            const badge = document.createElement('span');
                            badge.className = 'admin-badge relative';
                            badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                            storyAuthor.appendChild(badge);
                            return;
                        }
                    }
                }
            } catch (err) {
                // Silent fail
            }
            
            // Fallback to users collection if needed
            const userRef = ref(rtdb, `users/${authorId}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const username = userData.username || userData.email?.split('@')[0] || 'Author';
                storyAuthor.textContent = username;
                
                // Cache for future use
                if (!window.usernameCache) window.usernameCache = {};
                window.usernameCache[authorId] = username;
            } else {
                storyAuthor.textContent = 'Author';
            }
        } catch (error) {
            console.error("Error loading author data:", error);
            storyAuthor.textContent = 'Author'; // Fallback to generic "Author" instead of "Anonymous"
        }
    };
    
    // Increment view count with silent failure
    const incrementViewCount = async (storyId, dbType) => {
        try {
            if (dbType === 'rtdb') {
                // Update view count in RTDB
                await update(ref(rtdb, `stories/${storyId}`), {
                    views: rtdbIncrement(1)
                });
            } else {
                // Update view count in Firestore
                await updateDoc(doc(db, "stories", storyId), {
                    views: increment(1)
                });
            }
        } catch (error) {
            console.error("Error incrementing view count:", error);
            // Silent failure - don't alert the user
            // Just keep the current view count displayed
        }
    };
    
    // Setup like button functionality
    const setupLikeButton = (storyId, userId) => {
        // Check if user has already liked this story
        checkUserLike(storyId, userId);
        
        // Add click handler for like button
        likeButton.addEventListener('click', async () => {
            if (!userId) {
                // Redirect to login if not logged in
                window.location.href = 'login.html';
                return;
            }
            
            try {
                // Check current like status from User-Likes DB
                const userLikeRef = ref(rtdb, `user-likes/${userId}/${storyId}`);
                const snapshot = await get(userLikeRef);
                const hasLiked = snapshot.exists() && snapshot.val() === true;
                
                const currentLikes = parseInt(likeCount.textContent) || 0;
                
                if (hasLiked) {
                    // User has already liked, remove like - update UI first (optimistic)
                    likeButton.innerHTML = `<i class="far fa-heart"></i> <span id="like-count">${currentLikes - 1}</span>`;
                    likeCount.textContent = (currentLikes - 1).toString();
                    
                    try {
                        // First, remove the user-like record
                        await set(ref(rtdb, `user-likes/${userId}/${storyId}`), null);
                        
                        // Then decrement the story like count - FIXED PATH CONSTRUCTION
                        await update(ref(rtdb, `stories/${storyId}`), { likes: rtdbIncrement(-1) });
                    } catch (updateError) {
                        // If database update fails, revert the UI
                        console.error("Error removing like:", updateError);
                        likeButton.innerHTML = `<i class="fas fa-heart text-red-600 dark:text-red-400"></i> <span id="like-count">${currentLikes}</span>`;
                        likeCount.textContent = currentLikes.toString();
                    }
                } else {
                    // User hasn't liked, add like - update UI first (optimistic)
                    likeButton.innerHTML = `<i class="fas fa-heart text-red-600 dark:text-red-400"></i> <span id="like-count">${currentLikes + 1}</span>`;
                    likeCount.textContent = (currentLikes + 1).toString();
                    
                    try {
                        // First, set the user-like record
                        await set(ref(rtdb, `user-likes/${userId}/${storyId}`), true);
                        
                        // Then increment the story like count - FIXED PATH CONSTRUCTION
                        await update(ref(rtdb, `stories/${storyId}`), { likes: rtdbIncrement(1) });
                    } catch (updateError) {
                        // If database update fails, revert the UI
                        console.error("Error adding like:", updateError);
                        likeButton.innerHTML = `<i class="far fa-heart"></i> <span id="like-count">${currentLikes}</span>`;
                        likeCount.textContent = currentLikes.toString();
                    }
                }
            } catch (error) {
                console.error("Error updating like:", error);
                // Silent UI feedback
                const currentText = likeButton.innerHTML;
                likeButton.classList.add('text-red-500');
                setTimeout(() => {
                    likeButton.classList.remove('text-red-500');
                }, 1000);
            }
        });
    };
    
    // Check if user has already liked the story - matching comment like system
    const checkUserLike = async (storyId, userId) => {
        if (!userId || !storyId) return;
        
        try {
            const userLikeRef = ref(rtdb, `user-likes/${userId}/${storyId}`);
            const snapshot = await get(userLikeRef);
            
            if (snapshot.exists() && snapshot.val() === true) {
                // User has liked this story
                likeButton.innerHTML = `<i class="fas fa-heart text-red-600 dark:text-red-400"></i> <span id="like-count">${likeCount.textContent}</span>`;
            }
        } catch (error) {
            console.error("Error checking user like:", error);
            // Silent fail - don't disrupt the user experience
        }
    };
    
    // Setup comment form visibility
    const setupCommentForm = (user) => {
        if (!commentForm || !loginToComment) return;
        
        if (user) {
            // User is logged in, show comment form
            commentForm.classList.remove('hidden');
            loginToComment.classList.add('hidden');
            
            // Setup comment form submission
            commentForm.addEventListener('submit', handleCommentSubmit);
        } else {
            // User is not logged in, show login prompt
            commentForm.classList.add('hidden');
            loginToComment.classList.remove('hidden');
        }
    };
    
    // Handle comment submission
    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentUser) return;
        
        const commentContent = document.getElementById('comment-content');
        const content = commentContent.value.trim();
        
        if (!content) return;
        
        try {
            // Get all usernames for mention validation
            const usernames = await getUsernames();
            
            // Prepare comment data
            const commentData = {
                content,
                authorId: currentUser.uid,
                storyId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                likes: 0,
                parentId: null, // null means it's a top-level comment
                mentions: extractMentions(content, usernames)
            };
            
            // Save to Realtime Database
            const newCommentRef = push(ref(rtdb, "comments"));
            const commentId = newCommentRef.key;
            
            // Add ID to data
            commentData.id = commentId;
            
            // Save comment
            await set(newCommentRef, commentData);
            
            // Clear the comment form
            commentContent.value = '';
            
            // Add the comment to the list
            await loadComments(storyId);
            
        } catch (error) {
            console.error("Error posting comment:", error);
            alert("Failed to post comment. Please try again.");
        }
    };
    
    // Get all usernames from the database for mention validation
    const getUsernames = async () => {
        try {
            const usernamesRef = ref(rtdb, 'usernames');
            const snapshot = await get(usernamesRef);
            if (snapshot.exists()) {
                return Object.keys(snapshot.val());
            }
            return [];
        } catch (error) {
            console.error("Error loading usernames:", error);
            return [];
        }
    };
    
    // Extract valid mentions from comment content
    const extractMentions = (content, usernames) => {
        if (!content || !usernames || !usernames.length) return [];
        
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(content)) !== null) {
            const username = match[1];
            if (usernames.includes(username) && !mentions.includes(username)) {
                mentions.push(username);
            }
        }
        
        return mentions;
    };
    
    // Load all comments for the story
    const loadComments = async (storyId) => {
        if (!commentsList || !commentsLoading || !noComments) return;
        
        // Show loading state
        commentsLoading.classList.remove('hidden');
        noComments.classList.add('hidden');
        
        // Clear existing comments (except loading state)
        const existingComments = commentsList.querySelectorAll('.comment');
        existingComments.forEach(comment => {
            if (comment !== commentsLoading && comment !== noComments) {
                comment.remove();
            }
        });
        
        try {
            // Get all comments for this story
            const commentsRef = ref(rtdb, "comments");
            const commentsQuery = query(commentsRef, orderByChild("storyId"), equalTo(storyId));
            const snapshot = await get(commentsQuery);
            
            // Hide loading state
            commentsLoading.classList.add('hidden');
            
            if (!snapshot.exists()) {
                // No comments
                noComments.classList.remove('hidden');
                return;
            }
            
            // Convert to array and organize by parent/child relationship
            const comments = [];
            const repliesMap = {};
            
            snapshot.forEach((childSnapshot) => {
                const comment = childSnapshot.val();
                
                if (!comment.parentId) {
                    // This is a top-level comment
                    comments.push(comment);
                } else {
                    // This is a reply - ensure we only show direct replies to comments (not replies to replies)
                    const parent = snapshot.child(comment.parentId).val();
                    
                    // Only add this as a reply if its parent doesn't have a parentId (i.e., parent is a top-level comment)
                    if (parent && !parent.parentId) {
                        if (!repliesMap[comment.parentId]) {
                            repliesMap[comment.parentId] = [];
                        }
                        repliesMap[comment.parentId].push(comment);
                    } else {
                        // If trying to reply to a reply, convert it to a top-level comment
                        // (this handles any existing nested replies in the database)
                        const convertedComment = {...comment};
                        delete convertedComment.parentId;
                        comments.push(convertedComment);
                    }
                }
            });
            
            // Sort comments by date (newest first)
            comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // If no top-level comments
            if (comments.length === 0) {
                noComments.classList.remove('hidden');
                return;
            }
            
            // Display all top-level comments
            for (const comment of comments) {
                const replies = repliesMap[comment.id] || [];
                replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
                renderComment(comment, replies);
            }
            
        } catch (error) {
            console.error("Error loading comments:", error);
            commentsLoading.classList.add('hidden');
            
            // Show user-friendly error message with database rules instructions if it's a permission error
            if (error.message && error.message.includes('Permission denied')) {
                const errorElement = document.createElement('div');
                errorElement.className = 'p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-lg';
                errorElement.innerHTML = `
                    <p class="mb-3"><strong>Database permissions need to be updated:</strong> 
                    Please update your Firebase Realtime Database rules to include comment permissions.</p>
                    <div class="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                    <pre>
{
  "rules": {
    // ...your existing rules...
    "comments": {
      ".read": "auth != null || true",
      ".write": "auth != null",
      ".indexOn": ["storyId", "parentId"]
    },
    "comment-likes": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
</pre>
                    </div>
                `;
                commentsList.appendChild(errorElement);
            } else {
                // Generic error message
                const errorElement = document.createElement('div');
                errorElement.className = 'p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-center';
                errorElement.textContent = 'Failed to load comments. Please try again later.';
                commentsList.appendChild(errorElement);
            }
        }
    };
    
    // Render a single comment with its replies
    const renderComment = async (comment, replies = []) => {
        if (!commentTemplate || !commentsList) return;
        
        // Clone the template
        const commentElement = commentTemplate.content.cloneNode(true).querySelector('.comment');
        
        // Set comment data
        commentElement.dataset.id = comment.id;
        
        // Process content for @mentions before displaying
        const processedContent = processContentForMentions(comment.content);
        commentElement.querySelector('.comment-content').innerHTML = processedContent;
        
        commentElement.querySelector('.comment-like-count').textContent = comment.likes || 0;
        
        // Format date
        const commentDate = new Date(comment.createdAt);
        commentElement.querySelector('.comment-date').textContent = formatRelativeTime(commentDate);
        
        // Set author info with improved function
        const authorElement = commentElement.querySelector('.comment-author');
        if (authorElement) {
            await renderCommentAuthor(comment.authorId, authorElement);
        }
        
        // Add event listeners for comment actions
        setupCommentActions(commentElement, comment);
        
        // Add replies
        const repliesContainer = commentElement.querySelector('.replies');
        for (const reply of replies) {
            await renderReply(reply, repliesContainer);
        }
        
        // Add to the comments list
        commentsList.appendChild(commentElement);
    };
    
    // Process content to highlight @mentions
    const processContentForMentions = (content) => {
        if (!content) return '';
        
        // Escape HTML to prevent XSS
        const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Regex to find @username mentions (alphanumeric and underscore only)
        const mentionRegex = /@(\w+)/g;
        
        // Replace @mentions with styled spans
        return escapedContent.replace(mentionRegex, 
            '<span class="text-blue-600 dark:text-blue-400 font-medium">@$1</span>');
    };
    
    // Render a reply
    const renderReply = async (reply, container) => {
        // Similar to renderComment but with some styling differences
        if (!commentTemplate || !container) return;
        
        // Clone the template
        const replyElement = commentTemplate.content.cloneNode(true).querySelector('.comment');
        if (!replyElement) return; // Safety check
        
        // Modify for reply styling
        replyElement.classList.add('is-reply', 'border-l-4', 'border-gray-200', 'dark:border-gray-700', 'pl-2');
        replyElement.dataset.id = reply.id;
        replyElement.dataset.parentId = reply.parentId;
        
        // Process content for @mentions
        const contentElement = replyElement.querySelector('.comment-content');
        if (contentElement) {
            const processedContent = processContentForMentions(reply.content);
            contentElement.innerHTML = processedContent;
        }
        
        // Set like count
        const likeCountElement = replyElement.querySelector('.comment-like-count');
        if (likeCountElement) {
            likeCountElement.textContent = reply.likes || 0;
        }
        
        // Format date
        const dateElement = replyElement.querySelector('.comment-date');
        if (dateElement) {
            const replyDate = new Date(reply.createdAt);
            dateElement.textContent = formatRelativeTime(replyDate);
        }
        
        // Set author info with improved function
        const authorElement = replyElement.querySelector('.comment-author');
        if (authorElement) {
            await renderCommentAuthor(reply.authorId, authorElement);
        }
        
        // Remove the replies container from replies - with null check
        const repliesContainer = replyElement.querySelector('.replies');
        if (repliesContainer) {
            repliesContainer.remove();
        }
        
        // For clarity, update or remove the reply button
        const replyButton = replyElement.querySelector('.reply-button');
        if (replyButton) {
            // Option 2: Disable and style differently
            replyButton.innerHTML = '<i class="fas fa-reply mr-1"></i> Reply';
            replyButton.classList.add('opacity-50', 'cursor-not-allowed');
            replyButton.setAttribute('title', 'Cannot reply to replies');
            
            // Replace the event listener to prevent errors
            replyButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Visual feedback
                replyButton.classList.add('text-red-500', 'dark:text-red-400');
                replyButton.innerHTML = '<i class="fas fa-ban mr-1"></i> Nested replies not allowed';
                
                // Reset after 3 seconds
                setTimeout(() => {
                    replyButton.classList.remove('text-red-500', 'dark:text-red-400');
                    replyButton.innerHTML = '<i class="fas fa-reply mr-1"></i> Reply';
                }, 3000);
            };
        }
        
        // Add event listeners for reply actions (with careful null checking)
        setupCommentActions(replyElement, reply);
        
        // Add to the container
        container.appendChild(replyElement);
        return replyElement; // Return the created element for reference
    };
    
    // Setup event listeners for comment actions (like, reply, edit, delete)
    const setupCommentActions = (commentElement, commentData) => {
        if (!commentElement) return;
        
        // Get all action elements with null checking
        const menuButton = commentElement.querySelector('.comment-menu-button');
        const menu = commentElement.querySelector('.comment-menu');
        const likeButton = commentElement.querySelector('.comment-like-button');
        const replyButton = commentElement.querySelector('.reply-button');
        const editButton = menu ? menu.querySelector('.edit-comment-btn') : null;
        const deleteButton = menu ? menu.querySelector('.delete-comment-btn') : null;
        
        // Show/hide the edit/delete menu based on ownership
        if (currentUser && commentData.authorId === currentUser.uid && menuButton && menu) {
            menuButton.classList.remove('hidden');
            
            // Toggle menu
            menuButton.addEventListener('click', () => {
                menu.classList.toggle('hidden');
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (menu && !menuButton.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
            
            // Edit comment
            if (editButton) {
                editButton.addEventListener('click', () => {
                    handleEditComment(commentElement, commentData);
                    menu.classList.add('hidden');
                });
            }
            
            // Delete comment
            if (deleteButton) {
                deleteButton.addEventListener('click', () => {
                    handleDeleteComment(commentElement, commentData);
                    menu.classList.add('hidden');
                });
            }
        } else if (menuButton) {
            menuButton.classList.add('hidden');
        }
        
        // Like functionality
        if (likeButton) {
            likeButton.addEventListener('click', () => {
                handleCommentLike(commentElement, commentData);
            });
        }
        
        // Reply functionality
        if (replyButton) {
            replyButton.addEventListener('click', () => {
                handleReplyComment(commentElement, commentData);
            });
        }
        
        // Check if current user has liked this comment
        if (currentUser && likeButton) {
            checkCommentLike(commentElement, commentData, currentUser.uid);
        }
    };
    
    // Handle comment like action
    const handleCommentLike = async (commentElement, commentData) => {
        if (!currentUser) {
            // Redirect to login if not logged in
            window.location.href = 'login.html';
            return;
        }
        
        try {
            const commentId = commentData.id;
            const userId = currentUser.uid;
            
            // Check if user has already liked this comment
            const userLikeRef = ref(rtdb, `comment-likes/${userId}/${commentId}`);
            const snapshot = await get(userLikeRef);
            const likeButton = commentElement.querySelector('.comment-like-button');
            const likeCount = commentElement.querySelector('.comment-like-count');
            
            if (snapshot.exists() && snapshot.val() === true) {
                // User has already liked, remove like
                await update(ref(rtdb, `comment-likes/${userId}`), { [commentId]: null });
                await update(ref(rtdb, `comments/${commentId}`), { likes: (commentData.likes || 0) - 1 });
                
                // Update UI
                likeButton.innerHTML = `<i class="far fa-thumbs-up"></i> <span class="comment-like-count text-xs">${(commentData.likes || 0) - 1}</span>`;
                commentData.likes = (commentData.likes || 0) - 1;
            } else {
                // User hasn't liked, add like
                await update(ref(rtdb, `comment-likes/${userId}`), { [commentId]: true });
                await update(ref(rtdb, `comments/${commentId}`), { likes: (commentData.likes || 0) + 1 });
                
                // Update UI
                likeButton.innerHTML = `<i class="fas fa-thumbs-up text-blue-600 dark:text-blue-400"></i> <span class="comment-like-count text-xs">${(commentData.likes || 0) + 1}</span>`;
                commentData.likes = (commentData.likes || 0) + 1;
            }
        } catch (error) {
            console.error("Error liking comment:", error);
        }
    };
    
    // Check if user has already liked a comment
    const checkCommentLike = async (commentElement, commentData, userId) => {
        try {
            const commentId = commentData.id;
            const userLikeRef = ref(rtdb, `comment-likes/${userId}/${commentId}`);
            const snapshot = await get(userLikeRef);
            
            if (snapshot.exists() && snapshot.val() === true) {
                // User has liked this comment
                const likeButton = commentElement.querySelector('.comment-like-button');
                likeButton.innerHTML = `<i class="fas fa-thumbs-up text-blue-600 dark:text-blue-400"></i> <span class="comment-like-count text-xs">${commentData.likes || 0}</span>`;
            }
        } catch (error) {
            console.error("Error checking user like:", error);
            // Don't show error to user - just gracefully handle the failure
            // This means the user won't see their like state, but can still like the comment
        }
    };
    
    // Handle reply to comment
    const handleReplyComment = (commentElement, commentData) => {
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check if this is already a reply (has a parentId)
        if (commentData.parentId) {
            // Show feedback to the user
            const replyButton = commentElement.querySelector('.reply-button');
            
            // Visual feedback with animation
            replyButton.classList.add('text-red-500', 'dark:text-red-400');
            replyButton.innerHTML = '<i class="fas fa-ban mr-1"></i> Cannot reply to replies';
            
            // Reset after 3 seconds
            setTimeout(() => {
                replyButton.classList.remove('text-red-500', 'dark:text-red-400');
                replyButton.innerHTML = 'Reply';
            }, 3000);
            
            return;
        }
        
        // Hide any existing reply forms
        document.querySelectorAll('.reply-form').forEach(form => {
            form.remove();
        });
        
        // Clone the reply form template
        const replyFormElement = replyFormTemplate.content.cloneNode(true).querySelector('.reply-form');
        
        // Find where to insert the form
        const insertTarget = commentElement.querySelector('.replies');
        insertTarget.prepend(replyFormElement);
        
        // Focus the textarea
        const textarea = replyFormElement.querySelector('.reply-content');
        textarea.focus();
        
        // Handle form submission
        replyFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const content = textarea.value.trim();
            if (!content) return;
            
            try {
                // Prepare reply data
                const replyData = {
                    content,
                    authorId: currentUser.uid,
                    storyId,
                    parentId: commentData.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    likes: 0,
                    isReply: true // Flag to explicitly mark this as a reply
                };
                
                // Save to Realtime Database
                const newReplyRef = push(ref(rtdb, "comments"));
                const replyId = newReplyRef.key;
                
                // Add ID to data
                replyData.id = replyId;
                
                // Save reply
                await set(newReplyRef, replyData);
                
                // Remove the form
                replyFormElement.remove();
                
                // Render the new reply
                await renderReply(replyData, insertTarget);
                
            } catch (error) {
                console.error("Error posting reply:", error);
                alert("Failed to post reply. Please try again.");
            }
        });
        
        // Handle cancel button
        const cancelButton = replyFormElement.querySelector('.cancel-reply');
        cancelButton.addEventListener('click', () => {
            replyFormElement.remove();
        });
    };
    
    // Handle edit comment
    const handleEditComment = (commentElement, commentData) => {
        // Only allow editing your own comments
        if (!currentUser || !commentElement || currentUser.uid !== commentData.authorId) return;
        
        const commentContent = commentElement.querySelector('.comment-content');
        const editFormContainer = commentElement.querySelector('.edit-form-container');
        
        if (!commentContent || !editFormContainer) return;
        
        const editContentTextarea = editFormContainer.querySelector('.edit-comment-content');
        const cancelEditButton = editFormContainer.querySelector('.cancel-edit');
        const saveEditButton = editFormContainer.querySelector('.save-edit');
        
        if (!editContentTextarea || !cancelEditButton || !saveEditButton) return;
        
        // Show edit form
        commentContent.classList.add('hidden');
        editFormContainer.classList.remove('hidden');
        
        // Set existing content
        editContentTextarea.value = commentData.content || '';
        editContentTextarea.focus();
        
        // Remove any existing event listeners
        const newCancelButton = cancelEditButton.cloneNode(true);
        cancelEditButton.parentNode.replaceChild(newCancelButton, cancelEditButton);
        
        const newSaveButton = saveEditButton.cloneNode(true);
        saveEditButton.parentNode.replaceChild(newSaveButton, saveEditButton);
        
        // Handle cancel edit
        newCancelButton.addEventListener('click', () => {
            commentContent.classList.remove('hidden');
            editFormContainer.classList.add('hidden');
        });
        
        // Handle save edit
        newSaveButton.addEventListener('click', async () => {
            const newContent = editContentTextarea.value.trim();
            
            if (!newContent) return;
            
            try {
                // Update in database
                await update(ref(rtdb, `comments/${commentData.id}`), {
                    content: newContent,
                    updatedAt: new Date().toISOString()
                });
                
                // Update in UI
                commentContent.innerHTML = processContentForMentions(newContent);
                commentData.content = newContent;
                
                // Hide edit form
                commentContent.classList.remove('hidden');
                editFormContainer.classList.add('hidden');
                
            } catch (error) {
                console.error("Error updating comment:", error);
                alert("Failed to update comment. Please try again.");
            }
        });
    };
    
    // Handle delete comment
    const handleDeleteComment = async (commentElement, commentData) => {
        // Only allow deleting your own comments
        if (!currentUser || currentUser.uid !== commentData.authorId) return;
        
        if (!confirm('Are you sure you want to delete this comment?')) return;
        
        try {
            // Delete from database
            await set(ref(rtdb, `comments/${commentData.id}`), null);
            
            // Remove from UI
            commentElement.remove();
            
            // Check if we need to show the "no comments" message
            const remainingComments = commentsList.querySelectorAll('.comment');
            if (remainingComments.length === 2) { // Loading and "no comments" elements
                noComments.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error deleting comment:", error);
            alert("Failed to delete comment. Please try again.");
        }
    };
    
    // Format relative time for comments
    const formatRelativeTime = (date) => {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // difference in seconds
        
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
        
        // Fall back to regular date format for older dates
        return date.toLocaleDateString();
    };
    
    // Show error message
    const showError = (message) => {
        storyLoading.classList.add('hidden');
        storyError.classList.remove('hidden');
        storyError.textContent = message;
    };

    // Initialize username cache for better performance
    window.usernameCache = {};
    window.adminCache = {};
    
    // Preload all usernames for better performance
    const preloadAllUserData = async () => {
        try {
            // Initialize cache from localStorage first for immediate availability
            try {
                const cachedData = localStorage.getItem('usernameCache');
                if (cachedData) {
                    window.usernameCache = JSON.parse(cachedData) || {};
                }
            } catch (err) {
                console.log("Could not load from localStorage");
                window.usernameCache = {};
            }
            
            // Try to get from Firestore or RTDB, but don't block if permission denied
            try {
                // Load public usernames if possible (permissions may prevent this)
                const publicUsernamesRef = ref(rtdb, 'public-usernames');
                const publicSnapshot = await get(publicUsernamesRef);
                
                if (publicSnapshot.exists()) {
                    const publicUsernames = publicSnapshot.val();
                    Object.entries(publicUsernames).forEach(([userId, username]) => {
                        window.usernameCache[userId] = username;
                    });
                }
            } catch (error) {
                // Silently continue - we'll handle usernames individually as needed
            }
            
            // Try to get admin users list (publicly accessible)
            try {
                const adminRef = ref(rtdb, 'admin-users');
                const adminSnapshot = await get(adminRef);
                
                if (adminSnapshot.exists()) {
                    const adminUsers = adminSnapshot.val();
                    // Store admin status in cache
                    window.adminCache = adminUsers;
                }
            } catch (error) {
                // Silently continue
            }
            
            // Save to localStorage for future visits
            try {
                localStorage.setItem('usernameCache', JSON.stringify(window.usernameCache));
            } catch (err) {
                console.log("Could not save to localStorage");
            }
        } catch (error) {
            console.error("Error preloading user data:", error);
            // Ensure we at least have an empty cache
            window.usernameCache = window.usernameCache || {};
        }
    };
    
    // Call preload function
    preloadAllUserData();
};

// Helper function to fetch username from userID with improved public access
const fetchUsernameFromUserID = async (userId) => {
    try {
        // Check cache first for performance
        if (window.usernameCache && window.usernameCache[userId]) {
            return window.usernameCache[userId];
        }
        
        // Try to get from usernames collection first (public access)
        try {
            const usernamesRef = ref(rtdb, 'usernames');
            const snapshot = await get(usernamesRef);
            
            if (snapshot.exists()) {
                // Search for the username that maps to this userId
                const usernames = snapshot.val();
                for (const [username, uid] of Object.entries(usernames)) {
                    if (uid === userId) {
                        // Cache this result
                        if (!window.usernameCache) window.usernameCache = {};
                        window.usernameCache[userId] = username;
                        return username;
                    }
                }
            }
        } catch (err) {
            // Silent fail, continue to next method
        }
        
        // Fallback to other methods
        try {
            const publicUsernameRef = ref(rtdb, `public-usernames/${userId}`);
            const publicSnapshot = await get(publicUsernameRef);
            
            if (publicSnapshot.exists()) {
                const username = publicSnapshot.val();
                if (username) {
                    window.usernameCache[userId] = username;
                    return username;
                }
            }
        } catch (e) {
            // Silently continue to next option
        }
        
        // Only try the users collection if we're authenticated
        if (auth.currentUser) {
            try {
                const userRef = ref(rtdb, `users/${userId}`);
                const userSnapshot = await get(userRef);
                
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    if (userData.username) {
                        window.usernameCache[userId] = userData.username;
                        return userData.username;
                    } else if (userData.email) {
                        const username = userData.email.split('@')[0];
                        window.usernameCache[userId] = username;
                        return username;
                    }
                }
            } catch (e) {
                // Silently continue to next option
            }
        }
        
        // Generate a consistent username from the user ID
        const shortId = userId.substring(0, 6);
        return `User ${shortId}`; // Add space for better readability
    } catch (error) {
        console.error("Error fetching username:", error);
        return `User ${userId.substring(0, 6)}`;
    }
};

// Set author info with better error handling and admin detection
const renderCommentAuthor = async (authorId, authorElement) => {
    try {
        if (!authorId) {
            authorElement.textContent = 'User';
            return;
        }
        
        // Get username with error handling
        let username;
        try {
            username = await fetchUsernameFromUserID(authorId);
        } catch (e) {
            username = `User ${authorId.substring(0, 6)}`;
        }
        
        authorElement.textContent = username;
        
        // Check for admin status in the public admin list
        try {
            // First check our cache
            if (window.adminCache && window.adminCache[authorId]) {
                const badge = document.createElement('span');
                badge.className = 'admin-badge relative';
                badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                authorElement.appendChild(badge);
                return;
            }
            
            // Check the public admin-users node
            const adminRef = ref(rtdb, 'admin-users');
            const adminSnapshot = await get(adminRef);
            
            if (adminSnapshot.exists()) {
                const adminUsers = adminSnapshot.val();
                if (adminUsers && adminUsers[authorId]) {
                    // Cache for future reference
                    if (!window.adminCache) window.adminCache = {};
                    window.adminCache[authorId] = true;
                    
                    // Add the admin badge
                    const badge = document.createElement('span');
                    badge.className = 'admin-badge relative';
                    badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                    authorElement.appendChild(badge);
                    return;
                }
            }
            
            // Direct check in users collection as last resort
            const userRef = ref(rtdb, `users/${authorId}`);
            const userSnapshot = await get(userRef);
            
            if (userSnapshot.exists() && userSnapshot.val().isAdmin) {
                // Cache for future
                if (!window.adminCache) window.adminCache = {};
                window.adminCache[authorId] = true;
                
                // Add the admin badge
                const badge = document.createElement('span');
                badge.className = 'admin-badge relative';
                badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                authorElement.appendChild(badge);
            }
        } catch (error) {
            console.log("Error checking admin status:", error);
            // Still try one more time with the users collection
            try {
                if (auth.currentUser) {
                    const userRef = ref(rtdb, `users/${authorId}`);
                    const userSnapshot = await get(userRef);
                    
                    if (userSnapshot.exists() && userSnapshot.val().isAdmin) {
                        // Add the badge as last attempt
                        const badge = document.createElement('span');
                        badge.className = 'admin-badge relative';
                        badge.innerHTML = `<i class="fas fa-check-circle"></i><span class="tooltip-text">Admin</span>`;
                        authorElement.appendChild(badge);
                    }
                }
            } catch (err) {
                // Silent fail at this point
            }
        }
    } catch (error) {
        console.error("Error rendering author:", error);
        authorElement.textContent = `User ${authorId.substring(0, 6)}`;
    }
};

// Function to share the story
const shareStory = (title) => {
    // Get the current URL
    const shareUrl = window.location.href;
    const shareTitle = title || document.title;
    
    // Check if Web Share API is supported
    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            url: shareUrl
        })
        .then(() => console.log('Shared successfully'))
        .catch((error) => {
            console.log('Error sharing:', error);
            fallbackShare(shareUrl);
        });
    } else {
        // Fallback for browsers that don't support the Web Share API
        fallbackShare(shareUrl);
    }
};

// Fallback sharing method - copy to clipboard
const fallbackShare = (url) => {
    // Create a temporary input element
    const tempInput = document.createElement('input');
    document.body.appendChild(tempInput);
    
    // Set its value to the URL and select it
    tempInput.value = url;
    tempInput.select();
    tempInput.setSelectionRange(0, 99999); // For mobile devices
    
    // Copy the URL to clipboard
    document.execCommand('copy');
    
    // Remove the temporary element
    document.body.removeChild(tempInput);
    
    // Provide feedback to the user
    alert('Link copied to clipboard! You can now share it manually.');
};

// Function to show YouTube-style share popup
const showSharePopup = (title) => {
    // Create share popup if it doesn't exist
    if (!document.getElementById('share-popup')) {
        createSharePopup();
    }
    
    // Update share URL
    const shareUrl = window.location.href;
    const shareTitle = title || document.title;
    document.getElementById('share-url-input').value = shareUrl;
    
    // Update social media share links
    updateSocialShareLinks(shareUrl, shareTitle);
    
    // Show popup
    const popup = document.getElementById('share-popup');
    popup.classList.remove('hidden');
    
    // Apply current theme to popup (explicitly check and apply theme)
    applyThemeToPopup();
    
    // Add animation
    setTimeout(() => {
        popup.querySelector('.share-popup-content').classList.add('share-popup-active');
    }, 10);
    
    // Focus on the URL input for easy copying
    setTimeout(() => {
        document.getElementById('share-url-input').select();
    }, 300);
};

// Apply current theme to popup elements
const applyThemeToPopup = () => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const popup = document.getElementById('share-popup');
    if (!popup) return;
    
    // Ensure popup content follows dark mode
    const content = popup.querySelector('.share-popup-content');
    if (isDarkMode) {
        content.classList.add('dark-theme');
        content.style.backgroundColor = '#1f2937'; // dark:bg-gray-800
        content.style.color = '#e2e8f0'; // dark:text-gray-200
    } else {
        content.classList.remove('dark-theme');
        content.style.backgroundColor = '#ffffff'; // bg-white
        content.style.color = '#1f2937'; // text-gray-800
    }
    
    // Style the label
    const label = popup.querySelector('label');
    if (label) {
        if (isDarkMode) {
            label.style.color = '#d1d5db'; // dark:text-gray-300
        } else {
            label.style.color = '#374151'; // text-gray-700
        }
    }
    
    // Style the input
    const input = popup.querySelector('#share-url-input');
    if (input) {
        if (isDarkMode) {
            input.style.backgroundColor = '#374151'; // dark:bg-gray-700
            input.style.borderColor = '#4b5563'; // dark:border-gray-600
            input.style.color = '#e2e8f0'; // dark:text-gray-200
        } else {
            input.style.backgroundColor = '#ffffff';
            input.style.borderColor = '#d1d5db'; // border-gray-300
            input.style.color = '#1f2937'; // text-gray-800
        }
    }
    
    // Style the close button
    const closeBtn = popup.querySelector('#close-share-popup');
    if (closeBtn) {
        if (isDarkMode) {
            closeBtn.style.color = '#9ca3af'; // dark:text-gray-400
        } else {
            closeBtn.style.color = '#6b7280'; // text-gray-500
        }
    }
    
    // Style the feedback message
    const feedback = popup.querySelector('#copy-feedback');
    if (feedback) {
        if (isDarkMode) {
            feedback.style.color = '#4ade80'; // dark:text-green-400
        } else {
            feedback.style.color = '#16a34a'; // text-green-600
        }
    }
};

// Create share popup elements
const createSharePopup = () => {
    const popup = document.createElement('div');
    popup.id = 'share-popup';
    popup.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden';
    
    // HTML for the popup content
    popup.innerHTML = `
        <div class="share-popup-content bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform scale-95 opacity-0 transition-all duration-300">
            <div class="flex justify-between items-center border-b border-gray-200 p-4">
                <h3 class="text-lg font-bold">Share this story</h3>
                <button id="close-share-popup" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="p-4">
                <!-- Social Media Sharing -->
                <div class="flex justify-center space-x-4 mb-6">
                    <a href="#" id="share-facebook" class="share-icon bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700" title="Share on Facebook">
                        <i class="fab fa-facebook-f"></i>
                    </a>
                    <a href="#" id="share-twitter" class="share-icon bg-blue-400 text-white rounded-full p-3 hover:bg-blue-500" title="Share on Twitter">
                        <i class="fab fa-twitter"></i>
                    </a>
                    <a href="#" id="share-linkedin" class="share-icon bg-blue-700 text-white rounded-full p-3 hover:bg-blue-800" title="Share on LinkedIn">
                        <i class="fab fa-linkedin-in"></i>
                    </a>
                    <a href="#" id="share-whatsapp" class="share-icon bg-green-500 text-white rounded-full p-3 hover:bg-green-600" title="Share on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <a href="#" id="share-email" class="share-icon bg-gray-600 text-white rounded-full p-3 hover:bg-gray-700" title="Share via Email">
                        <i class="fas fa-envelope"></i>
                    </a>
                </div>
                
                <!-- URL Copy Field -->
                <div class="mb-2">
                    <label for="share-url-input" class="block text-sm font-medium text-gray-700 mb-1">Link</label>
                    <div class="flex">
                        <input type="text" id="share-url-input" class="flex-1 border border-gray-300 rounded-l px-3 py-2" readonly>
                        <button id="copy-share-url" class="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700">
                            Copy
                        </button>
                    </div>
                </div>
                
                <!-- Copy Feedback -->
                <div id="copy-feedback" class="text-green-600 text-sm hidden mt-2">
                    <i class="fas fa-check mr-1"></i> Link copied to clipboard!
                </div>
            </div>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(popup);
    
    // Setup event listeners
    document.getElementById('close-share-popup').addEventListener('click', hideSharePopup);
    document.getElementById('copy-share-url').addEventListener('click', copyShareUrl);
    
    // Close when clicking outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            hideSharePopup();
        }
    });
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popup.classList.contains('hidden')) {
            hideSharePopup();
        }
    });
    
    // Listen for theme changes
    document.addEventListener('themeChanged', applyThemeToPopup);
};

// Hide share popup
const hideSharePopup = () => {
    const popup = document.getElementById('share-popup');
    if (!popup) return;
    
    // Animate out
    popup.querySelector('.share-popup-content').classList.remove('share-popup-active');
    
    // Hide after animation
    setTimeout(() => {
        popup.classList.add('hidden');
        // Reset copy feedback
        document.getElementById('copy-feedback').classList.add('hidden');
    }, 300);
};

// Copy share URL to clipboard
const copyShareUrl = () => {
    const urlInput = document.getElementById('share-url-input');
    urlInput.select();
    document.execCommand('copy');
    
    // Show feedback
    const feedback = document.getElementById('copy-feedback');
    feedback.classList.remove('hidden');
    
    // Hide feedback after 2 seconds
    setTimeout(() => {
        feedback.classList.add('hidden');
    }, 2000);
};

// Update social media share links
const updateSocialShareLinks = (url, title) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    
    // Update each social media link
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
    document.getElementById('share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    document.getElementById('share-whatsapp').href = `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`;
    document.getElementById('share-email').href = `mailto:?subject=${encodedTitle}&body=Check%20out%20this%20story:%20${encodedUrl}`;
    
    // Open in new tabs
    document.querySelectorAll('.share-icon').forEach(icon => {
        icon.setAttribute('target', '_blank');
        icon.setAttribute('rel', 'noopener noreferrer');
    });
};

// Initialize story page when DOM content is loaded
document.addEventListener('DOMContentLoaded', initStoryPage);
