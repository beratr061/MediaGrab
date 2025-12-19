import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Cookie, Subtitles, Globe, Shield, Languages, Download, RefreshCw, CheckCircle, Palette, Sun, Moon, Monitor, FileText, RotateCcw, Gauge, Contrast } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Select, type SelectOption } from "./ui/select";
import { UpdateButton } from "./UpdateButton";
import { CopyDebugInfoButton } from "./CopyDebugInfoButton";
import { useTheme, ACCENT_COLORS, type AccentColor, type Theme } from "./ThemeProvider";
import { useToast } from "./Toast";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { buttonVariants, springTransition, fadeInVariants, defaultTransition } from "@/lib/animations";
import { supportedLanguages, type SupportedLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Preferences } from "@/types";

type SettingsTab = "general" | "download" | "appearance" | "advanced" | "about";

const BROWSER_OPTIONS: { value: string; labelKey: string; label: string }[] = [
  { value: "", labelKey: "settings.cookiesNone", label: "None" },
  { value: "chrome", labelKey: "", label: "Google Chrome" },
  { value: "firefox", labelKey: "", label: "Mozilla Firefox" },
  { value: "edge", labelKey: "", label: "Microsoft Edge" },
  { value: "brave", labelKey: "", label: "Brave" },
  { value: "opera", labelKey: "", label: "Opera" },
  { value: "vivaldi", labelKey: "", label: "Vivaldi" },
  { value: "chromium", labelKey: "", label: "Chromium" },
];

const LANGUAGE_OPTIONS: SelectOption[] = supportedLanguages.map((lang) => ({
  value: lang.code,
  label: lang.nativeName,
}));

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences | null;
  onPreferencesChange: (prefs: Preferences) => void;
}

const DEFAULT_PREFERENCES: Preferences = {
  outputFolder: "",
  format: "video-mp4",
  quality: "best",
  embedSubtitles: false,
  cookiesFromBrowser: null,
  checkUpdatesOnStartup: true,
  checkAppUpdatesOnStartup: true,
  proxyEnabled: false,
  proxyUrl: null,
  filenameTemplate: null,
  cookiesFilePath: null,
  bandwidthLimit: null,
  scheduledDownloads: null,
};

// Bandwidth limit presets in KB/s
const BANDWIDTH_PRESETS = [
  { value: 0, label: 'Unlimited' },
  { value: 512, label: '512 KB/s' },
  { value: 1024, label: '1 MB/s' },
  { value: 2048, label: '2 MB/s' },
  { value: 5120, label: '5 MB/s' },
  { value: 10240, label: '10 MB/s' },
];

