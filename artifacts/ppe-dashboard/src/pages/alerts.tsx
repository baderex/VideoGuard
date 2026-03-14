import { useState } from "react";
import { useListAlerts, useAcknowledgeAlert, useResolveAlert, AlertStatus, AlertSeverity } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data, isLoading } = useListAlerts({ status: statusFilter, limit: 50 });

  const { mutate: ackAlert } = useAcknowledgeAlert({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/alerts"] }) }
  });

  const { mutate: resAlert } = useResolveAlert({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/alerts"] }) }
  });

  const getSeverityBadge = (sev: AlertSeverity) => {
    switch(sev) {
      case AlertSeverity.critical: return <Badge variant="destructive" className="animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.8)]">CRITICAL</Badge>;
      case AlertSeverity.high: return <Badge variant="warning">HIGH</Badge>;
      case AlertSeverity.medium: return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/50">MEDIUM</Badge>;
      default: return <Badge variant="secondary">LOW</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center">
            <ShieldAlert className="w-8 h-8 mr-3 text-destructive" />
            INCIDENT <span className="text-destructive ml-2">LOG</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and resolve safety compliance violations</p>
        </div>

        <Card>
          <div className="p-4 border-b border-border/50 flex gap-2">
            <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(undefined)}>All</Button>
            <Button variant={statusFilter === AlertStatus.open ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(AlertStatus.open)}>Open</Button>
            <Button variant={statusFilter === AlertStatus.acknowledged ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(AlertStatus.acknowledged)}>Acknowledged</Button>
            <Button variant={statusFilter === AlertStatus.resolved ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(AlertStatus.resolved)}>Resolved</Button>
          </div>
          
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-background/50">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-display tracking-wider">SEVERITY</TableHead>
                  <TableHead className="font-display tracking-wider">TIME</TableHead>
                  <TableHead className="font-display tracking-wider">NODE</TableHead>
                  <TableHead className="font-display tracking-wider">MESSAGE</TableHead>
                  <TableHead className="font-display tracking-wider">STATUS</TableHead>
                  <TableHead className="font-display tracking-wider text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && data?.alerts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground font-mono">
                      NO_INCIDENTS_FOUND
                    </TableCell>
                  </TableRow>
                )}
                {data?.alerts.map((alert) => (
                  <TableRow key={alert.id} className="border-border/50 group hover:bg-white/5">
                    <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(alert.createdAt)}</TableCell>
                    <TableCell className="font-display tracking-wider">{alert.cameraName}</TableCell>
                    <TableCell>
                      <span className="text-sm">{alert.message}</span>
                      {alert.missingPpe && alert.missingPpe.length > 0 && (
                        <div className="text-xs text-destructive mt-1 font-mono">MISSING: {alert.missingPpe.join(', ')}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'warning' : 'outline'} className="uppercase">
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {alert.status === AlertStatus.open && (
                        <Button size="sm" variant="outline" className="mr-2" onClick={() => ackAlert({ alertId: alert.id })}>
                          ACKNOWLEDGE
                        </Button>
                      )}
                      {alert.status !== AlertStatus.resolved && (
                        <Button size="sm" variant="glass" className="text-success border-success/30 hover:bg-success/10 hover:text-success" onClick={() => resAlert({ alertId: alert.id })}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> RESOLVE
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
