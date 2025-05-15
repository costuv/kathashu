import { db, rtdb } from './firebase-config.js';
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import {
    ref,
    get,
    orderByChild,
    limitToLast,
    query as rtdbQuery,
    onValue
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

// Load featured stories - prioritizing RTDB to avoid Firestore index issues
const loadFeaturedStories = async () => {
    const featuredStoriesContainer = document.getElementById('featured-stories');
    if (!featuredStoriesContainer) return;
    
    try {
        // Use Realtime Database as primary source
        await loadFeaturedStoriesFromRTDB(featuredStoriesContainer);
    } catch (error) {
        console.error("Error loading featured stories from RTDB:", error);
        
        // Fallback to a simpler Firestore query if RTDB fails
        try {
            // Simplified query avoiding complex indexes
            const storiesRef = collection(db, "stories");
            const q = query(
                storiesRef,
                orderBy("createdAt", "desc"),
                limit(3)
            );
            
            const querySnapshot = await getDocs(q);
            
            // Clear loading state
            featuredStoriesContainer.innerHTML = '';
            
            if (querySnapshot.empty) {
                featuredStoriesContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                return;
            }
            
            // Filter published stories client-side
            const publishedStories = [];
            querySnapshot.forEach((doc) => {
                const story = doc.data();
                if (story.status === "published") {
                    publishedStories.push({
                        id: doc.id,
                        ...story
                    });
                }
            });
            
            // Sort by likes (client-side) to mimic the original query
            publishedStories.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            
            if (publishedStories.length === 0) {
                featuredStoriesContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                return;
            }
            
            // Render each story
            publishedStories.slice(0, 3).forEach(story => {
                renderStoryCard(story.id, story, featuredStoriesContainer);
            });
        } catch (firestoreError) {
            console.error("Error loading featured stories from Firestore:", firestoreError);
            featuredStoriesContainer.innerHTML = '<p class="col-span-full text-center text-red-600 dark:text-red-400">Failed to load stories. Please try again later.</p>';
        }
    }
};

// Load featured stories from Realtime Database
const loadFeaturedStoriesFromRTDB = async (container) => {
    // Listen for stories in real-time
    const storiesRef = ref(rtdb, "stories");
    
    // Clear loading state
    container.innerHTML = '';
    
    return new Promise((resolve, reject) => {
        onValue(storiesRef, (snapshot) => {
            try {
                if (!snapshot.exists()) {
                    container.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                    resolve();
                    return;
                }
                
                const stories = [];
                snapshot.forEach((childSnapshot) => {
                    // Only include published stories
                    const story = childSnapshot.val();
                    if (story.status === "published") {
                        stories.push({
                            id: childSnapshot.key,
                            ...story
                        });
                    }
                });
                
                // Sort by likes (descending) then by date (newest first)
                stories.sort((a, b) => {
                    const likesA = a.likes || 0;
                    const likesB = b.likes || 0;
                    
                    if (likesB !== likesA) {
                        return likesB - likesA;
                    }
                    
                    // If likes are equal, sort by date
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                });
                
                if (stories.length === 0) {
                    container.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                    resolve();
                    return;
                }
                
                // Clear container before adding new content
                container.innerHTML = '';
                
                // Render top 3 stories
                stories.slice(0, 3).forEach(story => {
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

// Load latest stories - prioritizing RTDB to avoid Firestore index issues
const loadLatestStories = async () => {
    const latestStoriesContainer = document.getElementById('latest-stories');
    if (!latestStoriesContainer) return;
    
    try {
        // Use Realtime Database as primary source
        await loadLatestStoriesFromRTDB(latestStoriesContainer);
    } catch (error) {
        console.error("Error loading latest stories from RTDB:", error);
        
        // Fallback to a simpler Firestore query if RTDB fails
        try {
            // Simplified query avoiding complex indexes
            const storiesRef = collection(db, "stories");
            const q = query(
                storiesRef,
                orderBy("createdAt", "desc"),
                limit(10)
            );
            
            const querySnapshot = await getDocs(q);
            
            // Clear container
            latestStoriesContainer.innerHTML = '';
            
            if (querySnapshot.empty) {
                latestStoriesContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                return;
            }
            
            // Filter published stories client-side
            const publishedStories = [];
            querySnapshot.forEach((doc) => {
                const story = doc.data();
                if (story.status === "published") {
                    publishedStories.push({
                        id: doc.id,
                        ...story
                    });
                }
            });
            
            if (publishedStories.length === 0) {
                latestStoriesContainer.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                return;
            }
            
            // Render each story (already sorted by createdAt desc)
            publishedStories.slice(0, 6).forEach(story => {
                renderStoryCard(story.id, story, latestStoriesContainer, true);
            });
        } catch (firestoreError) {
            console.error("Error loading latest stories from Firestore:", firestoreError);
            latestStoriesContainer.innerHTML = '<p class="col-span-full text-center text-red-600 dark:text-red-400">Failed to load stories. Please try again later.</p>';
        }
    }
};

// Load latest stories from Realtime Database
const loadLatestStoriesFromRTDB = async (container) => {
    // Listen for stories in real-time
    const storiesRef = ref(rtdb, "stories");
    
    // Clear loading state
    container.innerHTML = '';
    
    return new Promise((resolve, reject) => {
        onValue(storiesRef, (snapshot) => {
            try {
                if (!snapshot.exists()) {
                    container.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                    resolve();
                    return;
                }
                
                const stories = [];
                snapshot.forEach((childSnapshot) => {
                    // Only include published stories
                    const story = childSnapshot.val();
                    if (story.status === "published") {
                        stories.push({
                            id: childSnapshot.key,
                            ...story
                        });
                    }
                });
                
                // Sort by most recent
                stories.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                
                if (stories.length === 0) {
                    container.innerHTML = '<p class="col-span-full text-center text-gray-600 dark:text-gray-400">No stories found.</p>';
                    resolve();
                    return;
                }
                
                // Clear container before adding new content
                container.innerHTML = '';
                
                // Render latest 6 stories
                stories.slice(0, 6).forEach(story => {
                    renderStoryCard(story.id, story, container, true);
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

// Helper function to render story cards
const renderStoryCard = (id, story, container, isSidebar = false) => {
    const storyDate = story.createdAt ? 
        (typeof story.createdAt === 'string' ? 
            new Date(story.createdAt).toLocaleDateString() : 
            new Date(story.createdAt.toDate()).toLocaleDateString()) 
        : 'Unknown date';
    
    const storyCard = document.createElement('div');
    
    if (isSidebar) {
        // Sidebar card - make it horizontal but compact
        storyCard.className = 'bg-white dark:bg-gray-700 rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow duration-300';
        
        storyCard.innerHTML = `
            <a href="story.html?id=${id}" class="flex p-4">
                <div class="flex-1">
                    <h3 class="text-sm font-bold mb-1 line-clamp-1">${story.title}</h3>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">${storyDate}</p>
                    <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">${story.summary}</p>
                </div>
            </a>
        `;
    } else {
        // Featured stories - full width horizontal layout
        storyCard.className = 'bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow duration-300';
        
        storyCard.innerHTML = `
            <a href="story.html?id=${id}" class="block p-6">
                <div class="flex flex-col">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="text-xl font-bold">${story.title}</h3>
                        <span class="text-sm text-gray-600 dark:text-gray-400 ml-4">${storyDate}</span>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-2">${story.summary}</p>
                    <div class="flex justify-between items-center mt-3">
                        <div class="flex items-center">
                            <span class="text-gray-600 dark:text-gray-400 text-sm">
                                <i class="far fa-heart mr-1"></i>${story.likes || 0} likes
                            </span>
                            <span class="text-gray-600 dark:text-gray-400 text-sm ml-4">
                                <i class="far fa-eye mr-1"></i>${story.views || 0} views
                            </span>
                        </div>
                        <span class="text-blue-600 dark:text-blue-400 text-sm">Read more →</span>
                    </div>
                </div>
            </a>
        `;
    }
    
    container.appendChild(storyCard);
};

// Initialize homepage
const initHomePage = () => {
    loadFeaturedStories();
    loadLatestStories();
};

// Run initialization when DOM content is loaded
document.addEventListener('DOMContentLoaded', initHomePage);
