import {
  LayoutDashboard,
  ShoppingCart,
  Table2,
  TrendingUp,
  Wallet,
  Package,
  ShoppingBag,
  UserCog,
  BarChart3,
  Settings,
  Utensils,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "POS",
    url: "/",
    icon: ShoppingCart,
  },
  {
    title: "Tables",
    url: "/tables",
    icon: Table2,
  },
  {
    title: "Sales",
    url: "/sales",
    icon: TrendingUp,
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Wallet,
  },
  {
    title: "Items",
    url: "/items",
    icon: Package,
  },
  {
    title: "Purchases",
    url: "/purchases",
    icon: ShoppingBag,
  },
  {
    title: "HRM",
    url: "/hrm",
    icon: UserCog,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Utensils className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-foreground">
            RestaurantPOS
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location === item.url;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.title}
                href={item.url}
                data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all cursor-pointer hover-elevate active-elevate-2",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {item.title}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md hover-elevate cursor-pointer" data-testid="sidebar-profile">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Admin User</p>
            <p className="text-xs text-muted-foreground truncate">Restaurant Manager</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
