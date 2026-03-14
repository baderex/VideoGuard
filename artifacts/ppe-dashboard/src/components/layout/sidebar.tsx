import { Link, useLocation } from "wouter";
import { Activity, Camera, AlertTriangle, FileText, ShieldAlert, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Live Dashboard", href: "/", icon: Activity },
  { name: "Cameras", href: "/cameras", icon: Camera },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border/50 bg-card/50 backdrop-blur-xl h-screen flex flex-col fixed md:relative z-40 hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-border/50 bg-background/50">
        <ShieldAlert className="w-6 h-6 text-primary mr-3 animate-pulse-glow" />
        <h1 className="font-display font-bold text-xl tracking-widest text-foreground">
          SECURE<span className="text-primary">SIGHT</span>
        </h1>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-display font-semibold text-muted-foreground mb-4 uppercase tracking-widest px-2">
          System Core
        </div>
        
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_20px_rgba(0,255,255,0.05)]" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
              )}
            >
              <item.icon className={cn("w-5 h-5 mr-3 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="font-display tracking-wider uppercase">{item.name}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,255,255,1)] animate-pulse" />
              )}
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className="bg-secondary/50 rounded-lg p-4 border border-border/50 flex items-center space-x-3">
          <div className="relative">
            <MonitorPlay className="w-8 h-8 text-primary" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-background" />
          </div>
          <div>
            <p className="text-xs font-display text-muted-foreground uppercase tracking-wider">Engine Status</p>
            <p className="text-sm font-semibold text-success flex items-center">
              ONLINE <span className="inline-block w-1.5 h-1.5 ml-2 bg-success rounded-full animate-pulse" />
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
