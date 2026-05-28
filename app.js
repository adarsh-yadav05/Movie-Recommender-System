import Storage from './storage.js';
import API from './api.js';
import RecommendationEngine from './recommendation.js';

// Application State
const state = {
    activeSection: 'home-section',
    genreMap: {}, // Maps genre ID -> genre Name
    activeWatchlistFilter: 'all', // 'all', 'want', 'watched'
    debounceTimer: null,
    currentMovie: null // Holds currently opened movie details
};

// DOM Elements
const elements = {
    // Navigation
    navLinks: document.querySelectorAll('.nav-link'),
    viewSections: document.querySelectorAll('.view-section'),
    logoLink: document.getElementById('logo-link'),
    apiStatusIndicator: document.getElementById('api-status-indicator'),
    
    // Settings Section
    settingsApiKey: document.getElementById('settings-api-key'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnResetData: document.getElementById('btn-reset-data'),
    
    // Home Section
    featuredHero: document.getElementById('featured-hero'),
    heroMovieTitle: document.getElementById('hero-movie-title'),
    heroMovieRating: document.getElementById('hero-movie-rating'),
    heroMovieYear: document.getElementById('hero-movie-year'),
    heroMovieGenres: document.getElementById('hero-movie-genres'),
    heroMovieOverview: document.getElementById('hero-movie-overview'),
    heroPlayBtn: document.getElementById('hero-play-btn'),
    heroWatchlistBtn: document.getElementById('hero-watchlist-btn'),
    
    trendingCarousel: document.getElementById('trending-carousel'),
    hollywoodCarousel: document.getElementById('hollywood-carousel'),
    bollywoodCarousel: document.getElementById('bollywood-carousel'),
    regionalIndianCarousel: document.getElementById('regional-indian-carousel'),
    
    // Explore Section
    searchBar: document.getElementById('search-bar'),
    filterGenre: document.getElementById('filter-genre'),
    filterYear: document.getElementById('filter-year'),
    filterRating: document.getElementById('filter-rating'),
    filterSort: document.getElementById('filter-sort'),
    exploreResultsTitle: document.getElementById('explore-results-title'),
    exploreGrid: document.getElementById('explore-grid'),
    
    // Watchlist Section
    watchlistGrid: document.getElementById('watchlist-grid'),
    btnWatchlistAll: document.getElementById('btn-watchlist-filter-all'),
    btnWatchlistWant: document.getElementById('btn-watchlist-filter-want'),
    btnWatchlistWatched: document.getElementById('btn-watchlist-filter-watched'),
    
    // Recommendations Section
    recommendationsGrid: document.getElementById('recommendations-grid'),
    
    // Detail Modal Drawer
    movieDetailModal: document.getElementById('movie-detail-modal'),
    modalClose: document.getElementById('modal-close'),
    modalHeroBanner: document.getElementById('modal-hero-banner'),
    modalMovieTitle: document.getElementById('modal-movie-title'),
    modalRating: document.getElementById('modal-rating'),
    modalYear: document.getElementById('modal-year'),
    modalRuntime: document.getElementById('modal-runtime'),
    modalLanguage: document.getElementById('modal-language'),
    modalOverview: document.getElementById('modal-overview'),
    modalTrailerSection: document.getElementById('modal-trailer-section'),
    modalTrailerIframe: document.getElementById('modal-trailer-iframe'),
    modalCastList: document.getElementById('modal-cast-list'),
    modalGenres: document.getElementById('modal-genres'),
    modalReleaseDate: document.getElementById('modal-release-date'),
    modalOrgLang: document.getElementById('modal-org-lang'),
    modalPopScore: document.getElementById('modal-pop-score'),
    
    modalBtnWatchlist: document.getElementById('modal-btn-watchlist'),
    modalBtnWatchedStatus: document.getElementById('modal-btn-watched-status'),
    modalBtnFav: document.getElementById('modal-btn-fav'),
    modalBtnDislike: document.getElementById('modal-btn-dislike'),
    
    // Toast Notification
    toastNotification: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initYearFilter();
    setupEventHandlers();
    checkApiKeyConnection();
});

// Populate Year options in explore page
function initYearFilter() {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1960; y--) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        elements.filterYear.appendChild(option);
    }
}

