import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertOrderItemSchema, insertExpenseCategorySchema, insertExpenseSchema, insertCategorySchema, insertProductSchema, insertPurchaseSchema, insertTableSchema, insertEmployeeSchema, insertAttendanceSchema, insertLeaveSchema, insertPayrollSchema, insertStaffSalarySchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";

const createOrderWithItemsSchema = insertOrderSchema.extend({
  items: z.array(insertOrderItemSchema.omit({ orderId: true })),
});

function getDateRange(filter: string, customDate?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case "today":
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      };
    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday,
        endDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
      };
    case "this-week":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return {
        startDate: startOfWeek,
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    case "custom":
      if (customDate) {
        const custom = new Date(customDate);
        const customDay = new Date(custom.getFullYear(), custom.getMonth(), custom.getDate());
        return {
          startDate: customDay,
          endDate: new Date(customDay.getFullYear(), customDay.getMonth(), customDay.getDate(), 23, 59, 59, 999),
        };
      }
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      };
    case "all":
      return {
        startDate: new Date(2000, 0, 1),
        endDate: new Date(2099, 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.updateCategory(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId } = req.query;
      const products = categoryId
        ? await storage.getProductsByCategory(categoryId as string)
        : await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.get("/api/tables", async (req, res) => {
    try {
      const tables = await storage.getTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  app.get("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table" });
    }
  });

  app.post("/api/tables", async (req, res) => {
    try {
      const validatedData = insertTableSchema.parse(req.body);
      const table = await storage.createTable(validatedData);
      res.status(201).json(table);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid table data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  app.patch("/api/tables/:id", async (req, res) => {
    try {
      const validatedData = insertTableSchema.partial().parse(req.body);
      const table = await storage.updateTable(req.params.id, validatedData);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid table data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update table" });
    }
  });

  app.patch("/api/tables/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const table = await storage.updateTableStatus(req.params.id, status);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to update table status" });
    }
  });

  app.delete("/api/tables/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTable(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const items = await storage.getOrderItemsWithProducts(order.id);
      res.json({ ...order, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.get("/api/orders/:id/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const items = await storage.getOrderItemsWithProducts(order.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const validatedData = createOrderWithItemsSchema.parse(req.body);
      const { items, ...orderData } = validatedData;
      
      const order = await storage.createOrder(orderData);
      
      for (const item of items) {
        await storage.createOrderItem({
          ...item,
          orderId: order.id,
        });
      }

      if (orderData.tableId) {
        await storage.updateTableStatus(orderData.tableId, "occupied");
      }
      
      const orderWithItems = {
        ...order,
        items: await storage.getOrderItemsWithProducts(order.id),
      };
      
      res.status(201).json(orderWithItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.updateOrder(req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  app.get("/api/orders/drafts", async (req, res) => {
    try {
      const drafts = await storage.getDraftOrders();
      const draftsWithItems = await Promise.all(
        drafts.map(async (draft) => {
          const items = await storage.getOrderItemsWithProducts(draft.id);
          return { ...draft, items };
        })
      );
      res.json(draftsWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch draft orders" });
    }
  });

  app.get("/api/orders/qr", async (req, res) => {
    try {
      const qrOrders = await storage.getQROrders();
      const qrOrdersWithItems = await Promise.all(
        qrOrders.map(async (order) => {
          const items = await storage.getOrderItemsWithProducts(order.id);
          return { ...order, items };
        })
      );
      res.json(qrOrdersWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch QR orders" });
    }
  });

  app.patch("/api/orders/:id/accept", async (req, res) => {
    try {
      const order = await storage.updateOrderStatus(req.params.id, "pending");
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept order" });
    }
  });

  app.patch("/api/orders/:id/reject", async (req, res) => {
    try {
      const order = await storage.updateOrderStatus(req.params.id, "cancelled");
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject order" });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getCompletedOrders();
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate);
      const stats = await storage.getDashboardStats(startDate, endDate);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/sales-by-category", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate);
      const sales = await storage.getSalesByCategory(startDate, endDate);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales by category" });
    }
  });

  app.get("/api/dashboard/sales-by-payment-method", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate);
      const sales = await storage.getSalesByPaymentMethod(startDate, endDate);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales by payment method" });
    }
  });

  app.get("/api/dashboard/popular-products", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate);
      const products = await storage.getPopularProducts(startDate, endDate);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch popular products" });
    }
  });

  app.get("/api/dashboard/recent-orders", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate);
      const orders = await storage.getRecentOrders(startDate, endDate);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent orders" });
    }
  });

  app.get("/api/expense-categories", async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.get("/api/expense-categories/:id", async (req, res) => {
    try {
      const category = await storage.getExpenseCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense category" });
    }
  });

  app.post("/api/expense-categories", async (req, res) => {
    try {
      const validatedData = insertExpenseCategorySchema.parse(req.body);
      const category = await storage.createExpenseCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense category" });
    }
  });

  app.patch("/api/expense-categories/:id", async (req, res) => {
    try {
      const category = await storage.updateExpenseCategory(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense category" });
    }
  });

  app.delete("/api/expense-categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpenseCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense category" });
    }
  });

  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid expense data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.get("/api/purchases", async (req, res) => {
    try {
      const purchases = await storage.getPurchases();
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  app.get("/api/purchases/:id", async (req, res) => {
    try {
      const purchase = await storage.getPurchase(req.params.id);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchase" });
    }
  });

  app.post("/api/purchases", async (req, res) => {
    try {
      const validatedData = insertPurchaseSchema.parse(req.body);
      const purchase = await storage.createPurchase(validatedData);
      res.status(201).json(purchase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid purchase data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create purchase" });
    }
  });

  app.patch("/api/purchases/:id", async (req, res) => {
    try {
      const purchase = await storage.updatePurchase(req.params.id, req.body);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ error: "Failed to update purchase" });
    }
  });

  app.delete("/api/purchases/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePurchase(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete purchase" });
    }
  });

  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid employee data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.patch("/api/employees/:id", async (req, res) => {
    try {
      const employee = await storage.updateEmployee(req.params.id, req.body);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  app.get("/api/attendance", async (req, res) => {
    try {
      const { date, employeeId } = req.query;
      let attendance;
      
      if (date) {
        attendance = await storage.getAttendanceByDate(new Date(date as string));
      } else if (employeeId) {
        attendance = await storage.getAttendanceByEmployee(employeeId as string);
      } else {
        attendance = await storage.getAttendance();
      }
      
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      const attendance = await storage.createAttendance(validatedData);
      res.status(201).json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid attendance data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create attendance record" });
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    try {
      const attendance = await storage.updateAttendance(req.params.id, req.body);
      if (!attendance) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAttendance(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attendance" });
    }
  });

  app.get("/api/leaves", async (req, res) => {
    try {
      const { employeeId } = req.query;
      let leaves;
      
      if (employeeId) {
        leaves = await storage.getLeavesByEmployee(employeeId as string);
      } else {
        leaves = await storage.getLeaves();
      }
      
      res.json(leaves);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaves" });
    }
  });

  app.get("/api/leaves/:id", async (req, res) => {
    try {
      const leave = await storage.getLeave(req.params.id);
      if (!leave) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json(leave);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave" });
    }
  });

  app.post("/api/leaves", async (req, res) => {
    try {
      const validatedData = insertLeaveSchema.parse(req.body);
      const leave = await storage.createLeave(validatedData);
      res.status(201).json(leave);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid leave data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create leave request" });
    }
  });

  app.patch("/api/leaves/:id", async (req, res) => {
    try {
      const leave = await storage.updateLeave(req.params.id, req.body);
      if (!leave) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json(leave);
    } catch (error) {
      res.status(500).json({ error: "Failed to update leave" });
    }
  });

  app.delete("/api/leaves/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLeave(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete leave" });
    }
  });

  app.get("/api/payroll", async (req, res) => {
    try {
      const { employeeId } = req.query;
      let payroll;
      
      if (employeeId) {
        payroll = await storage.getPayrollByEmployee(employeeId as string);
      } else {
        payroll = await storage.getPayroll();
      }
      
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  app.get("/api/payroll/:id", async (req, res) => {
    try {
      const payroll = await storage.getPayrollById(req.params.id);
      if (!payroll) {
        return res.status(404).json({ error: "Payroll not found" });
      }
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  app.post("/api/payroll", async (req, res) => {
    try {
      const validatedData = insertPayrollSchema.parse(req.body);
      const payroll = await storage.createPayroll(validatedData);
      res.status(201).json(payroll);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payroll data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create payroll record" });
    }
  });

  app.patch("/api/payroll/:id", async (req, res) => {
    try {
      const payroll = await storage.updatePayroll(req.params.id, req.body);
      if (!payroll) {
        return res.status(404).json({ error: "Payroll not found" });
      }
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payroll" });
    }
  });

  app.delete("/api/payroll/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePayroll(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payroll not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payroll" });
    }
  });

  app.get("/api/staff-salaries", async (req, res) => {
    try {
      const salaries = await storage.getStaffSalaries();
      res.json(salaries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff salaries" });
    }
  });

  app.get("/api/staff-salaries/:id", async (req, res) => {
    try {
      const salary = await storage.getStaffSalary(req.params.id);
      if (!salary) {
        return res.status(404).json({ error: "Staff salary not found" });
      }
      res.json(salary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff salary" });
    }
  });

  app.post("/api/staff-salaries", async (req, res) => {
    try {
      const validatedData = insertStaffSalarySchema.parse(req.body);
      const salary = await storage.createStaffSalary(validatedData);
      res.status(201).json(salary);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid staff salary data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create staff salary" });
    }
  });

  app.patch("/api/staff-salaries/:id", async (req, res) => {
    try {
      const salary = await storage.updateStaffSalary(req.params.id, req.body);
      if (!salary) {
        return res.status(404).json({ error: "Staff salary not found" });
      }
      res.json(salary);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff salary" });
    }
  });

  app.delete("/api/staff-salaries/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStaffSalary(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Staff salary not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff salary" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(validatedData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
