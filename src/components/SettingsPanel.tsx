import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Cookie } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { Select, type SelectOption } from "./ui/select";
import { UpdateButton } from "./UpdateButton";
import { CopyDebugInfoButton } from "./CopyDebugInfoButton";
import { buttonVariants, springTransition, fadeInVariants, defaultTransition } from "@/lib/animations";
import type { Preferences } from "@/types";

/**
 * Supported browsers for cookie import
 * Requirements: 13.1, 13.3 - Support Chrome, Firefox, Edge, Brave, and other Chromium-based browsers
 */
const SUPPORTED_BROWSERS: SelectOption[] = [
  { value: "", label: "None (disabled)" },
  { value: "chrome", label: "Google Chrome" },
  { value: "firefox", label: "Mozilla Firefox" },
  { value: "edge", label: "Microsoft Edge" },
  { value: "brave", label: "Brave" },
  { value: "opera", label: "Opera" },
  { value: "vivaldi", label: "Vivaldi" },
  { value: "chromium", label: "Chromium" },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences | null;
  onPreferencesChange: (prefs: Preferences) => void;
}

/**
 * Settings panel component with yt-dlp update controls
 * 
 * **Validates: Requirements 7.6, 7.7**
 */
export function SettingsPanel({ 
  isOpen, 
  onClose, 
  preferences,
  onPreferencesChange 
}: SettingsPanelProps) {
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
  const [checkUpdatesOnStartup, setCheckUpdatesOnStartup] = useState(
    preferences?.checkUpdatesOnStartup ?? true
  );
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState<string>(
    preferences?.cookiesFromBrowser ?? ""
  );

  // Fetch yt-dlp version on mount
  useEffect(() => {
    if (isOpen) {
      invoke<string>("get_ytdlp_version_cmd")
        .then(setYtdlpVersion)
        .catch(() => setYtdlpVersion(null));
    }
  }, [isOpen]);

  // Sync with preferences
  useEffect(() => {
    if (preferences) {
      setCheckUpdatesOnStartup(preferences.checkUpdatesOnStartup);
      setCookiesFromBrowser(preferences.cookiesFromBrowser ?? "");
    }
  }, [preferences]);

  const handleCheckUpdatesToggle = useCallback(async () => {
    const newValue = !checkUpdatesOnStartup;
    setCheckUpdatesOnStartup(newValue);
    
    if (preferences) {
      const updatedPrefs = {
        ...preferences,
        checkUpdatesOnStartup: newValue,
      };
      
      try {
        await invoke("save_preferences", { preferences: updatedPrefs });
        onPreferencesChange(updatedPrefs);
      } catch (err) {
        console.error("Failed to save preferences:", err);
        // Revert on error
        setCheckUpdatesOnStartup(!newValue);
      }
    }
  }, [checkUpdatesOnStartup, preferences, onPreferencesChange]);

  /**
   * Handle browser cookie selection change
   * Requirements: 13.1 - Use --cookies-from-browser flag with selected browser
   */
  const handleCookieBrowserChange = useCallback(async (value: string) => {
    const previousValue = cookiesFromBrowser;
    const newValue = value || null; // Convert empty string to null
    setCookiesFromBrowser(value);
    
    if (preferences) {
      const updatedPrefs = {
        ...preferences,
        cookiesFromBrowser: newValue,
      };
      
      try {
        await invoke("save_preferences", { preferences: updatedPrefs });
        onPreferencesChange(updatedPrefs);
      } catch (err) {
        console.error("Failed to save preferences:", err);
        // Revert on error
        setCookiesFromBrowser(previousValue);
      }
    }
  }, [cookiesFromBrowser, preferences, onPreferencesChange]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l border-border shadow-lg z-50 overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Settings</h2>
              </div>
              <motion.div
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                transition={springTransition}
              >
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-6">
              {/* yt-dlp Update Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={defaultTransition}
              >
                <h3 className="text-sm font-medium mb-3">yt-dlp Updates</h3>
                
                <div className="space-y-4">
                  {/* Update Button */}
                  <UpdateButton currentVersion={ytdlpVersion || undefined} />
                  
                  {/* Auto-check toggle */}
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor="check-updates" 
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Check for updates on startup
                    </label>
                    <button
                      id="check-updates"
                      role="switch"
                      aria-checked={checkUpdatesOnStartup}
                      onClick={handleCheckUpdatesToggle}
                      className={`
                        relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                        ${checkUpdatesOnStartup ? 'bg-primary' : 'bg-muted'}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-background transition-transform
                          ${checkUpdatesOnStartup ? 'translate-x-4' : 'translate-x-0.5'}
                        `}
                      />
                    </button>
                  </div>
                </div>
              </motion.section>
              
              {/* Divider */}
              <hr className="border-border" />
              
              {/* Cookie Authentication Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Cookie className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Cookie Authentication</h3>
                </div>
                
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Import cookies from your browser to access private, age-restricted, 
                    or subscription content you have legitimate access to.
                  </p>
                  
                  <div className="space-y-2">
                    <label 
                      htmlFor="cookie-browser" 
                      className="text-sm text-muted-foreground"
                    >
                      Import cookies from
                    </label>
                    <Select
                      value={cookiesFromBrowser}
                      onChange={handleCookieBrowserChange}
                      options={SUPPORTED_BROWSERS}
                      placeholder="Select browser..."
                    />
                  </div>
                  
                  {cookiesFromBrowser && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      ⚠️ Make sure the selected browser is closed before downloading 
                      to avoid cookie access issues.
                    </p>
                  )}
                </div>
              </motion.section>
              
              {/* Divider */}
              <hr className="border-border" />
              
              {/* Debug Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.2 }}
              >
                <h3 className="text-sm font-medium mb-3">Troubleshooting</h3>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Copy debug information to share when reporting issues.
                  </p>
                  <CopyDebugInfoButton />
                </div>
              </motion.section>
              
              {/* Divider */}
              <hr className="border-border" />
              
              {/* About Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.3 }}
              >
                <h3 className="text-sm font-medium mb-3">About</h3>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>MediaGrab - Media Downloader</p>
                  {ytdlpVersion && <p>yt-dlp: {ytdlpVersion}</p>}
                </div>
              </motion.section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
