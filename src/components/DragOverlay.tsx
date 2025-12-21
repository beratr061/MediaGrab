/**
 * DragOverlay - Visual overlay shown during drag and drop
 */

import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DragOverlayProps {
    isVisible: boolean;
}

export function DragOverlay({ isVisible }: DragOverlayProps) {
    const { t } = useTranslation();

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="drag-overlay"
                    role="presentation"
                    aria-hidden="true"
                >
                    <div className="drag-overlay-content">
                        <Upload className="h-12 w-12 text-primary" aria-hidden="true" />
                        <p className="text-lg font-medium">{t("dragDrop.dropUrl", "Drop URL or .txt file here")}</p>
                        <p className="text-sm text-muted-foreground">{t("dragDrop.hint", "Drop a video URL or a text file with multiple URLs")}</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
