import { useState } from "react";
import { useGetDailyReport } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, Calendar as CalendarIcon, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Cell } from "recharts";
import { ppeLabelMap } from "@/components/ppe-icons";
import { getComplianceColor } from "@/lib/utils";

export default function Reports() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const { data: report, isLoading } = useGetDailyReport({ date });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center">
              <FileText className="w-8 h-8 mr-3 text-primary" />
              ANALYTICS <span className="text-primary ml-2">REPORT</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Historical compliance data and violation breakdown</p>
          </div>
          
          <div className="flex items-center bg-card border border-border/50 rounded-lg px-3 py-2 shadow-inner">
            <CalendarIcon className="w-4 h-4 text-primary mr-2" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-sm font-mono text-foreground focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-primary"><TrendingUp className="w-8 h-8 animate-pulse" /></div>
        ) : !report ? (
          <Card className="p-10 text-center text-muted-foreground font-mono">NO_DATA_FOR_SELECTED_CYCLE</Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-xs font-display tracking-wider text-muted-foreground">AVG COMPLIANCE</p>
                  <p className={`text-3xl font-bold font-mono mt-2 ${getComplianceColor(report.averageComplianceRate).split(' ')[0]}`}>
                    {Math.round(report.averageComplianceRate)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-xs font-display tracking-wider text-muted-foreground">TOTAL SCANS</p>
                  <p className="text-3xl font-bold font-mono mt-2 text-foreground">{report.totalPersonDetections}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-xs font-display tracking-wider text-muted-foreground">UNIQUE VIOLATIONS</p>
                  <p className="text-3xl font-bold font-mono mt-2 text-destructive">{report.uniqueViolations}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-xs font-display tracking-wider text-muted-foreground">PEAK TRAFFIC HR</p>
                  <p className="text-3xl font-bold font-mono mt-2 text-accent">{report.peakHour}</p>
                  <p className="text-xs text-muted-foreground mt-1">{report.peakPersonCount} subjects</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Violation Categories</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.topViolations} layout="vertical" margin={{ left: 40, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis dataKey="ppe" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => ppeLabelMap[v] || v} />
                      <RechartsTooltip 
                        cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                        formatter={(value) => [value, "Violations"]}
                        labelFormatter={(l) => ppeLabelMap[l as string] || l}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {report.topViolations.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill="hsl(var(--destructive))" fillOpacity={0.8 + (index * 0.05)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hourly Volume vs Compliance</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={(t) => format(new Date(t), 'HH:mm')} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="hsl(var(--primary))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                        labelFormatter={(t) => format(new Date(t), 'HH:mm')}
                      />
                      <Bar yAxisId="left" dataKey="personCount" name="Total Detected" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} opacity={0.6} />
                      <Bar yAxisId="right" dataKey="complianceRate" name="Compliance %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
