import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Bell, Plus, Grid3x3, FileText, Utensils } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { OrderPanel, type OrderItemData } from "@/components/order-panel";
import { PaymentModal } from "@/components/payment-modal";
import { DraftListModal } from "@/components/draft-list-modal";
import { ReceiptPrintModal } from "@/components/receipt-print-modal";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category, Table, Order, OrderItem } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function POS() {
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
  const { toast } = useToast();

  // Handle discount changes properly to avoid race conditions
  const handleDiscountChange = (value: number, type: 'amount' | 'percentage') => {
    setDiscountType(type);
    setManualDiscount(value);
  };

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["/api/tables"],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const draftOrders = orders.filter((order) => order.status === "draft");

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
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
      
      const productsMap = new Map(products.map((p) => [p.id, p]));
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
      
      const productsMap = new Map(products.map((p) => [p.id, p]));
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
        
        const productsMap = new Map(products.map((p) => [p.id, p]));
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
  }, [orders, products, toast]);

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
        
        const productsMap = new Map(products.map((p) => [p.id, p]));
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
  }, [orders, products, toast]);

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

  const handleConfirmPayment = (paymentMethod: string, amountPaid: number) => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
      0
    );

    const discountAmount = discountType === 'percentage' 
      ? (subtotal * manualDiscount) / 100 
      : manualDiscount;
    const total = subtotal - discountAmount;
    const draftIdToDelete = currentDraftId;

    const orderData = {
      tableId: selectedTable,
      diningOption,
      subtotal: subtotal.toString(),
      discount: manualDiscount.toString(),
      discountType: discountType,
      total: total.toString(),
      status: "completed",
      paymentMethod,
      paymentStatus: "paid",
      items: orderItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        total: (parseFloat(item.product.price) * item.quantity).toString(),
      })),
    };

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

  const filteredProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const subtotal = orderItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <h1 className="text-xl font-semibold whitespace-nowrap">Point of Sale (POS)</h1>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 max-w-md"
                data-testid="input-search-products"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-border bg-background">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">Dashboard</Badge>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm">POS</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="whitespace-nowrap"
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
                  className="whitespace-nowrap"
                  data-testid={`button-category-${category.slug}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted rounded-lg mb-3" />
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium mb-1">No products found</p>
                  <p className="text-sm">Try adjusting your search or filter</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToOrder={handleAddToOrder}
                  />
                ))}
              </div>
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
