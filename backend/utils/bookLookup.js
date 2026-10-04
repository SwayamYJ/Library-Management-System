const axios = require('axios');

// In-memory cache with 10-minute TTL
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function normalizeCoverUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let cleaned = url.trim();
    if (!cleaned) return '';
    if (cleaned.includes('via.placeholder.com') || cleaned.includes('unsplash.com')) {
        return '';
    }
    // Force HTTPS
    cleaned = cleaned.replace(/^http:\/\//i, 'https://');
    // Strip edge=curl
    cleaned = cleaned.replace(/[?&]edge=curl/gi, '');
    // Adjust zoom param: if zoom=1, replace with zoom=0 for higher quality
    cleaned = cleaned.replace(/([?&])zoom=1(&|$)/i, '$1zoom=0$2');
    // Clean up empty params
    cleaned = cleaned.replace(/&+/g, '&').replace(/\?&/, '?').replace(/[?&]$/, '');
    return cleaned;
}

// Axios request with timeout & retry on 429/5xx
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 600) {
    const config = {
        timeout: 8000,
        ...options,
        headers: {
            'User-Agent': 'SmartLibrary-LMS/1.0',
            ...(options.headers || {})
        }
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await axios.get(url, config);
        } catch (err) {
            const status = err.response?.status;
            const isRetryable = status === 429 || (status >= 500 && status < 600) || err.code === 'ECONNABORTED';
            if (attempt < retries && isRetryable) {
                const backoff = delayMs * Math.pow(2, attempt);
                console.warn(`Upstream request to ${url} returned ${status || err.code}. Retrying in ${backoff}ms...`);
                await new Promise(res => setTimeout(res, backoff));
            } else {
                throw err;
            }
        }
    }
}

function formatGoogleVolume(item, detectedIsbn = '') {
    const vol = item.volumeInfo || {};
    let cover = vol.imageLinks?.extraLarge ||
                vol.imageLinks?.large ||
                vol.imageLinks?.medium ||
                vol.imageLinks?.thumbnail ||
                vol.imageLinks?.smallThumbnail || '';
    cover = normalizeCoverUrl(cover);

    let isbn10 = '';
    let isbn13 = '';
    (vol.industryIdentifiers || []).forEach(id => {
        if (id.type === 'ISBN_10') isbn10 = id.identifier.replace(/[\s-]/g, '');
        if (id.type === 'ISBN_13') isbn13 = id.identifier.replace(/[\s-]/g, '');
    });

    const finalIsbn = isbn13 || isbn10 || detectedIsbn;
    if (!cover && finalIsbn) {
        cover = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(finalIsbn)}-L.jpg?default=false`;
    }

    return {
        title: vol.title || '',
        authors: Array.isArray(vol.authors) ? vol.authors.join(', ') : (vol.authors || 'Unknown Author'),
        publisher: vol.publisher || '',
        description: vol.description || (vol.subtitle ? `${vol.title}: ${vol.subtitle}` : ''),
        pageCount: vol.pageCount || 0,
        categories: vol.categories || [],
        isbn10,
        isbn13: finalIsbn,
        coverImageURL: cover,
        source: 'Google Books',
        rawItem: item
    };
}

function formatOpenLibraryData(key, data, detectedIsbn = '') {
    const cover = data.cover?.large || data.cover?.medium || data.cover?.small ||
        (detectedIsbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(detectedIsbn)}-L.jpg?default=false` : '');

    let isbn10 = '';
    let isbn13 = '';
    if (data.identifiers?.isbn_10?.length) isbn10 = data.identifiers.isbn_10[0];
    if (data.identifiers?.isbn_13?.length) isbn13 = data.identifiers.isbn_13[0];

    const finalIsbn = isbn13 || isbn10 || detectedIsbn;

    return {
        title: data.title || '',
        authors: Array.isArray(data.authors) ? data.authors.map(a => a.name).join(', ') : 'Unknown Author',
        publisher: Array.isArray(data.publishers) ? data.publishers.map(p => p.name).join(', ') : (data.publishers || ''),
        description: typeof data.notes === 'string' ? data.notes : (data.subtitle || ''),
        pageCount: data.number_of_pages || 0,
        categories: Array.isArray(data.subjects) ? data.subjects.map(s => s.name || s) : [],
        isbn10,
        isbn13: finalIsbn,
        coverImageURL: normalizeCoverUrl(cover),
        source: 'Open Library',
        rawItem: data
    };
}

