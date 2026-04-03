import Markdown from "react-markdown";

interface ContentViewProps {
  content: string;
  title?: string;
  contentType?: string;
}

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
            <Markdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-ctp-blue font-bold text-lg mb-2">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-ctp-blue font-bold text-base mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-ctp-sapphire font-bold text-sm mb-1">
                    {children}
                  </h3>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="bg-ctp-mantle rounded p-3 text-xs overflow-x-auto">
                        <code className="text-ctp-text">{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-ctp-surface0 text-ctp-yellow px-1 rounded text-xs">
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-ctp-overlay0 pl-3 text-ctp-overlay1 italic">
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 space-y-0.5">{children}</ol>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-ctp-blue underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-ctp-surface1 my-4" />,
                p: ({ children }) => <p className="mb-2">{children}</p>,
              }}
            >
              {content}
            </Markdown>
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