// Check if TMDB credentials exist and verify connectivity
async function checkApiKeyConnection() {
    // Hide Settings tab dynamically if developer has hardcoded the API token
    if (API.hasHardcodedKey()) {
        const settingsLink = document.querySelector('.nav-link[data-target="settings-section"]');
        if (settingsLink) {
            const settingsItem = settingsLink.closest('.nav-item');
            if (settingsItem) {
                settingsItem.style.display = 'none';
            }
        }
    }

    const apiKey = API.getApiKey();
    if (!apiKey) {
        updateApiIndicatorStatus(false, 'Missing API Key');
        showToast('Please set your TMDB API token in Settings.');
        navigateToSection('settings-section');
        return;
    }
    
    // If key exists, prefill in the settings field
    if (elements.settingsApiKey) {
        elements.settingsApiKey.value = apiKey;
    }
    
    updateApiIndicatorStatus(false, 'Connecting...');
    
    try {
        // Fetch genres to verify connectivity and construct our translation map
        const genres = await API.fetchGenres();
        
        state.genreMap = {};
        genres.forEach(g => {
            state.genreMap[g.id] = g.name;
        });
        
        updateApiIndicatorStatus(true, 'Connected to TMDB');
        
        // Populate the genre filter dropdown
        elements.filterGenre.innerHTML = '<option value="">All Genres</option>';
        genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            elements.filterGenre.appendChild(opt);
        });

        // Load content
        loadHomePageData();
        loadRecommendationsData();
        loadWatchlistData();
        loadExploreData();
        
    } catch (error) {
        console.error('API Verification error:', error);
        updateApiIndicatorStatus(false, 'API Key Invalid');
        if (API.hasHardcodedKey()) {
            showToast('Hardcoded TMDB token is invalid. Check api.js settings.');
        } else {
            showToast('API Key connection failed. Check credentials.');
            navigateToSection('settings-section');
        }
    }
}

function updateApiIndicatorStatus(isOnline, text) {
    const dot = elements.apiStatusIndicator.querySelector('.status-dot');
    const label = elements.apiStatusIndicator.querySelector('.status-text');
    
    if (isOnline) {
        dot.classList.add('online');
    } else {
        dot.classList.remove('online');
    }
    label.textContent = text;
}

// Global router logic
function navigateToSection(sectionId) {
    // If hardcoded key is configured, block navigation to settings screen
    if (sectionId === 'settings-section' && API.hasHardcodedKey()) {
        navigateToSection('home-section');
        return;
    }

    elements.viewSections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
    
    elements.navLinks.forEach(link => {
        const target = link.getAttribute('data-target');
        if (target === sectionId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    state.activeSection = sectionId;
    
    // Refresh content on navigation
    if (sectionId === 'watchlist-section') {
        loadWatchlistData();
    } else if (sectionId === 'recommendations-section') {
        loadRecommendationsData();
    } else if (sectionId === 'home-section') {
        loadHomePageData(); // Update with any watchlist additions/changes
    }
}

// Setup Nav, Filter & Form Events
function setupEventHandlers() {
    // Navigation Tabs Clicks
    elements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-target');
            navigateToSection(sectionId);
        });
    });

    elements.logoLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToSection('home-section');
    });

    // Save Settings Event (Optional, if elements exist)
    if (elements.btnSaveSettings) {
        elements.btnSaveSettings.addEventListener('click', () => {
            const key = elements.settingsApiKey.value.trim();
            if (!key) {
                showToast('Please enter a valid key.');
                return;
            }
            Storage.setApiKey(key);
            showToast('Settings saved. Connecting...');
            checkApiKeyConnection();
        });
    }

    // Reset Data Event (Optional, if elements exist)
    if (elements.btnResetData) {
        elements.btnResetData.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all cached watchlist items, favorites, and TMDB configurations? This cannot be undone.')) {
                localStorage.clear();
                if (elements.settingsApiKey) elements.settingsApiKey.value = '';
                updateApiIndicatorStatus(false, 'Missing API Key');
                showToast('Application state reset successfully.');
                setTimeout(() => window.location.reload(), 1000);
            }
        });
    }

    // Modal Close
    elements.modalClose.addEventListener('click', () => closeModal());
    elements.movieDetailModal.addEventListener('click', (e) => {
        if (e.target === elements.movieDetailModal) closeModal();
    });

    // Modal Operations
    elements.modalBtnWatchlist.addEventListener('click', () => toggleWatchlistState());
    elements.modalBtnWatchedStatus.addEventListener('click', () => toggleWatchedStatusState());
    elements.modalBtnFav.addEventListener('click', () => toggleFavoriteState());
    elements.modalBtnDislike.addEventListener('click', () => toggleDislikeState());

    // Search input typing debounce handler
    elements.searchBar.addEventListener('input', () => {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
            loadExploreData();
        }, 400);
    });

    // Filter selectors change handler
    [elements.filterGenre, elements.filterYear, elements.filterRating, elements.filterSort].forEach(select => {
        select.addEventListener('change', () => {
            loadExploreData();
        });
    });

    // Watchlist Sub-Filters click handlers
    elements.btnWatchlistAll.addEventListener('click', () => setWatchlistFilter('all'));
    elements.btnWatchlistWant.addEventListener('click', () => setWatchlistFilter('want'));
    elements.btnWatchlistWatched.addEventListener('click', () => setWatchlistFilter('watched'));
}

