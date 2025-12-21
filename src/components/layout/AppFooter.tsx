/**
 * AppFooter - Application footer with keyboard shortcuts
 */

import { memo } from "react";

interface AppFooterProps {
    t: (key: string) => string;
}

export const AppFooter = memo(function AppFooter({ t }: AppFooterProps) {
    return (
        <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/50 backdrop-blur-sm" role="contentinfo">
            <div className="mx-auto flex max-w-3xl items-center justify-center gap-6 px-6 py-2 text-xs text-muted-foreground">
                <span><kbd className="rounded bg-muted px-1.5 py-0.5">Ctrl+V</kbd> {t("shortcuts.paste")}</span>
                <span><kbd className="rounded bg-muted px-1.5 py-0.5">Enter</kbd> {t("shortcuts.download")}</span>
                <span><kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> {t("shortcuts.cancel")}</span>
            </div>
        </footer>
    );
});
