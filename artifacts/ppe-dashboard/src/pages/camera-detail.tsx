import { useParams, Link } from "wouter";
import { useGetCamera, useGetCameraSnapshot, useGetAnalyticsHistory } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, ShieldAlert, Activity } from "lucide-react";
import { PpeIconList } from "@/components/ppe-icons";
import { SimulatedFeed } from "@/components/simulated-feed";
import { getComplianceColor, getComplianceHex, formatTime, cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function CameraDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");

  const { data: camera, isLoading: isLoadingCam } = useGetCamera(id, {
    query: { enabled: !!id }
  });

  const { data: snapshot } = useGetCameraSnapshot(id, {
    query: { enabled: !!id && camera?.status === 'active', refetchInterval: 2000 }
  });

  const { data: history } = useGetAnalyticsHistory({ cameraId: id, interval: 'minute' }, {
    query: { enabled: !!id, refetchInterval: 60000 }
  });

  if (isLoadingCam) {
    return (
      <Layout>
        <div className="flex justify-center py-20 text-primary"><Activity className="animate-pulse w-8 h-8" /></div>
      </Layout>
    );
  }

  if (!camera) {
    return <Layout><div className="p-8 text-destructive">Camera not found.</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/cameras">
            <Button variant="ghost" size="icon" className="rounded-full bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-foreground tracking-wider">{camera.name}</h1>
              <Badge variant={camera.status === 'active' ? 'success' : camera.status === 'error' ? 'destructive' : 'secondary'}>
                {camera.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1">ID: {camera.id} | LOC: {camera.location}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-primary/20 shadow-[0_0_30px_rgba(0,255,255,0.05)]">
              <div className="p-1 bg-black">
                <SimulatedFeed snapshot={snapshot} status={camera.status} />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Local Compliance Trend (60m)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {history && history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={(t) => formatTime(t).substring(0,5)} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} labelFormatter={(t) => formatTime(t)} />
                      <Line type="step" dataKey="complianceRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">NO_DATA_AVAILABLE</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side Panel: Live Stats & Detections */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm"><Activity className="w-4 h-4 mr-2" /> Live Telemetry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/50 rounded-lg p-3 border border-border/50 text-center">
                    <p className="text-xs font-display text-muted-foreground tracking-wider mb-1">TARGETS</p>
                    <p className="text-2xl font-bold font-mono">{snapshot?.personCount ?? 0}</p>
                  </div>
                  <div className={cn("rounded-lg p-3 border text-center", getComplianceColor(snapshot?.complianceRate ?? 0))}>
                    <p className="text-xs font-display tracking-wider mb-1 opacity-80">COMPLIANCE</p>
                    <p className="text-2xl font-bold font-mono">{Math.round(snapshot?.complianceRate ?? 0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col h-[500px]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm justify-between">
                  <span className="flex items-center"><Users className="w-4 h-4 mr-2" /> Detected Subjects</span>
                  <Badge variant="outline">{snapshot?.detectedPersons?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pr-2 space-y-3">
                {!snapshot?.detectedPersons?.length ? (
                  <div className="text-center py-10 text-muted-foreground font-mono text-xs">NO_SUBJECTS_DETECTED</div>
                ) : (
                  snapshot.detectedPersons.map((person) => (
                    <div 
                      key={person.id} 
                      className={cn(
                        "p-3 rounded-lg border bg-background/50 relative overflow-hidden",
                        person.compliant ? "border-success/30 hover:border-success/60" : "border-destructive/50 shadow-[inset_0_0_15px_rgba(255,0,0,0.1)]"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-mono text-xs text-muted-foreground">ID: {person.id.substring(0,8)}</div>
                        {person.compliant ? (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">PASS</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">FAIL</Badge>
                        )}
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-[10px] font-display text-muted-foreground uppercase tracking-widest mb-1">Equipment Check</p>
                        <PpeIconList 
                          ppeList={camera.ppeRequirements} 
                          missing={person.missingPpe} 
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