// ----------------------------------------------------
// VIEW LOADING LOGIC
// ----------------------------------------------------

// 1. Home Section: Hero Featured Banner & Carousels
async function loadHomePageData() {
    if (!API.getApiKey()) return;

    // Render Skeletons first
    renderCarouselSkeletons(elements.trendingCarousel);
    renderCarouselSkeletons(elements.hollywoodCarousel);
    renderCarouselSkeletons(elements.bollywoodCarousel);
    renderCarouselSkeletons(elements.regionalIndianCarousel);

    try {
        // Fetch trending
        const trendingRes = await API.fetchTrending('day');
        const trendingMovies = (trendingRes.results || []).filter(movie => !Storage.isDisliked(movie.id));
        
        // Render Spotlight Hero using the most popular movie
        if (trendingMovies.length > 0) {
            setupHeroSpotlight(trendingMovies[0]);
        }

        // Render Trending Carousel
        renderMovieCarousel(trendingMovies, elements.trendingCarousel);

        // Fetch Hollywood
        const hollywoodRes = await API.fetchHollywood();
        const hollywoodMovies = (hollywoodRes.results || []).filter(movie => !Storage.isDisliked(movie.id));
        renderMovieCarousel(hollywoodMovies, elements.hollywoodCarousel);

        // Fetch Bollywood
        const bollywoodRes = await API.fetchBollywood();
        const bollywoodMovies = (bollywoodRes.results || []).filter(movie => !Storage.isDisliked(movie.id));
        renderMovieCarousel(bollywoodMovies, elements.bollywoodCarousel);

        // Fetch Regional Indian
        const regionalIndianRes = await API.fetchRegionalIndian();
        const regionalIndianMovies = (regionalIndianRes.results || []).filter(movie => !Storage.isDisliked(movie.id));
        renderMovieCarousel(regionalIndianMovies, elements.regionalIndianCarousel);

    } catch (e) {
        console.error('Error loading homepage lists', e);
        showToast('Error retrieving movie listings.');
    }
}

