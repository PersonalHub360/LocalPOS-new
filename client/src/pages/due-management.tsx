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
import { Calendar, CreditCard, User, DollarSign, FileText, Wallet, Download, Upload, FileSpreadsheet, Edit, Printer, Eye, UserPlus, History, Plus, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBranch } from "@/contexts/BranchContext";
import type { Customer, Order } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;
type CustomerFormData = z.infer<typeof customerFormSchema>;

interface DuePaymentWithDetails {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  paymentDate: string;
  amount: string;
  unappliedAmount: string;
  paymentMethod: string;
  reference?: string;
  note?: string;
  recordedBy?: string;
  branchId?: string;
  createdAt: string;
  allocations?: Array<{
    id: string;
    orderId: string;
    orderNumber?: string;
    amount: string;
  }>;
}

export default function DueManagement() {
  const [activeTab, setActiveTab] = useState("summary");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDueSummary | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCreateDueModal, setShowCreateDueModal] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<OrderWithDetails[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
  const [orderAllocations, setOrderAllocations] = useState<Record<string, number>>({});
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Due History tab states
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<string>("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<string>("all");
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(undefined);
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(undefined);
  const [historyPaymentMethodFilter, setHistoryPaymentMethodFilter] = useState<string>("all");
  const [viewPaymentDetails, setViewPaymentDetails] = useState<DuePaymentWithDetails | null>(null);
  
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
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

  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", selectedBranchId],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/customers?branchId=${selectedBranchId}`
        : "/api/customers";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const { data: allDuePayments = [], isLoading: isLoadingPayments } = useQuery<DuePaymentWithDetails[]>({
    queryKey: ["/api/due/payments", selectedBranchId, allCustomers, allOrders],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/due/payments?branchId=${selectedBranchId}`
        : "/api/due/payments";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch due payments");
      const payments = await response.json();
      
      // Enrich payments with customer info
      return payments.map((payment: any) => {
        const customer = allCustomers.find(c => c.id === payment.customerId);
        return {
          ...payment,
          customerName: customer?.name,
          customerPhone: customer?.phone,
        };
      });
    },
    enabled: activeTab === "history" && allCustomers.length > 0,
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

  const customerForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  const addCustomerForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return await apiRequest("POST", "/api/due/customers", {
        ...data,
        branchId: selectedBranchId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setShowAddCustomerModal(false);
      addCustomerForm.reset();
      toast({
        title: "Success",
        description: "Customer added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add customer",
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: { customerId: string; updates: CustomerFormData }) => {
      return await apiRequest("PATCH", `/api/due/customers/${data.customerId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      setShowEditModal(false);
      toast({
        title: "Success",
        description: "Customer updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({ queryKey: ["/api/due/payments"] });
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

  const createDueForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: "cash",
      paymentDate: new Date(),
      note: "",
    },
  });

  const [createDueCustomerId, setCreateDueCustomerId] = useState<string>("");
  const [createDueAllocations, setCreateDueAllocations] = useState<Record<string, number>>({});
  const [createDueSelectedOrders, setCreateDueSelectedOrders] = useState<Record<string, boolean>>({});

  const createDueMutation = useMutation({
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
        reference: data.payment.note || "",
        unappliedAmount: data.payment.amount.toString(),
        recordedBy: null,
        branchId: selectedBranchId || null,
        allocations: data.allocations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/payments"] });
      toast({
        title: "Success",
        description: "Due payment created successfully",
      });
      setShowCreateDueModal(false);
      setCreateDueCustomerId("");
      setCreateDueAllocations({});
      setCreateDueSelectedOrders({});
      createDueForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create due payment",
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

  // Filter due payments for history tab
  const filteredDuePayments = allDuePayments.filter((payment) => {
    // Customer filter
    if (selectedHistoryCustomer !== "all" && payment.customerId !== selectedHistoryCustomer) {
      return false;
    }

    // Search filter
    if (historySearchTerm) {
      const searchLower = historySearchTerm.toLowerCase();
      const matchesSearch = 
        payment.customerName?.toLowerCase().includes(searchLower) ||
        payment.customerPhone?.toLowerCase().includes(searchLower) ||
        payment.reference?.toLowerCase().includes(searchLower) ||
        payment.note?.toLowerCase().includes(searchLower) ||
        payment.id.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Payment method filter
    if (historyPaymentMethodFilter !== "all" && payment.paymentMethod !== historyPaymentMethodFilter) {
      return false;
    }

    // Date filter
    const paymentDate = new Date(payment.paymentDate);
    let matchesDate = true;
    const now = new Date();
    const currentYear = now.getFullYear();

    if (historyDateFilter === "today") {
      const today = startOfDay(now);
      const todayEnd = endOfDay(now);
      matchesDate = paymentDate >= today && paymentDate <= todayEnd;
    } else if (historyDateFilter === "yesterday") {
      const yesterday = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      const yesterdayEnd = endOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      matchesDate = paymentDate >= yesterday && paymentDate <= yesterdayEnd;
    } else if (historyDateFilter === "this-month") {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "last-month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "january") {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 1, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "february") {
      const start = new Date(currentYear, 1, 1);
      const end = new Date(currentYear, 2, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "march") {
      const start = new Date(currentYear, 2, 1);
      const end = new Date(currentYear, 3, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "april") {
      const start = new Date(currentYear, 3, 1);
      const end = new Date(currentYear, 4, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "may") {
      const start = new Date(currentYear, 4, 1);
      const end = new Date(currentYear, 5, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "june") {
      const start = new Date(currentYear, 5, 1);
      const end = new Date(currentYear, 6, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "july") {
      const start = new Date(currentYear, 6, 1);
      const end = new Date(currentYear, 7, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "august") {
      const start = new Date(currentYear, 7, 1);
      const end = new Date(currentYear, 8, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "september") {
      const start = new Date(currentYear, 8, 1);
      const end = new Date(currentYear, 9, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "october") {
      const start = new Date(currentYear, 9, 1);
      const end = new Date(currentYear, 10, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "november") {
      const start = new Date(currentYear, 10, 1);
      const end = new Date(currentYear, 11, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "december") {
      const start = new Date(currentYear, 11, 1);
      const end = new Date(currentYear, 12, 0, 23, 59, 59, 999);
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (historyDateFilter === "custom" && historyStartDate && historyEndDate) {
      const start = startOfDay(historyStartDate);
      const end = endOfDay(historyEndDate);
      matchesDate = paymentDate >= start && paymentDate <= end;
    }

    return matchesDate;
  });

  const handleCreateDue = () => {
    setShowCreateDueModal(true);
    setCreateDueCustomerId("");
    setCreateDueAllocations({});
    setCreateDueSelectedOrders({});
  };

  const handleCreateDueCustomerChange = (customerId: string) => {
    setCreateDueCustomerId(customerId);
    const customer = allCustomers.find(c => c.id === customerId);
    if (customer) {
      const dueOrders = allOrders.filter(
        (order) =>
          order.customerId === customerId &&
          (order.paymentStatus === "due" || order.paymentStatus === "partial")
      );
      const initialAllocations: Record<string, number> = {};
      const initialSelected: Record<string, boolean> = {};
      dueOrders.forEach((order) => {
        initialSelected[order.id] = false;
        initialAllocations[order.id] = 0;
      });
      setCreateDueSelectedOrders(initialSelected);
      setCreateDueAllocations(initialAllocations);
    }
  };

  const handleCreateDueSubmit = (data: PaymentFormData) => {
    if (!createDueCustomerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    const allocations = Object.entries(createDueSelectedOrders)
      .filter(([_, selected]) => selected)
      .map(([orderId]) => ({
        orderId,
        amount: createDueAllocations[orderId] || 0,
      }))
      .filter((a) => a.amount > 0);

    createDueMutation.mutate({
      payment: data,
      customerId: createDueCustomerId,
      allocations: allocations.length > 0 ? allocations : [],
    });
  };

  const handleViewPaymentDetails = async (payment: DuePaymentWithDetails) => {
    try {
      // Fetch allocations for this payment
      const response = await fetch(`/api/due/payments/${payment.id}/allocations`, { credentials: "include" });
      if (response.ok) {
        const allocations = await response.json();
        const enrichedAllocations = allocations.map((alloc: any) => {
          const order = allOrders.find(o => o.id === alloc.orderId);
          return {
            ...alloc,
            orderNumber: order?.orderNumber,
          };
        });
        setViewPaymentDetails({
          ...payment,
          allocations: enrichedAllocations,
        });
      } else {
        // If endpoint doesn't exist or fails, show payment without allocations
        setViewPaymentDetails({
          ...payment,
          allocations: [],
        });
      }
    } catch {
      // On error, show payment without allocations
      setViewPaymentDetails({
        ...payment,
        allocations: [],
      });
    }
  };

  const handleHistoryDateFilterChange = (range: string) => {
    setHistoryDateFilter(range);
    const today = new Date();
    const currentYear = today.getFullYear();
    
    if (range === "today") {
      setHistoryStartDate(startOfDay(today));
      setHistoryEndDate(endOfDay(today));
    } else if (range === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      setHistoryStartDate(startOfDay(yesterday));
      setHistoryEndDate(endOfDay(yesterday));
    } else if (range === "this-month") {
      setHistoryStartDate(startOfMonth(today));
      setHistoryEndDate(endOfMonth(today));
    } else if (range === "last-month") {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      setHistoryStartDate(startOfMonth(lastMonth));
      setHistoryEndDate(endOfMonth(lastMonth));
    } else if (range === "january") {
      setHistoryStartDate(new Date(currentYear, 0, 1));
      setHistoryEndDate(new Date(currentYear, 1, 0, 23, 59, 59, 999));
    } else if (range === "february") {
      setHistoryStartDate(new Date(currentYear, 1, 1));
      setHistoryEndDate(new Date(currentYear, 2, 0, 23, 59, 59, 999));
    } else if (range === "march") {
      setHistoryStartDate(new Date(currentYear, 2, 1));
      setHistoryEndDate(new Date(currentYear, 3, 0, 23, 59, 59, 999));
    } else if (range === "april") {
      setHistoryStartDate(new Date(currentYear, 3, 1));
      setHistoryEndDate(new Date(currentYear, 4, 0, 23, 59, 59, 999));
    } else if (range === "may") {
      setHistoryStartDate(new Date(currentYear, 4, 1));
      setHistoryEndDate(new Date(currentYear, 5, 0, 23, 59, 59, 999));
    } else if (range === "june") {
      setHistoryStartDate(new Date(currentYear, 5, 1));
      setHistoryEndDate(new Date(currentYear, 6, 0, 23, 59, 59, 999));
    } else if (range === "july") {
      setHistoryStartDate(new Date(currentYear, 6, 1));
      setHistoryEndDate(new Date(currentYear, 7, 0, 23, 59, 59, 999));
    } else if (range === "august") {
      setHistoryStartDate(new Date(currentYear, 7, 1));
      setHistoryEndDate(new Date(currentYear, 8, 0, 23, 59, 59, 999));
    } else if (range === "september") {
      setHistoryStartDate(new Date(currentYear, 8, 1));
      setHistoryEndDate(new Date(currentYear, 9, 0, 23, 59, 59, 999));
    } else if (range === "october") {
      setHistoryStartDate(new Date(currentYear, 9, 1));
      setHistoryEndDate(new Date(currentYear, 10, 0, 23, 59, 59, 999));
    } else if (range === "november") {
      setHistoryStartDate(new Date(currentYear, 10, 1));
      setHistoryEndDate(new Date(currentYear, 11, 0, 23, 59, 59, 999));
    } else if (range === "december") {
      setHistoryStartDate(new Date(currentYear, 11, 1));
      setHistoryEndDate(new Date(currentYear, 12, 0, 23, 59, 59, 999));
    } else if (range === "all") {
      setHistoryStartDate(undefined);
      setHistoryEndDate(undefined);
    }
  };

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

  const handleViewOrders = async (customer: CustomerDueSummary) => {
    setSelectedCustomer(customer);
    
    const dueOrders = allOrders.filter(
      (order) =>
        order.customerId === customer.customer.id &&
        (order.paymentStatus === "due" || order.paymentStatus === "partial")
    );
    
    // Fetch order items for each order
    const ordersWithItems = await Promise.all(
      dueOrders.map(async (order) => {
        try {
          const response = await fetch(`/api/orders/${order.id}/items`, { credentials: "include" });
          const items = await response.json();
          return { ...order, items };
        } catch (error) {
          return { ...order, items: [] };
        }
      })
    );
    
    setCustomerOrders(ordersWithItems);
    setShowOrdersModal(true);
  };

  const handleEditCustomer = (customer: CustomerDueSummary) => {
    setSelectedCustomer(customer);
    customerForm.reset({
      name: customer.customer.name || "",
      phone: customer.customer.phone || "",
      email: customer.customer.email || "",
      notes: customer.customer.notes || "",
    });
    setShowEditModal(true);
  };

  const handlePrintCustomer = (customer: CustomerDueSummary) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dueOrders = allOrders.filter(
      (order) =>
        order.customerId === customer.customer.id &&
        (order.paymentStatus === "due" || order.paymentStatus === "partial")
    );

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Due Summary - ${customer.customer.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .info { margin: 20px 0; }
            .info-row { margin: 8px 0; }
            .label { font-weight: bold; display: inline-block; width: 150px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Customer Due Summary</h1>
          <div class="info">
            <div class="info-row"><span class="label">Customer Name:</span> ${customer.customer.name || "N/A"}</div>
            <div class="info-row"><span class="label">Phone:</span> ${customer.customer.phone || "N/A"}</div>
            <div class="info-row"><span class="label">Email:</span> ${customer.customer.email || "N/A"}</div>
            <div class="info-row"><span class="label">Total Due:</span> $${customer.totalDue.toFixed(2)}</div>
            <div class="info-row"><span class="label">Total Paid:</span> $${customer.totalPaid.toFixed(2)}</div>
            <div class="info-row"><span class="label">Balance:</span> $${customer.balance.toFixed(2)}</div>
            <div class="info-row"><span class="label">Credit:</span> $${customer.credit.toFixed(2)}</div>
            <div class="info-row"><span class="label">Due Orders:</span> ${customer.ordersCount}</div>
          </div>
          
          <h2>Due Orders</h2>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${dueOrders.map(order => `
                <tr>
                  <td>${order.orderNumber}</td>
                  <td>${format(new Date(order.createdAt), "MMM dd, yyyy")}</td>
                  <td>$${parseFloat(order.total).toFixed(2)}</td>
                  <td>$${parseFloat(order.paidAmount || "0").toFixed(2)}</td>
                  <td>$${parseFloat(order.dueAmount || order.total).toFixed(2)}</td>
                  <td>${order.paymentStatus}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">Total</td>
                <td>$${customer.totalDue.toFixed(2)}</td>
                <td>$${customer.totalPaid.toFixed(2)}</td>
                <td>$${customer.balance.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Printed on ${format(new Date(), "PPP 'at' p")}
          </p>
          
          <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer;">
            Print
          </button>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
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
    const currentYear = today.getFullYear();
    
    if (range === "today") {
      setStartDate(startOfDay(today));
      setEndDate(endOfDay(today));
    } else if (range === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      setStartDate(startOfDay(yesterday));
      setEndDate(endOfDay(yesterday));
    } else if (range === "this-month") {
      setStartDate(startOfMonth(today));
      setEndDate(endOfMonth(today));
    } else if (range === "last-month") {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      setStartDate(startOfMonth(lastMonth));
      setEndDate(endOfMonth(lastMonth));
    } else if (range === "january") {
      setStartDate(new Date(currentYear, 0, 1));
      setEndDate(new Date(currentYear, 1, 0, 23, 59, 59, 999));
    } else if (range === "february") {
      setStartDate(new Date(currentYear, 1, 1));
      setEndDate(new Date(currentYear, 2, 0, 23, 59, 59, 999));
    } else if (range === "march") {
      setStartDate(new Date(currentYear, 2, 1));
      setEndDate(new Date(currentYear, 3, 0, 23, 59, 59, 999));
    } else if (range === "april") {
      setStartDate(new Date(currentYear, 3, 1));
      setEndDate(new Date(currentYear, 4, 0, 23, 59, 59, 999));
    } else if (range === "may") {
      setStartDate(new Date(currentYear, 4, 1));
      setEndDate(new Date(currentYear, 5, 0, 23, 59, 59, 999));
    } else if (range === "june") {
      setStartDate(new Date(currentYear, 5, 1));
      setEndDate(new Date(currentYear, 6, 0, 23, 59, 59, 999));
    } else if (range === "july") {
      setStartDate(new Date(currentYear, 6, 1));
      setEndDate(new Date(currentYear, 7, 0, 23, 59, 59, 999));
    } else if (range === "august") {
      setStartDate(new Date(currentYear, 7, 1));
      setEndDate(new Date(currentYear, 8, 0, 23, 59, 59, 999));
    } else if (range === "september") {
      setStartDate(new Date(currentYear, 8, 1));
      setEndDate(new Date(currentYear, 9, 0, 23, 59, 59, 999));
    } else if (range === "october") {
      setStartDate(new Date(currentYear, 9, 1));
      setEndDate(new Date(currentYear, 10, 0, 23, 59, 59, 999));
    } else if (range === "november") {
      setStartDate(new Date(currentYear, 10, 1));
      setEndDate(new Date(currentYear, 11, 0, 23, 59, 59, 999));
    } else if (range === "december") {
      setStartDate(new Date(currentYear, 11, 1));
      setEndDate(new Date(currentYear, 12, 0, 23, 59, 59, 999));
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

    autoTable(doc, {
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
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">
              <CreditCard className="w-4 h-4 mr-2" />
              Customer Summary
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Due History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {/* Filters and Actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Filters & Actions</CardTitle>
                  {hasPermission("due.create") && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleCreateDue}
                      data-testid="button-create-due"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Due
                    </Button>
                  )}
                </div>
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
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="last-month">Last Month</SelectItem>
                          <SelectItem value="january">January</SelectItem>
                          <SelectItem value="february">February</SelectItem>
                          <SelectItem value="march">March</SelectItem>
                          <SelectItem value="april">April</SelectItem>
                          <SelectItem value="may">May</SelectItem>
                          <SelectItem value="june">June</SelectItem>
                          <SelectItem value="july">July</SelectItem>
                          <SelectItem value="august">August</SelectItem>
                          <SelectItem value="september">September</SelectItem>
                          <SelectItem value="october">October</SelectItem>
                          <SelectItem value="november">November</SelectItem>
                          <SelectItem value="december">December</SelectItem>
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
                    {hasPermission("due.create") && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => setShowAddCustomerModal(true)} 
                        data-testid="button-add-customer"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add Customer
                      </Button>
                    )}
                    {hasPermission("reports.export") && (
                      <>
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
                      </>
                    )}
                    {hasPermission("due.create") && (
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
                    )}
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
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Customer Name</TableHead>
                          <TableHead className="hidden sm:table-cell">Phone Number</TableHead>
                          <TableHead>Total Due</TableHead>
                          <TableHead className="hidden md:table-cell">Total Paid</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead className="hidden lg:table-cell">Credit</TableHead>
                          <TableHead className="hidden md:table-cell">Due Orders</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dateFilteredCustomers.map((summary) => (
                          <TableRow key={summary.customer.id} data-testid={`row-customer-${summary.customer.id}`}>
                            <TableCell className="font-medium" data-testid={`text-customer-name-${summary.customer.id}`}>
                              {summary.customer.name || "-"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell" data-testid={`text-customer-phone-${summary.customer.id}`}>
                              {summary.customer.phone || "-"}
                            </TableCell>
                            <TableCell className="font-mono" data-testid={`text-total-due-${summary.customer.id}`}>
                              ${summary.totalDue.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono hidden md:table-cell" data-testid={`text-total-paid-${summary.customer.id}`}>
                              ${summary.totalPaid.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className="font-mono font-bold text-primary"
                              data-testid={`text-balance-${summary.customer.id}`}
                            >
                              ${summary.balance.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className="font-mono text-green-600 hidden lg:table-cell"
                              data-testid={`text-credit-${summary.customer.id}`}
                            >
                              ${summary.credit.toFixed(2)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell" data-testid={`text-orders-count-${summary.customer.id}`}>
                              {summary.ordersCount}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditCustomer(summary)}
                                  data-testid={`button-edit-${summary.customer.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrintCustomer(summary)}
                                  data-testid={`button-print-${summary.customer.id}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewOrders(summary)}
                                  data-testid={`button-view-${summary.customer.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleRecordPayment(summary)}
                                  data-testid={`button-record-payment-${summary.customer.id}`}
                                >
                                  <CreditCard className="w-4 h-4 mr-1" />
                                  Pay
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
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* History Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Due Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by customer, reference, note, or payment ID..."
                          value={historySearchTerm}
                          onChange={(e) => setHistorySearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Customer</Label>
                      <Select value={selectedHistoryCustomer} onValueChange={setSelectedHistoryCustomer}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Customers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          {allCustomers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} {customer.phone ? `(${customer.phone})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Date Range</Label>
                      <Select value={historyDateFilter} onValueChange={handleHistoryDateFilterChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Dates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Dates</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="last-month">Last Month</SelectItem>
                          <SelectItem value="january">January</SelectItem>
                          <SelectItem value="february">February</SelectItem>
                          <SelectItem value="march">March</SelectItem>
                          <SelectItem value="april">April</SelectItem>
                          <SelectItem value="may">May</SelectItem>
                          <SelectItem value="june">June</SelectItem>
                          <SelectItem value="july">July</SelectItem>
                          <SelectItem value="august">August</SelectItem>
                          <SelectItem value="september">September</SelectItem>
                          <SelectItem value="october">October</SelectItem>
                          <SelectItem value="november">November</SelectItem>
                          <SelectItem value="december">December</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {historyDateFilter === "custom" && (
                      <>
                        <div>
                          <Label>Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <Calendar className="w-4 h-4 mr-2" />
                                {historyStartDate ? format(historyStartDate, "MMM dd, yyyy") : "Pick date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent mode="single" selected={historyStartDate} onSelect={setHistoryStartDate} initialFocus />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <Calendar className="w-4 h-4 mr-2" />
                                {historyEndDate ? format(historyEndDate, "MMM dd, yyyy") : "Pick date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent mode="single" selected={historyEndDate} onSelect={setHistoryEndDate} initialFocus />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </>
                    )}
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={historyPaymentMethodFilter} onValueChange={setHistoryPaymentMethodFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Methods" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Methods</SelectItem>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* History Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Records</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPayments ? (
                  <div className="text-center py-8 text-muted-foreground">Loading payment history...</div>
                ) : filteredDuePayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No payment records found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="hidden sm:table-cell">Phone</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead className="hidden md:table-cell">Unapplied</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead className="hidden lg:table-cell">Reference</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDuePayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {format(new Date(payment.paymentDate), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>{payment.customerName || "N/A"}</TableCell>
                            <TableCell className="hidden sm:table-cell">{payment.customerPhone || "-"}</TableCell>
                            <TableCell className="font-mono">${parseFloat(payment.amount).toFixed(2)}</TableCell>
                            <TableCell className="font-mono hidden md:table-cell text-green-600">
                              ${parseFloat(payment.unappliedAmount || "0").toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {PAYMENT_METHODS.find(m => m.value === payment.paymentMethod)?.label || payment.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {payment.reference || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewPaymentDetails(payment)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
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
        </Tabs>
      </div>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-record-payment">
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
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
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

                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead className="hidden md:table-cell">Paid</TableHead>
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
                            <TableCell className="hidden sm:table-cell">
                              {format(new Date(order.createdAt), "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell className="font-mono">${parseFloat(order.total).toFixed(2)}</TableCell>
                            <TableCell className="font-mono hidden md:table-cell">${orderPaid.toFixed(2)}</TableCell>
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-orders">
          <DialogHeader>
            <DialogTitle>Customer Orders</DialogTitle>
            <DialogDescription>
              Due and partial orders for {selectedCustomer?.customer.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto max-h-[70vh]">
            {customerOrders.map((order) => {
              const orderBalance = parseFloat(order.dueAmount || order.total);
              const orderPaid = parseFloat(order.paidAmount || "0");

              return (
                <Card key={order.id} className="border-2" data-testid={`card-order-${order.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Order #{order.orderNumber}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(order.createdAt), "PPP")}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">${orderBalance.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Order Summary */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-mono font-semibold">${parseFloat(order.total).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <p className="font-mono font-semibold">${orderPaid.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="capitalize font-semibold">{order.paymentStatus}</p>
                      </div>
                    </div>

                    {/* Order Items */}
                    {order.items && order.items.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Order Items</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.productName}</TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    ${parseFloat(item.price).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-semibold">
                                    ${parseFloat(item.total).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrdersModal(false)} data-testid="button-close-orders">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Customer Modal */}
      <Dialog open={showAddCustomerModal} onOpenChange={setShowAddCustomerModal}>
        <DialogContent className="max-w-md" data-testid="dialog-add-customer">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer record
            </DialogDescription>
          </DialogHeader>

          <Form {...addCustomerForm}>
            <form
              onSubmit={addCustomerForm.handleSubmit((data) => {
                createCustomerMutation.mutate(data);
              })}
              className="space-y-4"
            >
              <FormField
                control={addCustomerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter customer name" data-testid="input-add-customer-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addCustomerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone number" data-testid="input-add-customer-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addCustomerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Enter email" data-testid="input-add-customer-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addCustomerForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes" data-testid="input-add-customer-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    addCustomerForm.reset();
                  }}
                  data-testid="button-cancel-add-customer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCustomerMutation.isPending}
                  data-testid="button-save-add-customer"
                >
                  {createCustomerMutation.isPending ? "Adding..." : "Add Customer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-customer">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information for {selectedCustomer?.customer.name}
            </DialogDescription>
          </DialogHeader>

          <Form {...customerForm}>
            <form
              onSubmit={customerForm.handleSubmit((data) => {
                if (selectedCustomer) {
                  updateCustomerMutation.mutate({
                    customerId: selectedCustomer.customer.id,
                    updates: data,
                  });
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={customerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter customer name" data-testid="input-customer-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={customerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone number" data-testid="input-customer-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={customerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Enter email" data-testid="input-customer-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={customerForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes" data-testid="input-customer-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCustomerMutation.isPending} data-testid="button-save-customer">
                  {updateCustomerMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Due Modal */}
      <Dialog open={showCreateDueModal} onOpenChange={setShowCreateDueModal}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-due">
          <DialogHeader>
            <DialogTitle>Create Due Payment</DialogTitle>
            <DialogDescription>
              Create a new due payment record for a customer
            </DialogDescription>
          </DialogHeader>

          <Form {...createDueForm}>
            <form onSubmit={createDueForm.handleSubmit(handleCreateDueSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={createDueForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createDueForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                  control={createDueForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="w-4 h-4 mr-2" />
                              {field.value ? format(field.value, "MMM dd, yyyy") : "Pick date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label>Customer</Label>
                  <Select value={createDueCustomerId} onValueChange={handleCreateDueCustomerChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} {customer.phone ? `(${customer.phone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormField
                  control={createDueForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Note (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add a note..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {createDueCustomerId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Allocate Payment to Orders (Optional)</h3>
                  </div>

                  {(() => {
                    const customer = allCustomers.find(c => c.id === createDueCustomerId);
                    const dueOrders = customer ? allOrders.filter(
                      (order) =>
                        order.customerId === createDueCustomerId &&
                        (order.paymentStatus === "due" || order.paymentStatus === "partial")
                    ) : [];

                    if (dueOrders.length === 0) {
                      return (
                        <div className="text-center py-4 text-muted-foreground">
                          No due orders found for this customer
                        </div>
                      );
                    }

                    return (
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Select</TableHead>
                              <TableHead>Order #</TableHead>
                              <TableHead className="hidden sm:table-cell">Date</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead className="hidden md:table-cell">Paid</TableHead>
                              <TableHead>Balance</TableHead>
                              <TableHead>Allocate Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dueOrders.map((order) => {
                              const orderBalance = parseFloat(order.dueAmount || order.total);
                              const orderPaid = parseFloat(order.paidAmount || "0");

                              return (
                                <TableRow key={order.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={createDueSelectedOrders[order.id] || false}
                                      onCheckedChange={(checked) => {
                                        setCreateDueSelectedOrders(prev => ({ ...prev, [order.id]: checked as boolean }));
                                        if (!checked) {
                                          setCreateDueAllocations(prev => ({ ...prev, [order.id]: 0 }));
                                        }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    {format(new Date(order.createdAt), "MMM dd, yyyy")}
                                  </TableCell>
                                  <TableCell className="font-mono">${parseFloat(order.total).toFixed(2)}</TableCell>
                                  <TableCell className="font-mono hidden md:table-cell">${orderPaid.toFixed(2)}</TableCell>
                                  <TableCell className="font-mono font-bold">${orderBalance.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={createDueAllocations[order.id] || ""}
                                      onChange={(e) => {
                                        const amount = parseFloat(e.target.value) || 0;
                                        setCreateDueAllocations(prev => ({ ...prev, [order.id]: amount }));
                                      }}
                                      disabled={!createDueSelectedOrders[order.id]}
                                      className="w-32"
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDueModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDueMutation.isPending || !createDueCustomerId}
                >
                  {createDueMutation.isPending ? "Creating..." : "Create Due Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Details Modal */}
      <Dialog open={!!viewPaymentDetails} onOpenChange={(open) => !open && setViewPaymentDetails(null)}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              View complete payment information and allocations
            </DialogDescription>
          </DialogHeader>

          {viewPaymentDetails && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Payment ID</Label>
                  <p className="font-mono text-sm">{viewPaymentDetails.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Date</Label>
                  <p>{format(new Date(viewPaymentDetails.paymentDate), "PPP p")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p>{viewPaymentDetails.customerName || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p>{viewPaymentDetails.customerPhone || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Amount</Label>
                  <p className="font-mono font-bold text-lg">${parseFloat(viewPaymentDetails.amount).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unapplied Amount</Label>
                  <p className="font-mono text-green-600">${parseFloat(viewPaymentDetails.unappliedAmount || "0").toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <Badge variant="outline">
                    {PAYMENT_METHODS.find(m => m.value === viewPaymentDetails.paymentMethod)?.label || viewPaymentDetails.paymentMethod}
                  </Badge>
                </div>
                {viewPaymentDetails.reference && (
                  <div>
                    <Label className="text-muted-foreground">Reference</Label>
                    <p>{viewPaymentDetails.reference}</p>
                  </div>
                )}
                {viewPaymentDetails.note && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Note</Label>
                    <p>{viewPaymentDetails.note}</p>
                  </div>
                )}
              </div>

              {viewPaymentDetails.allocations && viewPaymentDetails.allocations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Payment Allocations</Label>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order Number</TableHead>
                          <TableHead>Allocated Amount</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewPaymentDetails.allocations.map((allocation) => (
                          <TableRow key={allocation.id}>
                            <TableCell className="font-medium">
                              {allocation.orderNumber || allocation.orderId}
                            </TableCell>
                            <TableCell className="font-mono">
                              ${parseFloat(allocation.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(viewPaymentDetails.createdAt), "MMM dd, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex justify-between font-semibold">
                      <span>Total Allocated:</span>
                      <span className="font-mono">
                        ${viewPaymentDetails.allocations.reduce((sum, a) => sum + parseFloat(a.amount), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(!viewPaymentDetails.allocations || viewPaymentDetails.allocations.length === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  No allocations found for this payment
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewPaymentDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
