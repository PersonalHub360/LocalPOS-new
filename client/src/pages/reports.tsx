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
  FileText
} from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

type ReportType = "sales" | "inventory" | "payments" | "discounts" | "refunds" | "staff";
type DateFilter = "today" | "yesterday" | "7days" | "month" | "custom";

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

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
      if (dateFilter === "custom" && customEndDate) {
        return saleDate >= startDate && saleDate <= customEndDate;
      }
      return saleDate >= startDate;
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

  const handleExport = () => {
    const csvContent = [
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

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <Button onClick={handleExport} data-testid="button-export-report">
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
            <CardTitle>Detailed {reportType === "sales" ? "Sales" : "Transaction"} Report</CardTitle>
            <CardDescription>View all transactions in the selected date range</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
