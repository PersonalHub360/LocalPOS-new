import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Bell, Plus, Grid3x3, FileText, Utensils, ShoppingCart, Filter, X } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { ProductCard } from "@/components/product-card";
import { OrderPanel, type OrderItemData } from "@/components/order-panel";
import { PaymentModal } from "@/components/payment-modal";
import { DraftListModal } from "@/components/draft-list-modal";
import { ReceiptPrintModal } from "@/components/receipt-print-modal";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category, Table, Order, OrderItem } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useBranch } from "@/contexts/BranchContext";
import { withBranchId } from "@/lib/branchQuery";

interface ProductsResponse {
  products: Product[];
  total: number;
}

export default function POS() {
  const { selectedBranchId } = useBranch();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItemData[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [diningOption, setDiningOption] = useState("dine-in");
  const [searchInPacking, setSearchInPacking] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [draftListModalOpen, setDraftListModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentOrderNumber, setCurrentOrderNumber] = useState(() => 
    `${Math.floor(Math.random() * 100)}`
  );
  const [receiptData, setReceiptData] = useState<any>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);
  
  // Additional filters
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const isDesktop = useIsDesktop();
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Handle discount changes properly to avoid race conditions
  const handleDiscountChange = (value: number, type: 'amount' | 'percentage') => {
    setDiscountType(type);
    setManualDiscount(value);
  };

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Infinite query for paginated products
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: productsLoading,
    refetch,
  } = useInfiniteQuery<ProductsResponse>({
    queryKey: [
      "/api/products",
      {
        branchId: selectedBranchId,
        categoryId: selectedCategory,
        search: searchQuery,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        inStock: stockFilter === "inStock" ? true : stockFilter === "outOfStock" ? false : undefined,
      },
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: "50",
        offset: String(pageParam),
      });
      
      if (selectedCategory) params.append("categoryId", selectedCategory);
      if (searchQuery) params.append("search", searchQuery);
      if (minPrice) params.append("minPrice", minPrice);
      if (maxPrice) params.append("maxPrice", maxPrice);
      if (stockFilter === "inStock") params.append("inStock", "true");
      if (stockFilter === "outOfStock") params.append("inStock", "false");
      
      const url = withBranchId(`/api/products?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.products.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all products from all pages
  const allProducts = productsData?.pages.flatMap((page) => page.products) ?? [];
  const totalProducts = productsData?.pages[0]?.total ?? 0;

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["/api/tables", { branchId: selectedBranchId }],
    queryFn: async () => {
      const res = await fetch(withBranchId("/api/tables", selectedBranchId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tables");
      return res.json();
    },
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", { branchId: selectedBranchId }],
    queryFn: async () => {
      const res = await fetch(withBranchId("/api/orders", selectedBranchId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  const draftOrders = orders.filter((order) => order.status === "draft");

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      // Invalidate orders and products (all branches)
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      
      // Invalidate due management queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      
      // Invalidate inventory queries
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      
      // Invalidate all dashboard queries for real-time updates
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/dashboard');
        }
      });
      
      setOrderItems([]);
      setSelectedTable(null);
      setCurrentOrderNumber(`${Math.floor(Math.random() * 100)}`);
      toast({
        title: "Success",
        description: "Order processed successfully",
      });
    },
  });

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

  const handleAddToOrder = (product: Product) => {
    setOrderItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setOrderItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearOrder = () => {
    setOrderItems([]);
    setManualDiscount(0);
    setDiscountType('amount');
  };

  const handleSaveDraft = () => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
      0
    );

    const discountAmount = discountType === 'percentage' 
      ? (subtotal * manualDiscount) / 100 
      : manualDiscount;
    const total = subtotal - discountAmount;
    const draftIdToDelete = currentDraftId;

    createOrderMutation.mutate(
      {
        tableId: selectedTable,
        diningOption,
        subtotal: subtotal.toString(),
        discount: manualDiscount.toString(),
        discountType: discountType,
        total: total.toString(),
        status: "draft",
        items: orderItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          total: (parseFloat(item.product.price) * item.quantity).toString(),
        })),
      },
      {
        onSuccess: () => {
          if (draftIdToDelete) {
            deleteOrderMutation.mutate(draftIdToDelete);
            setCurrentDraftId(null);
          }
        },
      }
    );
  };

  const handleOpenDraftList = () => {
    setDraftListModalOpen(true);
  };

  const handleEditDraft = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    try {
      const response = await apiRequest("GET", `/api/orders/${orderId}/items`);
      const orderItemsData = await response.json() as OrderItem[];
      
      const productsMap = new Map(allProducts.map((p) => [p.id, p]));
      const restoredItems: OrderItemData[] = orderItemsData
        .map((item) => {
          const product = productsMap.get(item.productId);
          if (!product) return null;
          return {
            product,
            quantity: item.quantity,
          };
        })
        .filter((item): item is OrderItemData => item !== null);

      setOrderItems(restoredItems);
      setSelectedTable(order.tableId);
      setDiningOption(order.diningOption);
      setCurrentOrderNumber(order.orderNumber);
      setCurrentDraftId(orderId);
      setManualDiscount(parseFloat(order.discount) || 0);
      setDiscountType((order.discountType as 'amount' | 'percentage') || 'amount');
      setDraftListModalOpen(false);
      
      toast({
        title: "Draft Loaded",
        description: "Draft order items restored to cart. Complete or save to update.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load draft order",
        variant: "destructive",
      });
    }
  };

  const handlePrintDraft = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    try {
      const response = await apiRequest("GET", `/api/orders/${orderId}/items`);
      const orderItemsData = await response.json() as OrderItem[];
      
      const productsMap = new Map(allProducts.map((p) => [p.id, p]));
      const items = orderItemsData
        .map((item) => {
          const product = productsMap.get(item.productId);
          if (!product) return null;
          return {
            product,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          };
        })
        .filter((item): item is any => item !== null);

      setReceiptData({
        orderNumber: order.orderNumber,
        items,
        subtotal: parseFloat(order.subtotal),
        discount: parseFloat(order.discount),
        total: parseFloat(order.total),
        tableId: order.tableId,
        diningOption: order.diningOption,
      });
      setReceiptModalOpen(true);
      setDraftListModalOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load draft order for printing",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDraft = (orderId: string) => {
    deleteOrderMutation.mutate(orderId);
  };

  // Listen for loadDraft event from header
  useEffect(() => {
    const handleLoadDraft = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { orderId } = customEvent.detail;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      try {
        const response = await apiRequest("GET", `/api/orders/${orderId}/items`);
        const orderItemsData = await response.json() as OrderItem[];
        
        const productsMap = new Map(allProducts.map((p) => [p.id, p]));
        const restoredItems: OrderItemData[] = orderItemsData
          .map((item) => {
            const product = productsMap.get(item.productId);
            if (!product) return null;
            return {
              product,
              quantity: item.quantity,
            };
          })
          .filter((item): item is OrderItemData => item !== null);

        setOrderItems(restoredItems);
        setSelectedTable(order.tableId);
        setDiningOption(order.diningOption);
        setCurrentOrderNumber(order.orderNumber);
        setCurrentDraftId(orderId);
        setManualDiscount(parseFloat(order.discount) || 0);
        setDiscountType((order.discountType as 'amount' | 'percentage') || 'amount');
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load draft order",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('loadDraft', handleLoadDraft);
    return () => {
      window.removeEventListener('loadDraft', handleLoadDraft);
    };
  }, [orders, allProducts, toast]);

  // Listen for printDraft event from header
  useEffect(() => {
    const handlePrintDraft = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { orderId } = customEvent.detail;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      try {
        const response = await apiRequest("GET", `/api/orders/${orderId}/items`);
        const orderItemsData = await response.json() as OrderItem[];
        
        const productsMap = new Map(allProducts.map((p) => [p.id, p]));
        const restoredItems: OrderItemData[] = orderItemsData
          .map((item) => {
            const product = productsMap.get(item.productId);
            if (!product) return null;
            return {
              product,
              quantity: item.quantity,
            };
          })
          .filter((item): item is OrderItemData => item !== null);

        setOrderItems(restoredItems);
        setSelectedTable(order.tableId);
        setDiningOption(order.diningOption);
        setCurrentOrderNumber(order.orderNumber);
        setCurrentDraftId(orderId);
        setManualDiscount(parseFloat(order.discount) || 0);
        setDiscountType((order.discountType as 'amount' | 'percentage') || 'amount');
        
        // Open payment modal directly for printing
        setTimeout(() => {
          setPaymentModalOpen(true);
        }, 100);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load draft order for printing",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('printDraft', handlePrintDraft);
    return () => {
      window.removeEventListener('printDraft', handlePrintDraft);
    };
  }, [orders, allProducts, toast]);

  const handleProcessPayment = (type: "kot" | "bill" | "print") => {
    if (type === "kot") {
      const subtotal = orderItems.reduce(
        (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
        0
      );
      
      const discountAmount = discountType === 'percentage' 
        ? (subtotal * manualDiscount) / 100 
        : manualDiscount;
      
      setReceiptData({
        orderNumber: currentOrderNumber,
        items: orderItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          price: item.product.price,
          total: (parseFloat(item.product.price) * item.quantity).toString(),
        })),
        subtotal,
        discount: discountAmount,
        total: subtotal - discountAmount,
        tableId: selectedTable,
        diningOption,
      });
      setReceiptModalOpen(true);
    } else if (type === "print") {
      setPaymentModalOpen(true);
    }
  };

  const handleConfirmPayment = (paymentMethod: string, amountPaid: number, paymentSplits?: { method: string; amount: number; customerId?: string; customerName?: string; customerPhone?: string }[], customerName?: string, customerPhone?: string) => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
      0
    );

    const discountAmount = discountType === 'percentage' 
      ? (subtotal * manualDiscount) / 100 
      : manualDiscount;
    const total = subtotal - discountAmount;
    const draftIdToDelete = currentDraftId;

    const totalPaidAmount = paymentSplits && paymentSplits.length > 0
      ? paymentSplits.reduce((sum, split) => sum + split.amount, 0)
      : amountPaid;
    const changeDue = totalPaidAmount > total ? totalPaidAmount - total : 0;

    const orderData: any = {
      tableId: selectedTable,
      diningOption,
      subtotal: subtotal.toString(),
      discount: manualDiscount.toString(),
      discountType: discountType,
      total: total.toString(),
      status: "completed",
      paymentMethod,
      paymentStatus: paymentMethod === "due" ? "due" : "paid",
      items: orderItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        total: (parseFloat(item.product.price) * item.quantity).toString(),
      })),
    };

    if (customerName) {
      orderData.customerName = customerName;
    }

    if (customerPhone) {
      orderData.customerPhone = customerPhone;
    }

    if (paymentSplits && paymentSplits.length > 0) {
      orderData.paymentSplits = JSON.stringify(paymentSplits);
    }

    createOrderMutation.mutate(orderData, {
      onSuccess: () => {
        if (draftIdToDelete) {
          deleteOrderMutation.mutate(draftIdToDelete);
          setCurrentDraftId(null);
        }
      },
    });

    setReceiptData({
      orderNumber: currentOrderNumber,
      items: orderItems.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        price: item.product.price,
        total: (parseFloat(item.product.price) * item.quantity).toString(),
      })),
      subtotal,
      discount: discountAmount,
      total: total,
      tableId: selectedTable,
      diningOption,
      paymentSplits: paymentSplits && paymentSplits.length > 0 ? JSON.stringify(paymentSplits) : undefined,
      changeDue: changeDue > 0 ? changeDue : undefined,
    });

    setPaymentModalOpen(false);
    setReceiptModalOpen(true);
  };

  const handlePrintReceipt = () => {
    toast({
      title: "Receipt Printed",
      description: "Receipt has been sent to printer",
    });
  };

  const handleNewOrder = () => {
    setOrderItems([]);
    setSelectedTable(null);
    setDiningOption("dine-in");
    setCurrentOrderNumber(`${Math.floor(Math.random() * 100)}`);
    setCurrentDraftId(null);
    setManualDiscount(0);
    setDiscountType('amount');
    toast({
      title: "New Order",
      description: "Started a new order",
    });
  };

  const handleQRMenuOrders = () => {
    toast({
      title: "QR Menu Orders",
      description: "QR menu order feature coming soon",
    });
  };

  const handleTableOrder = () => {
    toast({
      title: "Table Order",
      description: "Table order management feature coming soon",
    });
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Reset scroll position when filters change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedCategory, searchQuery, minPrice, maxPrice, stockFilter]);

  const subtotal = orderItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-auto md:h-16 border-b border-border bg-background px-3 sm:px-4 md:px-6 py-2 md:py-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-0 flex-shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 max-w-2xl">
            <h1 className="text-base sm:text-lg md:text-xl font-semibold whitespace-nowrap shrink-0">Point of Sale (POS)</h1>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 w-full md:max-w-md text-sm sm:text-base"
                data-testid="input-search-products"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isDesktop && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 sm:h-10 sm:w-10 relative" 
                onClick={() => setOrderPanelOpen(true)}
                data-testid="button-toggle-order-panel"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                {orderItems.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" data-testid="button-notifications">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-b border-border bg-background flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1">
              <Badge variant="secondary" className="text-xs sm:text-sm shrink-0">Dashboard</Badge>
              <span className="text-muted-foreground shrink-0">/</span>
              <span className="text-xs sm:text-sm shrink-0">POS</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                  data-testid="button-category-all"
                >
                  Show All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                    data-testid={`button-category-${category.slug}`}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              {/* Advanced Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                >
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Filters
                </Button>
                {(minPrice || maxPrice || stockFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinPrice("");
                      setMaxPrice("");
                      setStockFilter("all");
                    }}
                    className="shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
                {allProducts.length > 0 && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {allProducts.length} of {totalProducts} products
                  </Badge>
                )}
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-md border">
                  <div>
                    <Label className="text-xs">Min Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Stock Status</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        <SelectItem value="inStock">In Stock</SelectItem>
                        <SelectItem value="outOfStock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 min-w-0"
          >
            {productsLoading && allProducts.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted rounded-lg mb-2 sm:mb-3" />
                    <div className="h-3 sm:h-4 bg-muted rounded w-3/4 mb-1 sm:mb-2" />
                    <div className="h-3 sm:h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : allProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground px-4">
                <div className="text-center">
                  <p className="text-base sm:text-lg font-medium mb-1">No products found</p>
                  <p className="text-xs sm:text-sm">Try adjusting your search or filter</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                  {allProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToOrder={handleAddToOrder}
                    />
                  ))}
                </div>
                {/* Infinite scroll trigger */}
                <div ref={observerTarget} className="h-4 flex items-center justify-center py-4">
                  {isFetchingNextPage && (
                    <div className="text-sm text-muted-foreground">Loading more products...</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <OrderPanel
        orderItems={orderItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearOrder={handleClearOrder}
        onSaveDraft={handleSaveDraft}
        onProcessPayment={handleProcessPayment}
        orderNumber={currentOrderNumber}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        tables={tables}
        diningOption={diningOption}
        onChangeDiningOption={setDiningOption}
        searchInPacking={searchInPacking}
        onSearchInPacking={setSearchInPacking}
        manualDiscount={manualDiscount}
        onManualDiscountChange={setManualDiscount}
        discountType={discountType}
        onDiscountTypeChange={setDiscountType}
        onDiscountChange={handleDiscountChange}
        open={isDesktop ? undefined : orderPanelOpen}
        onOpenChange={isDesktop ? undefined : setOrderPanelOpen}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handleConfirmPayment}
        total={subtotal - (discountType === 'percentage' ? (subtotal * manualDiscount) / 100 : manualDiscount)}
        orderNumber={currentOrderNumber}
      />

      <DraftListModal
        open={draftListModalOpen}
        onClose={() => setDraftListModalOpen(false)}
        draftOrders={draftOrders}
        onEditDraft={handleEditDraft}
        onPrintDraft={handlePrintDraft}
        onDeleteDraft={handleDeleteDraft}
      />

      {receiptData && (
        <ReceiptPrintModal
          open={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          order={receiptData}
          onPrint={handlePrintReceipt}
        />
      )}
    </div>
  );
}