function setupHeroSpotlight(movie) {
    const backdropUrl = API.getBackdropUrl(movie.backdrop_path);
    elements.featuredHero.style.backgroundImage = `url(${backdropUrl})`;
    elements.heroMovieTitle.textContent = movie.title || movie.name;
    elements.heroMovieRating.querySelector('span').textContent = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    
    const releaseDate = movie.release_date || movie.first_air_date || '';
    elements.heroMovieYear.textContent = releaseDate ? releaseDate.split('-')[0] : 'N/A';
    
    // Resolve genre tags
    const genres = (movie.genre_ids || [])
        .slice(0, 3)
        .map(id => state.genreMap[id] || '')
        .filter(Boolean)
        .join(' • ');
    elements.heroMovieGenres.textContent = genres || 'Movie';
    
    elements.heroMovieOverview.textContent = movie.overview || 'No synopsis available.';
    
    // Detail actions
    elements.heroPlayBtn.onclick = () => openMovieDetail(movie.id);
    
    // Update Watchlist button active state
    if (Storage.isInWatchlist(movie.id)) {
        elements.heroWatchlistBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
            In Watchlist
        `;
        elements.heroWatchlistBtn.classList.remove('btn-secondary');
        elements.heroWatchlistBtn.classList.add('btn-primary');
    } else {
        elements.heroWatchlistBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add Watchlist
        `;
        elements.heroWatchlistBtn.classList.add('btn-secondary');
        elements.heroWatchlistBtn.classList.remove('btn-primary');
    }
    
    elements.heroWatchlistBtn.onclick = () => {
        if (Storage.isInWatchlist(movie.id)) {
            Storage.removeFromWatchlist(movie.id);
            showToast(`Removed "${movie.title || movie.name}" from Watchlist`);
        } else {
            Storage.addToWatchlist(movie);
            showToast(`Added "${movie.title || movie.name}" to Watchlist`);
        }
        setupHeroSpotlight(movie); // Re-render state
    };
}

