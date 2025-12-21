/**
 * AppHeader - Application header with navigation controls
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { Settings, ListOrdered, History } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { buttonVariants, springTransition } from "@/lib/animations";

interface AppHeaderProps {
    activeCount: number;
    pendingCount: number;
    updateAvailable: boolean;
    onHistoryClick: () => void;
    onQueueClick: () => void;
    onSettingsClick: () => void;
    t: (key: string) => string;
}

export const AppHeader = memo(function AppHeader({
    activeCount,
    pendingCount,
    updateAvailable,
    onHistoryClick,
    onQueueClick,
    onSettingsClick,
    t,
}: AppHeaderProps) {
    return (
        <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
                <h1 className="text-xl font-semibold text-foreground">{t("app.title")}</h1>
                <nav className="flex items-center gap-2" aria-label="Application controls">
                    <ThemeToggle />
                    <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition}>
                        <Button variant="ghost" size="icon" title={t("header.history")} onClick={onHistoryClick}>
                            <History className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </motion.div>
                    <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition} className="relative">
                        <Button variant="ghost" size="icon" title={t("header.queue")} onClick={onQueueClick}>
                            <ListOrdered className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {(activeCount > 0 || pendingCount > 0) && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                                {activeCount + pendingCount}
                            </span>
                        )}
                    </motion.div>
                    <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition} className="relative">
                        <Button variant="ghost" size="icon" title={t("header.settings")} onClick={onSettingsClick}>
                            <Settings className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {updateAvailable && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />}
                    </motion.div>
                </nav>
            </div>
        </header>
    );
});
