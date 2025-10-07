import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTableSchema, type Table as TableType } from "@shared/schema";
import type { z } from "zod";
import { Plus, Edit, Trash2, Eye, Printer, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tables() {
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [viewingTable, setViewingTable] = useState<TableType | null>(null);
  const { toast } = useToast();

  const { data: tables = [] } = useQuery<TableType[]>({
    queryKey: ["/api/tables"],
  });

  const tableForm = useForm<z.infer<typeof insertTableSchema>>({
    resolver: zodResolver(insertTableSchema),
    defaultValues: {
      tableNumber: "",
      capacity: "",
      description: "",
      status: "available",
    },
  });

  const createTableMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertTableSchema>) => {
      return await apiRequest("POST", "/api/tables", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      setTableDialogOpen(false);
      tableForm.reset();
      toast({
        title: "Success",
        description: "Table created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create table",
        variant: "destructive",
      });
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertTableSchema>> }) => {
      return await apiRequest("PATCH", `/api/tables/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      setTableDialogOpen(false);
      tableForm.reset();
      toast({
        title: "Success",
        description: "Table updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update table",
        variant: "destructive",
      });
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/tables/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Success",
        description: "Table deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete table",
        variant: "destructive",
      });
    },
  });

  const handleTableSubmit = (data: z.infer<typeof insertTableSchema>) => {
    if (editingTable) {
      updateTableMutation.mutate({ id: editingTable.id, data });
    } else {
      createTableMutation.mutate(data);
    }
  };

  const handleEditTable = (table: TableType) => {
    setEditingTable(table);
    tableForm.reset({
      tableNumber: table.tableNumber,
      capacity: table.capacity || "",
      description: table.description || "",
      status: table.status,
    });
    setTableDialogOpen(true);
  };

  const handleAddTableClick = () => {
    setEditingTable(null);
    tableForm.reset({
      tableNumber: "",
      capacity: "",
      description: "",
      status: "available",
    });
    setTableDialogOpen(true);
  };

  const handleViewTable = (table: TableType) => {
    setViewingTable(table);
    setViewDialogOpen(true);
  };

  const handlePrintTable = (table: TableType) => {
    const printContent = `
      <html>
        <head>
          <title>Table Information - ${table.tableNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #EA580C; }
            .details { margin: 20px 0; }
            .details p { margin: 8px 0; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Table Information</h1>
          <div class="details">
            <p><span class="label">Table Number:</span> ${table.tableNumber}</p>
            <p><span class="label">Capacity:</span> ${table.capacity || 'Not specified'}</p>
            <p><span class="label">Description:</span> ${table.description || 'No description'}</p>
            <p><span class="label">Status:</span> ${table.status}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Table Management</h1>
          <p className="text-sm text-muted-foreground">Manage your restaurant tables and seating arrangements</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddTableClick} data-testid="button-add-table">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Table
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" data-testid="dialog-table">
                <DialogHeader>
                  <DialogTitle>{editingTable ? "Edit Table" : "Add New Table"}</DialogTitle>
                  <DialogDescription>
                    {editingTable ? "Update table information" : "Create a new table in your restaurant"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...tableForm}>
                  <form onSubmit={tableForm.handleSubmit(handleTableSubmit)} className="space-y-4">
                    <FormField
                      control={tableForm.control}
                      name="tableNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Table Number/Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 1, A1, VIP-1" data-testid="input-table-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={tableForm.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="e.g., 4, 6, 8" data-testid="input-capacity" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={tableForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              value={field.value || ""}
                              placeholder="e.g., Window seat, Outdoor patio, Private room" 
                              data-testid="input-description"
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setTableDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTableMutation.isPending || updateTableMutation.isPending} data-testid="button-submit">
                        {editingTable ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table Number</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No tables found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tables.map((table) => (
                        <TableRow key={table.id} data-testid={`row-table-${table.id}`}>
                          <TableCell className="font-medium" data-testid={`text-table-number-${table.id}`}>
                            {table.tableNumber}
                          </TableCell>
                          <TableCell data-testid={`text-capacity-${table.id}`}>
                            {table.capacity || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-description-${table.id}`}>
                            {table.description || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-status-${table.id}`}>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              table.status === 'available' ? 'bg-green-100 text-green-800' :
                              table.status === 'occupied' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {table.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleViewTable(table)}
                                data-testid={`button-view-${table.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditTable(table)}
                                data-testid={`button-edit-${table.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handlePrintTable(table)}
                                data-testid={`button-print-${table.id}`}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteTableMutation.mutate(table.id)}
                                data-testid={`button-delete-${table.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-view-table">
          <DialogHeader>
            <DialogTitle>Table Details</DialogTitle>
          </DialogHeader>
          {viewingTable && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Table Number</p>
                <p className="font-medium text-lg">{viewingTable.tableNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="font-medium">{viewingTable.capacity || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{viewingTable.description || 'No description provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  viewingTable.status === 'available' ? 'bg-green-100 text-green-800' :
                  viewingTable.status === 'occupied' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {viewingTable.status}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
