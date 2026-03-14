import { useState } from "react";
import { Link } from "wouter";
import { useListCameras, useUpdateCamera, CameraStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon, Plus, Power, Activity } from "lucide-react";
import { PpeIconList } from "@/components/ppe-icons";
import { CameraFormDialog } from "@/components/camera-form-dialog";

export default function Cameras() {
  const [formOpen, setFormOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: cameras, isLoading } = useListCameras({
    query: { refetchInterval: 10000 }
  });

  const { mutate: updateStatus } = useUpdateCamera({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cameras"] })
    }
  });

  const toggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === CameraStatus.active ? CameraStatus.inactive : CameraStatus.active;
    updateStatus({ cameraId: id, data: { status: newStatus } });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center">
              <CameraIcon className="w-8 h-8 mr-3 text-primary" />
              CAMERA <span className="text-primary ml-2">NODES</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage and monitor vision inference endpoints</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> DEPLOY NEW NODE
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-primary">
             <Activity className="w-8 h-8 animate-pulse-glow" />
          </div>
        ) : cameras?.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent text-center py-20">
            <CardContent>
              <CameraIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-xl font-display uppercase tracking-wider text-muted-foreground mb-4">No Endpoints Detected</p>
              <Button onClick={() => setFormOpen(true)} variant="outline">Initialize First Node</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cameras?.map((camera) => (
              <Card key={camera.id} className="flex flex-col group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-display font-bold tracking-wider text-foreground group-hover:text-primary transition-colors">{camera.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-1">LOC: {camera.location}</p>
                    </div>
                    <Badge variant={camera.status === 'active' ? 'success' : camera.status === 'error' ? 'destructive' : 'secondary'}>
                      {camera.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">Enforced Protocols</p>
                    <PpeIconList ppeList={camera.ppeRequirements} />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleStatus(camera.id, camera.status)}
                      className={camera.status === 'active' ? "text-warning hover:text-warning" : "text-success hover:text-success"}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      {camera.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE'}
                    </Button>
                    <Link href={`/cameras/${camera.id}`}>
                      <Button variant="glass" size="sm">
                        VIEW FEED
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <CameraFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </Layout>
  );
}
