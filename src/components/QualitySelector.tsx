import { Sparkles, MonitorPlay } from "lucide-react";
import { Select, type SelectOption } from "./ui/select";
import type { Quality } from "@/types";

const qualityOptions: SelectOption<Quality>[] = [
  { value: "best", label: "Best Quality", icon: <Sparkles className="h-4 w-4" /> },
  { value: "1080p", label: "1080p", icon: <MonitorPlay className="h-4 w-4" /> },
  { value: "720p", label: "720p", icon: <MonitorPlay className="h-4 w-4" /> },
];

interface QualitySelectorProps {
  value: Quality;
  onChange: (value: Quality) => void;
  disabled?: boolean;
  className?: string;
}

export function QualitySelector({ value, onChange, disabled, className }: QualitySelectorProps) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={qualityOptions}
      disabled={disabled}
      className={className}
    />
  );
}