function formatOpenLibraryDoc(doc) {
    const isbnList = doc.isbn || [];
    const isbn13 = isbnList.find(i => i.length === 13) || '';
    const isbn10 = isbnList.find(i => i.length === 10) || '';
    const finalIsbn = isbn13 || isbn10 || (isbnList.length > 0 ? isbnList[0] : '');

    let cover = '';
    if (doc.cover_i) {
        cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    } else if (finalIsbn) {
        cover = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(finalIsbn)}-L.jpg?default=false`;
    }

    return {
        title: doc.title || '',
        authors: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : 'Unknown Author',
        publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : '',
        description: doc.first_sentence ? doc.first_sentence[0] : '',
        pageCount: doc.number_of_pages_median || 0,
        categories: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [],
        isbn10,
        isbn13: finalIsbn,
        coverImageURL: normalizeCoverUrl(cover),
        source: 'Open Library',
        rawItem: doc
    };
}

/**
 * Universal lookup by ISBN or Title
 */
async function lookupBook(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
        const error = new Error('Search query is required.');
        error.statusCode = 400;
        throw error;
    }

    const query = rawQuery.trim();
    const cleanIsbn = query.replace(/[\s-]/g, '');
    const isISBN = /^(97(8|9))?\d{9}[\dX]$/i.test(cleanIsbn) || (/^\d{10}$/.test(cleanIsbn)) || (/^\d{13}$/.test(cleanIsbn));
    const cacheKey = isISBN ? `isbn:${cleanIsbn}` : `text:${query.toLowerCase()}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}` : '';
    let results = [];
    let googleError = null;

    // 1. Try Google Books
    try {
        const googleUrl = isISBN
            ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}${apiKey}`
            : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5${apiKey}`;

        const gRes = await fetchWithRetry(googleUrl);
        if (gRes.data?.items && gRes.data.items.length > 0) {
            results = gRes.data.items.map(item => formatGoogleVolume(item, isISBN ? cleanIsbn : ''));
        }
    } catch (err) {
        googleError = err;
        console.warn('Google Books API lookup failed or rate-limited:', err.message);
    }

    // 2. If no results from Google Books, fallback to Open Library
    if (results.length === 0) {
        try {
            if (isISBN) {
                const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(cleanIsbn)}&format=json&jscmd=data`;
                const olRes = await fetchWithRetry(olUrl);
                const bookData = olRes.data && olRes.data[`ISBN:${cleanIsbn}`];
                if (bookData) {
                    results.push(formatOpenLibraryData(`ISBN:${cleanIsbn}`, bookData, cleanIsbn));
                }
            } else {
                const olSearchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
                const olRes = await fetchWithRetry(olSearchUrl);
                if (olRes.data?.docs && olRes.data.docs.length > 0) {
                    results = olRes.data.docs.map(doc => formatOpenLibraryDoc(doc));
                }
            }
        } catch (olErr) {
            console.warn('Open Library API lookup also failed:', olErr.message);
        }
    }

    if (results.length === 0) {
        if (googleError?.response?.status === 429) {
            const err = new Error('Google Books rate limit reached and no fallback results found.');
            err.statusCode = 429;
            throw err;
        }
        const notFound = new Error(`No book records found for query "${query}".`);
        notFound.statusCode = 404;
        throw notFound;
    }

    const payload = {
        ...results[0],
        results
    };

    // Cache result
    cache.set(cacheKey, {
        timestamp: Date.now(),
        data: payload
    });

    return payload;
}

module.exports = {
    lookupBook,
    normalizeCoverUrl,
    fetchWithRetry
};
