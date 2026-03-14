import { useState } from "react";
import { useForm } from "react-hook-form";
import { useCreateCamera } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CameraPpeRequirementsItem, CreateCameraRequest } from "@workspace/api-client-react";
import { ppeLabelMap } from "./ppe-icons";

export function CameraFormDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { mutate: create, isPending } = useCreateCamera({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cameras"] });
        onOpenChange(false);
        reset();
      }
    }
  });

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<CreateCameraRequest>({
    defaultValues: {
      name: "",
      location: "",
      streamUrl: "",
      ppeRequirements: [CameraPpeRequirementsItem.hard_hat, CameraPpeRequirementsItem.safety_vest]
    }
  });

  const currentPpe = watch("ppeRequirements");

  const togglePpe = (item: CameraPpeRequirementsItem) => {
    if (currentPpe.includes(item)) {
      setValue("ppeRequirements", currentPpe.filter(p => p !== item));
    } else {
      setValue("ppeRequirements", [...currentPpe, item]);
    }
  };

  const onSubmit = (data: CreateCameraRequest) => {
    create({ data });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy New Camera Node</DialogTitle>
          <DialogDescription>Initialize a new analytics endpoint on the network.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Node Designation</label>
            <input 
              {...register("name", { required: true })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
              placeholder="e.g. Loading Dock Cam 01"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Location</label>
            <input 
              {...register("location", { required: true })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
              placeholder="e.g. Sector 7G"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Stream URL (RTSP/HLS)</label>
            <input 
              {...register("streamUrl")}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50 font-mono"
              placeholder="rtsp://admin:pass@ip:port/stream"
            />
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Enforced PPE Protocols</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.values(CameraPpeRequirementsItem).map(ppe => {
                const isActive = currentPpe.includes(ppe);
                return (
                  <div 
                    key={ppe}
                    onClick={() => togglePpe(ppe)}
                    className={`cursor-pointer border rounded-md px-3 py-2 text-sm transition-all flex items-center ${
                      isActive 
                        ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_0_10px_rgba(0,255,255,0.1)]' 
                        : 'border-border/50 bg-background text-muted-foreground hover:bg-white/5'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-sm border mr-2 ${isActive ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                    {ppeLabelMap[ppe]}
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "INITIALIZING..." : "DEPLOY NODE"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