export function SettingsPanel({ isOpen, onClose, preferences, onPreferencesChange }: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, accentColor, setAccentColor, isHighContrast } = useTheme();
  const { success } = useToast();
  const focusTrapRef = useFocusTrap(isOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);
  const [newAppVersion, setNewAppVersion] = useState<string | null>(null);
  const [installingAppUpdate, setInstallingAppUpdate] = useState(false);
  const [appUpdateProgress, setAppUpdateProgress] = useState<{ downloaded: number; total: number | null } | null>(null);

  // Local state for settings
  const [checkUpdatesOnStartup, setCheckUpdatesOnStartup] = useState(preferences?.checkUpdatesOnStartup ?? true);
  const [embedSubtitles, setEmbedSubtitles] = useState(preferences?.embedSubtitles ?? false);
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState<string>(preferences?.cookiesFromBrowser ?? "");
  const [proxyEnabled, setProxyEnabled] = useState(preferences?.proxyEnabled ?? false);
  const [proxyUrl, setProxyUrl] = useState(preferences?.proxyUrl ?? "");
  const [filenameTemplate, setFilenameTemplate] = useState(preferences?.filenameTemplate ?? "");
  const [checkAppUpdatesOnStartup, setCheckAppUpdatesOnStartup] = useState(preferences?.checkAppUpdatesOnStartup ?? true);
  const [cookiesFilePath, setCookiesFilePath] = useState<string>(preferences?.cookiesFilePath ?? "");
  const [bandwidthLimit, setBandwidthLimit] = useState<number>(preferences?.bandwidthLimit ?? 0);

  const currentLanguage = (i18n.language?.split("-")[0] || "en") as SupportedLanguage;

  const browserOptions: SelectOption[] = BROWSER_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.labelKey ? t(opt.labelKey) : opt.label,
  }));

  useEffect(() => {
    if (isOpen) {
      invoke<string>("get_ytdlp_version_cmd").then(setYtdlpVersion).catch(() => setYtdlpVersion(null));
      invoke<string>("get_app_version").then(setAppVersion).catch(() => setAppVersion(null));
    }
  }, [isOpen]);

  useEffect(() => {
    const unlistenAvailable = listen<{ currentVersion: string; newVersion: string }>("app-update-available", (event) => {
      setAppUpdateAvailable(true);
      setNewAppVersion(event.payload.newVersion);
    });
    const unlistenProgress = listen<{ downloaded: number; total: number | null }>("app-update-progress", (event) => {
      setAppUpdateProgress(event.payload);
    });
    return () => {
      unlistenAvailable.then(fn => fn());
      unlistenProgress.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    if (preferences) {
      setCheckUpdatesOnStartup(preferences.checkUpdatesOnStartup);
      setEmbedSubtitles(preferences.embedSubtitles);
      setCookiesFromBrowser(preferences.cookiesFromBrowser ?? "");
      setProxyEnabled(preferences.proxyEnabled ?? false);
      setProxyUrl(preferences.proxyUrl ?? "");
      setCheckAppUpdatesOnStartup(preferences.checkAppUpdatesOnStartup ?? true);
      setFilenameTemplate(preferences.filenameTemplate ?? "");
      setCookiesFilePath(preferences.cookiesFilePath ?? "");
      setBandwidthLimit(preferences.bandwidthLimit ?? 0);
    }
  }, [preferences]);

  const savePreference = useCallback(async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    if (!preferences) return;
    const updatedPrefs = { ...preferences, [key]: value };
    try {
      await invoke("save_preferences", { preferences: updatedPrefs });
      onPreferencesChange(updatedPrefs);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
  }, [preferences, onPreferencesChange]);

  const handleResetToDefaults = useCallback(async () => {
    try {
      await invoke("save_preferences", { preferences: DEFAULT_PREFERENCES });
      onPreferencesChange(DEFAULT_PREFERENCES);
      success(t("toast.settingsSaved"));
    } catch (err) {
      console.error("Failed to reset preferences:", err);
    }
  }, [onPreferencesChange, success, t]);

  const handleLanguageChange = useCallback((value: string) => i18n.changeLanguage(value), [i18n]);
  const handleCheckUpdatesToggle = useCallback(() => { const v = !checkUpdatesOnStartup; setCheckUpdatesOnStartup(v); savePreference("checkUpdatesOnStartup", v); }, [checkUpdatesOnStartup, savePreference]);
  const handleEmbedSubtitlesToggle = useCallback(() => { const v = !embedSubtitles; setEmbedSubtitles(v); savePreference("embedSubtitles", v); }, [embedSubtitles, savePreference]);
  const handleCookieBrowserChange = useCallback((value: string) => { setCookiesFromBrowser(value); savePreference("cookiesFromBrowser", value || null); }, [savePreference]);
  const handleProxyToggle = useCallback(() => { const v = !proxyEnabled; setProxyEnabled(v); savePreference("proxyEnabled", v); }, [proxyEnabled, savePreference]);
  const handleProxyUrlChange = useCallback((value: string) => { setProxyUrl(value); savePreference("proxyUrl", value || null); }, [savePreference]);
  const handleFilenameTemplateChange = useCallback((value: string) => { setFilenameTemplate(value); savePreference("filenameTemplate", value || null); }, [savePreference]);
  const handleCheckAppUpdatesToggle = useCallback(() => { const v = !checkAppUpdatesOnStartup; setCheckAppUpdatesOnStartup(v); savePreference("checkAppUpdatesOnStartup", v); }, [checkAppUpdatesOnStartup, savePreference]);
  const handlePickCookiesFile = useCallback(async () => {
    try {
      const filePath = await invoke<string | null>("pick_cookies_file");
      if (filePath) {
        setCookiesFilePath(filePath);
        savePreference("cookiesFilePath", filePath);
      }
    } catch (err) {
      console.error("Failed to pick cookies file:", err);
    }
  }, [savePreference]);
  const handleClearCookiesFile = useCallback(() => {
    setCookiesFilePath("");
    savePreference("cookiesFilePath", null);
  }, [savePreference]);

  const handleBandwidthChange = useCallback((value: number) => {
    setBandwidthLimit(value);
    savePreference("bandwidthLimit", value === 0 ? null : value);
  }, [savePreference]);

  const handleCheckAppUpdate = useCallback(async () => {
    setCheckingAppUpdate(true);
    try {
      const result = await invoke<{ currentVersion: string; updateAvailable: boolean; newVersion: string | null; error: string | null }>("check_app_update");
      if (result.updateAvailable && result.newVersion) { setAppUpdateAvailable(true); setNewAppVersion(result.newVersion); }
      else { setAppUpdateAvailable(false); setNewAppVersion(null); }
    } catch (err) { console.error("Failed to check for app updates:", err); }
    finally { setCheckingAppUpdate(false); }
  }, []);

  const handleInstallAppUpdate = useCallback(async () => {
    setInstallingAppUpdate(true);
    setAppUpdateProgress(null);
    try { await invoke("install_app_update"); } catch (err) { console.error("Failed to install app update:", err); setInstallingAppUpdate(false); }
  }, []);

  const tabs: { id: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
    { id: "general", labelKey: "settings.tabs.general", icon: <Settings className="h-4 w-4" /> },
    { id: "download", labelKey: "settings.tabs.download", icon: <Download className="h-4 w-4" /> },
    { id: "appearance", labelKey: "settings.tabs.appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "advanced", labelKey: "settings.tabs.advanced", icon: <Shield className="h-4 w-4" /> },
    { id: "about", labelKey: "settings.tabs.about", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="fixed inset-0 bg-black/50 z-40" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={focusTrapRef}
            className="fixed right-0 top-0 bottom-0 w-[480px] bg-background border-l border-border shadow-lg z-50 flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" aria-hidden="true" />
                <h2 id="settings-title" className="text-lg font-semibold">{t("settings.title")}</h2>
              </div>
              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition}>
                <Button 
                  ref={closeButtonRef}
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  aria-label={t("buttons.close", "Close settings")}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </motion.div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-2" role="tablist" aria-label={t("settings.tabs.label", "Settings tabs")}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors relative",
                    activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                  {activeTab === tab.id && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4" role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                  {activeTab === "general" && (
                    <div className="space-y-6">
                      <Section title={t("settings.language")} icon={<Languages className="h-4 w-4" />}>
                        <Select value={currentLanguage} onChange={handleLanguageChange} options={LANGUAGE_OPTIONS} />
                      </Section>
                      <Section title={t("settings.appUpdate")} icon={<Download className="h-4 w-4" />}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{t("settings.currentVersion")}: {appVersion || "..."}</span>
                            {appUpdateAvailable ? (
                              <Button size="sm" onClick={handleInstallAppUpdate} disabled={installingAppUpdate}>
                                {installingAppUpdate ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{appUpdateProgress ? `${Math.round((appUpdateProgress.downloaded / (appUpdateProgress.total || 1)) * 100)}%` : t("settings.installing")}</>) : (<><Download className="h-4 w-4 mr-2" />{t("settings.updateTo")} {newAppVersion}</>)}
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={handleCheckAppUpdate} disabled={checkingAppUpdate}>
                                {checkingAppUpdate ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                {t("settings.checkForUpdates")}
                              </Button>
                            )}
                          </div>
                          <ToggleSwitch id="check-app-updates" label={t("settings.checkAppUpdatesOnStartup")} checked={checkAppUpdatesOnStartup} onChange={handleCheckAppUpdatesToggle} />
                        </div>
                      </Section>
                      <Section title={t("settings.ytdlpUpdate")}>
                        <div className="space-y-4">
                          <UpdateButton currentVersion={ytdlpVersion || undefined} />
                          <ToggleSwitch id="check-updates" label={t("settings.checkUpdates")} checked={checkUpdatesOnStartup} onChange={handleCheckUpdatesToggle} />
                        </div>
                      </Section>
                    </div>
                  )}

                  {activeTab === "download" && (
                    <div className="space-y-6">
                      <Section title={t("settings.embedSubtitles")} icon={<Subtitles className="h-4 w-4" />}>
                        <ToggleSwitch id="embed-subtitles" label={t("settings.embedSubtitlesDescription")} checked={embedSubtitles} onChange={handleEmbedSubtitlesToggle} />
                      </Section>
                      <Section title={t("settings.bandwidthLimit", "Bandwidth Limit")} icon={<Gauge className="h-4 w-4" />}>
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">{t("settings.bandwidthLimitDescription", "Limit download speed to save bandwidth")}</p>
                          <div className="flex flex-wrap gap-2">
                            {BANDWIDTH_PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                onClick={() => handleBandwidthChange(preset.value)}
                                className={cn(
                                  "px-3 py-1.5 text-sm rounded-md border transition-colors",
                                  bandwidthLimit === preset.value
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-muted-foreground/50"
                                )}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={bandwidthLimit || ''}
                              onChange={(e) => handleBandwidthChange(parseInt(e.target.value) || 0)}
                              placeholder="Custom (KB/s)"
                              min="0"
                              className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <span className="text-sm text-muted-foreground">KB/s</span>
                          </div>
                        </div>
                      </Section>
                      <Section title={t("settings.filenameTemplate")} icon={<FileText className="h-4 w-4" />}>
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">{t("settings.filenameTemplateDescription")}</p>
                          <input type="text" value={filenameTemplate} onChange={(e) => handleFilenameTemplateChange(e.target.value)} placeholder="{title}" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-medium">{t("settings.availablePlaceholders")}:</p>
                            <div className="grid grid-cols-3 gap-1">
                              <code className="bg-muted px-1 rounded">{"{title}"}</code>
                              <code className="bg-muted px-1 rounded">{"{uploader}"}</code>
                              <code className="bg-muted px-1 rounded">{"{channel}"}</code>
                              <code className="bg-muted px-1 rounded">{"{date}"}</code>
                              <code className="bg-muted px-1 rounded">{"{quality}"}</code>
                              <code className="bg-muted px-1 rounded">{"{id}"}</code>
                            </div>
                          </div>
                        </div>
                      </Section>
                    </div>
                  )}

                  {activeTab === "appearance" && (
                    <div className="space-y-6">
                      <Section title={t("settings.themeMode")} icon={<Palette className="h-4 w-4" />}>
                        <div className="grid grid-cols-2 gap-2">
                          <ThemeModeButton mode="light" currentMode={theme} onClick={() => setTheme("light")} icon={<Sun className="h-4 w-4" />} label={t("settings.themeLight")} />
                          <ThemeModeButton mode="dark" currentMode={theme} onClick={() => setTheme("dark")} icon={<Moon className="h-4 w-4" />} label={t("settings.themeDark")} />
                          <ThemeModeButton mode="system" currentMode={theme} onClick={() => setTheme("system")} icon={<Monitor className="h-4 w-4" />} label={t("settings.themeSystem")} />
                          <ThemeModeButton mode="high-contrast" currentMode={theme} onClick={() => setTheme("high-contrast")} icon={<Contrast className="h-4 w-4" />} label={t("settings.themeHighContrast", "High Contrast")} />
                        </div>
                      </Section>
                      {!isHighContrast && (
                        <Section title={t("settings.accentColor")}>
                          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("settings.accentColor")}>
                            {ACCENT_COLORS.map((color) => (
                              <AccentColorButton key={color.name} color={color.name} hsl={color.hsl} isSelected={accentColor === color.name} onClick={() => setAccentColor(color.name)} label={t(`settings.colors.${color.name}`)} />
                            ))}
                          </div>
                        </Section>
                      )}
                    </div>
                  )}

                  {activeTab === "advanced" && (
                    <div className="space-y-6">
                      <Section title={t("settings.cookies")} icon={<Cookie className="h-4 w-4" />}>
                        <div className="space-y-4">
                          <p className="text-xs text-muted-foreground">{t("settings.cookiesDescription")}</p>
                          
                          {/* Custom cookies.txt file */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t("settings.cookiesFile")}</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={cookiesFilePath}
                                readOnly
                                placeholder={t("settings.cookiesFilePlaceholder")}
                                className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm"
                              />
                              <Button variant="outline" size="sm" onClick={handlePickCookiesFile}>
                                {t("buttons.browse")}
                              </Button>
                              {cookiesFilePath && (
                                <Button variant="ghost" size="sm" onClick={handleClearCookiesFile}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{t("settings.cookiesFileDescription")}</p>
                          </div>
                          
                          {/* Browser cookies (fallback) */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t("settings.cookiesBrowser")}</label>
                            <Select value={cookiesFromBrowser} onChange={handleCookieBrowserChange} options={browserOptions} disabled={!!cookiesFilePath} />
                            {cookiesFilePath && <p className="text-xs text-muted-foreground">{t("settings.cookiesFileOverride")}</p>}
                          </div>
                        </div>
                      </Section>
                      <Section title={t("settings.proxy")} icon={<Globe className="h-4 w-4" />}>
                        <div className="space-y-3">
                          <ToggleSwitch id="proxy-enabled" label={t("settings.proxyEnabled")} checked={proxyEnabled} onChange={handleProxyToggle} />
                          {proxyEnabled && (
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">{t("settings.proxyUrl")}</label>
                              <input type="text" value={proxyUrl} onChange={(e) => handleProxyUrlChange(e.target.value)} placeholder={t("settings.proxyPlaceholder")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            </div>
                          )}
                        </div>
                      </Section>
                      <Section title={t("settings.resetToDefaults")} icon={<RotateCcw className="h-4 w-4" />}>
                        <Button variant="outline" onClick={handleResetToDefaults} className="w-full">
                          <RotateCcw className="h-4 w-4 mr-2" />{t("settings.resetToDefaults")}
                        </Button>
                      </Section>
                    </div>
                  )}

                  {activeTab === "about" && (
                    <div className="space-y-6">
                      <Section title="Debug">
                        <CopyDebugInfoButton />
                      </Section>
                      <Section title={t("app.title")}>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{t("app.description")}</p>
                          {appVersion && <p>Version: {appVersion}</p>}
                          {ytdlpVersion && <p>yt-dlp: {ytdlpVersion}</p>}
                        </div>
                      </Section>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


// Helper Components
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section variants={fadeInVariants} initial="initial" animate="animate" transition={defaultTransition}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </motion.section>
  );
}

function ToggleSwitch({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm text-muted-foreground cursor-pointer flex-1 pr-4">{label}</label>
      <button 
        id={id} 
        type="button"
        role="switch" 
        aria-checked={checked}
        aria-label={label}
        onClick={onChange} 
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange();
          }
        }}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span 
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-background shadow-sm transition-transform",
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )} 
        />
      </button>
    </div>
  );
}

function ThemeModeButton({ mode, currentMode, onClick, icon, label }: { mode: Theme; currentMode: Theme; onClick: () => void; icon: React.ReactNode; label: string }) {
  const isSelected = mode === currentMode;
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected 
          ? 'border-primary bg-primary/10 text-primary' 
          : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
      )} 
      role="radio"
      aria-checked={isSelected}
      aria-label={label}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function AccentColorButton({ hsl, isSelected, onClick, label }: { color: AccentColor; hsl: string; isSelected: boolean; onClick: () => void; label: string }) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-8 h-8 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-105'
      )} 
      style={{ backgroundColor: `hsl(${hsl})` }} 
      role="radio"
      aria-checked={isSelected}
      aria-label={label} 
      title={label}
    >
      {isSelected && <CheckCircle className="h-4 w-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md" aria-hidden="true" />}
    </button>
  );
}
