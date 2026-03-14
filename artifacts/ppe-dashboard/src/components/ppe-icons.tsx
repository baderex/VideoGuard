import { HardHat, Shield, HandMetal, Glasses, VenetianMask, Footprints, Info } from "lucide-react";
import { CameraPpeRequirementsItem } from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const ppeIconMap: Record<string, React.ElementType> = {
  [CameraPpeRequirementsItem.hard_hat]: HardHat,
  [CameraPpeRequirementsItem.safety_vest]: Shield,
  [CameraPpeRequirementsItem.gloves]: HandMetal,
  [CameraPpeRequirementsItem.safety_glasses]: Glasses,
  [CameraPpeRequirementsItem.face_mask]: VenetianMask,
  [CameraPpeRequirementsItem.safety_boots]: Footprints,
};

export const ppeLabelMap: Record<string, string> = {
  [CameraPpeRequirementsItem.hard_hat]: "Hard Hat",
  [CameraPpeRequirementsItem.safety_vest]: "Safety Vest",
  [CameraPpeRequirementsItem.gloves]: "Gloves",
  [CameraPpeRequirementsItem.safety_glasses]: "Safety Glasses",
  [CameraPpeRequirementsItem.face_mask]: "Face Mask",
  [CameraPpeRequirementsItem.safety_boots]: "Safety Boots",
};

export function PpeIconList({ ppeList, missing = [], size = "sm" }: { ppeList: string[], missing?: string[], size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  
  return (
    <div className="flex gap-2 flex-wrap">
      {ppeList.map((ppe) => {
        const Icon = ppeIconMap[ppe] || Info;
        const isMissing = missing.includes(ppe);
        
        return (
          <Tooltip key={ppe}>
            <TooltipTrigger asChild>
              <div 
                className={`p-1.5 rounded-md border ${
                  isMissing 
                    ? "bg-destructive/10 border-destructive text-destructive shadow-[0_0_8px_rgba(255,0,0,0.3)]" 
                    : "bg-success/10 border-success/50 text-success"
                }`}
              >
                <Icon className={iconSize} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="font-display tracking-wider uppercase text-xs">
              {ppeLabelMap[ppe] || ppe} {isMissing ? "(MISSING)" : "(DETECTED)"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
