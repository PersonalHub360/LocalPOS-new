import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertOrderItemSchema, insertExpenseCategorySchema, insertExpenseSchema, insertCategorySchema, insertProductSchema, insertPurchaseSchema, insertTableSchema, insertEmployeeSchema, insertAttendanceSchema, insertLeaveSchema, insertPayrollSchema, insertStaffSalarySchema, insertSettingsSchema, insertUserSchema, insertInventoryAdjustmentSchema, insertBranchSchema, insertPaymentAdjustmentSchema, insertCustomerSchema, insertDuePaymentSchema, insertDuePaymentAllocationSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads directory exists
// In development: server/../uploads
// In production: dist/../uploads
const uploadsDir = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const createOrderWithItemsSchema = insertOrderSchema.extend({
  items: z.array(insertOrderItemSchema.omit({ orderId: true })),
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId && !req.session.branchId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

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
    case "this-month":
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfMonth,
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    case "last-month":
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth,
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
  // Health check endpoint (must be before authentication middleware)
  app.get("/health", async (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await storage.validateUserCredentials(username, password);
      
      if (user) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.userType = "user";

        return res.json({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          userType: "user",
        });
      }

      const branch = await storage.validateBranchCredentials(username, password);
      
      if (branch) {
        req.session.branchId = branch.id;
        req.session.username = branch.username;
        req.session.role = "branch";
        req.session.userType = "branch";

        return res.json({
          id: branch.id,
          username: branch.username,
          name: branch.name,
          location: branch.location,
          role: "branch",
          userType: "branch",
        });
      }

      return res.status(401).json({ error: "Invalid credentials" });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        // Get user's permissions
        let permissions: string[] = [];
        
        // Admin users have all permissions
        if (user.role === "admin") {
          permissions = ["*"]; // Special marker for all permissions
        } else {
          // Try to get roleId from user, or look it up by role name
          let roleId = user.roleId;
          
          // If no roleId but user has a role name, look it up (case-insensitive)
          if (!roleId && user.role) {
            // Try exact match first
            let role = await storage.getRoleByName(user.role);
            
            // If not found, try case-insensitive lookup
            if (!role) {
              const allRoles = await storage.getRoles();
              role = allRoles.find(r => r.name.toLowerCase() === user.role?.toLowerCase());
            }
            
            if (role) {
              roleId = role.id;
            }
          }
          
          // Fetch permissions if we have a roleId
          if (roleId) {
            const rolePermissions = await storage.getPermissionsForRole(roleId);
            permissions = rolePermissions.map(p => p.name);
          }
        }
        
        return res.json({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          roleId: user.roleId,
          permissions,
          userType: "user",
        });
      }
    }
    
    if (req.session.branchId) {
      const branch = await storage.getBranch(req.session.branchId);
      if (branch) {
        return res.json({
          id: branch.id,
          username: branch.username,
          name: branch.name,
          location: branch.location,
          role: "branch",
          permissions: ["*"], // Branches have all permissions
          userType: "branch",
        });
      }
    }
    
    res.status(401).json({ error: "Not authenticated" });
  });

  // Public settings endpoint (for login page branding)
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Change password endpoint (requires authentication but before global middleware)
  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long" });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Apply authentication middleware to all routes below this point
  app.use("/api", requireAuth);

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
      const { categoryId, branchId, limit, offset, search, minPrice, maxPrice, inStock } = req.query;
      
      // If pagination parameters are provided, use paginated endpoint
      if (limit !== undefined || offset !== undefined || search || minPrice || maxPrice || inStock !== undefined) {
        const limitNum = limit ? parseInt(limit as string, 10) : 50;
        const offsetNum = offset ? parseInt(offset as string, 10) : 0;
        const minPriceNum = minPrice ? parseFloat(minPrice as string) : undefined;
        const maxPriceNum = maxPrice ? parseFloat(maxPrice as string) : undefined;
        const inStockBool = inStock !== undefined ? inStock === 'true' : undefined;
        
        const result = await storage.getProductsPaginated(
          branchId as string | undefined,
          limitNum,
          offsetNum,
          categoryId as string | undefined,
          search as string | undefined,
          minPriceNum,
          maxPriceNum,
          inStockBool
        );
        res.json(result);
      } else {
        // Legacy endpoint for backward compatibility
        const products = categoryId
          ? await storage.getProductsByCategory(categoryId as string, branchId as string | undefined)
          : await storage.getProducts(branchId as string | undefined);
        res.json(products);
      }
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
      
      // Check for duplicate name
      const existingProduct = await storage.getProductByName(validatedData.name);
      if (existingProduct) {
        return res.status(409).json({ error: "Already uploaded" });
      }
      
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.post("/api/products/bulk", async (req, res) => {
    try {
      const items = req.body.items;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }

      const results = {
        imported: 0,
        failed: 0,
        errors: [] as Array<{ row: number; name: string; error: string }>
      };

      for (let i = 0; i < items.length; i++) {
        try {
          const validatedData = insertProductSchema.parse(items[i]);
          
          // Check for duplicate name
          const existingProduct = await storage.getProductByName(validatedData.name);
          if (existingProduct) {
            results.failed++;
            results.errors.push({
              row: i + 2,
              name: validatedData.name,
              error: "Duplicate name - product already exists"
            });
            continue;
          }
          
          await storage.createProduct(validatedData);
          results.imported++;
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof z.ZodError 
            ? error.errors.map(e => e.message).join(", ")
            : "Unknown error";
          results.errors.push({
            row: i + 2, // +2 because row 1 is header and array is 0-indexed
            name: items[i]?.name || "Unknown",
            error: errorMsg
          });
        }
      }

      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to process bulk import" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      // Get current product
      const currentProduct = await storage.getProduct(req.params.id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // If name is being updated, check for duplicates
      if (req.body.name && req.body.name !== currentProduct.name) {
        const existingProduct = await storage.getProductByName(req.body.name, req.params.id);
        if (existingProduct) {
          return res.status(409).json({ error: "Duplicate name" });
        }
      }
      
      // Check if the data is actually being changed
      if (req.body.name && req.body.name === currentProduct.name) {
        const hasOtherChanges = Object.keys(req.body).some(key => {
          if (key === 'name') return false;
          return req.body[key] !== (currentProduct as any)[key];
        });
        if (!hasOtherChanges) {
          return res.status(409).json({ error: "Already updated" });
        }
      }
      
      const product = await storage.updateProduct(req.params.id, req.body);
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
      const { branchId } = req.query;
      const tables = await storage.getTables(branchId as string | undefined);
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

  app.get("/api/tables/:id/order", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      
      const order = await storage.getTableCurrentOrder(req.params.id);
      if (!order) {
        return res.json(null);
      }
      
      const items = await storage.getOrderItemsWithProducts(order.id);
      const itemsWithProductName = items.map(item => ({
        ...item,
        productName: item.product.name,
      }));
      
      res.json({ ...order, items: itemsWithProductName });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table order" });
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
      const { branchId } = req.query;
      const orders = await storage.getOrders(branchId as string | undefined);
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
      const itemsWithProductName = items
        .filter(item => item.product) // Filter out items with null products
        .map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          productName: item.product.name,
        }));
      res.json(itemsWithProductName);
    } catch (error) {
      console.error("Error fetching order items:", error);
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders/:id/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const { productId, quantity, price, total } = req.body;
      if (!productId || !quantity || !price || !total) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const orderItem = await storage.createOrderItem({
        orderId: req.params.id,
        productId,
        quantity: quantity.toString(),
        price,
        total,
      });

      const allItems = await storage.getOrderItems(req.params.id);
      const newSubtotal = allItems.reduce((sum, item) => sum + parseFloat(item.total), 0).toFixed(2);
      const currentDiscount = parseFloat(order.discount) || 0;
      const newTotal = (parseFloat(newSubtotal) - currentDiscount).toFixed(2);

      await storage.updateOrder(req.params.id, {
        subtotal: newSubtotal,
        total: newTotal,
      });

      res.status(201).json(orderItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to add item to order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const validatedData = createOrderWithItemsSchema.parse(req.body);
      const { items, ...orderData } = validatedData;
      
      // Use createOrderWithItems which handles inventory deduction automatically
      const order = await storage.createOrderWithItems(orderData, items);

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
      const updates: any = { ...req.body };
      
      // Convert createdAt from ISO string to Date if provided
      if (updates.createdAt && typeof updates.createdAt === 'string') {
        updates.createdAt = new Date(updates.createdAt);
      }
      
      const order = await storage.updateOrder(req.params.id, updates);
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

  app.post("/api/sales/import", async (req, res) => {
    try {
      const { sales: salesData } = req.body;
      
      if (!Array.isArray(salesData) || salesData.length === 0) {
        return res.status(400).json({ error: "Invalid sales data. Expected an array of sales." });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ index: number; orderNumber: string; error: string }>,
      };

      for (let i = 0; i < salesData.length; i++) {
        const saleData = salesData[i];
        try {
          // Validate required fields
          if (!saleData.orderNumber && !saleData.total) {
            results.failed++;
            results.errors.push({
              index: i + 1,
              orderNumber: saleData.orderNumber || 'N/A',
              error: "Missing required fields: orderNumber or total",
            });
            continue;
          }

          // Prepare order data
          const orderData: any = {
            orderNumber: saleData.orderNumber || undefined, // Will be generated if not provided
            customerName: saleData.customerName || "Walk-in Customer",
            customerPhone: saleData.customerPhone || null,
            subtotal: saleData.subtotal || saleData.total || "0",
            discount: saleData.discount || "0",
            discountType: "amount",
            total: saleData.total || saleData.subtotal || "0",
            paymentMethod: saleData.paymentMethod || "cash",
            paymentStatus: saleData.paymentStatus || "paid",
            status: saleData.status || "completed",
            diningOption: saleData.diningOption || "dine-in",
            orderSource: "import",
          };

          // Set createdAt if provided
          if (saleData.createdAt) {
            orderData.createdAt = new Date(saleData.createdAt);
          }

          // Set completedAt if status is completed
          if (orderData.status === "completed") {
            orderData.completedAt = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
          }

          // Set paidAmount based on payment status
          if (orderData.paymentStatus === "paid") {
            orderData.paidAmount = orderData.total;
          } else {
            orderData.paidAmount = "0";
          }

          // Create the order
          await storage.createOrder(orderData);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            index: i + 1,
            orderNumber: saleData.orderNumber || 'N/A',
            error: error.message || "Unknown error",
          });
        }
      }

      res.json({
        message: `Import completed: ${results.success} successful, ${results.failed} failed`,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to import sales", message: error.message });
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

  app.get("/api/sales/summary", async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const summary = await storage.getSalesSummary(startDate, endDate);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales summary" });
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
      const { branchId } = req.query;
      const expenses = await storage.getExpenses(branchId as string | undefined);
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
      const { branchId } = req.query;
      const purchases = await storage.getPurchases(branchId as string | undefined);
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

  app.get("/api/inventory/adjustments", async (req, res) => {
    try {
      const { productId } = req.query;
      const adjustments = productId
        ? await storage.getInventoryAdjustmentsByProduct(productId as string)
        : await storage.getInventoryAdjustments();
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory adjustments" });
    }
  });

  app.get("/api/inventory/low-stock", async (req, res) => {
    try {
      const threshold = parseInt(req.query.threshold as string) || 10;
      const lowStockProducts = await storage.getLowStockProducts(threshold);
      res.json(lowStockProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });

  app.post("/api/inventory/adjustments", async (req, res) => {
    try {
      const validatedData = insertInventoryAdjustmentSchema.parse(req.body);
      const adjustment = await storage.createInventoryAdjustment(validatedData);
      res.status(201).json(adjustment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid adjustment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create inventory adjustment" });
    }
  });

  app.get("/api/employees", async (req, res) => {
    try {
      const { branchId } = req.query;
      const employees = await storage.getEmployees(branchId as string | undefined);
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

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid user data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Roles routes
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", async (req, res) => {
    try {
      const { insertRoleSchema } = await import("@shared/schema");
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid role data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", async (req, res) => {
    try {
      const role = await storage.updateRole(req.params.id, req.body);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRole(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Permissions routes
  app.get("/api/permissions", async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.get("/api/permissions/:id", async (req, res) => {
    try {
      const permission = await storage.getPermission(req.params.id);
      if (!permission) {
        return res.status(404).json({ error: "Permission not found" });
      }
      res.json(permission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permission" });
    }
  });

  app.get("/api/permissions/category/:category", async (req, res) => {
    try {
      const permissions = await storage.getPermissionsByCategory(req.params.category);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/permissions", async (req, res) => {
    try {
      const { insertPermissionSchema } = await import("@shared/schema");
      const validatedData = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(validatedData);
      res.status(201).json(permission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid permission data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create permission" });
    }
  });

  app.patch("/api/permissions/:id", async (req, res) => {
    try {
      const permission = await storage.updatePermission(req.params.id, req.body);
      if (!permission) {
        return res.status(404).json({ error: "Permission not found" });
      }
      res.json(permission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update permission" });
    }
  });

  app.delete("/api/permissions/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePermission(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Permission not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete permission" });
    }
  });

  // Role-Permissions routes
  app.get("/api/roles/:roleId/permissions", async (req, res) => {
    try {
      const permissions = await storage.getPermissionsForRole(req.params.roleId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/roles/:roleId/permissions", async (req, res) => {
    try {
      const { permissionIds } = req.body;
      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "permissionIds must be an array" });
      }
      await storage.setRolePermissions(req.params.roleId, permissionIds);
      const permissions = await storage.getPermissionsForRole(req.params.roleId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to set role permissions" });
    }
  });

  app.get("/api/branches", async (req, res) => {
    try {
      const branches = await storage.getBranches();
      const branchesWithoutPasswords = branches.map(({ password, ...branch }) => branch);
      res.json(branchesWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.get("/api/branches/:id", async (req, res) => {
    try {
      const branch = await storage.getBranch(req.params.id);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      const { password, ...branchWithoutPassword } = branch;
      res.json(branchWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branch" });
    }
  });

  app.post("/api/branches", async (req, res) => {
    try {
      const validatedData = insertBranchSchema.parse(req.body);
      
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const branch = await storage.createBranch({
        ...validatedData,
        password: hashedPassword,
      });
      
      const { password, ...branchWithoutPassword } = branch;
      res.status(201).json(branchWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid branch data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  app.patch("/api/branches/:id", async (req, res) => {
    try {
      let updateData = { ...req.body };
      
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
      
      const branch = await storage.updateBranch(req.params.id, updateData);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      
      const { password, ...branchWithoutPassword } = branch;
      res.json(branchWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBranch(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  app.get("/api/payment-adjustments", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const adjustments = await storage.getPaymentAdjustments(branchId);
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment adjustments" });
    }
  });

  app.post("/api/payment-adjustments", async (req, res) => {
    try {
      const validatedData = insertPaymentAdjustmentSchema.parse(req.body);
      const adjustment = await storage.createPaymentAdjustment(validatedData);
      res.status(201).json(adjustment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid adjustment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create payment adjustment" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const customers = await storage.getCustomers(branchId);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  app.get("/api/due/payments", async (req, res) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const payments = await storage.getDuePayments(customerId, branchId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/due/payments", async (req, res) => {
    try {
      const { allocations, ...paymentData } = req.body;
      
      if (!allocations || !Array.isArray(allocations)) {
        return res.status(400).json({ error: "Allocations array is required" });
      }
      
      const validatedPayment = insertDuePaymentSchema.parse(paymentData);
      
      const payment = await storage.recordPaymentWithAllocations(
        validatedPayment,
        allocations
      );
      
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  app.get("/api/due/payments/:id/allocations", async (req, res) => {
    try {
      const allocations = await storage.getDuePaymentAllocations(req.params.id);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment allocations" });
    }
  });

  app.get("/api/due/customers-summary", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const summary = await storage.getAllCustomersDueSummary(branchId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers summary" });
    }
  });

  app.get("/api/due/customers/:id/summary", async (req, res) => {
    try {
      const summary = await storage.getCustomerDueSummary(req.params.id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer summary" });
    }
  });

  app.post("/api/due/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/due/customers/:id", async (req, res) => {
    try {
      const updates = req.body;
      const customer = await storage.updateCustomer(req.params.id, updates);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // File upload endpoint for logo and favicon
  app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Return the file URL - use relative path that will be served by static middleware
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error: any) {
      if (error.message === "Only image files are allowed") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to upload file" });
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
