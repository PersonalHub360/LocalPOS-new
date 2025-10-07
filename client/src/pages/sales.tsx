import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function SalesManage() {
  const [viewSale, setViewSale] = useState<Order | null>(null);
  const [editSale, setEditSale] = useState<Order | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const { data: sales = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
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

  const handlePrint = (sale: Order) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sale Receipt - INV-${sale.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #ea580c; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .total { font-weight: bold; font-size: 1.2em; }
          </style>
        </head>
        <body>
          <h1>Sale Receipt</h1>
          <p><strong>Sale ID:</strong> ${sale.id}</p>
          <p><strong>Invoice No:</strong> INV-${sale.orderNumber}</p>
          <p><strong>Date:</strong> ${format(new Date(sale.createdAt), "PPpp")}</p>
          <p><strong>Customer:</strong> ${sale.customerName || "Walk-in Customer"}</p>
          <p><strong>Dining Option:</strong> ${sale.diningOption}</p>
          <hr>
          <p><strong>Subtotal:</strong> $${sale.subtotal}</p>
          <p><strong>Discount:</strong> $${sale.discount}</p>
          <p class="total"><strong>Total:</strong> $${sale.total}</p>
          <p><strong>Pay by:</strong> ${sale.paymentMethod || "N/A"}</p>
          <p><strong>Payment Status:</strong> ${sale.paymentStatus}</p>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handleUpdate = () => {
    if (!editSale) return;
    updateMutation.mutate({
      id: editSale.id,
      data: {
        customerName: editSale.customerName,
        paymentStatus: editSale.paymentStatus,
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
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent data-testid="dialog-view-sale">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>View complete sale information</DialogDescription>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
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
                  <Label className="text-muted-foreground">Subtotal</Label>
                  <p className="font-medium" data-testid="view-subtotal">${viewSale.subtotal}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Discount</Label>
                  <p className="font-medium" data-testid="view-discount">${viewSale.discount}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-bold text-lg" data-testid="view-total">${viewSale.total}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Pay by</Label>
                  <p className="font-medium capitalize" data-testid="view-pay-by">{viewSale.paymentMethod || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Status</Label>
                  <p className="font-medium" data-testid="view-payment-status">{viewSale.paymentStatus}</p>
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
        <DialogContent data-testid="dialog-edit-sale">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>Modify sale details</DialogDescription>
          </DialogHeader>
          {editSale && (
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
