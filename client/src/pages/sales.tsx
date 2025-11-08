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
import { Eye, Pencil, Printer, Trash2, Download, FileSpreadsheet, FileText, Search, Calendar as CalendarIcon, Trash, Upload } from "lucide-react";
import { generateReceiptHTML, type ReceiptTemplate } from "@/lib/receipt-templates";
import { Checkbox } from "@/components/ui/checkbox";
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

interface PaymentSplit {
  method: string;
  amount: number;
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
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>("cash");
  const [newPaymentAmount, setNewPaymentAmount] = useState<string>("");
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [printSale, setPrintSale] = useState<Order | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate>("classic");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return Promise.all(ids.map(id => apiRequest("DELETE", `/api/orders/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: `${selectedSales.size} sale(s) deleted successfully`,
      });
      setSelectedSales(new Set());
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected sales",
        variant: "destructive",
      });
    },
  });

  const toggleSelectAll = () => {
    if (selectedSales.size === filteredSales.length) {
      setSelectedSales(new Set());
    } else {
      setSelectedSales(new Set(filteredSales.map(sale => sale.id)));
    }
  };

  const toggleSelectSale = (id: string) => {
    const newSelected = new Set(selectedSales);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSales(newSelected);
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedSales));
  };

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
      // Load existing payment splits if any
      if (editSale.paymentSplits) {
        try {
          const splits = JSON.parse(editSale.paymentSplits);
          setPaymentSplits(splits);
        } catch {
          setPaymentSplits([]);
        }
      } else {
        setPaymentSplits([]);
      }
    } else {
      setOrderItems([]);
      setPaymentSplits([]);
    }
  }, [viewSale, editSale]);

  const handlePrint = async (sale: Order, template?: ReceiptTemplate) => {
    try {
      // Fetch order items
      const response = await fetch(`/api/orders/${sale.id}/items`);
      if (!response.ok) throw new Error("Failed to fetch order items");
      const items: OrderItemWithProduct[] = await response.json();

      // Fetch settings for receipt customization
      const settingsResponse = await fetch("/api/settings");
      const settings = settingsResponse.ok ? await settingsResponse.json() : null;

      // Use provided template or default to classic
      const templateToUse = template || selectedTemplate;

      // Calculate total in KHR
      const totalUSD = parseFloat(sale.total);
      const totalKHRNum = totalUSD * 4100;
      const totalKHR = totalKHRNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      // Parse payment splits if available
      let paymentDetails = `<p><strong>Pay by:</strong> ${sale.paymentMethod || "N/A"}</p>`;
      if (sale.paymentSplits) {
        try {
          const splits: PaymentSplit[] = JSON.parse(sale.paymentSplits);
          if (splits.length > 0) {
            const splitsHtml = splits.map(split => {
              const methodLabel = getPaymentMethodLabel(split.method);
              const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              return `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span>${methodLabel}:</span>
                  <span><strong>$${split.amount.toFixed(2)}</strong> (៛${amountKHR})</span>
                </div>
              `;
            }).join('');
            paymentDetails = `
              <div style="margin-top: 10px;">
                <p style="margin-bottom: 10px;"><strong>Payment Split:</strong></p>
                <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; background-color: #f9fafb;">
                  ${splitsHtml}
                </div>
              </div>
            `;
          }
        } catch (error) {
          console.error("Failed to parse payment splits:", error);
        }
      }

      // Generate receipt HTML using template
      const receiptData = {
        sale,
        items: items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          productName: item.productName,
        })),
        settings,
        totalKHR: totalKHRNum,
        paymentDetails,
      };

      const content = generateReceiptHTML(templateToUse, receiptData);

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to print receipts",
          variant: "destructive",
        });
        return;
      }

      printWindow.document.write(content);
      printWindow.document.close();
      
      // Wait for content to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to print receipt",
        variant: "destructive",
      });
    }
  };

  const handlePrintClick = (sale: Order) => {
    // Show template selection dialog
    setPrintSale(sale);
  };

  const handleConfirmPrint = () => {
    if (printSale) {
      handlePrint(printSale, selectedTemplate);
      setPrintSale(null);
    }
  };

  const addPaymentSplit = () => {
    if (!newPaymentAmount || parseFloat(newPaymentAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(newPaymentAmount);
    const totalPaid = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
    const orderTotal = editSale ? parseFloat(editSale.total) : 0;

    if (totalPaid + amount > orderTotal) {
      toast({
        title: "Amount Exceeds Total",
        description: `Payment amount cannot exceed order total of $${orderTotal.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setPaymentSplits([...paymentSplits, { method: newPaymentMethod, amount }]);
    setNewPaymentAmount("");
    setNewPaymentMethod("cash");
  };

  const removePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      "aba": "ABA",
      "acleda": "Acleda",
      "cash": "Cash",
      "due": "Due",
      "card": "Card",
      "cash_aba": "Cash And ABA",
      "cash_acleda": "Cash And Acleda",
    };
    return labels[method] || method;
  };

  const handleUpdate = () => {
    if (!editSale) return;

    // Generate primary payment method from splits
    let primaryPaymentMethod = editSale.paymentMethod;
    if (paymentSplits.length > 0) {
      // Create a summary of payment methods used
      const methods = paymentSplits.map(s => getPaymentMethodLabel(s.method));
      primaryPaymentMethod = methods.length === 1 ? paymentSplits[0].method : "split";
    }

    const updateData: any = {
      customerName: editSale.customerName,
      paymentStatus: editSale.paymentStatus,
      paymentMethod: primaryPaymentMethod,
      paymentSplits: paymentSplits.length > 0 ? JSON.stringify(paymentSplits) : null,
      status: editSale.status,
    };

    // Add createdAt if it was modified
    if (editSale.createdAt) {
      const createdAtValue = typeof editSale.createdAt === 'string' 
        ? editSale.createdAt 
        : new Date(editSale.createdAt).toISOString();
      updateData.createdAt = createdAtValue;
    }

    updateMutation.mutate({
      id: editSale.id,
      data: updateData,
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

  const handleDownloadSample = () => {
    const sampleData = [
      ["Invoice No", "Date & Time", "Customer Name", "Customer Phone", "Subtotal", "Discount", "Total", "Payment Method", "Payment Status", "Order Status", "Dining Option"],
      ["INV-001", "2025-11-07 10:00:00", "John Doe", "012345678", "100.00", "0.00", "100.00", "cash", "paid", "completed", "dine-in"],
      ["INV-002", "2025-11-07 11:30:00", "Jane Smith", "098765432", "250.50", "10.00", "240.50", "card", "paid", "completed", "takeaway"],
      ["INV-003", "2025-11-07 14:15:00", "Walk-in Customer", "", "75.25", "5.00", "70.25", "aba", "paid", "completed", "dine-in"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");

    const fileName = `sales_import_sample.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Success",
      description: "Sample file downloaded successfully",
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCSV = file.name.endsWith('.csv');

    if (!isExcel && !isCSV) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        let rows: any[][] = [];
        
        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as any[][];
          rows = jsonData.slice(1); // Skip header row
        } else {
          const text = event.target?.result as string;
          const lines = text.split('\n').slice(1); // Skip header row
          rows = lines.map(line => {
            if (!line.trim()) return [];
            // Simple CSV parsing - handle quoted fields
            const fields: string[] = [];
            let currentField = '';
            let insideQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const nextChar = line[i + 1];
              
              if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                  currentField += '"';
                  i++; // Skip next quote
                } else {
                  insideQuotes = !insideQuotes;
                }
              } else if (char === ',' && !insideQuotes) {
                fields.push(currentField.trim());
                currentField = '';
              } else {
                currentField += char;
              }
            }
            fields.push(currentField.trim());
            return fields;
          }).filter(row => row.length > 0);
        }

        // Prepare data for API
        const salesData = rows.map((row, index) => {
          try {
            // Expected columns: Invoice No, Date & Time, Customer Name, Customer Phone, Subtotal, Discount, Total, Payment Method, Payment Status, Order Status, Dining Option
            const invoiceNo = row[0]?.toString().trim() || '';
            const dateTime = row[1]?.toString().trim() || new Date().toISOString();
            const customerName = row[2]?.toString().trim() || 'Walk-in Customer';
            const customerPhone = row[3]?.toString().trim() || '';
            const subtotal = parseFloat(row[4]?.toString().replace(/[^0-9.-]/g, '') || '0');
            const discount = parseFloat(row[5]?.toString().replace(/[^0-9.-]/g, '') || '0');
            const total = parseFloat(row[6]?.toString().replace(/[^0-9.-]/g, '') || '0');
            const paymentMethod = row[7]?.toString().trim().toLowerCase() || 'cash';
            const paymentStatus = row[8]?.toString().trim().toLowerCase() || 'paid';
            const orderStatus = row[9]?.toString().trim().toLowerCase() || 'completed';
            const diningOption = row[10]?.toString().trim().toLowerCase() || 'dine-in';

            // Parse date - try multiple formats
            let parsedDate = new Date();
            if (dateTime) {
              const dateStr = dateTime.toString();
              // Try ISO format first
              parsedDate = new Date(dateStr);
              // If invalid, try common formats
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date(dateStr.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:$6'));
              }
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date(); // Fallback to current date
              }
            }

            return {
              orderNumber: invoiceNo.replace(/^INV-?/i, ''), // Remove INV- prefix if present
              createdAt: parsedDate.toISOString(),
              customerName,
              customerPhone: customerPhone || null,
              subtotal: subtotal.toString(),
              discount: discount.toString(),
              total: total.toString(),
              paymentMethod,
              paymentStatus,
              status: orderStatus,
              diningOption,
            };
          } catch (error) {
            console.error(`Error parsing row ${index + 2}:`, error);
            return null;
          }
        }).filter(sale => sale !== null);

        if (salesData.length === 0) {
          toast({
            title: "No valid data",
            description: "No valid sales records found in the file",
            variant: "destructive",
          });
          return;
        }

        // Send to API
        const response = await apiRequest("POST", "/api/sales/import", { sales: salesData });
        
        toast({
          title: "Success",
          description: `Successfully imported ${salesData.length} sales record(s)`,
        });

        // Refresh sales list
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      } catch (error: any) {
        console.error("Import error:", error);
        toast({
          title: "Import failed",
          description: error.message || "Failed to import sales data",
          variant: "destructive",
        });
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    // Reset input
    e.target.value = '';
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
          <div className="flex gap-2">
            <input
              type="file"
              id="import-sales-file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImport}
              data-testid="input-import-sales-file"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('import-sales-file')?.click()}
              data-testid="button-import-sales"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Sales
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadSample}
              data-testid="button-download-sample"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Sample
            </Button>
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
              
              {selectedSales.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  data-testid="button-bulk-delete"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedSales.size})
                </Button>
              )}
              
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedSales.size === filteredSales.length && filteredSales.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
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
                        <TableCell>
                          <Checkbox
                            checked={selectedSales.has(sale.id)}
                            onCheckedChange={() => toggleSelectSale(sale.id)}
                            data-testid={`checkbox-select-${sale.id}`}
                          />
                        </TableCell>
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
                          {sale.paymentSplits ? (() => {
                            try {
                              const splits: { method: string; amount: number }[] = JSON.parse(sale.paymentSplits);
                              if (splits.length > 0) {
                                const paymentMethodLabels: Record<string, string> = {
                                  cash: "Cash",
                                  card: "Card",
                                  aba: "ABA",
                                  acleda: "Acleda",
                                  due: "Due",
                                  cash_aba: "Cash And ABA",
                                  cash_acleda: "Cash And Acleda",
                                };
                                return (
                                  <div className="flex flex-col gap-1">
                                    {splits.map((split, index) => (
                                      <div key={index} className="text-xs">
                                        <span className="font-medium">{paymentMethodLabels[split.method] || split.method}:</span>
                                        <span className="ml-1">${split.amount.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                            } catch (error) {
                              console.error("Failed to parse payment splits:", error);
                            }
                            return <span className="capitalize">{sale.paymentMethod || "N/A"}</span>;
                          })() : <span className="capitalize">{sale.paymentMethod || "N/A"}</span>}
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
                                  onClick={() => handlePrintClick(sale)}
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
                            <TableHead data-testid="header-actions">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSummary.map((item, index) => {
                            // Find sales containing this product for View action
                            const productSales = filteredSales.filter(sale => {
                              // This is a simplified check - in a real scenario, you'd need to check order items
                              return true; // Placeholder - would need to check actual order items
                            });
                            
                            return (
                              <TableRow key={index} data-testid={`row-summary-${index}`}>
                                <TableCell data-testid={`text-product-${index}`} className="font-medium">{item.product}</TableCell>
                                <TableCell data-testid={`text-quantity-${index}`}>{item.quantity}</TableCell>
                                <TableCell data-testid={`text-revenue-${index}`}>${item.revenue.toFixed(2)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => {
                                            // Filter detailed report by product name
                                            setActiveTab("detailed");
                                            setSearchTerm(item.product.split(" - ")[0] || item.product);
                                          }}
                                          data-testid={`button-view-summary-${index}`}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Sales</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
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
                  {viewSale.paymentSplits ? (() => {
                    try {
                      const splits: { method: string; amount: number }[] = JSON.parse(viewSale.paymentSplits);
                      if (splits.length > 0) {
                        const paymentMethodLabels: Record<string, string> = {
                          cash: "Cash",
                          card: "Card",
                          aba: "ABA",
                          acleda: "Acleda",
                          due: "Due",
                          cash_aba: "Cash And ABA",
                          cash_acleda: "Cash And Acleda",
                        };
                        return (
                          <div className="space-y-1" data-testid="view-pay-by">
                            {splits.map((split, index) => (
                              <div key={index} className="font-medium">
                                <span className="text-muted-foreground">{paymentMethodLabels[split.method] || split.method}:</span>
                                <span className="ml-2">${split.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    } catch (error) {
                      console.error("Failed to parse payment splits:", error);
                    }
                    return <p className="font-medium capitalize" data-testid="view-pay-by">{viewSale.paymentMethod || "N/A"}</p>;
                  })() : <p className="font-medium capitalize" data-testid="view-pay-by">{viewSale.paymentMethod || "N/A"}</p>}
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
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium" data-testid="view-summary-customer">
                    {viewSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
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
                  <Label htmlFor="sale-date-time">Date & Time</Label>
                  <Input
                    id="sale-date-time"
                    type="datetime-local"
                    data-testid="input-edit-sale-datetime"
                    value={editSale.createdAt 
                      ? (typeof editSale.createdAt === 'string' 
                          ? new Date(editSale.createdAt).toISOString().slice(0, 16)
                          : new Date(editSale.createdAt).toISOString().slice(0, 16))
                      : ""}
                    onChange={(e) => {
                      const newDate = e.target.value ? new Date(e.target.value) : new Date();
                      setEditSale({ ...editSale, createdAt: newDate.toISOString() as any });
                    }}
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
              <div className="border-t pt-4 space-y-4">
                <Label className="text-base font-semibold">Process Payment - Split Payment</Label>
                
                {/* Payment Splits List */}
                {paymentSplits.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Current Payments:</Label>
                    <div className="border rounded-md divide-y">
                      {paymentSplits.map((split, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted/30"
                          data-testid={`payment-split-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium capitalize">
                              {getPaymentMethodLabel(split.method)}
                            </span>
                            <span className="text-lg font-bold text-primary">
                              ${split.amount.toFixed(2)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePaymentSplit(index)}
                            data-testid={`button-remove-split-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add New Payment */}
                <div className="space-y-3 border rounded-md p-4 bg-muted/10">
                  <Label className="text-sm font-medium">Add Payment Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="new-payment-method" className="text-xs text-muted-foreground">
                        Payment Method
                      </Label>
                      <Select
                        value={newPaymentMethod}
                        onValueChange={setNewPaymentMethod}
                      >
                        <SelectTrigger data-testid="select-new-payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aba">ABA</SelectItem>
                          <SelectItem value="acleda">Acleda</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="due">Due</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="new-payment-amount" className="text-xs text-muted-foreground">
                        Amount Paid
                      </Label>
                      <Input
                        id="new-payment-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                        data-testid="input-new-payment-amount"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={addPaymentSplit}
                    className="w-full"
                    variant="outline"
                    data-testid="button-add-payment-split"
                  >
                    Add Payment
                  </Button>
                </div>

                {/* Payment Summary */}
                {editSale && (
                  <div className="border rounded-md p-4 bg-accent/5 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Order Total:</span>
                      <span className="font-semibold">${parseFloat(editSale.total).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Paid:</span>
                      <span className="font-semibold text-green-600">
                        ${paymentSplits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground font-medium">Remaining:</span>
                      <span className={`font-bold ${
                        (parseFloat(editSale.total) - paymentSplits.reduce((sum, split) => sum + split.amount, 0)) > 0
                          ? "text-orange-600"
                          : "text-green-600"
                      }`}>
                        ${(parseFloat(editSale.total) - paymentSplits.reduce((sum, split) => sum + split.amount, 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
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
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium" data-testid="edit-summary-customer">
                    {editSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
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
      {/* Template Selection Dialog for Printing */}
      <Dialog open={!!printSale} onOpenChange={() => setPrintSale(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-print-template">
          <DialogHeader>
            <DialogTitle>Select Receipt Template</DialogTitle>
            <DialogDescription>
              Choose a template style for your receipt, preview it, then print
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="template-select">Receipt Template</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(value: ReceiptTemplate) => setSelectedTemplate(value)}
              >
                <SelectTrigger id="template-select" data-testid="select-print-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Classic - Traditional receipt style</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="modern">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Modern - Clean and minimal design</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="compact">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Compact - Small format for thermal printers</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="detailed">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Detailed - Full information with borders</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="elegant">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Elegant - Premium style with gradients</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Select a template and click "Preview Receipt" to see how it will look
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!printSale) return;
                  try {
                    const response = await fetch(`/api/orders/${printSale.id}/items`);
                    if (!response.ok) throw new Error("Failed to fetch order items");
                    const items: OrderItemWithProduct[] = await response.json();
                    const settingsResponse = await fetch("/api/settings");
                    const settings = settingsResponse.ok ? await settingsResponse.json() : null;

                    const totalUSD = parseFloat(printSale.total);
                    const totalKHRNum = totalUSD * 4100;

                    let paymentDetails = `<p><strong>Pay by:</strong> ${printSale.paymentMethod || "N/A"}</p>`;
                    if (printSale.paymentSplits) {
                      try {
                        const splits: PaymentSplit[] = JSON.parse(printSale.paymentSplits);
                        if (splits.length > 0) {
                          const splitsHtml = splits.map(split => {
                            const methodLabel = getPaymentMethodLabel(split.method);
                            const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                            return `
                              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                <span>${methodLabel}:</span>
                                <span><strong>$${split.amount.toFixed(2)}</strong> (៛${amountKHR})</span>
                              </div>
                            `;
                          }).join('');
                          paymentDetails = `
                            <div style="margin-top: 10px;">
                              <p style="margin-bottom: 10px;"><strong>Payment Split:</strong></p>
                              <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; background-color: #f9fafb;">
                                ${splitsHtml}
                              </div>
                            </div>
                          `;
                        }
                      } catch (error) {
                        console.error("Failed to parse payment splits:", error);
                      }
                    }

                    const receiptData = {
                      sale: printSale,
                      items: items.map(item => ({
                        id: item.id,
                        orderId: item.orderId,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        total: item.total,
                        productName: item.productName,
                      })),
                      settings,
                      totalKHR: totalKHRNum,
                      paymentDetails,
                    };

                    const content = generateReceiptHTML(selectedTemplate, receiptData);
                    const previewWindow = window.open("", "_blank");
                    if (previewWindow) {
                      previewWindow.document.write(content);
                      previewWindow.document.close();
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to preview receipt",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-preview-receipt"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Receipt
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintSale(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPrint} data-testid="button-confirm-print">
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent data-testid="dialog-bulk-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Sales</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSales.size} selected sale(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
