/**
 * UpdateBanner - Notification banner for available updates
 */

import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface UpdateInfo {
    currentVersion: string;
    latestVersion: string | null;
}

interface UpdateBannerProps {
    updateInfo: UpdateInfo | null;
    onDismiss: () => void;
    onUpdate: () => void;
}

export function UpdateBanner({ updateInfo, onDismiss, onUpdate }: UpdateBannerProps) {
    const { t } = useTranslation();

    if (!updateInfo) return null;

    return (
        <motion.div
            className="fixed top-16 left-0 right-0 z-30"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
        >
            <div className="mx-auto max-w-3xl px-6">
                <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Bell className="h-4 w-4 text-primary" />
                        <span>
                            {t("update.available")}
                            {updateInfo.latestVersion && ` ${t("update.version", { version: updateInfo.latestVersion })}`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={onDismiss}>
                            {t("buttons.dismiss")}
                        </Button>
                        <Button size="sm" onClick={onUpdate}>
                            {t("buttons.update")}
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
