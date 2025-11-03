import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, CreditCard, User, DollarSign, FileText, Wallet, Download, Upload, FileSpreadsheet } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBranch } from "@/contexts/BranchContext";
import type { Customer, Order } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface CustomerDueSummary {
  customer: Customer;
  totalDue: number;
  totalPaid: number;
  balance: number;
  credit: number;
  ordersCount: number;
}

interface OrderWithDetails extends Order {
  items?: Array<{
    productName: string;
    quantity: number;
    price: string;
    total: string;
  }>;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "aba", label: "ABA" },
  { value: "acleda", label: "Acleda" },
  { value: "bank-transfer", label: "Bank Transfer" },
];

const paymentFormSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  paymentDate: z.date(),
  note: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

export default function DueManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDueSummary | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<OrderWithDetails[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
  const [orderAllocations, setOrderAllocations] = useState<Record<string, number>>({});
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();

  const { data: customerSummaries = [], isLoading } = useQuery<CustomerDueSummary[]>({
    queryKey: ["/api/due/customers-summary", selectedBranchId],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/due/customers-summary?branchId=${selectedBranchId}`
        : "/api/due/customers-summary";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch customer summaries");
      return response.json();
    },
  });

  const { data: allOrders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders", selectedBranchId],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/orders?branchId=${selectedBranchId}`
        : "/api/orders";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: "cash",
      paymentDate: new Date(),
      note: "",
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: {
      payment: PaymentFormData;
      customerId: string;
      allocations: { orderId: string; amount: number }[];
    }) => {
      return await apiRequest("POST", "/api/due/payments", {
        customerId: data.customerId,
        paymentDate: data.payment.paymentDate.toISOString(),
        amount: data.payment.amount.toString(),
        paymentMethod: data.payment.paymentMethod,
        note: data.payment.note || "",
        unappliedAmount: "0",
        recordedBy: null,
        branchId: selectedBranchId || null,
        allocations: data.allocations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setSelectedOrders({});
      setOrderAllocations({});
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  // Filter customer summaries by search term
  const filteredCustomers = customerSummaries.filter((summary) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      summary.customer.name?.toLowerCase().includes(searchLower) ||
      summary.customer.phone?.toLowerCase().includes(searchLower)
    );
  });

  const handleRecordPayment = (customer: CustomerDueSummary) => {
    setSelectedCustomer(customer);
    
    // Get customer's due orders
    const dueOrders = allOrders.filter(
      (order) =>
        order.customerId === customer.customer.id &&
        (order.paymentStatus === "due" || order.paymentStatus === "partial")
    );
    
    setCustomerOrders(dueOrders);
    
    // Auto-allocate to oldest orders
    const sortedOrders = [...dueOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const initialAllocations: Record<string, number> = {};
    const initialSelected: Record<string, boolean> = {};
    
    sortedOrders.forEach((order) => {
      initialSelected[order.id] = false;
      initialAllocations[order.id] = 0;
    });
    
    setSelectedOrders(initialSelected);
    setOrderAllocations(initialAllocations);
    setShowPaymentModal(true);
  };

  const handleViewOrders = (customer: CustomerDueSummary) => {
    setSelectedCustomer(customer);
    
    const dueOrders = allOrders.filter(
      (order) =>
        order.customerId === customer.customer.id &&
        (order.paymentStatus === "due" || order.paymentStatus === "partial")
    );
    
    setCustomerOrders(dueOrders);
    setShowOrdersModal(true);
  };

  const handleAutoAllocate = () => {
    const paymentAmount = form.getValues("amount");
    if (!paymentAmount || paymentAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a payment amount first",
        variant: "destructive",
      });
      return;
    }

    const sortedOrders = [...customerOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let remaining = paymentAmount;
    const newAllocations: Record<string, number> = {};
    const newSelected: Record<string, boolean> = {};

    for (const order of sortedOrders) {
      if (remaining <= 0) {
        newSelected[order.id] = false;
        newAllocations[order.id] = 0;
        continue;
      }

      const orderBalance = parseFloat(order.dueAmount || order.total);
      const allocate = Math.min(remaining, orderBalance);

      if (allocate > 0) {
        newSelected[order.id] = true;
        newAllocations[order.id] = allocate;
        remaining -= allocate;
      } else {
        newSelected[order.id] = false;
        newAllocations[order.id] = 0;
      }
    }

    setSelectedOrders(newSelected);
    setOrderAllocations(newAllocations);
  };

  const handleAllocationChange = (orderId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setOrderAllocations((prev) => ({ ...prev, [orderId]: amount }));
  };

  const handleOrderSelect = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) => ({ ...prev, [orderId]: checked }));
    if (!checked) {
      setOrderAllocations((prev) => ({ ...prev, [orderId]: 0 }));
    }
  };

  const totalAllocated = Object.entries(selectedOrders)
    .filter(([_, selected]) => selected)
    .reduce((sum, [orderId]) => sum + (orderAllocations[orderId] || 0), 0);

  const handleSubmitPayment = (data: PaymentFormData) => {
    const allocations = Object.entries(selectedOrders)
      .filter(([_, selected]) => selected)
      .map(([orderId]) => ({
        orderId,
        amount: orderAllocations[orderId] || 0,
      }))
      .filter((a) => a.amount > 0);

    if (allocations.length === 0) {
      toast({
        title: "No Allocations",
        description: "Please allocate the payment to at least one order",
        variant: "destructive",
      });
      return;
    }

    if (totalAllocated > data.amount) {
      toast({
        title: "Over Allocated",
        description: "Total allocated amount exceeds payment amount",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCustomer) return;

    recordPaymentMutation.mutate({
      payment: data,
      customerId: selectedCustomer.customer.id,
      allocations,
    });
  };

  // Date filtering logic
  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    const today = new Date();
    
    if (range === "today") {
      setStartDate(startOfDay(today));
      setEndDate(endOfDay(today));
    } else if (range === "this-month") {
      setStartDate(startOfMonth(today));
      setEndDate(endOfMonth(today));
    } else if (range === "all") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  // Filter customers by date range
  const dateFilteredCustomers = filteredCustomers.filter((summary) => {
    if (!startDate || !endDate) return true;
    
    // Filter based on orders' creation dates
    const customerOrders = allOrders.filter(
      (order) => order.customerId === summary.customer.id &&
        (order.paymentStatus === "due" || order.paymentStatus === "partial")
    );
    
    return customerOrders.some((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
  });

  // Calculate totals
  const totalDueAmount = dateFilteredCustomers.reduce((sum, s) => sum + s.balance, 0);
  const totalCustomers = dateFilteredCustomers.length;
  const totalCredit = dateFilteredCustomers.reduce((sum, s) => sum + s.credit, 0);

  // Export to CSV
  const handleExportCSV = () => {
    const csvData = dateFilteredCustomers.map((summary) => ({
      "Customer Name": summary.customer.name || "",
      "Phone": summary.customer.phone || "",
      "Total Due": summary.totalDue.toFixed(2),
      "Total Paid": summary.totalPaid.toFixed(2),
      "Balance": summary.balance.toFixed(2),
      "Credit": summary.credit.toFixed(2),
      "Due Orders": summary.ordersCount,
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Due Customers");
    XLSX.writeFile(wb, `due-customers-${format(new Date(), "yyyy-MM-dd")}.csv`);
    
    toast({
      title: "Success",
      description: "Data exported to CSV successfully",
    });
  };

  // Export to Excel
  const handleExportExcel = () => {
    const excelData = dateFilteredCustomers.map((summary) => ({
      "Customer Name": summary.customer.name || "",
      "Phone": summary.customer.phone || "",
      "Total Due": summary.totalDue.toFixed(2),
      "Total Paid": summary.totalPaid.toFixed(2),
      "Balance": summary.balance.toFixed(2),
      "Credit": summary.credit.toFixed(2),
      "Due Orders": summary.ordersCount,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Due Customers");
    XLSX.writeFile(wb, `due-customers-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    
    toast({
      title: "Success",
      description: "Data exported to Excel successfully",
    });
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Due Customers Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 32);

    const tableData = dateFilteredCustomers.map((summary) => [
      summary.customer.name || "",
      summary.customer.phone || "",
      `$${summary.totalDue.toFixed(2)}`,
      `$${summary.totalPaid.toFixed(2)}`,
      `$${summary.balance.toFixed(2)}`,
      `$${summary.credit.toFixed(2)}`,
      summary.ordersCount.toString(),
    ]);

    (doc as any).autoTable({
      head: [["Customer", "Phone", "Total Due", "Paid", "Balance", "Credit", "Orders"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`due-customers-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    toast({
      title: "Success",
      description: "Data exported to PDF successfully",
    });
  };

  // Download sample CSV
  const handleDownloadSample = () => {
    const sampleData = [
      {
        "Customer Name": "John Doe",
        "Phone": "555-1234",
        "Email": "john@example.com",
      },
      {
        "Customer Name": "Jane Smith",
        "Phone": "555-5678",
        "Email": "jane@example.com",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, "customer-import-sample.csv");
    
    toast({
      title: "Success",
      description: "Sample file downloaded successfully",
    });
  };

  // Import customers from file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            const rowData = row as any;
            await apiRequest("POST", "/api/due/customers", {
              name: rowData["Customer Name"],
              phone: rowData["Phone"] || null,
              email: rowData["Email"] || null,
              branchId: selectedBranchId || null,
              notes: null,
            });
            successCount++;
          } catch (error) {
            errorCount++;
          }
        }

        queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
        
        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} customers. ${errorCount} errors.`,
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to process the import file",
          variant: "destructive",
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              Due Management
            </h1>
            <p className="text-muted-foreground mt-1">Track customer due payments and balances</p>
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
              <p className="text-xs text-muted-foreground mt-1">Across all customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-customers">
                {totalCustomers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">With due balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Unapplied Credit</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-total-credit">
                ${totalCredit.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Available credit balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters & Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search */}
              <div>
                <Label>Search</Label>
                <Input
                  placeholder="Search by customer name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              {/* Date Range Filter */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={handleDateRangeChange}>
                    <SelectTrigger data-testid="select-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this-month">This Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateRange === "custom" && (
                  <>
                    <div>
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start" data-testid="button-start-date">
                            <Calendar className="w-4 h-4 mr-2" />
                            {startDate ? format(startDate, "MMM dd, yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start" data-testid="button-end-date">
                            <Calendar className="w-4 h-4 mr-2" />
                            {endDate ? format(endDate, "MMM dd, yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </div>

              {/* Export and Import Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
                  <Download className="w-4 h-4 mr-1" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel">
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
                  <Download className="w-4 h-4 mr-1" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadSample} data-testid="button-download-sample">
                  <Download className="w-4 h-4 mr-1" />
                  Download Sample
                </Button>
                <Button variant="outline" size="sm" asChild data-testid="button-import">
                  <label>
                    <Upload className="w-4 h-4 mr-1" />
                    Import File
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Due Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : dateFilteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No customers with due payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Total Due</TableHead>
                      <TableHead>Total Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Credit</TableHead>
                      <TableHead>Due Orders</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateFilteredCustomers.map((summary) => (
                      <TableRow key={summary.customer.id} data-testid={`row-customer-${summary.customer.id}`}>
                        <TableCell className="font-medium" data-testid={`text-customer-name-${summary.customer.id}`}>
                          {summary.customer.name || "-"}
                        </TableCell>
                        <TableCell data-testid={`text-customer-phone-${summary.customer.id}`}>
                          {summary.customer.phone || "-"}
                        </TableCell>
                        <TableCell className="font-mono" data-testid={`text-total-due-${summary.customer.id}`}>
                          ${summary.totalDue.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono" data-testid={`text-total-paid-${summary.customer.id}`}>
                          ${summary.totalPaid.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className="font-mono font-bold text-primary"
                          data-testid={`text-balance-${summary.customer.id}`}
                        >
                          ${summary.balance.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className="font-mono text-green-600"
                          data-testid={`text-credit-${summary.customer.id}`}
                        >
                          ${summary.credit.toFixed(2)}
                        </TableCell>
                        <TableCell data-testid={`text-orders-count-${summary.customer.id}`}>
                          {summary.ordersCount}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleRecordPayment(summary)}
                              data-testid={`button-record-payment-${summary.customer.id}`}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Record Payment
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewOrders(summary)}
                              data-testid={`button-view-orders-${summary.customer.id}`}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View Orders
                            </Button>
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
      </div>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-record-payment">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedCustomer?.customer.name} (Balance: $
              {selectedCustomer?.balance.toFixed(2)})
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitPayment)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-payment-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full justify-start" data-testid="button-payment-date">
                              <Calendar className="w-4 h-4 mr-2" />
                              {field.value ? format(field.value, "MMM dd, yyyy") : "Pick date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add a note..." {...field} data-testid="input-payment-note" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Payment Allocation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Allocate Payment to Orders</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAutoAllocate} data-testid="button-auto-allocate">
                    Auto-Allocate to Oldest
                  </Button>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Allocate Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.map((order) => {
                        const orderBalance = parseFloat(order.dueAmount || order.total);
                        const orderPaid = parseFloat(order.paidAmount || "0");

                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrders[order.id] || false}
                                onCheckedChange={(checked) =>
                                  handleOrderSelect(order.id, checked as boolean)
                                }
                                data-testid={`checkbox-order-${order.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>
                              {format(new Date(order.createdAt), "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell className="font-mono">${parseFloat(order.total).toFixed(2)}</TableCell>
                            <TableCell className="font-mono">${orderPaid.toFixed(2)}</TableCell>
                            <TableCell className="font-mono font-bold">${orderBalance.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={orderAllocations[order.id] || ""}
                                onChange={(e) => handleAllocationChange(order.id, e.target.value)}
                                disabled={!selectedOrders[order.id]}
                                className="w-32"
                                data-testid={`input-allocation-${order.id}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Allocation Summary */}
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Payment Amount:</span>
                    <span className="font-mono">${form.watch("amount")?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Allocated:</span>
                    <span className="font-mono">${totalAllocated.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold">Remaining Unapplied:</span>
                    <span className="font-mono font-bold">
                      ${((form.watch("amount") || 0) - totalAllocated).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                  data-testid="button-cancel-payment"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  data-testid="button-submit-payment"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Orders Modal */}
      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-4xl" data-testid="dialog-view-orders">
          <DialogHeader>
            <DialogTitle>Customer Orders</DialogTitle>
            <DialogDescription>
              Due and partial orders for {selectedCustomer?.customer.name}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Paid Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerOrders.map((order) => {
                  const orderBalance = parseFloat(order.dueAmount || order.total);
                  const orderPaid = parseFloat(order.paidAmount || "0");

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{format(new Date(order.createdAt), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-mono">${parseFloat(order.total).toFixed(2)}</TableCell>
                      <TableCell className="font-mono">${orderPaid.toFixed(2)}</TableCell>
                      <TableCell className="font-mono font-bold text-primary">
                        ${orderBalance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{order.paymentStatus}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrdersModal(false)} data-testid="button-close-orders">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
