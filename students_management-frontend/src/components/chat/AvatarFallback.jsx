import React from 'react';

const PALETTE = [
    ['bg-blue-100', 'text-blue-700'],
    ['bg-violet-100', 'text-violet-700'],
    ['bg-emerald-100', 'text-emerald-700'],
    ['bg-amber-100', 'text-amber-700'],
    ['bg-rose-100', 'text-rose-700'],
    ['bg-cyan-100', 'text-cyan-700'],
];

function colorIndex(value = '') {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash % PALETTE.length;
}

export default function AvatarFallback({ name, src, size = 'md', showStatus = false, isOnline = false, className = '' }) {
    const [imageError, setImageError] = React.useState(false);
    const label = (name || 'U').trim() || 'U';
    const initial = label.charAt(0).toUpperCase();
    const [bg, text] = PALETTE[colorIndex(label.toLowerCase())];

    const sizes = {
        sm: 'w-7 h-7 text-[10px]',
        md: 'w-10 h-10 text-xs',
        lg: 'w-12 h-12 text-sm',
    };

    React.useEffect(() => {
        setImageError(false);
    }, [src, name]);

    return (
        <div className={`relative flex-shrink-0 ${className}`}>
            {src && !imageError ? (
                <img
                    src={src}
                    alt={label}
                    onError={() => setImageError(true)}
                    className={`${sizes[size] || sizes.md} rounded-full object-cover`}
                />
            ) : (
                <div
                    aria-label={label}
                    className={`${sizes[size] || sizes.md} rounded-full ${bg} ${text} flex items-center justify-center font-bold`}
                >
                    {initial}
                </div>
            )}

            {showStatus && (
                <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
                />
            )}
        </div>
    );
}
