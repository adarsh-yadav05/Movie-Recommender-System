/**
 * CineMatch Local Storage Manager
 * Encapsulates read/write operations with LocalStorage
 */

const KEYS = {
    API_KEY: 'cinematch_tmdb_api_key',
    WATCHLIST: 'cinematch_watchlist',
    FAVORITES: 'cinematch_favorites',
    DISLIKES: 'cinematch_dislikes',
    SEARCH_HISTORY: 'cinematch_search_history',
    PREFERENCES: 'cinematch_user_preferences',
    GENRES: 'cinematch_cached_genres'
};

const Storage = {
    // TMDB API Token Management
    getApiKey() {
        return localStorage.getItem(KEYS.API_KEY) || '';
    },

    setApiKey(key) {
        if (!key) {
            localStorage.removeItem(KEYS.API_KEY);
        } else {
            localStorage.setItem(KEYS.API_KEY, key.trim());
        }
    },

    // Watchlist Management
    // Each movie is stored as: { id, title, poster_path, vote_average, release_date, genres, status: 'want_to_watch' | 'watched' }
    getWatchlist() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.WATCHLIST)) || [];
        } catch (e) {
            console.error('Error parsing watchlist from local storage', e);
            return [];
        }
    },

    saveWatchlist(watchlist) {
        localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(watchlist));
    },

    addToWatchlist(movie) {
        const watchlist = this.getWatchlist();
        if (!watchlist.find(m => m.id === movie.id)) {
            // Keep essential info for rendering without hit TMDB each time
            watchlist.push({
                id: movie.id,
                title: movie.title || movie.name,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date || movie.first_air_date,
                genre_ids: movie.genre_ids || (movie.genres ? movie.genres.map(g => g.id) : []),
                addedAt: new Date().getTime(),
                status: 'want_to_watch'
            });
            this.saveWatchlist(watchlist);
        }
    },

    removeFromWatchlist(movieId) {
        const watchlist = this.getWatchlist().filter(m => m.id !== parseInt(movieId));
        this.saveWatchlist(watchlist);
    },

    isInWatchlist(movieId) {
        return this.getWatchlist().some(m => m.id === parseInt(movieId));
    },

    toggleWatchStatus(movieId) {
        const watchlist = this.getWatchlist();
        const movie = watchlist.find(m => m.id === parseInt(movieId));
        if (movie) {
            movie.status = movie.status === 'want_to_watch' ? 'watched' : 'want_to_watch';
            this.saveWatchlist(watchlist);
        }
    },

    // Favorites Management (for Recommendations weight)
    getFavorites() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.FAVORITES)) || [];
        } catch (e) {
            return [];
        }
    },

    saveFavorites(favorites) {
        localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
    },

    toggleFavorite(movie) {
        let favorites = this.getFavorites();
        const index = favorites.findIndex(m => m.id === movie.id);
        let added = false;
        
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push({
                id: movie.id,
                title: movie.title || movie.name,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date || movie.first_air_date,
                genre_ids: movie.genre_ids || (movie.genres ? movie.genres.map(g => g.id) : []),
                addedAt: new Date().getTime()
            });
            added = true;
            
            // Remove from dislikes if favorited
            this.removeDislike(movie.id);
        }
        this.saveFavorites(favorites);
        return added;
    },

    isFavorite(movieId) {
        return this.getFavorites().some(m => m.id === parseInt(movieId));
    },

    // Disliked / Hide Movies (Exclude from suggestions)
    getDisliked() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.DISLIKES)) || [];
        } catch (e) {
            return [];
        }
    },

    saveDisliked(dislikes) {
        localStorage.setItem(KEYS.DISLIKES, JSON.stringify(dislikes));
    },

    toggleDislike(movie) {
        let dislikes = this.getDisliked();
        const index = dislikes.findIndex(m => m.id === movie.id);
        let added = false;

        if (index > -1) {
            dislikes.splice(index, 1);
        } else {
            dislikes.push({
                id: movie.id,
                title: movie.title || movie.name,
                poster_path: movie.poster_path
            });
            added = true;
            
            // Remove from favorites and watchlist if disliked
            this.removeFromWatchlist(movie.id);
            let favorites = this.getFavorites().filter(m => m.id !== movie.id);
            this.saveFavorites(favorites);
        }
        this.saveDisliked(dislikes);
        return added;
    },

    removeDislike(movieId) {
        let dislikes = this.getDisliked().filter(m => m.id !== parseInt(movieId));
        this.saveDisliked(dislikes);
    },

    isDisliked(movieId) {
        return this.getDisliked().some(m => m.id === parseInt(movieId));
    },

    // Search History Management
    getSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.SEARCH_HISTORY)) || [];
        } catch (e) {
            return [];
        }
    },

    addSearchQuery(query) {
        if (!query || !query.trim()) return;
        let history = this.getSearchHistory();
        // Remove duplicate if it exists
        history = history.filter(q => q.toLowerCase() !== query.trim().toLowerCase());
        // Add to front
        history.unshift(query.trim());
        // Slice top 5 items
        history = history.slice(0, 5);
        localStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(history));
    },

    clearSearchHistory() {
        localStorage.removeItem(KEYS.SEARCH_HISTORY);
    },

    // Genre Cache
    getCachedGenres() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.GENRES)) || null;
        } catch (e) {
            return null;
        }
    },

    cacheGenres(genres) {
        localStorage.setItem(KEYS.GENRES, JSON.stringify(genres));
    },

    // User General Preferences
    getUserPreferences() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.PREFERENCES)) || {
                theme: 'dark',
                language: 'en-US',
                adult: false
            };
        } catch (e) {
            return { theme: 'dark', language: 'en-US', adult: false };
        }
    },

    saveUserPreferences(prefs) {
        localStorage.setItem(KEYS.PREFERENCES, JSON.stringify(prefs));
    }
};

export default Storage;
