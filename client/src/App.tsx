import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthWrapper } from "@/components/auth-wrapper";
import { BranchProvider } from "@/contexts/BranchContext";
import { BranchSelector } from "@/components/branch-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Grid3x3, LogOut, User, Key, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRMenuOrdersModal } from "@/components/qr-menu-orders-modal";
import { DraftListModal } from "@/components/draft-list-modal";
import { ReceiptPrintModal } from "@/components/receipt-print-modal";
import { useToast } from "@/hooks/use-toast";
import type { Order, Settings } from "@shared/schema";
import POS from "@/pages/pos";
import Dashboard from "@/pages/dashboard";
import Tables from "@/pages/tables";
import SalesManage from "@/pages/sales";
import ExpenseManage from "@/pages/expenses";
import ItemManage from "@/pages/items";
import PurchaseManage from "@/pages/purchases";
import Inventory from "@/pages/inventory";
import HRM from "@/pages/hrm";
import Reports from "@/pages/reports";
import BankStatement from "@/pages/bank-statement";
import DueManagement from "@/pages/due-management";
import Settings from "@/pages/settings";
import Branches from "@/pages/branches";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={POS} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tables" component={Tables} />
      <Route path="/sales" component={SalesManage} />
      <Route path="/expenses" component={ExpenseManage} />
      <Route path="/items" component={ItemManage} />
      <Route path="/purchases" component={PurchaseManage} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/hrm" component={HRM} />
      <Route path="/reports" component={Reports} />
      <Route path="/bank-statement" component={BankStatement} />
      <Route path="/due-management" component={DueManagement} />
      <Route path="/branches" component={Branches} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
}

function AppHeader() {
  const [location, setLocation] = useLocation();
  const isPOSPage = location === "/";
  const [qrOrdersOpen, setQrOrdersOpen] = useState(false);
  const [draftListModalOpen, setDraftListModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  const { data: user } = useQuery<AuthUser>({
    queryKey: ["/api/auth/session"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      setLocation("/login");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const draftOrders = orders.filter((order) => order.status === "draft");

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("DELETE", `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Draft order deleted",
      });
    },
  });

  const handleEditDraft = async (orderId: string) => {
    // Dispatch custom event to notify POS page to load this draft
    if (location !== "/") {
      toast({
        title: "Navigate to POS",
        description: "Please go to the POS page to edit draft orders",
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('loadDraft', { detail: { orderId } }));
    setDraftListModalOpen(false);
    toast({
      title: "Draft Loaded",
      description: "Draft order has been loaded to the cart for editing",
    });
  };

  const handlePrintDraft = async (orderId: string) => {
    // Dispatch custom event to notify POS page to show payment modal for this draft
    if (location !== "/") {
      toast({
        title: "Navigate to POS",
        description: "Please go to the POS page to print draft orders",
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('printDraft', { detail: { orderId } }));
    setDraftListModalOpen(false);
  };

  const handleDeleteDraft = (orderId: string) => {
    deleteOrderMutation.mutate(orderId);
  };

  const handlePrintReceipt = () => {
    toast({
      title: "Receipt Printed",
      description: "Receipt has been sent to printer",
    });
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest("PUT", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully",
      });
      setChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <>
      <header className="min-h-16 border-b border-border bg-gradient-to-r from-primary via-secondary to-accent px-2 sm:px-4 md:px-6 py-2 md:py-0 flex flex-wrap items-center gap-2 sm:gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white hover:bg-white/20 shrink-0" />
        <div className="min-w-0 shrink-0">
          <BranchSelector />
        </div>
        <div className="flex-1 min-w-0" />
        {isPOSPage && (
          <div className="flex gap-1 sm:gap-2 flex-wrap shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0" 
              data-testid="button-new-order"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0" 
              onClick={() => setQrOrdersOpen(true)}
              data-testid="button-menu-orders"
            >
              <Grid3x3 className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">QR Menu Orders</span>
              <span className="md:hidden">QR Orders</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDraftListModalOpen(true)}
              data-testid="button-draft-list"
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0 relative"
            >
              <span className="hidden sm:inline">Draft List</span>
              <span className="sm:hidden">Drafts</span>
              {draftOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-white text-primary shrink-0" data-testid="badge-draft-count">
                  {draftOrders.length}
                </Badge>
              )}
            </Button>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 sm:gap-2 text-white hover:bg-white/20 shrink-0"
                  data-testid="button-user-menu"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[120px] md:max-w-none">{user.fullName || user.username}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 hidden sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setChangePasswordOpen(true)} data-testid="button-change-password">
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()} 
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </header>
      <QRMenuOrdersModal open={qrOrdersOpen} onOpenChange={setQrOrdersOpen} />
      <DraftListModal
        open={draftListModalOpen}
        onClose={() => setDraftListModalOpen(false)}
        draftOrders={draftOrders}
        onEditDraft={handleEditDraft}
        onPrintDraft={handlePrintDraft}
        onDeleteDraft={handleDeleteDraft}
      />
      {receiptData && (
        <ReceiptPrintModal
          open={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          order={receiptData}
          onPrint={handlePrintReceipt}
        />
      )}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangePasswordOpen(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              data-testid="button-submit-change-password"
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentMetadata() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      // Update document title
      const title = settings.websiteTitle || settings.businessName || "BondPos - POS System";
      document.title = title;

      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      if (settings.websiteDescription) {
        metaDescription.setAttribute('content', settings.websiteDescription);
      }

      // Update favicon
      if (settings.favicon) {
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = settings.favicon;
      }
    }
  }, [settings]);

  return null;
}

function AuthenticatedApp() {
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  if (location === "/login") {
    return <Router />;
  }

  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <DocumentMetadata />
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <AppHeader />
          <main className="flex-1 overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BranchProvider>
          <AuthWrapper>
            <AuthenticatedApp />
          </AuthWrapper>
        </BranchProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
