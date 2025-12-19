import { Sparkles, MonitorPlay, HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select, type SelectOption } from "./ui/select";
import type { Quality } from "@/types";

// Estimated file sizes per minute of video (rough approximations)
const ESTIMATED_SIZES: Record<Quality, string> = {
  best: "~150 MB/min",
  "1080p": "~100 MB/min",
  "720p": "~50 MB/min",
};

interface QualitySelectorProps {
  id?: string;
  value: Quality;
  onChange: (value: Quality) => void;
  disabled?: boolean;
  className?: string;
  duration?: number | null | undefined; // Video duration in seconds for size estimation
}

export function QualitySelector({ id, value, onChange, disabled, className, duration }: QualitySelectorProps) {
  const { t } = useTranslation();
  
  const qualityOptions: SelectOption<Quality>[] = [
    { 
      value: "best", 
      label: t("quality.best", "Best Quality"), 
      icon: <Sparkles className="h-4 w-4" />,
    },
    { 
      value: "1080p", 
      label: t("quality.1080p", "1080p HD"), 
      icon: <MonitorPlay className="h-4 w-4" />,
    },
    { 
      value: "720p", 
      label: t("quality.720p", "720p HD"), 
      icon: <MonitorPlay className="h-4 w-4" />,
    },
  ];

  // Calculate estimated file size if duration is provided
  const getEstimatedSize = (quality: Quality): string => {
    if (!duration || duration <= 0) return ESTIMATED_SIZES[quality];
    
    const minutes = duration / 60;
    const mbPerMin = quality === "best" ? 150 : quality === "1080p" ? 100 : 50;
    const totalMb = minutes * mbPerMin;
    
    if (totalMb >= 1024) {
      return `~${(totalMb / 1024).toFixed(1)} GB`;
    }
    return `~${Math.round(totalMb)} MB`;
  };

  const optionsWithSize = qualityOptions.map((opt) => ({
    ...opt,
    label: `${opt.label} (${getEstimatedSize(opt.value)})`,
  }));

  return (
    <div className="space-y-1">
      <Select
        id={id}
        value={value}
        onChange={onChange}
        options={optionsWithSize}
        disabled={disabled}
        className={className}
        aria-label={t("accessibility.selectQuality", "Select video quality")}
      />
      {duration && duration > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span>{t("mediaInfo.estimated", { size: getEstimatedSize(value) })}</span>
        </div>
      )}
    </div>
  );
}
