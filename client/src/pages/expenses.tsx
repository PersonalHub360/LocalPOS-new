import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Eye, Edit, Trash2, Printer, Search, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import type { Expense, ExpenseCategory } from "@shared/schema";

const UNIT_OPTIONS = ["Kg", "ml", "Litre", "Gram", "Box", "Unit", "Piece", "Dozen", "Pack"];

export default function ExpenseManage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("expenses");
  
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [printExpense, setPrintExpense] = useState<Expense | null>(null);
  
  const [editCategory, setEditCategory] = useState<ExpenseCategory | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  
  const [expenseFormData, setExpenseFormData] = useState({
    expenseDate: new Date().toISOString().slice(0, 16),
    categoryId: "",
    description: "",
    amount: "",
    unit: "Kg",
    quantity: "1",
    total: "",
  });
  
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setShowAddExpenseDialog(false);
      resetExpenseForm();
      toast({ title: "Success", description: "Expense added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/expenses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setEditExpense(null);
      toast({ title: "Success", description: "Expense updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update expense", variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setDeleteExpenseId(null);
      toast({ title: "Success", description: "Expense deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expense-categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setShowAddCategoryDialog(false);
      resetCategoryForm();
      toast({ title: "Success", description: "Category added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add category", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/expense-categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setEditCategory(null);
      toast({ title: "Success", description: "Category updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expense-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setDeleteCategoryId(null);
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    },
  });

  const resetExpenseForm = () => {
    setExpenseFormData({
      expenseDate: new Date().toISOString().slice(0, 16),
      categoryId: "",
      description: "",
      amount: "",
      unit: "Kg",
      quantity: "1",
      total: "",
    });
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      description: "",
    });
  };

  const calculateTotal = (amount: string, quantity: string) => {
    const amt = parseFloat(amount) || 0;
    const qty = parseFloat(quantity) || 0;
    return (amt * qty).toFixed(2);
  };

  const handleExpenseFormChange = (field: string, value: string) => {
    const updated = { ...expenseFormData, [field]: value };
    
    if (field === "amount" || field === "quantity") {
      updated.total = calculateTotal(updated.amount, updated.quantity);
    }
    
    setExpenseFormData(updated);
  };

  const handleAddExpense = () => {
    if (!expenseFormData.categoryId || !expenseFormData.description || !expenseFormData.amount) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createExpenseMutation.mutate({
      expenseDate: new Date(expenseFormData.expenseDate).toISOString(),
      categoryId: expenseFormData.categoryId,
      description: expenseFormData.description,
      amount: expenseFormData.amount,
      unit: expenseFormData.unit,
      quantity: expenseFormData.quantity,
      total: expenseFormData.total || calculateTotal(expenseFormData.amount, expenseFormData.quantity),
    });
  };

  const handleEditExpenseSave = () => {
    if (!editExpense) return;
    
    updateExpenseMutation.mutate({
      id: editExpense.id,
      data: {
        expenseDate: new Date(editExpense.expenseDate).toISOString(),
        categoryId: editExpense.categoryId,
        description: editExpense.description,
        amount: editExpense.amount,
        unit: editExpense.unit,
        quantity: editExpense.quantity,
        total: editExpense.total,
      },
    });
  };

  const handlePrintExpense = (expense: Expense) => {
    const category = categories.find(c => c.id === expense.categoryId);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Expense Receipt - ${expense.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #EA580C; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f5f5f5; }
              .total { font-size: 1.2em; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Expense Receipt</h1>
            <table>
              <tr><th>Expense ID</th><td>${expense.id}</td></tr>
              <tr><th>Date & Time</th><td>${format(new Date(expense.expenseDate), "PPpp")}</td></tr>
              <tr><th>Category</th><td>${category?.name || "N/A"}</td></tr>
              <tr><th>Description</th><td>${expense.description}</td></tr>
              <tr><th>Amount</th><td>$${expense.amount}</td></tr>
              <tr><th>Unit</th><td>${expense.unit}</td></tr>
              <tr><th>Quantity</th><td>${expense.quantity}</td></tr>
              <tr><th class="total">Total</th><td class="total">$${expense.total}</td></tr>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleAddCategory = () => {
    if (!categoryFormData.name) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }

    createCategoryMutation.mutate(categoryFormData);
  };

  const handleEditCategorySave = () => {
    if (!editCategory) return;
    
    updateCategoryMutation.mutate({
      id: editCategory.id,
      data: {
        name: editCategory.name,
        description: editCategory.description,
      },
    });
  };

  const filteredExpenses = expenses.filter(expense => {
    const category = categories.find(c => c.id === expense.categoryId);
    const searchLower = searchTerm.toLowerCase();
    
    return (
      expense.id.toLowerCase().includes(searchLower) ||
      expense.description.toLowerCase().includes(searchLower) ||
      category?.name.toLowerCase().includes(searchLower) ||
      expense.total.includes(searchTerm)
    );
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Expense Management</h1>
            <p className="text-muted-foreground mt-1">Track and manage all business expenses</p>
          </div>
          <Button onClick={() => setShowAddExpenseDialog(true)} data-testid="button-add-expense">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              <FolderOpen className="w-4 h-4 mr-2" />
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expense Records</CardTitle>
                <CardDescription>View and manage all expense records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by ID, description, category, or amount..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-expenses"
                    />
                  </div>
                </div>

                {expensesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No expenses found matching your search" : "No expenses recorded yet"}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-expense-id">Expense ID</TableHead>
                          <TableHead data-testid="header-date-time">Date & Time</TableHead>
                          <TableHead data-testid="header-category">Category</TableHead>
                          <TableHead data-testid="header-description">Description</TableHead>
                          <TableHead data-testid="header-amount">Amount</TableHead>
                          <TableHead data-testid="header-unit">Unit</TableHead>
                          <TableHead data-testid="header-quantity">Quantity</TableHead>
                          <TableHead data-testid="header-total">Total</TableHead>
                          <TableHead data-testid="header-actions">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map((expense) => {
                          const category = categories.find(c => c.id === expense.categoryId);
                          return (
                            <TableRow key={expense.id}>
                              <TableCell data-testid={`text-expense-id-${expense.id}`}>{expense.id}</TableCell>
                              <TableCell data-testid={`text-date-${expense.id}`}>
                                {format(new Date(expense.expenseDate), "MMM dd, yyyy HH:mm")}
                              </TableCell>
                              <TableCell data-testid={`text-category-${expense.id}`}>
                                {category?.name || "Unknown"}
                              </TableCell>
                              <TableCell data-testid={`text-description-${expense.id}`}>{expense.description}</TableCell>
                              <TableCell data-testid={`text-amount-${expense.id}`}>${expense.amount}</TableCell>
                              <TableCell data-testid={`text-unit-${expense.id}`}>{expense.unit}</TableCell>
                              <TableCell data-testid={`text-quantity-${expense.id}`}>{expense.quantity}</TableCell>
                              <TableCell className="font-semibold" data-testid={`text-total-${expense.id}`}>
                                ${expense.total}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setViewExpense(expense)}
                                        data-testid={`button-view-${expense.id}`}
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
                                        onClick={() => setEditExpense(expense)}
                                        data-testid={`button-edit-${expense.id}`}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Expense</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handlePrintExpense(expense)}
                                        data-testid={`button-print-${expense.id}`}
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
                                        onClick={() => setDeleteExpenseId(expense.id)}
                                        data-testid={`button-delete-${expense.id}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Expense</TooltipContent>
                                  </Tooltip>
                                </div>
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
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <div>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>Organize expenses by categories</CardDescription>
                </div>
                <Button onClick={() => setShowAddCategoryDialog(true)} data-testid="button-add-category">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No categories created yet</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-category-name">Category Name</TableHead>
                          <TableHead data-testid="header-category-description">Description</TableHead>
                          <TableHead data-testid="header-category-actions">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium" data-testid={`text-category-name-${category.id}`}>
                              {category.name}
                            </TableCell>
                            <TableCell data-testid={`text-category-description-${category.id}`}>
                              {category.description || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setEditCategory(category)}
                                      data-testid={`button-edit-category-${category.id}`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Category</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setDeleteCategoryId(category.id)}
                                      data-testid={`button-delete-category-${category.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Category</TooltipContent>
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
        </Tabs>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-add-expense">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>Record a new business expense</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expense-date">Expense Date *</Label>
              <Input
                id="expense-date"
                type="datetime-local"
                value={expenseFormData.expenseDate}
                onChange={(e) => handleExpenseFormChange("expenseDate", e.target.value)}
                data-testid="input-expense-date"
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={expenseFormData.categoryId}
                onValueChange={(value) => handleExpenseFormChange("categoryId", value)}
              >
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} data-testid={`option-category-${cat.id}`}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="Enter expense description"
                value={expenseFormData.description}
                onChange={(e) => handleExpenseFormChange("description", e.target.value)}
                data-testid="input-description"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={expenseFormData.amount}
                onChange={(e) => handleExpenseFormChange("amount", e.target.value)}
                data-testid="input-amount"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit *</Label>
              <Select
                value={expenseFormData.unit}
                onValueChange={(value) => handleExpenseFormChange("unit", value)}
              >
                <SelectTrigger id="unit" data-testid="select-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit} value={unit} data-testid={`option-unit-${unit}`}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="1"
                value={expenseFormData.quantity}
                onChange={(e) => handleExpenseFormChange("quantity", e.target.value)}
                data-testid="input-quantity"
              />
            </div>
            <div>
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                placeholder="Auto-calculated"
                value={expenseFormData.total || calculateTotal(expenseFormData.amount, expenseFormData.quantity)}
                readOnly
                className="bg-muted"
                data-testid="input-total"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)} data-testid="button-cancel-expense">
              Cancel
            </Button>
            <Button onClick={handleAddExpense} disabled={createExpenseMutation.isPending} data-testid="button-save-expense">
              {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Expense Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
        <DialogContent data-testid="dialog-view-expense">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>View complete expense information</DialogDescription>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Expense ID</Label>
                  <p className="font-medium" data-testid="view-expense-id">{viewExpense.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date & Time</Label>
                  <p className="font-medium" data-testid="view-expense-date">
                    {format(new Date(viewExpense.expenseDate), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium" data-testid="view-expense-category">
                    {categories.find(c => c.id === viewExpense.categoryId)?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium" data-testid="view-expense-description">{viewExpense.description}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium" data-testid="view-expense-amount">${viewExpense.amount}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit</Label>
                  <p className="font-medium" data-testid="view-expense-unit">{viewExpense.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium" data-testid="view-expense-quantity">{viewExpense.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-bold text-lg" data-testid="view-expense-total">${viewExpense.total}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewExpense(null)} data-testid="button-close-view">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-expense">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Modify expense details</DialogDescription>
          </DialogHeader>
          {editExpense && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-expense-date">Expense Date</Label>
                <Input
                  id="edit-expense-date"
                  type="datetime-local"
                  value={new Date(editExpense.expenseDate).toISOString().slice(0, 16)}
                  onChange={(e) => setEditExpense({ ...editExpense, expenseDate: new Date(e.target.value) })}
                  data-testid="input-edit-expense-date"
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editExpense.categoryId}
                  onValueChange={(value) => setEditExpense({ ...editExpense, categoryId: value })}
                >
                  <SelectTrigger id="edit-category" data-testid="select-edit-category">
                    <SelectValue />
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
              <div className="col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editExpense.description}
                  onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                  data-testid="input-edit-description"
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editExpense.amount}
                  onChange={(e) => {
                    const newAmount = e.target.value;
                    const newTotal = calculateTotal(newAmount, editExpense.quantity);
                    setEditExpense({ ...editExpense, amount: newAmount, total: newTotal });
                  }}
                  data-testid="input-edit-amount"
                />
              </div>
              <div>
                <Label htmlFor="edit-unit">Unit</Label>
                <Select
                  value={editExpense.unit}
                  onValueChange={(value) => setEditExpense({ ...editExpense, unit: value })}
                >
                  <SelectTrigger id="edit-unit" data-testid="select-edit-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  step="0.01"
                  value={editExpense.quantity}
                  onChange={(e) => {
                    const newQuantity = e.target.value;
                    const newTotal = calculateTotal(editExpense.amount, newQuantity);
                    setEditExpense({ ...editExpense, quantity: newQuantity, total: newTotal });
                  }}
                  data-testid="input-edit-quantity"
                />
              </div>
              <div>
                <Label htmlFor="edit-total">Total</Label>
                <Input
                  id="edit-total"
                  type="number"
                  step="0.01"
                  value={editExpense.total}
                  readOnly
                  className="bg-muted"
                  data-testid="input-edit-total"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpense(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleEditExpenseSave} disabled={updateExpenseMutation.isPending} data-testid="button-save-edit">
              {updateExpenseMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirmation */}
      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent data-testid="dialog-delete-expense">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseId && deleteExpenseMutation.mutate(deleteExpenseId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent data-testid="dialog-add-category">
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
            <DialogDescription>Create a new expense category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                placeholder="e.g., Office Supplies"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                placeholder="Optional description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                data-testid="input-category-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)} data-testid="button-cancel-category">
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={createCategoryMutation.isPending} data-testid="button-save-category">
              {createCategoryMutation.isPending ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editCategory} onOpenChange={() => setEditCategory(null)}>
        <DialogContent data-testid="dialog-edit-category">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Modify category details</DialogDescription>
          </DialogHeader>
          {editCategory && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-category-name">Category Name</Label>
                <Input
                  id="edit-category-name"
                  value={editCategory.name}
                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                  data-testid="input-edit-category-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-category-description">Description</Label>
                <Input
                  id="edit-category-description"
                  value={editCategory.description || ""}
                  onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                  data-testid="input-edit-category-description"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCategory(null)} data-testid="button-cancel-edit-category">
              Cancel
            </Button>
            <Button onClick={handleEditCategorySave} disabled={updateCategoryMutation.isPending} data-testid="button-save-edit-category">
              {updateCategoryMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <AlertDialogContent data-testid="dialog-delete-category">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategoryId && deleteCategoryMutation.mutate(deleteCategoryId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete-category"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