// 2. Explore Section: Searches, filters, and discover logic
async function loadExploreData() {
    if (!API.getApiKey()) return;

    renderGridSkeletons(elements.exploreGrid);
    
    const query = elements.searchBar.value.trim();
    const genreId = elements.filterGenre.value;
    const year = elements.filterYear.value;
    const ratingGte = elements.filterRating.value;
    const sortBy = elements.filterSort.value;

    try {
        let results = [];
        
        if (query) {
            elements.exploreResultsTitle.textContent = `Search results for "${query}"`;
            
            // TMDB text search query
            const res = await API.searchMovies(query);
            results = res.results || [];
            
            // Apply filtering locally for search query
            results = results.filter(movie => {
                if (Storage.isDisliked(movie.id)) return false;
                
                if (genreId && !(movie.genre_ids || []).includes(parseInt(genreId))) {
                    return false;
                }
                if (year) {
                    const releaseDate = movie.release_date || '';
                    if (!releaseDate.startsWith(year)) return false;
                }
                if (ratingGte && (movie.vote_average || 0) < parseFloat(ratingGte)) {
                    return false;
                }
                return true;
            });
            
            // Apply local sorting if query result sorting is needed
            if (sortBy === 'vote_average.desc') {
                results.sort((a, b) => b.vote_average - a.vote_average);
            } else if (sortBy === 'primary_release_date.desc') {
                results.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
            } else if (sortBy === 'title.asc') {
                results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            }
            
            Storage.addSearchQuery(query); // Save successful query
        } else {
            elements.exploreResultsTitle.textContent = 'Discover Movies';
            
            // TMDB Discover endpoint (performs filters on database side)
            const res = await API.fetchDiscover({
                genreId,
                year,
                voteAverageGte: ratingGte,
                sortBy
            });
            results = (res.results || []).filter(movie => !Storage.isDisliked(movie.id));
        }

        renderMovieGrid(results, elements.exploreGrid, 'No movies match your exploration filters.');

    } catch (e) {
        console.error('Error discovering movies', e);
        elements.exploreGrid.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                <h3 class="empty-title">Connection Error</h3>
                <p class="empty-desc">Failed to retrieve data from TMDB database. Verify network connection and settings.</p>
            </div>
        `;
    }
}

// 3. Watchlist Section: plan to watch, watched filtering
function loadWatchlistData() {
    const list = Storage.getWatchlist();
    let filteredList = list;

    if (state.activeWatchlistFilter === 'want') {
        filteredList = list.filter(m => m.status === 'want_to_watch');
    } else if (state.activeWatchlistFilter === 'watched') {
        filteredList = list.filter(m => m.status === 'watched');
    }

    renderMovieGrid(filteredList, elements.watchlistGrid, 'Your watchlist is empty. Add films from Home or Explore page to start tracking your list.');
}

function setWatchlistFilter(type) {
    state.activeWatchlistFilter = type;
    
    // Toggle active class on status buttons
    [elements.btnWatchlistAll, elements.btnWatchlistWant, elements.btnWatchlistWatched].forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255, 255, 255, 0.08)';
        btn.style.border = 'var(--glass-border)';
    });

    let activeBtn;
    if (type === 'all') activeBtn = elements.btnWatchlistAll;
    if (type === 'want') activeBtn = elements.btnWatchlistWant;
    if (type === 'watched') activeBtn = elements.btnWatchlistWatched;

    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))';
        activeBtn.style.border = 'none';
    }

    loadWatchlistData();
}

// 4. Recommendations Section
async function loadRecommendationsData() {
    if (!API.getApiKey()) return;

    renderGridSkeletons(elements.recommendationsGrid);

    try {
        const recommendations = await RecommendationEngine.getRecommendations();
        renderMovieGrid(recommendations, elements.recommendationsGrid, 'Add movies to your Favorites (click "Like" inside details modal) or Watchlist to train our recommendation engine.');
    } catch (e) {
        console.error('Error generating suggestions', e);
    }
}

// ----------------------------------------------------
// MOVIE MODAL DETAILS COMPONENT
// ----------------------------------------------------

async function openMovieDetail(movieId) {
    // Show empty backdrop and loading indicators
    elements.movieDetailModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Stop page scrolling
    
    elements.modalMovieTitle.textContent = 'Loading details...';
    elements.modalOverview.textContent = '';
    elements.modalCastList.innerHTML = '';
    elements.modalGenres.innerHTML = '';
    elements.modalTrailerSection.style.display = 'none';
    elements.modalTrailerIframe.src = '';
    elements.modalBtnWatchedStatus.style.display = 'none';

    try {
        const movie = await API.fetchMovieDetails(movieId);
        state.currentMovie = movie;

        // Set images
        const backdropUrl = API.getBackdropUrl(movie.backdrop_path);
        elements.modalHeroBanner.style.backgroundImage = `url(${backdropUrl})`;
        
        elements.modalMovieTitle.textContent = movie.title || movie.name;
        elements.modalRating.querySelector('span').textContent = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        
        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
        elements.modalYear.textContent = releaseYear;
        elements.modalRuntime.textContent = movie.runtime ? `${movie.runtime} min` : 'N/A';
        
        const lang = movie.spoken_languages && movie.spoken_languages.length > 0 ? movie.spoken_languages[0].english_name : (movie.original_language || 'N/A');
        elements.modalLanguage.textContent = lang.toUpperCase();
        
        elements.modalOverview.textContent = movie.overview || 'No synopsis detailed yet.';
        
        // Metadata fields
        elements.modalReleaseDate.textContent = movie.release_date || 'N/A';
        elements.modalOrgLang.textContent = (movie.original_language || 'N/A').toUpperCase();
        elements.modalPopScore.textContent = movie.popularity ? Math.round(movie.popularity) : 'N/A';

        // Genre Pills
        if (movie.genres && movie.genres.length > 0) {
            movie.genres.forEach(g => {
                const badge = document.createElement('span');
                badge.className = 'genre-pill';
                badge.textContent = g.name;
                elements.modalGenres.appendChild(badge);
            });
        }

        // Render Cast Slider
        if (movie.credits && movie.credits.cast && movie.credits.cast.length > 0) {
            movie.credits.cast.slice(0, 10).forEach(actor => {
                const castDiv = document.createElement('div');
                castDiv.className = 'cast-member';
                
                const profilePhoto = actor.profile_path ? API.getPosterUrl(actor.profile_path, 'w185') : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=185&auto=format&fit=crop';
                
                castDiv.innerHTML = `
                    <img class="cast-photo" src="${profilePhoto}" alt="${actor.name}" loading="lazy">
                    <span class="cast-name" title="${actor.name}">${actor.name}</span>
                    <span class="cast-character" title="${actor.character}">${actor.character}</span>
                `;
                elements.modalCastList.appendChild(castDiv);
            });
        }

        // Parse YouTube Trailer Video Link
        if (movie.videos && movie.videos.results && movie.videos.results.length > 0) {
            const trailer = movie.videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
            if (trailer) {
                elements.modalTrailerIframe.src = `https://www.youtube.com/embed/${trailer.key}`;
                elements.modalTrailerSection.style.display = 'block';
            }
        }

        // Load & Sync Action states
        syncModalActions();

    } catch (e) {
        console.error('Error fetching detailed movie metadata', e);
        showToast('Error opening details drawer.');
        closeModal();
    }
}

