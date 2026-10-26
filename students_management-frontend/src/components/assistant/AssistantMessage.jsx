import { Fragment, useMemo } from 'react';

function renderInline(text, keyPrefix) {
    const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    const parts = String(text).split(pattern);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={keyPrefix + index} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={keyPrefix + index} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-violet-700 dark:bg-slate-800 dark:text-violet-300">{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={keyPrefix + index}>{part.slice(1, -1)}</em>;
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (link) return <a key={keyPrefix + index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">{link[1]}</a>;
        return <Fragment key={keyPrefix + index}>{part}</Fragment>;
    });
}

export default function AssistantMessage({ content = '' }) {
    const blocks = useMemo(() => {
        const lines = String(content).replace(/\r/g, '').split('\n');
        const output = [];
        let paragraph = [];
        let list = [];
        let code = [];
        let inCode = false;
        let codeLanguage = '';
        const flushParagraph = () => {
            if (paragraph.length) output.push({ type: 'paragraph', text: paragraph.join(' ') });
            paragraph = [];
        };
        const flushList = () => {
            if (list.length) output.push({ type: 'list', items: list });
            list = [];
        };
        lines.forEach(line => {
            const fence = line.match(/^\s*```([\w+-]*)\s*$/);
            if (fence) {
                flushParagraph(); flushList();
                if (inCode) output.push({ type: 'code', language: codeLanguage, text: code.join('\n') });
                else code = [];
                inCode = !inCode;
                codeLanguage = fence[1] || '';
                return;
            }
            if (inCode) { code.push(line); return; }
            const bullet = line.match(/^\s*[-*]\s+(.+)$/);
            const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
            if (bullet || numbered) {
                flushParagraph();
                list.push((bullet || numbered)[1]);
                return;
            }
            if (!line.trim()) { flushParagraph(); flushList(); return; }
            flushList();
            const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
            if (heading) { flushParagraph(); output.push({ type: 'heading', level: heading[1].length, text: heading[2] }); return; }
            if (/^\s*[-*_]{3,}\s*$/.test(line)) { flushParagraph(); output.push({ type: 'divider' }); return; }
            paragraph.push(line.trim());
        });
        flushParagraph(); flushList();
        if (inCode) output.push({ type: 'code', language: codeLanguage, text: code.join('\n') });
        return output;
    }, [content]);

    return (
        <div className="min-w-0 space-y-2 text-[13px] leading-6 text-slate-700 dark:text-slate-200">
            {blocks.map((block, index) => {
                if (block.type === 'heading') {
                    const className = block.level === 1 ? 'text-base font-bold' : 'text-sm font-semibold';
                    return <h3 key={index} className={className + ' m-0 text-slate-900 dark:text-white'}>{renderInline(block.text, 'h' + index)}</h3>;
                }
                if (block.type === 'list') return <ul key={index} className="my-1 list-disc space-y-1 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, 'l' + index + '-' + itemIndex)}</li>)}</ul>;
                if (block.type === 'code') return <div key={index} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"><div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"><span>{block.language || 'Code'}</span><span> </span></div><pre className="m-0 overflow-x-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100"><code>{block.text}</code></pre></div>;
                if (block.type === 'divider') return <hr key={index} className="border-slate-200 dark:border-slate-700" />;
                return <p key={index} className="m-0 whitespace-pre-wrap break-words">{renderInline(block.text, 'p' + index)}</p>;
            })}
        </div>
    );
}
