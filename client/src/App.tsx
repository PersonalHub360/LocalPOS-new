import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Grid3x3 } from "lucide-react";
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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
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

function AppHeader() {
  const [location] = useLocation();
  const isPOSPage = location === "/";
  const [qrOrdersOpen, setQrOrdersOpen] = useState(false);
  const [draftListModalOpen, setDraftListModalOpen] = useState(false);
  const [tableOrderModalOpen, setTableOrderModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const { toast } = useToast();

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
      <header className="h-14 border-b border-border bg-background px-4 flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex-1" />
        {isPOSPage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-new-order">
              <Plus className="w-4 h-4" />
              New
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
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
              className="gap-2"
            >
              Draft List
              {draftOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1" data-testid="badge-draft-count">
                  {draftOrders.length}
                </Badge>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setTableOrderModalOpen(true)}
              data-testid="button-table-order"
              className="gap-2"
            >
              Table Order
              {tables.length > 0 && (
                <Badge variant="secondary" className="ml-1" data-testid="badge-table-count">
                  {tables.length}
                </Badge>
              )}
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

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <AppHeader />
              <main className="flex-1 overflow-hidden">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
