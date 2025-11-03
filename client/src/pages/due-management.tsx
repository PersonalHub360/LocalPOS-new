import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CreditCard, User, Phone, DollarSign, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Order } from "@shared/schema";

type OrderWithDetails = Order & {
  items?: Array<{
    productName: string;
    quantity: number;
    price: string;
    total: string;
  }>;
};

interface PaymentSplit {
  method: string;
  amount: number;
}

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "custom", label: "Custom Date" },
];

export default function DueManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState<Date>();
  const [monthFilter, setMonthFilter] = useState<Date>();

  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // Filter orders to only show those with "due" payment
  const dueOrders = orders.filter((order) => {
    // Check if primary payment method is "due"
    if (order.paymentMethod === "due") return true;

    // Check if any payment split contains "due"
    if (order.paymentSplits) {
      try {
        const splits: PaymentSplit[] = JSON.parse(order.paymentSplits);
        return splits.some((split) => split.method === "due");
      } catch {
        return false;
      }
    }

    return false;
  });

  // Calculate due amount for each order
  const getDueAmount = (order: OrderWithDetails) => {
    if (order.paymentMethod === "due") {
      return parseFloat(order.total);
    }

    if (order.paymentSplits) {
      try {
        const splits: PaymentSplit[] = JSON.parse(order.paymentSplits);
        const dueSplit = splits.find((split) => split.method === "due");
        return dueSplit?.amount || 0;
      } catch {
        return 0;
      }
    }

    return 0;
  };

  // Apply filters
  const filteredOrders = dueOrders.filter((order) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerPhone?.includes(searchTerm);

    if (!matchesSearch) return false;

    // Date filter
    const orderDate = order.completedAt ? new Date(order.completedAt) : new Date(order.createdAt);
    const now = new Date();
    let matchesDateFilter = true;

    if (dateFilter === "today") {
      matchesDateFilter = orderDate.toDateString() === now.toDateString();
    } else if (dateFilter === "this-week") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      matchesDateFilter = isWithinInterval(orderDate, { start: weekStart, end: weekEnd });
    } else if (dateFilter === "this-month") {
      matchesDateFilter = (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    } else if (dateFilter === "custom" && customDate) {
      matchesDateFilter = orderDate.toDateString() === customDate.toDateString();
    }

    if (!matchesDateFilter) return false;

    // Month filter
    if (monthFilter) {
      const monthStart = startOfMonth(monthFilter);
      const monthEnd = endOfMonth(monthFilter);
      return isWithinInterval(orderDate, { start: monthStart, end: monthEnd });
    }

    return true;
  });

  // Calculate totals
  const totalDueAmount = filteredOrders.reduce((sum, order) => sum + getDueAmount(order), 0);
  const totalCustomers = new Set(filteredOrders.map((o) => o.customerName || o.customerPhone)).size;

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Due Management</h1>
            <p className="text-muted-foreground mt-1">Track all customer bills with due payments</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Due Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-total-due">
                ${totalDueAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-orders">
                {filteredOrders.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Due payment orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Customers</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-customers">
                {totalCustomers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                With due payments
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter Due Bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Order #, customer name/phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date Filter</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue placeholder="Date Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dateFilter === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" data-testid="button-custom-date">
                        <Calendar className="w-4 h-4 mr-2" />
                        {customDate ? format(customDate, "MMM dd, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={customDate}
                        onSelect={setCustomDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Month</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-month-filter">
                      <Calendar className="w-4 h-4 mr-2" />
                      {monthFilter ? format(monthFilter, "MMMM yyyy") : "All Months"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={monthFilter}
                      onSelect={setMonthFilter}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {monthFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMonthFilter(undefined)}
                    data-testid="button-clear-month"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Due Bills Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Due Bills</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No due bills found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Due Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const orderDate = order.completedAt
                        ? new Date(order.completedAt)
                        : new Date(order.createdAt);
                      const dueAmount = getDueAmount(order);

                      return (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-medium" data-testid={`text-order-number-${order.id}`}>
                            {order.orderNumber}
                          </TableCell>
                          <TableCell data-testid={`text-order-date-${order.id}`}>
                            {format(orderDate, "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell data-testid={`text-customer-name-${order.id}`}>
                            {order.customerName || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-customer-phone-${order.id}`}>
                            {order.customerPhone || "-"}
                          </TableCell>
                          <TableCell className="font-mono" data-testid={`text-total-${order.id}`}>
                            ${parseFloat(order.total).toFixed(2)}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-primary" data-testid={`text-due-amount-${order.id}`}>
                            ${dueAmount.toFixed(2)}
                          </TableCell>
                          <TableCell data-testid={`text-payment-method-${order.id}`}>
                            {order.paymentSplits ? (
                              <span className="text-xs bg-muted px-2 py-1 rounded">Split Payment</span>
                            ) : (
                              <span className="capitalize">{order.paymentMethod}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
