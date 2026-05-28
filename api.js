import Storage from './storage.js';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Paste your TMDB API Key (v3) or Read Access Bearer Token (v4) here.
// If set, this will be used automatically and hide/disable the settings page.
const DEVELOPER_API_KEY = '6b7b415cd0477bae1090ce7e2e9f7e1c';

const API = {
    // Get the active API key
    getApiKey() {
        return DEVELOPER_API_KEY || Storage.getApiKey();
    },

    // Check if key is configured in code
    hasHardcodedKey() {
        return !!DEVELOPER_API_KEY;
    },

    // Helper to determine if the saved key is a Bearer Token (long JWT) or standard API Key (32-char hex string)
    isBearerToken(token) {
        return token && token.length > 50;
    },

    // Build standard request parameters
    buildUrl(endpoint, params = {}) {
        const apiKey = this.getApiKey();
        const url = new URL(`${BASE_URL}${endpoint}`);
        
        // Add default parameters
        const userPrefs = Storage.getUserPreferences();
        url.searchParams.append('language', userPrefs.language || 'en-US');
        
        // Add custom params
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
                url.searchParams.append(key, val);
            }
        });
        
        // If not a bearer token, append it as a query param
        if (apiKey && !this.isBearerToken(apiKey)) {
            url.searchParams.append('api_key', apiKey);
        }
        
        return url.toString();
    },

    // Build request headers
    getHeaders() {
        const apiKey = this.getApiKey();
        const headers = {
            'Content-Type': 'application/json;charset=utf-8'
        };
        
        if (apiKey && this.isBearerToken(apiKey)) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        return headers;
    },

    // Standard Fetch wrapper
    async request(endpoint, params = {}) {
        const token = this.getApiKey();
        if (!token) {
            throw new Error('NO_API_KEY');
        }

        const url = this.buildUrl(endpoint, params);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    throw new Error('INVALID_API_KEY');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request failed for ${endpoint}:`, error);
            throw error;
        }
    },

    // Get Poster Image URLs
    // Size options: 'w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'
    getPosterUrl(path, size = 'w342') {
        if (!path) return 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=342&auto=format&fit=crop';
        return `${IMAGE_BASE_URL}/${size}${path}`;
    },

    // Get Backdrop Image URLs
    // Size options: 'w300', 'w780', 'w1280', 'original'
    getBackdropUrl(path, size = 'w1280') {
        if (!path) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1280&auto=format&fit=crop';
        return `${IMAGE_BASE_URL}/${size}${path}`;
    },

    // Fetch Movie Genres
    async fetchGenres() {
        // Return from cache if present
        const cached = Storage.getCachedGenres();
        if (cached) return cached;

        const data = await this.request('/genre/movie/list');
        if (data && data.genres) {
            Storage.cacheGenres(data.genres);
            return data.genres;
        }
        return [];
    },

    // Fetch Trending Content
    async fetchTrending(timeWindow = 'day') {
        return await this.request(`/trending/movie/${timeWindow}`);
    },

    // Fetch Top Rated Movies
    async fetchTopRated(page = 1) {
        return await this.request('/movie/top_rated', { page });
    },

    // Fetch Now Playing Movies
    async fetchNowPlaying(page = 1) {
        return await this.request('/movie/now_playing', { page });
    },

    // Search Movies
    async searchMovies(query, page = 1) {
        return await this.request('/search/movie', { query, page });
    },

    // Fetch Detailed Movie (using append_to_response to save calls)
    async fetchMovieDetails(movieId) {
        return await this.request(`/movie/${movieId}`, {
            append_to_response: 'credits,videos,similar'
        });
    },

    // Discover movies based on active filters
    async fetchDiscover(filters = {}) {
        // Map of params matching TMDB format
        const params = {
            page: filters.page || 1,
            sort_by: filters.sortBy || 'popularity.desc',
            include_adult: false,
            include_video: false
        };

        if (filters.genreId) {
            params.with_genres = filters.genreId;
        }
        if (filters.year) {
            params.primary_release_year = filters.year;
        }
        if (filters.voteAverageGte) {
            params['vote_average.gte'] = filters.voteAverageGte;
        }
        if (filters.originalLanguage) {
            params.with_original_language = filters.originalLanguage;
        }
        if (filters.region) {
            params.region = filters.region;
        }
        if (filters.originCountry) {
            params.with_origin_country = filters.originCountry;
        }

        return await this.request('/discover/movie', params);
    },

    // Fetch Hollywood hits (English language, popular)
    async fetchHollywood(page = 1) {
        return await this.fetchDiscover({
            originalLanguage: 'en',
            page
        });
    },

    // Fetch Bollywood spotlight (Hindi language, India country, popular)
    async fetchBollywood(page = 1) {
        return await this.fetchDiscover({
            originalLanguage: 'hi',
            originCountry: 'IN',
            page
        });
    },

    // Fetch Regional Indian cinema (Tamil, Telugu, Malayalam, Kannada, popular)
    async fetchRegionalIndian(page = 1) {
        return await this.fetchDiscover({
            originalLanguage: 'ta|te|ml|kn',
            page
        });
    }
};

export default API;
