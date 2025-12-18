import { memo } from "react";
import { motion } from "framer-motion";
import { Link } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlatformIcon, SUPPORTED_PLATFORMS } from "./PlatformIcon";
import { containerVariants, itemVariants } from "@/lib/animations";

interface EmptyStateProps {
  className?: string;
}

export const EmptyState = memo(function EmptyState({ className }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className={className}
    >
      <div className="flex flex-col items-center justify-center py-8 text-center">
        {/* Icon */}
        <motion.div
          variants={itemVariants}
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"
        >
          <Link className="h-8 w-8 text-muted-foreground" />
        </motion.div>

        {/* Title */}
        <motion.h3 variants={itemVariants} className="text-lg font-medium text-foreground">
          {t("emptyState.title")}
        </motion.h3>

        {/* Description */}
        <motion.p variants={itemVariants} className="mt-1 text-sm text-muted-foreground max-w-xs">
          {t("emptyState.description")}
        </motion.p>

        {/* Supported platforms */}
        <motion.div variants={itemVariants} className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">{t("emptyState.supportedPlatforms")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {SUPPORTED_PLATFORMS.map((platform, index) => (
              <motion.div
                key={platform}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <PlatformIcon platform={platform} size="lg" />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Keyboard shortcut hint */}
        <motion.div variants={itemVariants} className="mt-6 text-xs text-muted-foreground">
          <kbd className="rounded bg-muted px-2 py-1 font-mono">Ctrl+V</kbd>
          <span className="ml-2">{t("emptyState.pasteHint")}</span>
        </motion.div>
      </div>
    </motion.div>
  );
});
