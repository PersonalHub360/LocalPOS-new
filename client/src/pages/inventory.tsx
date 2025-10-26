import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Plus, Minus, RefreshCw, TrendingUp, TrendingDown, Package, History, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, InventoryAdjustment, Settings } from "@shared/schema";
import { format } from "date-fns";

export default function Inventory() {
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: adjustments = [] } = useQuery<InventoryAdjustment[]>({
    queryKey: ["/api/inventory/adjustments"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const stockThreshold = settings?.stockThreshold || 10;

  const { data: lowStockProducts = [] } = useQuery<Product[]>({
    queryKey: [`/api/inventory/low-stock?threshold=${stockThreshold}`],
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: { productId: string; adjustmentType: string; quantity: string; reason: string; notes?: string }) => {
      return await apiRequest("POST", "/api/inventory/adjustments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      setAdjustmentDialogOpen(false);
      setSelectedProduct(null);
      setQuantity("");
      setReason("");
      setNotes("");
      toast({
        title: "Success",
        description: "Stock adjusted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to adjust stock",
        variant: "destructive",
      });
    },
  });

  const handleAdjustStock = () => {
    if (!selectedProduct || !quantity || !reason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const trimmedQuantity = quantity.trim();
    const numQuantity = parseFloat(trimmedQuantity);
    
    if (isNaN(numQuantity) || numQuantity <= 0 || !/^\d+(\.\d+)?$/.test(trimmedQuantity)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid positive number for quantity",
        variant: "destructive",
      });
      return;
    }

    createAdjustmentMutation.mutate({
      productId: selectedProduct.id,
      adjustmentType,
      quantity: trimmedQuantity,
      reason,
      notes: notes || undefined,
    });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: "Out of Stock", variant: "destructive" as const, icon: AlertTriangle };
    if (qty <= stockThreshold) return { label: "Low Stock", variant: "secondary" as const, icon: AlertTriangle };
    return { label: "In Stock", variant: "default" as const, icon: Package };
  };

  const getAdjustmentIcon = (type: string) => {
    switch (type) {
      case "add":
        return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "remove":
        return <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent" data-testid="text-inventory-title">
            Inventory Management
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage your stock levels</p>
        </div>
        <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-adjust-stock">
              <RefreshCw className="w-4 h-4" />
              Adjust Stock
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" data-testid="dialog-adjust-stock">
            <DialogHeader>
              <DialogTitle>Adjust Stock Level</DialogTitle>
              <DialogDescription>
                Add, remove, or set stock quantity for a product
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product *</Label>
                <Select
                  value={selectedProduct?.id}
                  onValueChange={(value) => {
                    const product = products.find(p => p.id === value);
                    setSelectedProduct(product || null);
                  }}
                >
                  <SelectTrigger id="product" data-testid="select-product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} (Current: {product.quantity} {product.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustment-type">Adjustment Type *</Label>
                <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
                  <SelectTrigger id="adjustment-type" data-testid="select-adjustment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Stock</SelectItem>
                    <SelectItem value="remove">Remove Stock</SelectItem>
                    <SelectItem value="set">Set Stock Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="reason" data-testid="select-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">New Purchase</SelectItem>
                    <SelectItem value="sale">Sale/Usage</SelectItem>
                    <SelectItem value="damage">Damage/Spoilage</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="correction">Stock Correction</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-notes"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button onClick={handleAdjustStock} disabled={createAdjustmentMutation.isPending} data-testid="button-save-adjustment">
                {createAdjustmentMutation.isPending ? "Saving..." : "Save Adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <Package className="w-4 h-4" />
            Stock Overview
          </TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-2" data-testid="tab-low-stock">
            <AlertTriangle className="w-4 h-4" />
            Low Stock ({lowStockProducts.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <History className="w-4 h-4" />
            Adjustment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Products</CardTitle>
              <CardDescription>Complete inventory with stock levels</CardDescription>
              <div className="pt-4">
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const qty = parseFloat(product.quantity);
                      const status = getStockStatus(qty);
                      return (
                        <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.categoryId}</TableCell>
                          <TableCell>{product.unit}</TableCell>
                          <TableCell className="text-right font-mono">{qty}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setAdjustmentDialogOpen(true);
                              }}
                              data-testid={`button-adjust-${product.id}`}
                            >
                              Adjust
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low-stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Low Stock Alerts
              </CardTitle>
              <CardDescription>
                Products with stock below {stockThreshold} units
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No low stock products</p>
                  <p className="text-sm mt-1">All products are well stocked!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Threshold</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((product) => (
                      <TableRow key={product.id} data-testid={`row-low-stock-${product.id}`}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.unit}</TableCell>
                        <TableCell className="text-right font-mono text-destructive font-bold">
                          {parseFloat(product.quantity)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {stockThreshold}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setAdjustmentType("add");
                              setAdjustmentDialogOpen(true);
                            }}
                            data-testid={`button-restock-${product.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Restock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adjustment History</CardTitle>
              <CardDescription>All stock movements and adjustments</CardDescription>
            </CardHeader>
            <CardContent>
              {adjustments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No adjustment history</p>
                  <p className="text-sm mt-1">Stock adjustments will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adjustment) => {
                      const product = products.find(p => p.id === adjustment.productId);
                      return (
                        <TableRow key={adjustment.id} data-testid={`row-adjustment-${adjustment.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(adjustment.createdAt), "MMM dd, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {product?.name || "Unknown Product"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getAdjustmentIcon(adjustment.adjustmentType)}
                              <span className="capitalize">{adjustment.adjustmentType}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(adjustment.quantity)} {product?.unit}
                          </TableCell>
                          <TableCell className="capitalize">{adjustment.reason}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {adjustment.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