function closeModal() {
    elements.movieDetailModal.classList.remove('active');
    document.body.style.overflow = 'auto'; // Re-enable window scroll
    elements.modalTrailerIframe.src = ''; // Freeze Youtube audio streaming instantly
    state.currentMovie = null;
}

function syncModalActions() {
    if (!state.currentMovie) return;
    const movie = state.currentMovie;
    
    // Watchlist check
    const inWatchlist = Storage.isInWatchlist(movie.id);
    if (inWatchlist) {
        elements.modalBtnWatchlist.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
            Remove Watchlist
        `;
        elements.modalBtnWatchlist.style.background = 'rgba(255, 255, 255, 0.05)';
        elements.modalBtnWatchlist.style.color = '#f87171';
        
        // Show Watched/Want status toggle button
        elements.modalBtnWatchedStatus.style.display = 'flex';
        const listObj = Storage.getWatchlist().find(m => m.id === movie.id);
        
        if (listObj && listObj.status === 'watched') {
            elements.modalBtnWatchedStatus.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                Watched
            `;
            elements.modalBtnWatchedStatus.style.background = 'rgba(16, 185, 129, 0.15)';
            elements.modalBtnWatchedStatus.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            elements.modalBtnWatchedStatus.style.color = '#34d399';
        } else {
            elements.modalBtnWatchedStatus.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                Plan to Watch
            `;
            elements.modalBtnWatchedStatus.style.background = 'rgba(255, 255, 255, 0.05)';
            elements.modalBtnWatchedStatus.style.borderColor = 'var(--border-color)';
            elements.modalBtnWatchedStatus.style.color = '#fff';
        }
    } else {
        elements.modalBtnWatchlist.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add to Watchlist
        `;
        elements.modalBtnWatchlist.style.background = 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))';
        elements.modalBtnWatchlist.style.color = '#fff';
        
        elements.modalBtnWatchedStatus.style.display = 'none';
    }

    // Favorite state
    const isFav = Storage.isFavorite(movie.id);
    if (isFav) {
        elements.modalBtnFav.classList.add('active');
        elements.modalBtnFav.querySelector('span').textContent = 'Liked';
    } else {
        elements.modalBtnFav.classList.remove('active');
        elements.modalBtnFav.querySelector('span').textContent = 'Like';
    }

    // Disliked state
    const isDis = Storage.isDisliked(movie.id);
    if (isDis) {
        elements.modalBtnDislike.classList.add('active');
        elements.modalBtnDislike.querySelector('span').textContent = 'Hidden';
    } else {
        elements.modalBtnDislike.classList.remove('active');
        elements.modalBtnDislike.querySelector('span').textContent = 'Hide';
    }
}

// Action triggers inside details modal
function toggleWatchlistState() {
    if (!state.currentMovie) return;
    const movie = state.currentMovie;
    
    if (Storage.isInWatchlist(movie.id)) {
        Storage.removeFromWatchlist(movie.id);
        showToast(`Removed "${movie.title}" from Watchlist`);
    } else {
        Storage.addToWatchlist(movie);
        showToast(`Added "${movie.title}" to Watchlist`);
    }
    syncModalActions();
    
    // Refresh parent screens if active
    if (state.activeSection === 'watchlist-section') loadWatchlistData();
}

function toggleWatchedStatusState() {
    if (!state.currentMovie) return;
    const movie = state.currentMovie;
    
    Storage.toggleWatchStatus(movie.id);
    syncModalActions();
    
    const obj = Storage.getWatchlist().find(m => m.id === movie.id);
    if (obj) {
        showToast(`Status updated: ${obj.status === 'watched' ? 'Watched' : 'Plan to Watch'}`);
    }
    
    if (state.activeSection === 'watchlist-section') loadWatchlistData();
}

function toggleFavoriteState() {
    if (!state.currentMovie) return;
    const movie = state.currentMovie;
    
    const added = Storage.toggleFavorite(movie);
    showToast(added ? `Saved "${movie.title}" to Favorites!` : `Removed "${movie.title}" from Favorites.`);
    syncModalActions();
}

