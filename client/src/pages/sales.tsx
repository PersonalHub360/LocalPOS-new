import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Pencil, Printer, Trash2, Download, FileSpreadsheet, FileText, Search, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type DateFilterType = "all" | "today" | "yesterday" | "custom";

interface OrderItemWithProduct {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: string;
  total: string;
  productName: string;
}

interface SalesSummaryItem {
  product: string;
  quantity: number;
  revenue: number;
}

export default function SalesManage() {
  const [activeTab, setActiveTab] = useState("detailed");
  const [viewSale, setViewSale] = useState<Order | null>(null);
  const [editSale, setEditSale] = useState<Order | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [summaryDateFilter, setSummaryDateFilter] = useState<DateFilterType>("all");
  const [summaryStartDate, setSummaryStartDate] = useState<Date | undefined>(undefined);
  const [summaryEndDate, setSummaryEndDate] = useState<Date | undefined>(undefined);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const { toast} = useToast();

  const { data: sales = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Get date range for sales summary - memoize to prevent infinite re-renders
  const summaryDateRange = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = now;

    if (summaryDateFilter === "today") {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (summaryDateFilter === "yesterday") {
      const yesterday = subDays(now, 1);
      start = startOfDay(yesterday);
      end = endOfDay(yesterday);
    } else if (summaryDateFilter === "custom" && summaryStartDate && summaryEndDate) {
      start = startOfDay(summaryStartDate);
      end = endOfDay(summaryEndDate);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }, [summaryDateFilter, summaryStartDate, summaryEndDate]);
  
  const { data: salesSummary = [], isLoading: isSummaryLoading } = useQuery<SalesSummaryItem[]>({
    queryKey: ["/api/sales/summary", summaryDateRange.start, summaryDateRange.end],
    queryFn: async () => {
      const url = `/api/sales/summary?startDate=${summaryDateRange.start}&endDate=${summaryDateRange.end}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Order> }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Sale updated successfully",
      });
      setEditSale(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sale",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Sale deleted successfully",
      });
      setDeleteSaleId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sale",
        variant: "destructive",
      });
    },
  });

  // Fetch order items when viewing or editing a sale
  useEffect(() => {
    const fetchOrderItems = async (orderId: string) => {
      try {
        const response = await fetch(`/api/orders/${orderId}/items`);
        if (!response.ok) throw new Error("Failed to fetch order items");
        const data = await response.json();
        setOrderItems(data);
      } catch (error) {
        console.error("Error fetching order items:", error);
        setOrderItems([]);
      }
    };

    if (viewSale) {
      fetchOrderItems(viewSale.id);
    } else if (editSale) {
      fetchOrderItems(editSale.id);
    } else {
      setOrderItems([]);
    }
  }, [viewSale, editSale]);

  const handlePrint = async (sale: Order) => {
    try {
      // Fetch order items
      const response = await fetch(`/api/orders/${sale.id}/items`);
      if (!response.ok) throw new Error("Failed to fetch order items");
      const items: OrderItemWithProduct[] = await response.json();

      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const itemsRows = items.map(item => `
        <tr>
          <td>${item.productName}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">$${item.price}</td>
          <td style="text-align: center;">-</td>
          <td style="text-align: right;">$${item.total}</td>
        </tr>
      `).join('');

      // Calculate total in KHR (1 USD = 4,100 KHR)
      const totalUSD = parseFloat(sale.total);
      const totalKHR = (totalUSD * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Sale Receipt - INV-${sale.orderNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
              h1 { color: #ea580c; margin-bottom: 20px; }
              .header-info { margin-bottom: 20px; }
              .header-info p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f3f4f6; font-weight: 600; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .summary { margin-top: 20px; text-align: right; }
              .summary p { margin: 8px 0; }
              .total { font-weight: bold; font-size: 1.3em; color: #ea580c; }
              .total-khr { color: #666; font-size: 0.95em; margin-top: 4px; }
              hr { margin: 20px 0; border: none; border-top: 2px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <h1>Sale Receipt</h1>
            <div class="header-info">
              <p><strong>Sale ID:</strong> ${sale.id}</p>
              <p><strong>Invoice No:</strong> INV-${sale.orderNumber}</p>
              <p><strong>Date:</strong> ${format(new Date(sale.createdAt), "PPpp")}</p>
              <p><strong>Customer:</strong> ${sale.customerName || "Walk-in Customer"}</p>
              <p><strong>Dining Option:</strong> ${sale.diningOption}</p>
            </div>
            
            <h3>Order Items</h3>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th class="text-center">Quantity</th>
                  <th class="text-right">Price</th>
                  <th class="text-center">Discount</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="summary">
              <p><strong>Subtotal:</strong> $${sale.subtotal}</p>
              <p><strong>Discount:</strong> $${sale.discount}</p>
              <p class="total"><strong>Total:</strong> $${sale.total}</p>
              <p class="total-khr"><strong>Total in KHR:</strong> ៛${totalKHR}</p>
              <hr>
              <p><strong>Pay by:</strong> ${sale.paymentMethod || "N/A"}</p>
              <p><strong>Payment Status:</strong> ${sale.paymentStatus}</p>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to print receipt",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = () => {
    if (!editSale) return;
    updateMutation.mutate({
      id: editSale.id,
      data: {
        customerName: editSale.customerName,
        paymentStatus: editSale.paymentStatus,
        paymentMethod: editSale.paymentMethod,
        status: editSale.status,
      },
    });
  };

  const handleDelete = () => {
    if (!deleteSaleId) return;
    deleteMutation.mutate(deleteSaleId);
  };

  const getPaymentStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return colors[status] || colors.pending;
  };

  const exportToExcel = () => {
    const exportData = filteredSales.map((sale) => ({
      "Sale ID": sale.id,
      "Invoice No": `INV-${sale.orderNumber}`,
      "Date & Time": format(new Date(sale.createdAt), "PPpp"),
      "Customer Name": sale.customerName || "Walk-in Customer",
      "Dining Option": sale.diningOption,
      "Subtotal": `$${sale.subtotal}`,
      "Discount Amount": `$${sale.discount}`,
      "Total Amount": `$${sale.total}`,
      "Pay by": sale.paymentMethod || "N/A",
      "Payment Status": sale.paymentStatus,
      "Order Status": sale.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");

    const fileName = `sales_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Success",
      description: "Sales data exported to Excel successfully",
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Sales Report", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), "PPpp")}`, 14, 32);

    const tableData = filteredSales.map((sale) => [
      sale.id,
      `INV-${sale.orderNumber}`,
      format(new Date(sale.createdAt), "PPpp"),
      sale.customerName || "Walk-in Customer",
      `$${sale.discount}`,
      `$${sale.total}`,
      sale.paymentMethod || "N/A",
      sale.paymentStatus,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Sale ID", "Invoice No", "Date & Time", "Customer", "Discount", "Total", "Pay by", "Payment"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [234, 88, 12] },
    });

    const fileName = `sales_report_${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);

    toast({
      title: "Success",
      description: "Sales data exported to PDF successfully",
    });
  };

  const filteredSales = sales.filter((sale) => {
    if (sale.status !== "completed") {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    const invoiceNo = `INV-${sale.orderNumber}`.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      sale.id.toLowerCase().includes(searchLower) ||
      sale.orderNumber.toLowerCase().includes(searchLower) ||
      invoiceNo.includes(searchLower) ||
      sale.customerName?.toLowerCase().includes(searchLower) ||
      sale.total.toLowerCase().includes(searchLower);

    const saleDate = new Date(sale.createdAt);
    let matchesDate = true;

    if (dateFilter === "today") {
      const today = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      matchesDate = isWithinInterval(saleDate, { start: today, end: todayEnd });
    } else if (dateFilter === "yesterday") {
      const yesterday = startOfDay(subDays(new Date(), 1));
      const yesterdayEnd = endOfDay(subDays(new Date(), 1));
      matchesDate = isWithinInterval(saleDate, { start: yesterday, end: yesterdayEnd });
    } else if (dateFilter === "custom" && startDate && endDate) {
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      matchesDate = isWithinInterval(saleDate, { start, end });
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-sales-title">Sales Management</h1>
            <p className="text-muted-foreground mt-1">Manage sales activities and records</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-export">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel} data-testid="button-export-excel">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} data-testid="button-export-pdf">
                <FileText className="w-4 h-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="detailed" data-testid="tab-detailed-sales">Detailed Sales Report</TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-sales-summary">Sales Summary Report</TabsTrigger>
          </TabsList>

          <TabsContent value="detailed" className="space-y-4">
            <Card>
          <CardHeader>
            <CardTitle>Sales List</CardTitle>
            <CardDescription>Comprehensive list of all sales transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name, sale ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-sales"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={dateFilter} onValueChange={(value: DateFilterType) => setDateFilter(value)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-date-filter">
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {dateFilter === "custom" && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[160px] justify-start" data-testid="button-start-date">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : "Start Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[160px] justify-start" data-testid="button-end-date">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "End Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            </div>

            {isLoading ? (
              <p className="text-muted-foreground">Loading sales...</p>
            ) : filteredSales.length === 0 ? (
              <p className="text-muted-foreground">No sales found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="header-sale-id">Sale ID</TableHead>
                      <TableHead data-testid="header-invoice-no">Invoice No</TableHead>
                      <TableHead data-testid="header-date-time">Date & Time</TableHead>
                      <TableHead data-testid="header-customer-name">Customer Name</TableHead>
                      <TableHead data-testid="header-discount-amount">Discount</TableHead>
                      <TableHead data-testid="header-total-amount">Total Amount</TableHead>
                      <TableHead data-testid="header-pay-by">Pay by</TableHead>
                      <TableHead data-testid="header-payment-status">Payment Status</TableHead>
                      <TableHead data-testid="header-actions">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell data-testid={`text-sale-id-${sale.id}`}>{sale.id}</TableCell>
                        <TableCell data-testid={`text-invoice-no-${sale.id}`}>INV-{sale.orderNumber}</TableCell>
                        <TableCell data-testid={`text-date-${sale.id}`}>
                          {format(new Date(sale.createdAt), "PPpp")}
                        </TableCell>
                        <TableCell data-testid={`text-customer-${sale.id}`}>
                          {sale.customerName || "Walk-in Customer"}
                        </TableCell>
                        <TableCell data-testid={`text-discount-${sale.id}`}>${sale.discount}</TableCell>
                        <TableCell data-testid={`text-total-${sale.id}`}>${sale.total}</TableCell>
                        <TableCell data-testid={`text-pay-by-${sale.id}`}>
                          <span className="capitalize">{sale.paymentMethod || "N/A"}</span>
                        </TableCell>
                        <TableCell data-testid={`text-payment-status-${sale.id}`}>
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusBadge(
                              sale.paymentStatus
                            )}`}
                          >
                            {sale.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setViewSale(sale)}
                                  data-testid={`button-view-${sale.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditSale(sale)}
                                  data-testid={`button-edit-${sale.id}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Sale</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handlePrint(sale)}
                                  data-testid={`button-print-${sale.id}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Print Receipt</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteSaleId(sale.id)}
                                  data-testid={`button-delete-${sale.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Sale</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales Summary Report</CardTitle>
                <CardDescription>Individual item sales summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Select value={summaryDateFilter} onValueChange={(value: DateFilterType) => setSummaryDateFilter(value)}>
                      <SelectTrigger className="w-[180px]" data-testid="select-summary-date-filter">
                        <SelectValue placeholder="Filter by date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>

                    {summaryDateFilter === "custom" && (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[160px] justify-start" data-testid="button-summary-start-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {summaryStartDate ? format(summaryStartDate, "PPP") : "Start Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={summaryStartDate}
                              onSelect={setSummaryStartDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[160px] justify-start" data-testid="button-summary-end-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {summaryEndDate ? format(summaryEndDate, "PPP") : "End Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={summaryEndDate}
                              onSelect={setSummaryEndDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by product name..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-product-search"
                    />
                  </div>
                </div>

                {isSummaryLoading ? (
                  <p className="text-muted-foreground">Loading sales summary...</p>
                ) : (() => {
                  const filteredSummary = salesSummary.filter((item) =>
                    item.product.toLowerCase().includes(productSearchTerm.toLowerCase())
                  );
                  
                  return filteredSummary.length === 0 ? (
                    <p className="text-muted-foreground">
                      {productSearchTerm 
                        ? `No products found matching "${productSearchTerm}"`
                        : "No sales data available for the selected period"}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="header-product-name">Product Name</TableHead>
                            <TableHead data-testid="header-quantity-sold">Quantity Sold</TableHead>
                            <TableHead data-testid="header-total-revenue">Total Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSummary.map((item, index) => (
                            <TableRow key={index} data-testid={`row-summary-${index}`}>
                              <TableCell data-testid={`text-product-${index}`} className="font-medium">{item.product}</TableCell>
                              <TableCell data-testid={`text-quantity-${index}`}>{item.quantity}</TableCell>
                              <TableCell data-testid={`text-revenue-${index}`}>${item.revenue.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-sale">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>View complete sale information</DialogDescription>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Sale ID</Label>
                  <p className="font-medium" data-testid="view-sale-id">{viewSale.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice No</Label>
                  <p className="font-medium" data-testid="view-invoice-no">INV-{viewSale.orderNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date & Time</Label>
                  <p className="font-medium" data-testid="view-date">
                    {format(new Date(viewSale.createdAt), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium" data-testid="view-customer">
                    {viewSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dining Option</Label>
                  <p className="font-medium" data-testid="view-dining-option">{viewSale.diningOption}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p className="font-medium capitalize" data-testid="view-pay-by">{viewSale.paymentMethod || "N/A"}</p>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Order Items</Label>
                {orderItems.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item) => (
                          <TableRow key={item.id} data-testid={`view-item-${item.id}`}>
                            <TableCell data-testid={`view-item-name-${item.id}`}>{item.productName}</TableCell>
                            <TableCell className="text-right" data-testid={`view-item-qty-${item.id}`}>{item.quantity}</TableCell>
                            <TableCell className="text-right" data-testid={`view-item-price-${item.id}`}>${item.price}</TableCell>
                            <TableCell className="text-right" data-testid={`view-item-total-${item.id}`}>${item.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Loading items...</p>
                )}
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Subtotal</Label>
                  <p className="font-medium" data-testid="view-subtotal">${viewSale.subtotal}</p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Discount</Label>
                  <p className="font-medium" data-testid="view-discount">${viewSale.discount}</p>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <Label className="text-lg font-semibold">Total</Label>
                  <p className="font-bold text-lg" data-testid="view-total">${viewSale.total}</p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Payment Status</Label>
                  <p className="font-medium" data-testid="view-payment-status">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusBadge(viewSale.paymentStatus)}`}>
                      {viewSale.paymentStatus}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewSale(null)} data-testid="button-close-view">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSale} onOpenChange={() => setEditSale(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-sale">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>Modify sale details</DialogDescription>
          </DialogHeader>
          {editSale && (
            <div className="space-y-6">
              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    data-testid="input-edit-customer-name"
                    value={editSale.customerName || ""}
                    onChange={(e) =>
                      setEditSale({ ...editSale, customerName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="payment-status">Payment Status</Label>
                  <Select
                    value={editSale.paymentStatus}
                    onValueChange={(value) =>
                      setEditSale({ ...editSale, paymentStatus: value })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-payment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Order Status</Label>
                  <Select
                    value={editSale.status}
                    onValueChange={(value) =>
                      setEditSale({ ...editSale, status: value })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Process Payment Section */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-4 block">Process Payment</Label>
                <div>
                  <Label htmlFor="payment-method">Payment Method (Pay by)</Label>
                  <Select
                    value={editSale.paymentMethod || ""}
                    onValueChange={(value) =>
                      setEditSale({ ...editSale, paymentMethod: value })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aba">ABA</SelectItem>
                      <SelectItem value="acleda">Acleda</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="cash_aba">Cash And ABA</SelectItem>
                      <SelectItem value="cash_acleda">Cash And Acleda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Order Items (Read-only) */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Order Items</Label>
                {orderItems.length > 0 ? (
                  <div className="border rounded-md bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item) => (
                          <TableRow key={item.id} data-testid={`edit-item-${item.id}`}>
                            <TableCell data-testid={`edit-item-name-${item.id}`}>{item.productName}</TableCell>
                            <TableCell className="text-right" data-testid={`edit-item-qty-${item.id}`}>{item.quantity}</TableCell>
                            <TableCell className="text-right" data-testid={`edit-item-price-${item.id}`}>${item.price}</TableCell>
                            <TableCell className="text-right" data-testid={`edit-item-total-${item.id}`}>${item.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Loading items...</p>
                )}
              </div>

              {/* Order Summary (Read-only) */}
              <div className="border-t pt-4 space-y-2 bg-muted/20 p-4 rounded-md">
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Subtotal</Label>
                  <p className="font-medium">${editSale.subtotal}</p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Discount</Label>
                  <p className="font-medium">${editSale.discount}</p>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <Label className="text-lg font-semibold">Total</Label>
                  <p className="font-bold text-lg">${editSale.total}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSale(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSaleId} onOpenChange={() => setDeleteSaleId(null)}>
        <AlertDialogContent data-testid="dialog-delete-sale">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
