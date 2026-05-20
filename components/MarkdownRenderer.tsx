
import React from 'react';

const MarkdownRenderer: React.FC<{
    text: string;
    onWordDoubleClick?: (event: React.MouseEvent, word: string) => void;
}> = ({ text, onWordDoubleClick }) => {
    const sanitizedText = text.replace(/\r\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/\\_/g, '_');

    const ensureHeadingSpacing = (txt: string): string => {
        const lines = txt.split('\n');
        const processedLines: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.trim().match(/^(#{1,6})\s+(.*)$/);
            if (headingMatch) {
                if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
                    processedLines.push('');
                }
                processedLines.push(line.trim());
                if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
                    processedLines.push('');
                }
            } else {
                processedLines.push(line);
            }
        }
        return processedLines.join('\n');
    };

    const spacedText = ensureHeadingSpacing(sanitizedText);

    const renderInteractiveSegment = (segment: string, key: string | number) => {
        const cleanedWord = segment.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase();
        const canBeDoubleClicked = /^[a-zA-Z'’]{2,}$/.test(cleanedWord);

        if (canBeDoubleClicked && onWordDoubleClick) {
            return (
                <span 
                    key={key} 
                    onDoubleClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        onWordDoubleClick(e, cleanedWord); 
                    }} 
                    className="cursor-text hover:text-teal-600 transition-colors"
                >
                    {segment}
                </span>
            );
        }
        return <React.Fragment key={key}>{segment}</React.Fragment>;
    };
    
    const processInlineFormatting = (line: string, keyPrefix: string) => {
        if (!line) return null;
        const allFormattingRegex = /(!\[[^\]]*\]\([^)]*\)|\*\*\*[\s\S]*?\*\*\*|\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|`[\s\S]*?`|[\\L_]{3,}|\[[\s\S]*?\])/gi;
        const parts = line.split(allFormattingRegex).filter(Boolean);
        
        return parts.map((part, index) => {
            const key = `${keyPrefix}-${index}`;
            if (part.startsWith('![') && part.includes('](') && part.endsWith(')')) {
                const altMatch = part.match(/^!\[([^\]]*)\]\(/);
                const urlMatch = part.match(/\]\(([^)]+)\)$/);
                if (altMatch && urlMatch) {
                    const altText = altMatch[1].replace(/\n/g, ' ');
                    const url = urlMatch[1].replace(/\s+/g, '');
                    return <img key={key} src={url} alt={altText} className="max-w-full h-auto rounded-lg shadow-md my-2" referrerPolicy="no-referrer" />;
                }
            }
            if (part.startsWith('***') && part.endsWith('***')) return <strong key={key}><em>{part.slice(3, -3)}</em></strong>;
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
            if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
            if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-mono text-sm">{part.slice(1, -1)}</code>;
            if (/^[\\L_]{3,}$/i.test(part) || /^\[[\s\S]*?\]$/.test(part)) return <span key={key} className="font-semibold text-slate-400 tracking-widest px-1">__________</span>;
            
            return part.split(/(\s+)/).map((segment, segIndex) => renderInteractiveSegment(segment, `${key}-${segIndex}`));
        });
    };

    const blocks = spacedText.split(/\n\s*\n/);

    return (
        <div className="text-slate-700 leading-relaxed space-y-4">
            {blocks.map((block, blockIndex) => {
                const trimmedBlock = block.trim();
                if (trimmedBlock.length === 0) return null;
                const lines = block.split('\n');

                if (lines.length === 1) {
                    const line = lines[0].trim();
                    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
                    if (headingMatch) {
                        const level = headingMatch[1].length;
                        const content = headingMatch[2];
                        const key = `h${level}-${blockIndex}`;
                        const formatted = processInlineFormatting(content, key);
                        if (level === 1) return <h1 key={blockIndex} className="text-2xl font-black border-b-2 border-slate-300 pb-2 mb-2">{formatted}</h1>;
                        if (level === 2) return <h2 key={blockIndex} className="text-xl font-extrabold border-b border-slate-200 pb-2 text-slate-800 mb-1.5">{formatted}</h2>;
                        if (level === 3) return <h3 key={blockIndex} className="text-lg font-bold text-slate-800 mb-1">{formatted}</h3>;
                        if (level === 4) return <h4 key={blockIndex} className="text-base font-bold text-slate-700 mb-1">{formatted}</h4>;
                        if (level === 5) return <h5 key={blockIndex} className="text-sm font-bold text-slate-600 tracking-wide mb-1">{formatted}</h5>;
                        return <h6 key={blockIndex} className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{formatted}</h6>;
                    }
                }

                if (trimmedBlock === '---' || trimmedBlock === '***' || trimmedBlock === '___') return <hr key={blockIndex} className="my-6 border-slate-200" />;

                if (lines.every(line => line.trim().startsWith('> '))) {
                    return <blockquote key={blockIndex} className="pl-4 border-l-4 border-slate-300 text-slate-600 italic"><MarkdownRenderer text={lines.map(line => line.trim().substring(2)).join('\n')} onWordDoubleClick={onWordDoubleClick} /></blockquote>;
                }

                const isTable = lines.length > 1 && lines.every(line => line.trim().startsWith('|') && line.trim().endsWith('|')) && lines[1].includes('---');
                if (isTable) {
                    const tableRows = lines.map(line => line.trim().slice(1, -1).split('|').map(cell => cell.trim()));
                    const header = tableRows[0];
                    const bodyRows = tableRows.slice(2);
                    return (
                        <div key={blockIndex} className="overflow-x-auto my-4 shadow-sm rounded-lg border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>{header.map((th, i) => <th key={i} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{processInlineFormatting(th, `th-${i}`)}</th>)}</tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {bodyRows.map((row, i) => <tr key={i}>{row.map((td, j) => <td key={j} className="px-4 py-3 text-sm text-slate-700 align-top">{processInlineFormatting(td, `td-${i}-${j}`)}</td>)}</tr>)}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                
                if (lines.every(line => line.trim().startsWith('* '))) {
                    return <ul key={blockIndex} className="list-disc list-outside ml-6 space-y-1">{lines.map((line, lineIndex) => <li key={lineIndex}>{processInlineFormatting(line.trim().substring(2), `ul-${blockIndex}-${lineIndex}`)}</li>)}</ul>;
                }
                
                if (lines.every(line => /^\d+\.\s/.test(line.trim()))) {
                    return <ol key={blockIndex} className="list-decimal list-outside ml-6 space-y-1">{lines.map((line, lineIndex) => <li key={lineIndex}>{processInlineFormatting(line.trim().replace(/^\d+\.\s/, ''), `ol-${blockIndex}-${lineIndex}`)}</li>)}</ol>;
                }
                
                return (
                    <p key={blockIndex}>
                        {lines.map((line, lineIndex) => {
                            const trimmedLine = line.trim();
                            // If a line in a paragraph block starts with heading marks, strip and style it correctly.
                            const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
                            if (headingMatch) {
                                const level = headingMatch[1].length;
                                const content = headingMatch[2];
                                const key = `p-h-${level}-${blockIndex}-${lineIndex}`;
                                const formatted = processInlineFormatting(content, key);
                                
                                let headingClass = "font-extrabold text-slate-800 block my-1.5 ";
                                if (level === 1) headingClass += "text-2xl";
                                else if (level === 2) headingClass += "text-xl";
                                else if (level === 3) headingClass += "text-lg";
                                else if (level === 4) headingClass += "text-base";
                                else headingClass += "text-sm text-slate-600";
                                
                                return (
                                    <span key={lineIndex} className={headingClass}>
                                        {formatted}
                                    </span>
                                );
                            }

                            return (
                                <React.Fragment key={lineIndex}>
                                    {processInlineFormatting(trimmedLine.startsWith('* ') ? trimmedLine.replace(/^\s*\*\s*/, '') : line, `p-${blockIndex}-${lineIndex}`)}
                                    {lineIndex < lines.length - 1 && <br />}
                                </React.Fragment>
                            );
                        })}
                    </p>
                );
            })}
        </div>
    );
};

export default MarkdownRenderer;
