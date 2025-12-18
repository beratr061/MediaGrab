import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Cookie, Subtitles, Globe, ChevronDown, ChevronRight, Shield } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { Select, type SelectOption } from "./ui/select";
import { UpdateButton } from "./UpdateButton";
import { CopyDebugInfoButton } from "./CopyDebugInfoButton";
import { buttonVariants, springTransition, fadeInVariants, defaultTransition } from "@/lib/animations";
import type { Preferences } from "@/types";

/**
 * Supported browsers for cookie import
 */
const SUPPORTED_BROWSERS: SelectOption[] = [
  { value: "", label: "Devre dışı" },
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
  const [embedSubtitles, setEmbedSubtitles] = useState(
    preferences?.embedSubtitles ?? false
  );
  
  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState<string>(
    preferences?.cookiesFromBrowser ?? ""
  );
  const [proxyEnabled, setProxyEnabled] = useState(
    preferences?.proxyEnabled ?? false
  );
  const [proxyUrl, setProxyUrl] = useState(
    preferences?.proxyUrl ?? ""
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
      setEmbedSubtitles(preferences.embedSubtitles);
      setCookiesFromBrowser(preferences.cookiesFromBrowser ?? "");
      setProxyEnabled(preferences.proxyEnabled ?? false);
      setProxyUrl(preferences.proxyUrl ?? "");
    }
  }, [preferences]);

  const savePreference = useCallback(async <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    if (!preferences) return;
    
    const updatedPrefs = { ...preferences, [key]: value };
    
    try {
      await invoke("save_preferences", { preferences: updatedPrefs });
      onPreferencesChange(updatedPrefs);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
  }, [preferences, onPreferencesChange]);

  const handleCheckUpdatesToggle = useCallback(() => {
    const newValue = !checkUpdatesOnStartup;
    setCheckUpdatesOnStartup(newValue);
    savePreference("checkUpdatesOnStartup", newValue);
  }, [checkUpdatesOnStartup, savePreference]);

  const handleEmbedSubtitlesToggle = useCallback(() => {
    const newValue = !embedSubtitles;
    setEmbedSubtitles(newValue);
    savePreference("embedSubtitles", newValue);
  }, [embedSubtitles, savePreference]);

  const handleCookieBrowserChange = useCallback((value: string) => {
    setCookiesFromBrowser(value);
    savePreference("cookiesFromBrowser", value || null);
  }, [savePreference]);

  const handleProxyToggle = useCallback(() => {
    const newValue = !proxyEnabled;
    setProxyEnabled(newValue);
    savePreference("proxyEnabled", newValue);
  }, [proxyEnabled, savePreference]);

  const handleProxyUrlChange = useCallback((value: string) => {
    setProxyUrl(value);
    savePreference("proxyUrl", value || null);
  }, [savePreference]);

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
            className="fixed right-0 top-0 bottom-0 w-96 bg-background border-l border-border shadow-lg z-50 overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Ayarlar</h2>
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
                <h3 className="text-sm font-medium mb-3">yt-dlp Güncellemeleri</h3>
                
                <div className="space-y-4">
                  <UpdateButton currentVersion={ytdlpVersion || undefined} />
                  
                  <ToggleSwitch
                    id="check-updates"
                    label="Başlangıçta güncelleme kontrolü"
                    checked={checkUpdatesOnStartup}
                    onChange={handleCheckUpdatesToggle}
                  />
                </div>
              </motion.section>
              
              <hr className="border-border" />
              
              {/* Subtitle Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Subtitles className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Altyazı Ayarları</h3>
                </div>
                
                <div className="space-y-3">
                  <ToggleSwitch
                    id="embed-subtitles"
                    label="Altyazıları videoya göm"
                    checked={embedSubtitles}
                    onChange={handleEmbedSubtitlesToggle}
                  />
                  
                  {embedSubtitles && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      ℹ️ Tüm mevcut altyazılar videoya gömülecektir.
                    </p>
                  )}
                </div>
              </motion.section>
              
              <hr className="border-border" />
              
              {/* Advanced Settings Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.15 }}
              >
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <h3 className="text-sm font-medium">Gelişmiş Ayarlar</h3>
                  </div>
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-6">
                        {/* Cookie Authentication */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Cookie className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Çerez Kimlik Doğrulama</span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            Özel, yaş kısıtlamalı veya abonelik içeriklerine erişmek için 
                            tarayıcınızdan çerezleri içe aktarın.
                          </p>
                          
                          <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">
                              Çerezleri içe aktar
                            </label>
                            <Select
                              value={cookiesFromBrowser}
                              onChange={handleCookieBrowserChange}
                              options={SUPPORTED_BROWSERS}
                              placeholder="Tarayıcı seçin..."
                            />
                          </div>
                          
                          {cookiesFromBrowser && (
                            <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded p-2">
                              ⚠️ İndirmeden önce seçili tarayıcının kapalı olduğundan emin olun.
                            </p>
                          )}
                        </div>
                        
                        <hr className="border-border" />
                        
                        {/* Proxy Settings */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Proxy Ayarları</span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            Bölge kısıtlamalarını aşmak veya gizlilik için proxy kullanın.
                          </p>
                          
                          <ToggleSwitch
                            id="proxy-enabled"
                            label="Proxy kullan"
                            checked={proxyEnabled}
                            onChange={handleProxyToggle}
                          />
                          
                          {proxyEnabled && (
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">
                                Proxy URL
                              </label>
                              <input
                                type="text"
                                value={proxyUrl}
                                onChange={(e) => handleProxyUrlChange(e.target.value)}
                                placeholder="http://127.0.0.1:8080 veya socks5://127.0.0.1:1080"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                              <p className="text-xs text-muted-foreground">
                                Desteklenen formatlar: http://, https://, socks4://, socks5://
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
              
              <hr className="border-border" />
              
              {/* Debug Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.2 }}
              >
                <h3 className="text-sm font-medium mb-3">Sorun Giderme</h3>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Sorun bildirirken paylaşmak için hata ayıklama bilgilerini kopyalayın.
                  </p>
                  <CopyDebugInfoButton />
                </div>
              </motion.section>
              
              <hr className="border-border" />
              
              {/* About Section */}
              <motion.section
                variants={fadeInVariants}
                initial="initial"
                animate="animate"
                transition={{ ...defaultTransition, delay: 0.25 }}
              >
                <h3 className="text-sm font-medium mb-3">Hakkında</h3>
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

// Toggle Switch Component
interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}

function ToggleSwitch({ id, label, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <label 
        htmlFor={id} 
        className="text-sm text-muted-foreground cursor-pointer"
      >
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${checked ? 'bg-primary' : 'bg-muted'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-background transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
}
