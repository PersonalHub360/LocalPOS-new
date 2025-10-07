import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, insertCategorySchema, type Product, type Category } from "@shared/schema";
import type { z } from "zod";
import { Plus, Search, Download, Upload, Edit, Trash2, PackagePlus, FolderPlus, Utensils, Calendar, ImagePlus, X, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from 'xlsx';

const UNIT_OPTIONS = ["piece", "kg", "gram", "ml", "litre", "plate", "serving", "bowl", "cup", "glass", "box"];

const DATE_FILTER_OPTIONS = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Custom Date", value: "custom" },
];

export default function ItemManage() {
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string>("");
  const { toast } = useToast();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory;
    
    let matchesDate = true;
    if (dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const productDate = new Date(product.createdAt);
      productDate.setHours(0, 0, 0, 0);
      matchesDate = productDate.getTime() === today.getTime();
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const productDate = new Date(product.createdAt);
      productDate.setHours(0, 0, 0, 0);
      matchesDate = productDate.getTime() === yesterday.getTime();
    } else if (dateFilter === "custom" && customDate) {
      const selectedDate = new Date(customDate);
      selectedDate.setHours(0, 0, 0, 0);
      const productDate = new Date(product.createdAt);
      productDate.setHours(0, 0, 0, 0);
      matchesDate = productDate.getTime() === selectedDate.getTime();
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  const itemForm = useForm<z.infer<typeof insertProductSchema>>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      price: "",
      purchaseCost: "",
      categoryId: "",
      imageUrl: "",
      unit: "piece",
      description: "",
      quantity: "0",
    },
  });

  const categoryForm = useForm<z.infer<typeof insertCategorySchema>>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertProductSchema>) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setItemDialogOpen(false);
      itemForm.reset();
      toast({
        title: "Success",
        description: "Item created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertProductSchema>> }) => {
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertCategorySchema>) => {
      return await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialogOpen(false);
      categoryForm.reset();
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertCategorySchema>> }) => {
      return await apiRequest("PATCH", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleItemSubmit = (data: z.infer<typeof insertProductSchema>) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleCategorySubmit = (data: z.infer<typeof insertCategorySchema>) => {
    const categoryData = {
      ...data,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    };
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryData });
    } else {
      createCategoryMutation.mutate(categoryData);
    }
  };

  const handleEditItem = (item: Product) => {
    setEditingItem(item);
    setImagePreview(item.imageUrl || "");
    itemForm.reset({
      name: item.name,
      price: item.price,
      purchaseCost: item.purchaseCost || "",
      categoryId: item.categoryId,
      imageUrl: item.imageUrl || "",
      unit: item.unit,
      description: item.description || "",
      quantity: item.quantity,
    });
    setItemDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      slug: category.slug,
    });
    setCategoryDialogOpen(true);
  };

  const handleAddItemClick = () => {
    setEditingItem(null);
    setImagePreview("");
    itemForm.reset({
      name: "",
      price: "",
      purchaseCost: "",
      categoryId: "",
      imageUrl: "",
      unit: "piece",
      description: "",
      quantity: "0",
    });
    setItemDialogOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      itemForm.setValue('imageUrl', base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    itemForm.setValue('imageUrl', "");
  };

  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    categoryForm.reset({
      name: "",
      slug: "",
    });
    setCategoryDialogOpen(true);
  };

  const handleExport = () => {
    const csvHeaders = "Name,Category,Purchase Cost,Sales Price,Unit,Quantity,Description,Created At\n";
    const csvRows = filteredProducts.map(product => {
      const category = categories.find(c => c.id === product.categoryId)?.name || "";
      return `"${product.name}","${category}","${product.purchaseCost || ""}","${product.price}","${product.unit}","${product.quantity}","${product.description || ""}","${format(new Date(product.createdAt), "yyyy-MM-dd")}"`;
    }).join("\n");
    
    const csv = csvHeaders + csvRows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `items-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Items exported successfully",
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      let rows: any[][] = [];
      
      if (isExcel) {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as any[][];
        rows = jsonData.slice(1);
      } else {
        const text = event.target?.result as string;
        const lines = text.split('\n').slice(1);
        rows = lines.map(line => {
          if (!line.trim()) return [];
          const matches = line.match(/(?:"([^"]*)"|([^,]*))/g);
          return matches ? matches.map(m => m.replace(/^"|"$/g, '').trim()) : [];
        });
      }
      
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        if (!row || row.length < 6) continue;

        const name = (row[0] || "").toString().trim();
        const categoryName = (row[1] || "").toString().trim();
        const purchaseCost = (row[2] || "").toString().trim();
        const price = (row[3] || "").toString().trim();
        const unit = (row[4] || "").toString().trim();
        const quantity = (row[5] || "").toString().trim();
        const description = (row[6] || "").toString().trim();

        const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!category) {
          skipped++;
          continue;
        }

        try {
          await apiRequest("POST", "/api/products", {
            name,
            categoryId: category.id,
            purchaseCost: purchaseCost || undefined,
            price,
            unit,
            quantity,
            description,
            imageUrl: "",
          });
          imported++;
        } catch (error) {
          console.error("Failed to import item:", name, error);
          skipped++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${imported} items. ${skipped > 0 ? `${skipped} items skipped.` : ''}`,
      });
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ["Name", "Category", "Purchase Cost", "Sales Price", "Unit", "Quantity", "Description"],
      ["Shrimp Basil Salad", "Salads", "6.00", "10.60", "plate", "50", "Fresh shrimp with basil and greens"],
      ["Onion Rings", "Beverages", "4.50", "8.50", "serving", "100", "Crispy fried onion rings"],
      ["Chicken Burger", "Soup", "6.50", "10.50", "piece", "60", "Juicy grilled chicken burger"],
      ["Vegetable Pizza", "Pizza", "9.00", "15.00", "piece", "40", "Mixed vegetable pizza"],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
    
    const fileName = `items_sample_template.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Success",
      description: "Sample Excel template downloaded",
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Item Management</h1>
            <p className="text-muted-foreground mt-1">Manage inventory and menu items</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={handleAddCategoryClick} data-testid="button-manage-categories">
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-category">
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                  <DialogDescription>
                    {editingCategory ? "Update category information" : "Create a new category for items"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...categoryForm}>
                  <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
                    <FormField
                      control={categoryForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Beverages" data-testid="input-category-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={categoryForm.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., beverages" data-testid="input-category-slug" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending} data-testid="button-save-category">
                        {editingCategory ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>

                {categories.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-medium text-sm">Existing Categories</h3>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center justify-between p-2 rounded-md border" data-testid={`category-item-${category.id}`}>
                          <span className="text-sm">{category.name}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditCategory(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <div>
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImport}
                data-testid="input-import-file"
              />
              <Button 
                variant="outline" 
                onClick={() => document.getElementById('import-file')?.click()}
                data-testid="button-import"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Items
              </Button>
            </div>

            <Button variant="outline" onClick={handleDownloadSample} data-testid="button-download-sample">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Sample Excel
            </Button>

            <Button variant="outline" onClick={handleExport} data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export Items
            </Button>

            <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddItemClick} data-testid="button-add-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-item">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "Update item information" : "Create a new inventory item"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...itemForm}>
                  <form onSubmit={itemForm.handleSubmit(handleItemSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <FormLabel>Item Image (optional)</FormLabel>
                      
                      {imagePreview ? (
                        <div className="relative w-full h-48 rounded-md overflow-hidden border">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={handleRemoveImage}
                            data-testid="button-remove-image"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label htmlFor="item-image-upload">
                            <input
                              id="item-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              data-testid="input-image-upload"
                            />
                            <div className="border-2 border-dashed rounded-md p-6 hover-elevate cursor-pointer transition-colors flex flex-col items-center gap-2">
                              <ImagePlus className="w-8 h-8 text-muted-foreground" />
                              <div className="text-center">
                                <p className="text-sm font-medium">Upload Image</p>
                                <p className="text-xs text-muted-foreground">Click to select an image file</p>
                              </div>
                            </div>
                          </label>
                          
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">Or use URL</span>
                            </div>
                          </div>

                          <FormField
                            control={itemForm.control}
                            name="imageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    value={field.value || ""} 
                                    placeholder="https://example.com/image.jpg" 
                                    data-testid="input-image-url"
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setImagePreview(e.target.value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Fresh Orange Juice" data-testid="input-item-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="purchaseCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purchase Cost</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-purchase-cost" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sales Price</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-sales-price" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-unit">
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {UNIT_OPTIONS.map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity/Stock</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0" data-testid="input-quantity" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Item description" rows={3} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending} data-testid="button-save-item">
                        {editingItem ? "Update Item" : "Create Item"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find items by name, category, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
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

                {dateFilter === "custom" && (
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
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Items ({filteredProducts.length})</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const category = categories.find(c => c.id === product.categoryId);
              return (
                <Card key={product.id} className="overflow-hidden" data-testid={`card-item-${product.id}`}>
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent">
                        <Utensils className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold truncate" data-testid={`text-item-name-${product.id}`}>{product.name}</h3>
                      {category && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-item-category-${product.id}`}>{category.name}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary font-mono" data-testid={`text-item-price-${product.id}`}>
                        ${parseFloat(product.price).toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground" data-testid={`text-item-unit-${product.id}`}>
                        per {product.unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="font-medium" data-testid={`text-item-quantity-${product.id}`}>
                        {parseFloat(product.quantity)} {product.unit}
                      </span>
                    </div>

                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-item-description-${product.id}`}>
                        {product.description}
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleEditItem(product)}
                        data-testid={`button-edit-item-${product.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteItemMutation.mutate(product.id)}
                        disabled={deleteItemMutation.isPending}
                        data-testid={`button-delete-item-${product.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PackagePlus className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No items found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery || selectedCategory !== "all" || dateFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Get started by adding your first item"}
                </p>
                {!searchQuery && selectedCategory === "all" && dateFilter === "all" && (
                  <Button onClick={handleAddItemClick} data-testid="button-add-first-item">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Item
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
