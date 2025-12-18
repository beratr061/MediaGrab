import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { buttonVariants, springTransition } from "@/lib/animations";

interface OpenFolderButtonProps {
  folderPath: string;
  disabled?: boolean;
}

/**
 * Button to open the output folder in Windows Explorer
 * Requirements: 4.3 - Display buttons to open the output folder
 */
export function OpenFolderButton({ folderPath, disabled }: OpenFolderButtonProps) {
  const handleClick = async () => {
    try {
      await invoke("open_folder", { path: folderPath });
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  return (
    <motion.div
      variants={buttonVariants}
      whileHover={disabled ? {} : "hover"}
      whileTap={disabled ? {} : "tap"}
      transition={springTransition}
    >
      <Button
        onClick={handleClick}
        disabled={disabled || !folderPath}
        variant="outline"
        className="flex items-center gap-2"
        size="default"
      >
        <FolderOpen className="h-4 w-4" />
        Open Folder
      </Button>
    </motion.div>
  );
}