function toggleDislikeState() {
    if (!state.currentMovie) return;
    const movie = state.currentMovie;
    
    const added = Storage.toggleDislike(movie);
    showToast(added ? `"${movie.title}" will now be hidden from recommendation feeds.` : `"${movie.title}" unhidden.`);
    
    closeModal();
    
    // Refresh background list instantly so it disappears
    if (state.activeSection === 'home-section') loadHomePageData();
    if (state.activeSection === 'explore-section') loadExploreData();
    if (state.activeSection === 'watchlist-section') loadWatchlistData();
    if (state.activeSection === 'recommendations-section') loadRecommendationsData();
}

// ----------------------------------------------------
// UI RENDERING UTILITIES & HELPERS
// ----------------------------------------------------

// Render standard Horizontal lists
function renderMovieCarousel(movies, container) {
    container.innerHTML = '';
    
    if (movies.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:2rem; width:100%;">
                <p class="empty-desc">No movie listings available.</p>
            </div>
        `;
        return;
    }

    movies.forEach(movie => {
        const card = createMovieCardElement(movie);
        container.appendChild(card);
    });
}

// Render dynamic Grids (Search, watchlist, recommendations)
function renderMovieGrid(movies, container, emptyMsg = 'No movies found.') {
    container.innerHTML = '';

    if (movies.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg class="empty-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                <h3 class="empty-title">Empty Collection</h3>
                <p class="empty-desc">${emptyMsg}</p>
            </div>
        `;
        return;
    }

    movies.forEach(movie => {
        const card = createMovieCardElement(movie);
        container.appendChild(card);
    });
}

// Factory element for Movie cards
function createMovieCardElement(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.setAttribute('data-id', movie.id);
    
    const posterUrl = API.getPosterUrl(movie.poster_path, 'w342');
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    
    const releaseDate = movie.release_date || movie.first_air_date || '';
    const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
    
    const inWatchlist = Storage.isInWatchlist(movie.id);
    const watchlistBtnText = inWatchlist ? 'In Watchlist' : 'Add Watchlist';
    
    card.innerHTML = `
        <div class="movie-poster-wrapper">
            <img class="movie-poster" src="${posterUrl}" alt="${movie.title || movie.name}" loading="lazy">
            <span class="card-rating">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                ${rating}
            </span>
            <div class="card-actions-overlay">
                <button class="quick-add-btn" data-action="watchlist">${watchlistBtnText}</button>
            </div>
        </div>
        <div class="card-info">
            <span class="card-title" title="${movie.title || movie.name}">${movie.title || movie.name}</span>
            <div class="card-metadata">
                <span>${year}</span>
                <span>Movie</span>
            </div>
        </div>
    `;

    // Click handler to open details modal (ignores click on button overlays)
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-add-btn')) return;
        openMovieDetail(movie.id);
    });

    // Quick Action button add to watchlist directly
    const quickBtn = card.querySelector('.quick-add-btn');
    quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Storage.isInWatchlist(movie.id)) {
            Storage.removeFromWatchlist(movie.id);
            quickBtn.textContent = 'Add Watchlist';
            showToast(`Removed "${movie.title || movie.name}" from Watchlist`);
        } else {
            Storage.addToWatchlist(movie);
            quickBtn.textContent = 'In Watchlist';
            showToast(`Added "${movie.title || movie.name}" to Watchlist`);
        }
        
        // Refresh grids in background if on active list
        if (state.activeSection === 'watchlist-section') loadWatchlistData();
    });

    return card;
}

// Show animated skeletons while waiting on TMDB endpoints
function renderCarouselSkeletons(container) {
    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        container.innerHTML += `
            <div class="skeleton-card" style="flex: 0 0 190px;">
                <div class="skeleton-poster"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>
        `;
    }
}

function renderGridSkeletons(container) {
    container.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        container.innerHTML += `
            <div class="skeleton-card">
                <div class="skeleton-poster"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>
        `;
    }
}

// Fade in toast alerts for UI interactions feedback
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toastNotification.style.display = 'flex';
    
    // Clear styles and slide in
    elements.toastNotification.style.opacity = '1';
    
    setTimeout(() => {
        elements.toastNotification.style.opacity = '0';
        setTimeout(() => {
            elements.toastNotification.style.display = 'none';
        }, 300);
    }, 2800);
}
