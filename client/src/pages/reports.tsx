import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  Clock
} from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ReportType = "sales" | "inventory" | "payments" | "discounts" | "refunds" | "staff" | "gateway";
type DateFilter = "today" | "yesterday" | "7days" | "month" | "custom";

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  const { data: sales = [] } = useQuery<Order[]>({
    queryKey: ["/api/sales"],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
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
      if (reportType === "gateway") {
        if (paymentMethodFilter !== "all" && sale.paymentMethod !== paymentMethodFilter) {
          return false;
        }
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
    
    if (reportType === "gateway") {
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
    
    // Add header
    doc.setFontSize(18);
    doc.text("Payment Gateway Report", 14, 20);
    
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

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">POS Reports Dashboard</h1>
            <p className="text-muted-foreground mt-1">Analyze performance, sales, and profitability</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} data-testid="button-print-report">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {reportType === "gateway" && (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <SelectItem value="gateway">Payment Gateway</SelectItem>
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

              {dateFilter === "custom" && (
                <div className="flex gap-2">
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
                </div>
              )}
            </div>

            {reportType === "gateway" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Method</label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="ABA">ABA</SelectItem>
                      <SelectItem value="Acleda">Acleda</SelectItem>
                      <SelectItem value="Due">Due</SelectItem>
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
              </div>
            )}
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {reportType === "gateway" ? "Payment Gateway Transactions" : `Detailed ${reportType === "sales" ? "Sales" : "Transaction"} Report`}
                </CardTitle>
                <CardDescription>
                  {reportType === "gateway" 
                    ? "Complete transaction details with payment gateway information" 
                    : "View all transactions in the selected date range"}
                </CardDescription>
              </div>
              {reportType === "gateway" && filteredSales.length > 0 && (
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
            {reportType === "gateway" ? (
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
                                <Button size="sm" variant="ghost" data-testid={`button-view-${sale.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" data-testid={`button-print-${sale.id}`}>
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No transactions found for the selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
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
                            <Button size="sm" variant="ghost" data-testid={`button-view-${sale.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" data-testid={`button-print-${sale.id}`}>
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
      </div>
    </div>
  );
}
