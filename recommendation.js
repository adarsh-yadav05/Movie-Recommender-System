import Storage from './storage.js';
import API from './api.js';

const RecommendationEngine = {
    // Generate personalized movie suggestions
    async getRecommendations() {
        const watchlist = Storage.getWatchlist();
        const favorites = Storage.getFavorites();
        const dislikes = Storage.getDisliked();

        // 1. If user has no watchlist or favorites, return trending movies as a default recommendation list
        if (watchlist.length === 0 && favorites.length === 0) {
            try {
                // Fetch two pages of trending movies for a richer default recommendation list of lots of movies
                const [p1, p2] = await Promise.all([
                    API.fetchTrending('day'),
                    API.request('/trending/movie/day', { page: 2 })
                ]);
                const candidates = [...(p1.results || []), ...(p2.results || [])];
                // Filter out dislikes
                return candidates.filter(movie => !Storage.isDisliked(movie.id)).slice(0, 48);
            } catch (e) {
                console.error('Error fetching default recommendations:', e);
                return [];
            }
        }

        try {
            // 2. Build user genre profile
            const genreWeights = {};
            const allInteractions = [...watchlist, ...favorites];

            allInteractions.forEach(movie => {
                const genres = movie.genre_ids || [];
                // Favorites get weight of 2, Watchlist gets 1
                const weight = Storage.isFavorite(movie.id) ? 2 : 1;

                genres.forEach(genreId => {
                    genreWeights[genreId] = (genreWeights[genreId] || 0) + weight;
                });
            });

            // Sort genres by weight
            const sortedGenres = Object.entries(genreWeights)
                .sort((a, b) => b[1] - a[1])
                .map(entry => parseInt(entry[0]));

            const topGenres = sortedGenres.slice(0, 3); // Get top 3 genres

            // 3. Fetch candidate pools in parallel to construct a rich source of recommendations
            const candidatePromises = [];
            const similarSources = []; // Tracks which candidates came from similar-movie recommendations

            // Pool A: Daily Trending (general fallback) - Fetch pages 1 and 2
            candidatePromises.push(
                API.fetchTrending('day').then(res => res.results || []).catch(() => [])
            );
            candidatePromises.push(
                API.request('/trending/movie/day', { page: 2 }).then(res => res.results || []).catch(() => [])
            );

            // Pool B: Discover movies from the top 3 genres (increasing depth for top genre)
            if (topGenres[0]) {
                candidatePromises.push(
                    API.fetchDiscover({ genreId: topGenres[0], page: 1 }).then(res => res.results || []).catch(() => [])
                );
                candidatePromises.push(
                    API.fetchDiscover({ genreId: topGenres[0], page: 2 }).then(res => res.results || []).catch(() => [])
                );
            }
            if (topGenres[1]) {
                candidatePromises.push(
                    API.fetchDiscover({ genreId: topGenres[1], page: 1 }).then(res => res.results || []).catch(() => [])
                );
            }
            if (topGenres[2]) {
                candidatePromises.push(
                    API.fetchDiscover({ genreId: topGenres[2], page: 1 }).then(res => res.results || []).catch(() => [])
                );
            }

            // Pool C: Similar movies for the 5 most recently interacted films (Favorites take priority)
            const recentInteractions = [...favorites, ...watchlist]
                .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
                .slice(0, 5);

            recentInteractions.forEach(movie => {
                candidatePromises.push(
                    API.request(`/movie/${movie.id}/similar`, { page: 1 })
                        .then(res => {
                            const results = res.results || [];
                            results.forEach(m => {
                                similarSources.push(m.id);
                            });
                            return results;
                        })
                        .catch(() => [])
                );
            });

            // Await all pools
            const pools = await Promise.all(candidatePromises);
            
            // 4. Merge pools & Deduplicate
            const candidatesMap = new Map();
            pools.forEach(pool => {
                pool.forEach(movie => {
                    if (movie && movie.id) {
                        candidatesMap.set(movie.id, movie);
                    }
                });
            });

            // 5. Exclude movies that user has already watched, wants to watch, or disliked
            const blacklist = new Set([
                ...watchlist.map(m => m.id),
                ...favorites.map(m => m.id),
                ...dislikes.map(m => m.id)
            ]);

            const validCandidates = Array.from(candidatesMap.values()).filter(movie => !blacklist.has(movie.id));

            // 6. Score remaining candidate movies
            const scoredCandidates = validCandidates.map(movie => {
                let score = movie.vote_average || 5.0; // Base score on average rating

                const movieGenres = movie.genre_ids || [];

                // Genre Match Bonuses
                if (topGenres[0] && movieGenres.includes(topGenres[0])) {
                    score += 2.5; // Primary genre match
                }
                if (topGenres[1] && movieGenres.includes(topGenres[1])) {
                    score += 1.5; // Secondary genre match
                }
                if (topGenres[2] && movieGenres.includes(topGenres[2])) {
                    score += 0.8; // Tertiary genre match
                }

                // Similarity Match Bonus
                if (similarSources.includes(movie.id)) {
                    score += 3.0; // Heavily weight films recommended from similar movies
                }

                // Popularity Bonus (caps at 1.5)
                const popularityBonus = Math.min((movie.popularity || 0) / 150, 1.5);
                score += popularityBonus;

                return { movie, score };
            });

            // 7. Sort by score and return the list of movie objects
            return scoredCandidates
                .sort((a, b) => b.score - a.score)
                .map(item => item.movie)
                .slice(0, 48); // Return top 48 suggestions

        } catch (error) {
            console.error('Error computing recommendations:', error);
            // Fallback in case of overall failures
            try {
                const trending = await API.fetchTrending('day');
                return (trending.results || []).filter(movie => !Storage.isDisliked(movie.id)).slice(0, 48);
            } catch (e) {
                return [];
            }
        }
    }
};

export default RecommendationEngine;
