import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Compact breadcrumb for the shared application shell.
 * Items are supplied by the page so this component stays independent from
 * role-specific navigation and translation dictionaries.
 */
export default function PageBreadcrumbs({ items = [] }) {
    if (!items.length) return null;

    return (
        <nav aria-label="Breadcrumb" className="mb-5 min-w-0">
            <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                <li className="flex shrink-0 items-center">
                    <Link
                        to="/students"
                        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                    >
                        <Home size={14} aria-hidden="true" />
                        <span>Trang chủ</span>
                    </Link>
                </li>
                {items.map((item, index) => {
                    const isCurrent = index === items.length - 1;
                    return (
                        <li key={item.key || item.label} className="flex min-w-0 items-center gap-1.5">
                            <ChevronRight size={13} className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                            {item.to && !isCurrent ? (
                                <Link to={item.to} className="truncate rounded-md px-1 py-1 text-slate-500 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-blue-300">
                                    {item.label}
                                </Link>
                            ) : (
                                <span aria-current="page" className={`truncate px-1 py-1 ${isCurrent ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
