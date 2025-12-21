/**
 * ErrorDisplay - Displays errors with localized messages and suggestions
 * Uses the centralized error type system
 */

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    WifiOff,
    Lock,
    Globe,
    Clock,
    FileQuestion,
    RefreshCw,
    FolderX,
    Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    parseErrorType,
    getErrorI18nKey,
    getSuggestionI18nKey,
    isRetryableError,
    getErrorCategory,
    type DownloadErrorType
} from "@/types";

interface ErrorDisplayProps {
    error: string;
    onRetry?: () => void;
    onOpenSettings?: () => void;
    className?: string;
    compact?: boolean;
}

/**
 * Gets the appropriate icon for an error type
 */
function getErrorIcon(errorType: DownloadErrorType) {
    const category = getErrorCategory(errorType);

    switch (category) {
        case 'network':
            return WifiOff;
        case 'access':
        case 'auth':
            return Lock;
        case 'not_found':
            return FileQuestion;
        case 'rate_limit':
            return Clock;
        case 'filesystem':
            return FolderX;
        case 'validation':
            return Globe;
        default:
            return AlertTriangle;
    }
}

/**
 * Gets the appropriate color class for an error type
 */
function getErrorColorClass(errorType: DownloadErrorType): string {
    const category = getErrorCategory(errorType);

    switch (category) {
        case 'network':
        case 'not_found':
            return "text-amber-500";
        case 'access':
        case 'auth':
            return "text-orange-500";
        case 'rate_limit':
            return "text-yellow-500";
        default:
            return "text-destructive";
    }
}

export function ErrorDisplay({
    error,
    onRetry,
    onOpenSettings,
    className = "",
    compact = false,
}: ErrorDisplayProps) {
    const { t } = useTranslation();

    // Parse the error type from the message
    const errorType = parseErrorType(error);
    const isRetryable = isRetryableError(errorType);

    // Get i18n keys
    const errorKey = getErrorI18nKey(errorType);
    const suggestionKey = getSuggestionI18nKey(errorType);

    // Get translated messages (fallback to original error if key not found)
    const errorMessage = t(errorKey, error);
    const suggestion = suggestionKey ? t(suggestionKey) : null;

    // Get icon
    const Icon = getErrorIcon(errorType);
    const colorClass = getErrorColorClass(errorType);

    // Check if this error suggests opening settings (auth/cookie related)
    const suggestsSettings = ['AgeRestricted', 'AuthenticationRequired', 'PrivateVideo'].includes(errorType);

    if (compact) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <Icon className={`h-4 w-4 ${colorClass} shrink-0`} />
                <span className="text-sm text-muted-foreground truncate">
                    {errorMessage}
                </span>
                {isRetryable && onRetry && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRetry}
                        className="shrink-0 h-6 px-2"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {t("buttons.retry")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border border-destructive/20 bg-destructive/5 p-4 ${className}`}
        >
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full bg-destructive/10 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                        {errorMessage}
                    </p>

                    {suggestion && (
                        <p className="text-sm text-muted-foreground mt-1">
                            {suggestion}
                        </p>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                        {isRetryable && onRetry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRetry}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {t("buttons.retry")}
                            </Button>
                        )}

                        {suggestsSettings && onOpenSettings && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenSettings}
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                {t("cookies.openSettings")}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/**
 * Simple error text with icon - for inline use
 */
export function ErrorText({
    error,
    className = ""
}: {
    error: string;
    className?: string;
}) {
    const { t } = useTranslation();
    const errorType = parseErrorType(error);
    const errorKey = getErrorI18nKey(errorType);
    const errorMessage = t(errorKey, error);
    const Icon = getErrorIcon(errorType);
    const colorClass = getErrorColorClass(errorType);

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <Icon className={`h-4 w-4 ${colorClass}`} />
            <span className="text-muted-foreground">{errorMessage}</span>
        </span>
    );
}
