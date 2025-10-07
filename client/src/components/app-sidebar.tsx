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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
    title: "Table",
    url: "/tables",
    icon: Table2,
  },
  {
    title: "Sales manage",
    url: "/sales",
    icon: TrendingUp,
  },
  {
    title: "Expense Manage",
    url: "/expenses",
    icon: Wallet,
  },
  {
    title: "Item Manage",
    url: "/items",
    icon: Package,
  },
  {
    title: "Purchase Manage",
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
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg">
            <Utensils className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            BondPos
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-4 py-6">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location === item.url;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.title}
                href={item.url}
                data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="group flex items-center gap-4 py-2 px-3 rounded-full transition-all duration-200 hover-elevate active-elevate-2 cursor-pointer">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md",
                      isActive
                        ? "bg-gradient-to-br from-primary to-orange-600 text-primary-foreground scale-105 shadow-lg"
                        : "bg-sidebar-accent text-sidebar-accent-foreground group-hover:scale-110 group-hover:shadow-lg"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium transition-all duration-200",
                      isActive
                        ? "text-primary font-semibold"
                        : "text-sidebar-foreground group-hover:text-primary"
                    )}
                  >
                    {item.title}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2" data-testid="sidebar-profile">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-md">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Mohid Zaman</p>
            <p className="text-xs text-muted-foreground truncate">Product Designer</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
