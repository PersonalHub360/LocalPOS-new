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
  ChevronRight,
  Store,
  Receipt,
  LogOut,
  PackageSearch,
  Landmark,
  Building2,
  CreditCard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permission?: string; // Required permission name (e.g., "sales.view")
}

const mainMenuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    // Dashboard is accessible to all authenticated users
  },
  {
    title: "POS",
    url: "/",
    icon: ShoppingCart,
    permission: "sales.create", // POS requires ability to create sales
  },
  {
    title: "Tables",
    url: "/tables",
    icon: Table2,
    permission: "sales.view", // Tables are part of sales
  },
];

const operationsMenuItems: MenuItem[] = [
  {
    title: "Sales",
    url: "/sales",
    icon: TrendingUp,
    permission: "sales.view",
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Wallet,
    permission: "expenses.view",
  },
  {
    title: "Items",
    url: "/items",
    icon: Package,
    permission: "inventory.view", // Items are part of inventory
  },
  {
    title: "Purchases",
    url: "/purchases",
    icon: ShoppingBag,
    permission: "purchases.view",
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: PackageSearch,
    permission: "inventory.view",
  },
];

const managementMenuItems: MenuItem[] = [
  {
    title: "HRM",
    url: "/hrm",
    icon: UserCog,
    permission: "hrm.view",
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    permission: "reports.view",
  },
  {
    title: "Bank Statement",
    url: "/bank-statement",
    icon: Landmark,
    permission: "bank.view",
  },
  {
    title: "Due Management",
    url: "/due-management",
    icon: CreditCard,
    permission: "due.view",
  },
  {
    title: "Branches",
    url: "/branches",
    icon: Building2,
    permission: "branches.view",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    permission: "settings.view",
  },
];

interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  permissions?: string[];
}

// Helper function to check if user has permission
function hasPermission(userPermissions: string[] | undefined, requiredPermission: string | undefined): boolean {
  // If no permission required, allow access
  if (!requiredPermission) {
    return true;
  }
  
  // If user has no permissions, deny access
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }
  
  // If user has "*" permission, they have all permissions
  if (userPermissions.includes("*")) {
    return true;
  }
  
  // Check if user has the specific permission
  return userPermissions.includes(requiredPermission);
}

// Helper function to filter menu items based on permissions
function filterMenuItems(items: MenuItem[], userPermissions: string[] | undefined): MenuItem[] {
  return items.filter(item => hasPermission(userPermissions, item.permission));
}

export function AppSidebar() {
  const [location] = useLocation();
  
  // Get current user and permissions
  const { data: user } = useQuery<AuthUser>({
    queryKey: ["/api/auth/session"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to ensure fresh permissions
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Filter menu items based on permissions
  const filteredMainMenuItems = filterMenuItems(mainMenuItems, user?.permissions);
  const filteredOperationsMenuItems = filterMenuItems(operationsMenuItems, user?.permissions);
  const filteredManagementMenuItems = filterMenuItems(managementMenuItems, user?.permissions);

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Link href="/">
                <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <Store className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text-base">BondPos</span>
                  <span className="truncate text-xs opacity-80">Restaurant Management</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider opacity-70">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="group"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="group-data-[active=true]:text-sidebar-primary-foreground" />
                        <span className="group-data-[active=true]:font-semibold">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider opacity-70">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredOperationsMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="group"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="group-data-[active=true]:text-sidebar-primary-foreground" />
                        <span className="group-data-[active=true]:font-semibold">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider opacity-70">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredManagementMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="group"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="group-data-[active=true]:text-sidebar-primary-foreground" />
                        <span className="group-data-[active=true]:font-semibold">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" data-testid="sidebar-profile">
                  <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm">
                    {user?.fullName 
                      ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : user?.username 
                        ? user.username.slice(0, 2).toUpperCase()
                        : "U"}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.fullName || "User"}</span>
                    <span className="truncate text-xs opacity-80">{user?.email || user?.username || ""}</span>
                  </div>
                  <ChevronRight className="ml-auto size-4 opacity-60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
