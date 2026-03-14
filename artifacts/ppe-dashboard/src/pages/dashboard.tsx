import { useGetLiveAnalytics, useGetAnalyticsHistory } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Users, ShieldCheck, AlertTriangle, Activity } from "lucide-react";
import { getComplianceColor, cn, formatTime } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: liveData, isLoading } = useGetLiveAnalytics({
    query: { refetchInterval: 5000 }
  });

  const { data: historyData } = useGetAnalyticsHistory({
    interval: 'hour'
  }, {
    query: { refetchInterval: 60000 } // Refresh history every minute
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <div className="flex flex-col items-center text-primary">
            <Activity className="w-12 h-12 animate-pulse-glow mb-4" />
            <p className="font-display tracking-widest uppercase">Initializing Core Systems...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    {
      title: "Active Cameras",
      value: `${liveData?.activeCameras || 0} / ${liveData?.totalCameras || 0}`,
      icon: Camera,
      color: "text-primary",
      glow: "shadow-[0_0_20px_rgba(0,255,255,0.15)]",
    },
    {
      title: "Total Detections",
      value: liveData?.totalPersonsDetected || 0,
      icon: Users,
      color: "text-accent",
      glow: "shadow-[0_0_20px_rgba(153,50,204,0.15)]",
    },
    {
      title: "System Compliance",
      value: `${liveData?.overallComplianceRate ? Math.round(liveData.overallComplianceRate) : 0}%`,
      icon: ShieldCheck,
      color: liveData ? (liveData.overallComplianceRate >= 90 ? "text-success" : liveData.overallComplianceRate >= 70 ? "text-warning" : "text-destructive") : "text-primary",
      glow: "shadow-[0_0_20px_rgba(0,255,0,0.15)]", // Defaults to green glow
    },
    {
      title: "Active Alerts",
      value: liveData?.openAlerts || 0,
      icon: AlertTriangle,
      color: (liveData?.openAlerts || 0) > 0 ? "text-destructive" : "text-muted-foreground",
      glow: (liveData?.openAlerts || 0) > 0 ? "shadow-[0_0_20px_rgba(255,0,0,0.2)] border-destructive/30" : "",
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">COMMAND <span className="text-primary">CENTER</span></h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">SYS_STATUS: ONLINE | LAST_SYNC: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <Card key={i} className={cn("relative overflow-hidden group", stat.glow)}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <stat.icon className={`w-16 h-16 ${stat.color}`} />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-display tracking-wider uppercase text-muted-foreground">{stat.title}</p>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold font-display">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>System Compliance Trend (24H)</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px]">
              {historyData && historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(t) => formatTime(t).substring(0,5)} 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(t) => formatTime(t)}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="complianceRate" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCompliance)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                   AWAITING_TELEMETRY_DATA...
                 </div>
              )}
            </CardContent>
          </Card>

          {/* Active Nodes List */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Active Feeds</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2 space-y-3">
              {liveData?.cameraSnapshots?.map(snap => (
                <Link key={snap.cameraId} href={`/cameras/${snap.cameraId}`} className="block">
                  <div className="p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-white/5 transition-colors group cursor-pointer relative overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-display font-semibold tracking-wider text-sm">CAM-{snap.cameraId.toString().padStart(3, '0')}</div>
                      <div className={cn("text-xs font-mono px-1.5 py-0.5 rounded", getComplianceColor(snap.complianceRate))}>
                        {Math.round(snap.complianceRate)}% COMP
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Targets: <span className="text-foreground">{snap.personCount}</span></span>
                      <span>Violations: <span className="text-destructive">{snap.nonCompliantCount}</span></span>
                    </div>
                  </div>
                </Link>
              ))}
              {(!liveData?.cameraSnapshots || liveData.cameraSnapshots.length === 0) && (
                 <div className="text-center py-8 text-muted-foreground font-mono text-xs">
                   NO_ACTIVE_FEEDS_DETECTED
                 </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
