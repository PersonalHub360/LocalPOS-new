import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthWrapper } from "@/components/auth-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Grid3x3, LogOut, User } from "lucide-react";
import { QRMenuOrdersModal } from "@/components/qr-menu-orders-modal";
import { DraftListModal } from "@/components/draft-list-modal";
import { ReceiptPrintModal } from "@/components/receipt-print-modal";
import { TableOrderModal } from "@/components/table-order-modal";
import { useToast } from "@/hooks/use-toast";
import type { Order, OrderItem, Product, Table } from "@shared/schema";
import POS from "@/pages/pos";
import Dashboard from "@/pages/dashboard";
import Tables from "@/pages/tables";
import SalesManage from "@/pages/sales";
import ExpenseManage from "@/pages/expenses";
import ItemManage from "@/pages/items";
import PurchaseManage from "@/pages/purchases";
import HRM from "@/pages/hrm";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
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
      <Route path="/hrm" component={HRM} />
      <Route path="/reports" component={Reports} />
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
  const [tableOrderModalOpen, setTableOrderModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
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

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["/api/tables"],
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

  return (
    <>
      <header className="h-16 border-b border-border bg-gradient-to-r from-primary via-secondary to-accent px-6 flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white hover:bg-white/20" />
        <div className="flex-1" />
        {isPOSPage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30" data-testid="button-new-order">
              <Plus className="w-4 h-4" />
              New
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30" 
              onClick={() => setQrOrdersOpen(true)}
              data-testid="button-menu-orders"
            >
              <Grid3x3 className="w-4 h-4" />
              QR Menu Orders
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDraftListModalOpen(true)}
              data-testid="button-draft-list"
              className="gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
            >
              Draft List
              {draftOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-white text-primary" data-testid="badge-draft-count">
                  {draftOrders.length}
                </Badge>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setTableOrderModalOpen(true)}
              data-testid="button-table-order"
              className="gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
            >
              Table Order
              {tables.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-white text-accent" data-testid="badge-table-count">
                  {tables.length}
                </Badge>
              )}
            </Button>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-white font-medium" data-testid="text-user-info">
              <User className="w-4 h-4" />
              <span>{user.fullName || user.username}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
              className="gap-2 text-white hover:bg-white/20"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}
        <ThemeToggle />
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
      <TableOrderModal
        open={tableOrderModalOpen}
        onClose={() => setTableOrderModalOpen(false)}
        tables={tables}
      />
      {receiptData && (
        <ReceiptPrintModal
          open={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          order={receiptData}
          onPrint={handlePrintReceipt}
        />
      )}
    </>
  );
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
    <SidebarProvider style={style as React.CSSProperties}>
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
        <AuthWrapper>
          <AuthenticatedApp />
        </AuthWrapper>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
