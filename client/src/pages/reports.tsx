import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Download, 
  Printer, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  BarChart3,
  Eye,
  FileText,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  X,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import type { Order, Product, OrderItem } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { queryClient, apiRequest } from "@/lib/queryClient";

type ReportType = "sales" | "inventory" | "payments" | "discounts" | "refunds" | "staff" | "aba" | "acleda" | "cash" | "due" | "card";
type PaymentReportType = "gateway" | "payment-history" | "none";
type DateFilter = "today" | "yesterday" | "7days" | "month" | "custom";

interface OrderItemWithProduct extends OrderItem {
  productName: string;
  discount: string;
}

interface OrderWithItems extends Order {
  items: OrderItemWithProduct[];
  tableNumber?: string;
}

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [paymentReportType, setPaymentReportType] = useState<PaymentReportType>("none");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: sales = [] } = useQuery<Order[]>({
    queryKey: ["/api/sales"],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const getFilteredSales = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (dateFilter) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "7days":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "custom":
        if (customStartDate) {
          startDate = customStartDate;
        }
        break;
    }

    return sales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      let dateMatch = false;
      
      if (dateFilter === "custom" && customEndDate) {
        dateMatch = saleDate >= startDate && saleDate <= customEndDate;
      } else {
        dateMatch = saleDate >= startDate;
      }

      if (!dateMatch) return false;

      // For gateway report, apply payment filters
      if (paymentReportType === "gateway") {
        if (paymentMethodFilter !== "all" && sale.paymentMethod !== paymentMethodFilter) {
          return false;
        }
        if (paymentStatusFilter !== "all" && sale.paymentStatus !== paymentStatusFilter) {
          return false;
        }
      }

      // For payment method-specific reports, filter by payment method
      if (reportType === "aba" && sale.paymentMethod !== "aba") {
        return false;
      }
      if (reportType === "acleda" && sale.paymentMethod !== "acleda") {
        return false;
      }
      if (reportType === "cash" && sale.paymentMethod !== "cash") {
        return false;
      }
      if (reportType === "due" && sale.paymentMethod !== "due") {
        return false;
      }
      if (reportType === "card" && sale.paymentMethod !== "card") {
        return false;
      }

      // Apply payment status filter for payment method-specific reports
      if ((reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card")) {
        if (paymentStatusFilter !== "all" && sale.paymentStatus !== paymentStatusFilter) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredSales = getFilteredSales();
  
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
  const totalTransactions = filteredSales.length;
  const avgSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalDiscounts = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.discount), 0);

  const paymentMethods = filteredSales.reduce((acc, sale) => {
    const method = sale.paymentMethod || "Unknown";
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate payment totals by method for payment history (using filtered sales to respect date range)
  const paymentTotals = filteredSales.reduce((acc, sale) => {
    const method = sale.paymentMethod || "unknown";
    const total = parseFloat(sale.total);
    if (!acc[method]) {
      acc[method] = { total: 0, count: 0, paid: 0, pending: 0, failed: 0 };
    }
    acc[method].total += total;
    acc[method].count += 1;
    if (sale.paymentStatus === "paid") {
      acc[method].paid += total;
    } else if (sale.paymentStatus === "pending") {
      acc[method].pending += total;
    } else if (sale.paymentStatus === "failed") {
      acc[method].failed += total;
    }
    return acc;
  }, {} as Record<string, { total: number; count: number; paid: number; pending: number; failed: number }>);

  // Calculate outstanding dues (all pending/unpaid "due" payments, filtered by date range)
  const outstandingDues = filteredSales.filter(
    sale => sale.paymentMethod === "due" && sale.paymentStatus !== "paid"
  );
  const totalOutstanding = outstandingDues.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" => {
    if (status === "completed" || status === "paid" || status === "successful") return "default";
    if (status === "pending") return "secondary";
    if (status === "failed" || status === "cancelled") return "destructive";
    return "secondary";
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed" || status === "paid" || status === "successful") return CheckCircle;
    if (status === "pending") return Clock;
    if (status === "failed" || status === "cancelled") return XCircle;
    return Clock;
  };

  const handleExportCSV = () => {
    let csvContent;
    
    if (paymentReportType === "gateway" || reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card") {
      csvContent = [
        ["Transaction ID", "Date/Time", "Payment Method", "Amount (USD)", "Amount (KHR)", "Status", "Payment Status", "Customer", "Phone"].join(","),
        ...filteredSales.map(sale => [
          sale.orderNumber,
          format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm"),
          sale.paymentMethod || "N/A",
          parseFloat(sale.total).toFixed(2),
          (parseFloat(sale.total) * 4100).toFixed(0),
          sale.status,
          sale.paymentStatus,
          sale.customerName || "Walk-in",
          sale.customerPhone || "N/A"
        ].join(","))
      ].join("\n");
    } else {
      csvContent = [
        ["Date", "Order Number", "Customer", "Total", "Payment Method", "Status"].join(","),
        ...filteredSales.map(sale => [
          format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm"),
          sale.orderNumber,
          sale.customerName || "N/A",
          sale.total,
          sale.paymentMethod || "N/A",
          sale.status
        ].join(","))
      ].join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Get report title based on type
    const reportTitles: Record<string, string> = {
      gateway: "Payment Gateway Report",
      aba: "ABA Payment Report",
      acleda: "Acleda Payment Report",
      cash: "Cash Payment Report",
      due: "Due Payment Report",
      card: "Card Payment Report"
    };
    
    // Add header
    doc.setFontSize(18);
    doc.text(reportTitles[reportType] || "Payment Report", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 14, 28);
    doc.text(`Period: ${dateFilter === "custom" && customStartDate && customEndDate 
      ? `${format(customStartDate, "MMM dd, yyyy")} - ${format(customEndDate, "MMM dd, yyyy")}`
      : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)}`, 14, 34);
    
    // Add summary
    doc.setFontSize(10);
    doc.text(`Total Transactions: ${filteredSales.length}`, 14, 42);
    doc.text(`Total Revenue: $${totalRevenue.toFixed(2)} USD (៛${(totalRevenue * 4100).toFixed(0)} KHR)`, 14, 48);
    
    // Prepare table data
    const tableData = filteredSales.map(sale => [
      sale.orderNumber,
      format(new Date(sale.createdAt), "MMM dd, HH:mm"),
      sale.paymentMethod || "N/A",
      `$${parseFloat(sale.total).toFixed(2)}`,
      `៛${(parseFloat(sale.total) * 4100).toFixed(0)}`,
      sale.paymentStatus,
      sale.customerName || "Walk-in"
    ]);
    
    // Add table
    autoTable(doc, {
      startY: 55,
      head: [["Transaction ID", "Date/Time", "Method", "USD", "KHR", "Status", "Customer"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 20 },
        6: { cellWidth: 30 }
      }
    });
    
    doc.save(`payment-gateway-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleViewOrder = async (order: Order) => {
    setLoadingOrderDetails(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/items`);
      const items = await response.json();
      
      const itemsWithDetails: OrderItemWithProduct[] = items.map((item: any) => ({
        ...item,
        productName: item.product?.name || products.find(p => p.id === item.productId)?.name || 'Unknown Product',
        discount: item.discount || "0"
      }));

      const orderWithItems: OrderWithItems = {
        ...order,
        items: itemsWithDetails
      };

      setSelectedOrder(orderWithItems);
      setViewDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const handleEditOrder = (orderId: string) => {
    setLocation(`/sales`);
  };

  const handlePrintOrder = async (order: Order) => {
    try {
      const response = await fetch(`/api/orders/${order.id}/items`);
      const items = await response.json();
      
      const itemsWithDetails: OrderItemWithProduct[] = items.map((item: any) => ({
        ...item,
        productName: item.product?.name || products.find(p => p.id === item.productId)?.name || 'Unknown Product',
        discount: item.discount || "0"
      }));

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const subtotal = parseFloat(order.subtotal);
      const discount = parseFloat(order.discount);
      const total = parseFloat(order.total);
      const totalKHR = total * 4100;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Order Receipt #${order.orderNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Courier New', monospace;
                padding: 20px;
                max-width: 400px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px dashed #000;
                padding-bottom: 10px;
              }
              .header h1 {
                font-size: 24px;
                margin-bottom: 5px;
              }
              .header p {
                font-size: 12px;
                margin: 2px 0;
              }
              .order-info {
                margin: 15px 0;
                font-size: 12px;
              }
              .order-info div {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
              }
              .items {
                margin: 15px 0;
                border-top: 2px dashed #000;
                border-bottom: 2px dashed #000;
                padding: 10px 0;
              }
              .item {
                margin: 8px 0;
                font-size: 12px;
              }
              .item-header {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
              }
              .item-details {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #555;
                margin-top: 2px;
              }
              .totals {
                margin: 15px 0;
                font-size: 13px;
              }
              .totals div {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
              }
              .totals .total-line {
                font-weight: bold;
                font-size: 16px;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 2px solid #000;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 11px;
                border-top: 2px dashed #000;
                padding-top: 10px;
              }
              @media print {
                body { padding: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>BondPos</h1>
              <p>Restaurant POS System</p>
              <p>Receipt</p>
            </div>

            <div class="order-info">
              <div><span>Order #:</span><span>${order.orderNumber}</span></div>
              <div><span>Date:</span><span>${format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}</span></div>
              ${order.customerName ? `<div><span>Customer:</span><span>${order.customerName}</span></div>` : ''}
              ${order.customerPhone ? `<div><span>Phone:</span><span>${order.customerPhone}</span></div>` : ''}
              <div><span>Payment:</span><span>${order.paymentMethod || 'N/A'}</span></div>
              <div><span>Status:</span><span>${order.status.toUpperCase()}</span></div>
            </div>

            <div class="items">
              <h3 style="margin-bottom: 10px; font-size: 14px;">Order Items</h3>
              ${itemsWithDetails.map(item => `
                <div class="item">
                  <div class="item-header">
                    <span>${item.productName}</span>
                    <span>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                  <div class="item-details">
                    <span>${item.quantity} x $${parseFloat(item.price).toFixed(2)}</span>
                    ${parseFloat(item.discount) > 0 ? `<span>Discount: $${parseFloat(item.discount).toFixed(2)}</span>` : '<span></span>'}
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="totals">
              <div><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
              ${discount > 0 ? `<div><span>Discount:</span><span>-$${discount.toFixed(2)}</span></div>` : ''}
              <div class="total-line"><span>Total (USD):</span><span>$${total.toFixed(2)}</span></div>
              <div><span>Total (KHR):</span><span>៛${totalKHR.toFixed(0)}</span></div>
            </div>

            <div class="footer">
              <p>Thank you for your business!</p>
              <p>Powered by BondPos</p>
            </div>

            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error("Failed to print order:", error);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      await Promise.all(
        orderIds.map(id => 
          fetch(`/api/orders/${id}`, { method: "DELETE" }).then(res => {
            if (!res.ok) throw new Error("Failed to delete order");
            return res;
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Success",
        description: `${selectedOrders.length} order(s) deleted successfully`,
      });
      setSelectedOrders([]);
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete orders",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredSales.map(sale => sale.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedOrders.length > 0) {
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    deleteMutation.mutate(selectedOrders);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">POS Reports Dashboard</h1>
            <p className="text-muted-foreground mt-1">Analyze performance, sales, and profitability</p>
          </div>
          <div className="flex gap-2">
            {selectedOrders.length > 0 && reportType === "sales" && (
              <Button 
                variant="destructive" 
                onClick={handleDeleteSelected}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedOrders.length})
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint} data-testid="button-print-report">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {(paymentReportType === "gateway" || reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card") && (
              <Button variant="outline" onClick={handleExportPDF} data-testid="button-export-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
            <Button onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>Select report type and date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Report Type</label>
                <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                  <SelectTrigger data-testid="select-report-type">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="payments">Payments</SelectItem>
                    <SelectItem value="aba">ABA</SelectItem>
                    <SelectItem value="acleda">Acleda</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="discounts">Discounts</SelectItem>
                    <SelectItem value="refunds">Refunds</SelectItem>
                    <SelectItem value="staff">Staff Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Payment Report</label>
                <Select value={paymentReportType} onValueChange={(value) => setPaymentReportType(value as PaymentReportType)}>
                  <SelectTrigger data-testid="select-payment-report-type">
                    <SelectValue placeholder="Select payment report" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="gateway">Payment Gateway</SelectItem>
                    <SelectItem value="payment-history">Payments History</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentReportType === "gateway" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Payment Method</label>
                    <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue placeholder="All Methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="aba">ABA</SelectItem>
                        <SelectItem value="acleda">Acleda</SelectItem>
                        <SelectItem value="due">Due</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Payment Status</label>
                    <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {(reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card" || paymentReportType === "payment-history") && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Status</label>
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger data-testid="select-payment-status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {dateFilter === "custom" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-start-date">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customStartDate ? format(customStartDate, "MMM dd, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-end-date">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customEndDate ? format(customEndDate, "MMM dd, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {totalTransactions} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-transactions">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                Total orders processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sale Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-sale">${avgSaleValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Per transaction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-discounts">${totalDiscounts.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Given to customers
              </p>
            </CardContent>
          </Card>
        </div>

        {reportType === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods Breakdown</CardTitle>
              <CardDescription>Distribution of payment methods used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(paymentMethods).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">{method}</Badge>
                      <span className="text-sm text-muted-foreground">{count} transactions</span>
                    </div>
                    <div className="text-sm font-medium">
                      {((count / totalTransactions) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {paymentReportType === "payment-history" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods Summary</CardTitle>
                <CardDescription>Total payments collected through each payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {["aba", "acleda", "cash", "card", "due"].map((method) => {
                    const methodData = paymentTotals[method] || { total: 0, count: 0, paid: 0, pending: 0, failed: 0 };
                    return (
                      <Card key={method}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium capitalize">{method === "aba" ? "ABA" : method === "acleda" ? "Acleda" : method}</CardTitle>
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold" data-testid={`text-${method}-total`}>
                            ${methodData.total.toFixed(2)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {methodData.count} transactions
                          </p>
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-green-600">Paid:</span>
                              <span className="font-medium">${methodData.paid.toFixed(2)}</span>
                            </div>
                            {methodData.pending > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-yellow-600">Pending:</span>
                                <span className="font-medium">${methodData.pending.toFixed(2)}</span>
                              </div>
                            )}
                            {methodData.failed > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-red-600">Failed:</span>
                                <span className="font-medium">${methodData.failed.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outstanding Dues</CardTitle>
                <CardDescription>Pending and unpaid "Pay Later" transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                    <div>
                      <h3 className="font-semibold text-lg">Total Outstanding</h3>
                      <p className="text-sm text-muted-foreground">
                        {outstandingDues.length} pending payments
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" data-testid="text-outstanding-total">
                        ${totalOutstanding.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ៛{(totalOutstanding * 4100).toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {outstandingDues.length > 0 ? (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outstandingDues.map((order) => (
                            <TableRow key={order.id} data-testid={`row-outstanding-${order.id}`}>
                              <TableCell className="font-mono font-medium">#{order.orderNumber}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(order.createdAt), "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell>{order.customerName || "Walk-in"}</TableCell>
                              <TableCell className="text-right font-mono">
                                ${parseFloat(order.total).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="w-3 h-3" />
                                  {order.paymentStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p className="font-medium">All dues have been collected!</p>
                      <p className="text-sm">No outstanding payments at this time.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {paymentReportType === "gateway" ? "Payment Gateway Transactions" : 
                   reportType === "aba" ? "ABA Payment Transactions" :
                   reportType === "acleda" ? "Acleda Payment Transactions" :
                   reportType === "cash" ? "Cash Payment Transactions" :
                   reportType === "due" ? "Due Payment Transactions" :
                   reportType === "card" ? "Card Payment Transactions" :
                   `Detailed ${reportType === "sales" ? "Sales" : "Transaction"} Report`}
                </CardTitle>
                <CardDescription>
                  {(paymentReportType === "gateway" || reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card")
                    ? "Complete transaction details with payment information" 
                    : "View all transactions in the selected date range"}
                </CardDescription>
              </div>
              {(paymentReportType === "gateway" || reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card") && filteredSales.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <CreditCard className="w-3 h-3" />
                    {filteredSales.length} Transactions
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(paymentReportType === "gateway" || reportType === "aba" || reportType === "acleda" || reportType === "cash" || reportType === "due" || reportType === "card") ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount (USD)</TableHead>
                      <TableHead className="text-right">Amount (KHR)</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Payer Info</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No transactions found for the selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((sale) => {
                        const StatusIcon = getStatusIcon(sale.paymentStatus);
                        const usdAmount = parseFloat(sale.total);
                        const khrAmount = usdAmount * 4100;
                        
                        return (
                          <TableRow key={sale.id} data-testid={`row-gateway-${sale.id}`}>
                            <TableCell className="font-mono font-medium">#{sale.orderNumber}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(sale.createdAt), "MMM dd, yyyy")}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(sale.createdAt), "hh:mm a")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 capitalize">
                                <CreditCard className="w-3 h-3" />
                                {sale.paymentMethod || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              ${usdAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ៛{khrAmount.toFixed(0)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(sale.paymentStatus)} className="gap-1">
                                <StatusIcon className="w-3 h-3" />
                                {sale.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="font-medium">{sale.customerName || "Walk-in"}</div>
                                {sale.customerPhone && (
                                  <div className="text-xs text-muted-foreground">{sale.customerPhone}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleViewOrder(sale)}
                                  disabled={loadingOrderDetails}
                                  data-testid={`button-view-${sale.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleEditOrder(sale.id)}
                                  data-testid={`button-edit-${sale.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handlePrintOrder(sale)}
                                  data-testid={`button-print-${sale.id}`}
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {reportType === "sales" && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.length === filteredSales.length && filteredSales.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                    )}
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={reportType === "sales" ? 8 : 7} className="text-center text-muted-foreground">
                        No transactions found for the selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        {reportType === "sales" && (
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(sale.id)}
                              onCheckedChange={(checked) => handleSelectOrder(sale.id, checked as boolean)}
                              data-testid={`checkbox-order-${sale.id}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>{format(new Date(sale.createdAt), "MMM dd, yyyy HH:mm")}</TableCell>
                        <TableCell className="font-mono">#{sale.orderNumber}</TableCell>
                        <TableCell>{sale.customerName || "Walk-in"}</TableCell>
                        <TableCell className="font-mono">${sale.total}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sale.paymentMethod || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.status === "completed" ? "default" : "secondary"}>
                            {sale.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleViewOrder(sale)}
                              disabled={loadingOrderDetails}
                              data-testid={`button-view-${sale.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleEditOrder(sale.id)}
                              data-testid={`button-edit-${sale.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handlePrintOrder(sale)}
                              data-testid={`button-print-${sale.id}`}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>Complete order information and items</DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Order Number</label>
                    <div className="font-mono font-bold text-lg">#{selectedOrder.orderNumber}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                    <div className="font-medium">{format(new Date(selectedOrder.createdAt), "MMM dd, yyyy HH:mm")}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Name</label>
                    <div className="font-medium">{selectedOrder.customerName || "Walk-in"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <div className="font-medium">{selectedOrder.customerPhone || "N/A"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                    <div><Badge variant="outline" className="capitalize">{selectedOrder.paymentMethod || "N/A"}</Badge></div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div><Badge variant={selectedOrder.status === "completed" ? "default" : "secondary"}>{selectedOrder.status}</Badge></div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-4">Order Items</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">${parseFloat(item.price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">${parseFloat(item.discount).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            ${parseFloat(item.total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono">${parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                  </div>
                  {parseFloat(selectedOrder.discount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-mono">-${parseFloat(selectedOrder.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total (USD):</span>
                    <span className="font-mono">${parseFloat(selectedOrder.total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total (KHR):</span>
                    <span className="font-mono">៛{(parseFloat(selectedOrder.total) * 4100).toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                  <Button variant="outline" onClick={() => handleEditOrder(selectedOrder.id)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Order
                  </Button>
                  <Button onClick={() => handlePrintOrder(selectedOrder)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Receipt
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedOrders.length} selected order(s)? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
