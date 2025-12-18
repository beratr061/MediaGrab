import { Video, Music } from "lucide-react";
import { Select, type SelectOption } from "./ui/select";
import type { Format } from "@/types";

const formatOptions: SelectOption<Format>[] = [
  { value: "video-mp4", label: "Video (MP4)", icon: <Video className="h-4 w-4" /> },
  { value: "audio-mp3", label: "Audio (MP3)", icon: <Music className="h-4 w-4" /> },
  { value: "audio-best", label: "Audio (Best)", icon: <Music className="h-4 w-4" /> },
];

interface FormatSelectorProps {
  id?: string;
  value: Format;
  onChange: (value: Format) => void;
  disabled?: boolean;
  className?: string;
}

export function FormatSelector({ id, value, onChange, disabled, className }: FormatSelectorProps) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={formatOptions}
      disabled={disabled}
      className={className}
      aria-label="Select download format"
    />
  );
}
