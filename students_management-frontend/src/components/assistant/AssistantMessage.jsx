import { Fragment, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

function renderInline(text, keyPrefix) {
    const pattern = /(\\*\\*[^*]+\\*\\*|`[^`]+`|\\*[^*]+\\*|\\[[^\\]]+\\]\\(https?:\\/\\/[^\\s)]+\\))/g;
    const parts = String(text).split(pattern);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={keyPrefix + index} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={keyPrefix + index} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-violet-700 dark:bg-slate-800 dark:text-violet-300">{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={keyPrefix + index}>{part.slice(1, -1)}</em>;
        const link = part.match(/^\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)$/);
        if (link) return <a key={keyPrefix + index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 dark:text-blue-400">{link[1]}</a>;
        return <Fragment key={keyPrefix + index}>{part}</Fragment>;
    });
}

function splitTableRow(line) {
    return line.trim().replace(/^\\|/, '').replace(/\\|$/, '').split('|').map(cell => cell.trim());
}

function isTableDivider(line) {
    return /^\\s*\\|?\\s*:?-{3,}:?\\s*(\\|\\s*:?-{3,}:?\\s*)+\\|?\\s*$/.test(line);
}

export default function AssistantMessage({ content = '' }) {
    const [copiedCode, setCopiedCode] = useState(null);
    const blocks = useMemo(() => {
        const lines = String(content).replace(/\\r/g, '').split('\\n');
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
        lines.forEach((line, index) => {
            const fence = line.match(/^\\s*```([\\w+-]*)\\s*$/);
            if (fence) {
                flushParagraph(); flushList();
                if (inCode) output.push({ type: 'code', language: codeLanguage, text: code.join('\\n') });
                else code = [];
                inCode = !inCode;
                codeLanguage = fence[1] || '';
                return;
            }
            if (inCode) { code.push(line); return; }
            if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
                flushParagraph(); flushList();
                const headers = splitTableRow(line);
                const rows = [];
                let rowIndex = index + 2;
                while (rowIndex < lines.length && lines[rowIndex].includes('|') && lines[rowIndex].trim()) {
                    rows.push(splitTableRow(lines[rowIndex]));
                    rowIndex += 1;
                }
                output.push({ type: 'table', headers, rows });
                // Mark consumed lines so the outer pass does not render them twice.
                for (let consumed = index + 1; consumed < rowIndex; consumed += 1) lines[consumed] = '';
                return;
            }
            const quote = line.match(/^\\s*>\\s?(.*)$/);
            if (quote) { flushParagraph(); flushList(); output.push({ type: 'quote', text: quote[1] }); return; }
            const bullet = line.match(/^\\s*[-*]\\s+(.+)$/);
            const numbered = line.match(/^\\s*\\d+[.)]\\s+(.+)$/);
            if (bullet || numbered) {
                flushParagraph();
                list.push({ text: (bullet || numbered)[1], ordered: Boolean(numbered) });
                return;
            }
            if (!line.trim()) { flushParagraph(); flushList(); return; }
            flushList();
            const heading = line.match(/^\\s*(#{1,3})\\s+(.+)$/);
            if (heading) { flushParagraph(); output.push({ type: 'heading', level: heading[1].length, text: heading[2] }); return; }
            if (/^\\s*[-*_]{3,}\\s*$/.test(line)) { flushParagraph(); output.push({ type: 'divider' }); return; }
            paragraph.push(line.trim());
        });
        flushParagraph(); flushList();
        if (inCode) output.push({ type: 'code', language: codeLanguage, text: code.join('\\n') });
        return output;
    }, [content]);

    const copyCode = async (index, text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCode(index);
            window.setTimeout(() => setCopiedCode(current => current === index ? null : current), 1400);
        } catch { setCopiedCode(null); }
    };

    return (
        <div className="min-w-0 space-y-3 text-[13px] leading-6 text-slate-700 dark:text-slate-200">
            {blocks.map((block, index) => {
                if (block.type === 'heading') {
                    const className = block.level === 1 ? 'text-base font-bold' : block.level === 2 ? 'text-sm font-bold' : 'text-[13px] font-semibold';
                    return <h3 key={index} className={className + ' m-0 text-slate-900 dark:text-white'}>{renderInline(block.text, 'h' + index)}</h3>;
                }
                if (block.type === 'list') return <ul key={index} className="my-1 list-disc space-y-1.5 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.text, 'l' + index + '-' + itemIndex)}</li>)}</ul>;
                if (block.type === 'quote') return <blockquote key={index} className="m-0 border-l-2 border-blue-400 bg-blue-50/70 py-2 pl-3 pr-2 text-slate-600 dark:bg-blue-950/30 dark:text-slate-300">{renderInline(block.text, 'q' + index)}</blockquote>;
                if (block.type === 'table') return (
                    <div key={index} className="max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><tr>{block.headers.map((cell, cellIndex) => <th key={cellIndex} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold dark:border-slate-700">{renderInline(cell, 'th' + index + '-' + cellIndex)}</th>)}</tr></thead>
                            <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/70 dark:odd:bg-slate-900 dark:even:bg-slate-800/40">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="border-b border-slate-100 px-3 py-2 align-top last:border-0 dark:border-slate-800">{renderInline(row[cellIndex] || '', 'td' + index + '-' + rowIndex + '-' + cellIndex)}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                );
                if (block.type === 'code') return (
                    <div key={index} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <span className="font-medium">{block.language || 'Code'}</span>
                            <button type="button" onClick={() => void copyCode(index, block.text)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white">
                                {copiedCode === index ? <Check size={12} /> : <Copy size={12} />}{copiedCode === index ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <pre className="m-0 overflow-x-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100"><code>{block.text}</code></pre>
                    </div>
                );
                if (block.type === 'divider') return <hr key={index} className="border-slate-200 dark:border-slate-700" />;
                return <p key={index} className="m-0 whitespace-pre-wrap break-words">{renderInline(block.text, 'p' + index)}</p>;
            })}
        </div>
    );
}
