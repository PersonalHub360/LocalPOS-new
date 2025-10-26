import { useState, useRef } from "react";
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
import { AlertTriangle, Plus, RefreshCw, TrendingUp, TrendingDown, Package, History, Eye, Edit, Trash2, Download, Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, InventoryAdjustment, Settings, Category } from "@shared/schema";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function Inventory() {
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [viewProductDialogOpen, setViewProductDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Product form state
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    quantity: "",
    unit: "",
    categoryId: "",
    image: null as string | null,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
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

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      resetProductForm();
      toast({
        title: "Success",
        description: "Product created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      resetProductForm();
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
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

  const resetProductForm = () => {
    setProductForm({
      name: "",
      price: "",
      quantity: "",
      unit: "",
      categoryId: "",
      image: null,
    });
    setIsEditMode(false);
    setSelectedProduct(null);
  };

  const handleAddProduct = () => {
    resetProductForm();
    setIsEditMode(false);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setProductForm({
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      categoryId: product.categoryId,
      image: product.image,
    });
    setSelectedProduct(product);
    setIsEditMode(true);
    setProductDialogOpen(true);
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setViewProductDialogOpen(true);
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleProductSubmit = () => {
    if (!productForm.name || !productForm.price || !productForm.quantity || !productForm.unit || !productForm.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (isEditMode && selectedProduct) {
      updateProductMutation.mutate({
        id: selectedProduct.id,
        data: productForm,
      });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const handleExportExcel = () => {
    const exportData = products.map(p => ({
      "Product Name": p.name,
      "Category": categories.find(c => c.id === p.categoryId)?.name || p.categoryId,
      "Price (USD)": parseFloat(p.price),
      "Quantity": parseFloat(p.quantity),
      "Unit": p.unit,
      "Status": parseFloat(p.quantity) === 0 ? "Out of Stock" : parseFloat(p.quantity) <= stockThreshold ? "Low Stock" : "In Stock",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: "Export Successful",
      description: "Inventory data exported to Excel",
    });
  };

  const handleExportCSV = () => {
    const headers = ["Product Name", "Category", "Price (USD)", "Quantity", "Unit", "Status"];
    const rows = products.map(p => [
      p.name,
      categories.find(c => c.id === p.categoryId)?.name || p.categoryId,
      parseFloat(p.price),
      parseFloat(p.quantity),
      p.unit,
      parseFloat(p.quantity) === 0 ? "Out of Stock" : parseFloat(p.quantity) <= stockThreshold ? "Low Stock" : "In Stock",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Inventory data exported to CSV",
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        toast({
          title: "Import Started",
          description: `Processing ${jsonData.length} products...`,
        });

        // Process imported data
        jsonData.forEach(async (row: any) => {
          const category = categories.find(c => c.name === row["Category"]);
          if (category && row["Product Name"]) {
            const productData = {
              name: row["Product Name"],
              price: row["Price (USD)"]?.toString() || "0",
              quantity: row["Quantity"]?.toString() || "0",
              unit: row["Unit"] || "Unit",
              categoryId: category.id,
              image: null,
            };

            await apiRequest("POST", "/api/products", productData);
          }
        });

        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({
          title: "Import Successful",
          description: "Inventory data imported successfully",
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to import inventory data",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        "Product Name": "Sample Product 1",
        "Category": "Rice",
        "Price (USD)": 10.50,
        "Quantity": 100,
        "Unit": "Kg",
      },
      {
        "Product Name": "Sample Product 2",
        "Category": "Soup",
        "Price (USD)": 8.00,
        "Quantity": 50,
        "Unit": "Bowl",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_import_template.xlsx");

    toast({
      title: "Download Complete",
      description: "Sample template downloaded",
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
          <p className="text-muted-foreground mt-1">Track and manage your stock levels and products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadSampleTemplate} className="gap-2" data-testid="button-download-template">
            <FileSpreadsheet className="w-4 h-4" />
            Sample Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2" data-testid="button-import">
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={handleExportExcel} className="gap-2" data-testid="button-export-excel">
            <Download className="w-4 h-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2" data-testid="button-export-csv">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button onClick={handleAdjustStock} className="gap-2" data-testid="button-adjust-stock">
            <RefreshCw className="w-4 h-4" />
            Adjust Stock
          </Button>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="gap-2" data-testid="tab-products">
            <Package className="w-4 h-4" />
            All Products
          </TabsTrigger>
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

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Products</CardTitle>
                  <CardDescription>Manage your product catalog</CardDescription>
                </div>
                <Button onClick={handleAddProduct} className="gap-2" data-testid="button-add-product">
                  <Plus className="w-4 h-4" />
                  Add Product
                </Button>
              </div>
              <div className="pt-4">
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search-products"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                          <TableCell>{categories.find(c => c.id === product.categoryId)?.name || product.categoryId}</TableCell>
                          <TableCell className="text-right font-mono">${parseFloat(product.price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{qty}</TableCell>
                          <TableCell>{product.unit}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewProduct(product)}
                                data-testid={`button-view-${product.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                                data-testid={`button-edit-${product.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
                                data-testid={`button-delete-${product.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Overview</CardTitle>
              <CardDescription>Complete inventory with stock levels</CardDescription>
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
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => {
                      const qty = parseFloat(product.quantity);
                      const status = getStockStatus(qty);
                      return (
                        <TableRow key={product.id} data-testid={`row-overview-${product.id}`}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{categories.find(c => c.id === product.categoryId)?.name || product.categoryId}</TableCell>
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

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
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

      {/* Product Add/Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-product">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Update product information" : "Create a new product"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name *</Label>
              <Input
                id="product-name"
                placeholder="Enter product name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                data-testid="input-product-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category">Category *</Label>
              <Select
                value={productForm.categoryId}
                onValueChange={(value) => setProductForm({ ...productForm, categoryId: value })}
              >
                <SelectTrigger id="product-category" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price">Price (USD) *</Label>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  data-testid="input-product-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-quantity">Quantity *</Label>
                <Input
                  id="product-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={productForm.quantity}
                  onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                  data-testid="input-product-quantity"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-unit">Unit *</Label>
              <Input
                id="product-unit"
                placeholder="e.g., Kg, Piece, Bowl"
                value={productForm.unit}
                onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                data-testid="input-product-unit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} data-testid="button-product-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleProductSubmit}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              data-testid="button-product-save"
            >
              {createProductMutation.isPending || updateProductMutation.isPending ? "Saving..." : isEditMode ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={viewProductDialogOpen} onOpenChange={setViewProductDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-view-product">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Product Name</Label>
                <p className="text-lg font-medium">{selectedProduct.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <p>{categories.find(c => c.id === selectedProduct.categoryId)?.name || selectedProduct.categoryId}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Price</Label>
                  <p className="font-mono">${parseFloat(selectedProduct.price).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-mono">{parseFloat(selectedProduct.quantity)} {selectedProduct.unit}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {(() => {
                    const qty = parseFloat(selectedProduct.quantity);
                    const status = getStockStatus(qty);
                    return (
                      <Badge variant={status.variant} className="gap-1">
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewProductDialogOpen(false)} data-testid="button-close-view">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-product">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-delete-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedProduct && deleteProductMutation.mutate(selectedProduct.id)}
              disabled={deleteProductMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteProductMutation.isPending ? "Deleting..." : "Delete Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
