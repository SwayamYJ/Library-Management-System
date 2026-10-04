import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

const LocalFallbackCover = ({ bookTitle, bookAuthor, cleanIsbnStr, containerClassName }) => (
    <div
        className={`w-full h-full min-h-[140px] bg-gradient-to-br from-slate-800 via-sky-900 to-indigo-950 text-white p-4 flex flex-col justify-between select-none relative overflow-hidden shadow-inner ${containerClassName}`}
    >
        {/* Book spine & background accents */}
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-white/15 border-r border-black/20" />
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="pl-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm border border-white/10 text-[10px] uppercase font-bold tracking-wider text-sky-200">
                <BookOpen className="w-3 h-3 text-sky-400" />
                <span>SmartLibrary</span>
            </div>
        </div>

        <div className="pl-2 my-auto py-2">
            <h4 className="font-bold text-sm leading-snug line-clamp-3 text-white drop-shadow-sm">
                {bookTitle}
            </h4>
            {bookAuthor && (
                <p className="text-xs text-sky-200/90 mt-1 line-clamp-1 italic font-medium">
                    {bookAuthor}
                </p>
            )}
        </div>

        <div className="pl-2 text-[9px] text-slate-300 font-mono flex items-center justify-between border-t border-white/10 pt-1.5">
            <span>{cleanIsbnStr ? `ISBN: ${cleanIsbnStr.slice(0, 10)}...` : 'LMS Collection'}</span>
        </div>
    </div>
);

const RemoteImageCover = ({ candidates, alt, className, containerClassName, bookTitle, bookAuthor, cleanIsbnStr }) => {
    const [candidateIndex, setCandidateIndex] = useState(0);

    const handleImgError = (e) => {
        e.target.onerror = null; // Prevent infinite error loop
        setCandidateIndex(prev => prev + 1);
    };

    if (candidateIndex >= candidates.length) {
        return (
            <LocalFallbackCover
                bookTitle={bookTitle}
                bookAuthor={bookAuthor}
                cleanIsbnStr={cleanIsbnStr}
                containerClassName={containerClassName}
            />
        );
    }

    return (
        <img
            src={candidates[candidateIndex]}
            alt={alt || bookTitle}
            onError={handleImgError}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={className}
        />
    );
};

const BookCover = ({
    book,
    thumbnail,
    imageUrl,
    isbn,
    title,
    className = 'w-full h-full object-cover',
    containerClassName = '',
    alt = ''
}) => {
    const rawThumb = thumbnail ?? book?.thumbnail ?? '';
    const rawImg = imageUrl ?? book?.imageUrl ?? '';
    const rawIsbn = isbn ?? book?.ISBN ?? '';
    const bookTitle = title ?? book?.Title ?? 'Untitled Book';
    const bookAuthor = book?.Author || '';

    // Filter out dead placeholder domains
    const cleanUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (trimmed.includes('via.placeholder.com') || trimmed.includes('unsplash.com')) {
            return '';
        }
        return trimmed.replace(/^http:\/\//i, 'https://');
    };

    const cleanThumb = cleanUrl(rawThumb);
    const cleanImg = cleanUrl(rawImg);
    const cleanIsbnStr = (rawIsbn || '').toString().replace(/[\s-]/g, '');

    // Build ordered list of candidates
    const candidates = [];
    if (cleanThumb) candidates.push(cleanThumb);
    if (cleanImg && cleanImg !== cleanThumb) candidates.push(cleanImg);
    if (cleanIsbnStr && cleanIsbnStr.length >= 9) {
        candidates.push(`https://covers.openlibrary.org/b/isbn/${encodeURIComponent(cleanIsbnStr)}-L.jpg?default=false`);
    }

    const key = `${cleanThumb}|${cleanImg}|${cleanIsbnStr}`;

    if (candidates.length === 0) {
        return (
            <LocalFallbackCover
                bookTitle={bookTitle}
                bookAuthor={bookAuthor}
                cleanIsbnStr={cleanIsbnStr}
                containerClassName={containerClassName}
            />
        );
    }

    return (
        <RemoteImageCover
            key={key}
            candidates={candidates}
            alt={alt}
            className={className}
            containerClassName={containerClassName}
            bookTitle={bookTitle}
            bookAuthor={bookAuthor}
            cleanIsbnStr={cleanIsbnStr}
        />
    );
};

export default BookCover;
