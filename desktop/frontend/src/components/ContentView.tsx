import Markdown from "react-markdown";

interface ContentViewProps {
  content: string;
  title?: string;
  contentType?: string;
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-ctp-blue font-bold text-lg mb-2">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-ctp-blue font-bold text-base mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-ctp-sapphire font-bold text-sm mb-1">{children}</h3>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    if (className?.includes("language-")) {
      return (
        <pre className="bg-ctp-mantle rounded p-3 text-xs overflow-x-auto font-mono">
          <code className="text-ctp-text">{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-ctp-surface0 text-ctp-yellow px-1 rounded text-xs font-mono">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-ctp-overlay0 pl-3 text-ctp-overlay1 italic">
      {children}
    </blockquote>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-4 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-4 space-y-0.5">{children}</ol>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} className="text-ctp-blue underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  hr: () => <hr className="border-ctp-surface1 my-4" />,
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2">{children}</p>,
};

export function ContentView({ content, title, contentType }: ContentViewProps) {
  const isMarkdown =
    !contentType || contentType === "md" || contentType === "markdown";

  return (
    <div className="h-full overflow-auto">
      {title && (
        <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{title}</span>
        </div>
      )}
      <div className="p-4 selectable">
        {isMarkdown ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <Markdown components={markdownComponents}>{content}</Markdown>
          </div>
        ) : (
          <pre className="font-mono text-xs text-foreground whitespace-pre-wrap">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
