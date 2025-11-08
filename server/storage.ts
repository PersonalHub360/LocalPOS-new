import {
  type Product,
  type InsertProduct,
  type Category,
  type InsertCategory,
  type Table,
  type InsertTable,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Expense,
  type InsertExpense,
  type Purchase,
  type InsertPurchase,
  type Employee,
  type InsertEmployee,
  type Attendance,
  type InsertAttendance,
  type Leave,
  type InsertLeave,
  type Payroll,
  type InsertPayroll,
  type StaffSalary,
  type InsertStaffSalary,
  type Settings,
  type InsertSettings,
  type User,
  type InsertUser,
  type InventoryAdjustment,
  type InsertInventoryAdjustment,
  type Branch,
  type InsertBranch,
  type PaymentAdjustment,
  type InsertPaymentAdjustment,
  type Customer,
  type InsertCustomer,
  type DuePayment,
  type InsertDuePayment,
  type DuePaymentAllocation,
  type InsertDuePaymentAllocation,
  categories,
  products,
  tables,
  orders,
  orderItems,
  expenseCategories,
  expenses,
  purchases,
  employees,
  attendance,
  leaves,
  payroll,
  staffSalaries,
  settings,
  inventoryAdjustments,
  users,
  branches,
  paymentAdjustments,
  orderCounters,
  customers,
  duePayments,
  duePaymentAllocations,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, sql, isNull, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  getProducts(branchId?: string | null): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByCategory(categoryId: string, branchId?: string | null): Promise<Product[]>;
  getProductByName(name: string, excludeId?: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getTables(branchId?: string | null): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: string, table: Partial<InsertTable>): Promise<Table | undefined>;
  updateTableStatus(id: string, status: string): Promise<Table | undefined>;
  deleteTable(id: string): Promise<boolean>;
  
  getOrders(branchId?: string | null): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getDraftOrders(branchId?: string | null): Promise<Order[]>;
  getQROrders(branchId?: string | null): Promise<Order[]>;
  getCompletedOrders(branchId?: string | null): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithItems(order: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  deleteOrderItems(orderId: string): Promise<boolean>;
  getOrderItemsWithProducts(orderId: string): Promise<(OrderItem & { product: Product })[]>;
  getTableCurrentOrder(tableId: string): Promise<Order | undefined>;
  
  getDashboardStats(startDate: Date, endDate: Date): Promise<{
    todaySales: number;
    todayOrders: number;
    totalRevenue: number;
    totalOrders: number;
    totalExpenses: number;
    profitLoss: number;
    totalPurchase: number;
  }>;
  getSalesByCategory(startDate: Date, endDate: Date): Promise<Array<{ category: string; revenue: number }>>;
  getSalesByPaymentMethod(startDate: Date, endDate: Date): Promise<Array<{ paymentMethod: string; amount: number }>>;
  getPopularProducts(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>>;
  getSalesSummary(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>>;
  getRecentOrders(startDate: Date, endDate: Date): Promise<Order[]>;
  
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string): Promise<boolean>;
  
  getExpenses(branchId?: string | null): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getPurchases(branchId?: string | null): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  updatePurchase(id: string, purchase: Partial<InsertPurchase>): Promise<Purchase | undefined>;
  deletePurchase(id: string): Promise<boolean>;
  
  getEmployees(branchId?: string | null): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  
  getAttendance(): Promise<Attendance[]>;
  getAttendanceByDate(date: Date): Promise<Attendance[]>;
  getAttendanceByEmployee(employeeId: string): Promise<Attendance[]>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, attendance: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;
  
  getLeaves(): Promise<Leave[]>;
  getLeave(id: string): Promise<Leave | undefined>;
  getLeavesByEmployee(employeeId: string): Promise<Leave[]>;
  createLeave(leave: InsertLeave): Promise<Leave>;
  updateLeave(id: string, leave: Partial<InsertLeave>): Promise<Leave | undefined>;
  deleteLeave(id: string): Promise<boolean>;
  
  getPayroll(): Promise<Payroll[]>;
  getPayrollById(id: string): Promise<Payroll | undefined>;
  getPayrollByEmployee(employeeId: string): Promise<Payroll[]>;
  createPayroll(payroll: InsertPayroll): Promise<Payroll>;
  updatePayroll(id: string, payroll: Partial<InsertPayroll>): Promise<Payroll | undefined>;
  deletePayroll(id: string): Promise<boolean>;
  
  getStaffSalaries(): Promise<StaffSalary[]>;
  getStaffSalary(id: string): Promise<StaffSalary | undefined>;
  createStaffSalary(salary: InsertStaffSalary): Promise<StaffSalary>;
  updateStaffSalary(id: string, salary: Partial<InsertStaffSalary>): Promise<StaffSalary | undefined>;
  deleteStaffSalary(id: string): Promise<boolean>;
  
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  getInventoryAdjustments(): Promise<InventoryAdjustment[]>;
  getInventoryAdjustment(id: string): Promise<InventoryAdjustment | undefined>;
  getInventoryAdjustmentsByProduct(productId: string): Promise<InventoryAdjustment[]>;
  createInventoryAdjustment(adjustment: InsertInventoryAdjustment): Promise<InventoryAdjustment>;
  getLowStockProducts(threshold: number): Promise<Product[]>;
  
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  validateUserCredentials(username: string, password: string): Promise<User | null>;
  validateBranchCredentials(username: string, password: string): Promise<Branch | null>;
  
  getBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  getBranchByName(name: string): Promise<Branch | undefined>;
  getBranchByUsername(username: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: string, branch: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;
  
  getPaymentAdjustments(branchId?: string | null): Promise<PaymentAdjustment[]>;
  createPaymentAdjustment(adjustment: InsertPaymentAdjustment): Promise<PaymentAdjustment>;
  
  getCustomers(branchId?: string | null): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string, branchId?: string | null): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  
  getDuePayments(customerId?: string, branchId?: string | null): Promise<DuePayment[]>;
  getDuePayment(id: string): Promise<DuePayment | undefined>;
  createDuePayment(payment: InsertDuePayment): Promise<DuePayment>;
  updateDuePayment(id: string, payment: Partial<InsertDuePayment>): Promise<DuePayment | undefined>;
  deleteDuePayment(id: string): Promise<boolean>;
  
  getDuePaymentAllocations(paymentId?: string, orderId?: string): Promise<DuePaymentAllocation[]>;
  createDuePaymentAllocation(allocation: InsertDuePaymentAllocation): Promise<DuePaymentAllocation>;
  
  recordPaymentWithAllocations(
    payment: InsertDuePayment,
    allocations: { orderId: string; amount: number }[]
  ): Promise<DuePayment>;
  
  getCustomerDueSummary(customerId: string): Promise<{
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }>;
  
  getAllCustomersDueSummary(branchId?: string | null): Promise<Array<{
    customer: Customer;
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  private readonly ORDER_COUNTER_ID = 'order-counter';

  private async getNextOrderNumber(): Promise<string> {
    return await db.transaction(async (tx) => {
      await tx
        .insert(orderCounters)
        .values({ id: this.ORDER_COUNTER_ID, counterValue: 0 })
        .onConflictDoNothing();
      
      const counters = await tx
        .select()
        .from(orderCounters)
        .where(eq(orderCounters.id, this.ORDER_COUNTER_ID))
        .for('update');
      
      const newValue = counters[0].counterValue + 1;
      const result = await tx
        .update(orderCounters)
        .set({ counterValue: newValue })
        .where(eq(orderCounters.id, this.ORDER_COUNTER_ID))
        .returning();
      
      return result[0].counterValue.toString();
    });
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(insertCategory).returning();
    return result[0];
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return result[0];
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getProducts(branchId?: string | null): Promise<Product[]> {
    if (branchId) {
      // Return products with matching branchId OR NULL branchId (global products)
      return await db.select().from(products)
        .where(or(eq(products.branchId, branchId), isNull(products.branchId)));
    }
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductsByCategory(categoryId: string, branchId?: string | null): Promise<Product[]> {
    if (branchId) {
      // Return products with matching category and (matching branchId OR NULL branchId)
      return await db.select().from(products)
        .where(and(
          eq(products.categoryId, categoryId),
          or(eq(products.branchId, branchId), isNull(products.branchId))
        ));
    }
    return await db.select().from(products).where(eq(products.categoryId, categoryId));
  }

  async getProductByName(name: string, excludeId?: string): Promise<Product | undefined> {
    if (excludeId) {
      const result = await db.select().from(products)
        .where(and(
          eq(products.name, name),
          sql`${products.id} != ${excludeId}`
        ));
      return result[0];
    }
    const result = await db.select().from(products).where(eq(products.name, name));
    return result[0];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTables(branchId?: string | null): Promise<Table[]> {
    if (branchId) {
      return await db.select().from(tables).where(
        or(
          eq(tables.branchId, branchId),
          isNull(tables.branchId)
        )
      );
    }
    return await db.select().from(tables);
  }

  async getTable(id: string): Promise<Table | undefined> {
    const result = await db.select().from(tables).where(eq(tables.id, id));
    return result[0];
  }

  async createTable(insertTable: InsertTable): Promise<Table> {
    const result = await db.insert(tables).values(insertTable).returning();
    return result[0];
  }

  async updateTable(id: string, updates: Partial<InsertTable>): Promise<Table | undefined> {
    const result = await db.update(tables).set(updates).where(eq(tables.id, id)).returning();
    return result[0];
  }

  async updateTableStatus(id: string, status: string): Promise<Table | undefined> {
    const result = await db.update(tables).set({ status }).where(eq(tables.id, id)).returning();
    return result[0];
  }

  async deleteTable(id: string): Promise<boolean> {
    const result = await db.delete(tables).where(eq(tables.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getOrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders).where(eq(orders.branchId, branchId)).orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getDraftOrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders)
        .where(and(eq(orders.status, 'draft'), eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(eq(orders.status, 'draft')).orderBy(desc(orders.createdAt));
  }

  async getQROrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders)
        .where(and(eq(orders.status, 'qr-pending'), eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(eq(orders.status, 'qr-pending')).orderBy(desc(orders.createdAt));
  }

  async getCompletedOrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders)
        .where(and(eq(orders.status, 'completed'), eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(eq(orders.status, 'completed')).orderBy(desc(orders.createdAt));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderNumber = await this.getNextOrderNumber();
    const orderWithNumber = {
      ...insertOrder,
      orderNumber,
    };
    const result = await db.insert(orders).values(orderWithNumber).returning();
    return result[0];
  }

  async createOrderWithItems(insertOrder: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const orderNumber = await this.getNextOrderNumber();
      let orderData = {
        ...insertOrder,
        orderNumber,
      };
      
      // If payment status is "due", create or find customer
      if (insertOrder.paymentStatus === 'due' && insertOrder.customerName) {
        // Try to find existing customer by name
        const existingCustomer = await tx
          .select()
          .from(customers)
          .where(eq(customers.name, insertOrder.customerName))
          .limit(1);
        
        let customerId: string;
        
        if (existingCustomer.length > 0) {
          customerId = existingCustomer[0].id;
        } else {
          // Create new customer
          const newCustomerResult = await tx
            .insert(customers)
            .values({
              name: insertOrder.customerName,
              phone: insertOrder.customerPhone || null,
              email: null,
              branchId: insertOrder.branchId || null,
              notes: null,
            })
            .returning();
          customerId = newCustomerResult[0].id;
        }
        
        // Set customer-related fields for due orders
        orderData = {
          ...orderData,
          customerId,
          dueAmount: insertOrder.total,
          paidAmount: '0',
        };
      }
      
      const result = await tx.insert(orders).values(orderData).returning();
      const newOrder = result[0];

      if (items.length > 0) {
        const orderItemsWithOrderId = items.map(item => ({
          ...item,
          orderId: newOrder.id,
        }));
        await tx.insert(orderItems).values(orderItemsWithOrderId);
      }

      return newOrder;
    });
  }

  async updateOrder(id: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    const result = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    const result = await db.delete(orders).where(eq(orders.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(insertOrderItem).returning();
    return result[0];
  }

  async deleteOrderItems(orderId: string): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getOrderItemsWithProducts(orderId: string): Promise<(OrderItem & { product: Product })[]> {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await this.getProduct(item.productId);
        if (!product) {
          // Return a placeholder product if the actual product is deleted
          return {
            ...item,
            product: {
              id: item.productId,
              name: "Deleted Product",
              description: null,
              price: item.price,
              purchaseCost: null,
              categoryId: "",
              branchId: null,
              imageUrl: null,
              unit: "piece",
              quantity: "0",
              createdAt: new Date(),
            } as Product,
          };
        }
        return {
          ...item,
          product,
        };
      })
    );

    return itemsWithProducts;
  }

  async getTableCurrentOrder(tableId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders)
      .where(and(
        eq(orders.tableId, tableId),
        or(eq(orders.status, 'draft'), eq(orders.status, 'confirmed'))
      ))
      .orderBy(desc(orders.createdAt));
    return result[0];
  }

  async getDashboardStats(startDate: Date, endDate: Date): Promise<{
    todaySales: number;
    todayOrders: number;
    totalRevenue: number;
    totalOrders: number;
    totalExpenses: number;
    profitLoss: number;
    totalPurchase: number;
  }> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const todaySales = completedOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalSales = completedOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalDiscount = completedOrders.reduce((sum, order) => sum + parseFloat(order.discount), 0);

    const allPurchases = await db.select().from(purchases)
      .where(and(
        gte(purchases.purchaseDate, startDate),
        lte(purchases.purchaseDate, endDate)
      ));

    const totalPurchaseCost = allPurchases.reduce((sum, purchase) => {
      return sum + (parseFloat(purchase.price) * parseFloat(purchase.quantity));
    }, 0);

    const totalRevenue = totalSales - (totalPurchaseCost + totalDiscount);

    const allExpenses = await db.select().from(expenses)
      .where(and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      ));

    const totalExpenses = allExpenses.reduce((sum, expense) => sum + parseFloat(expense.total), 0);
    const profitLoss = totalRevenue - totalExpenses;

    const allOrders = await db.select().from(orders).where(eq(orders.status, 'completed'));

    return {
      todaySales,
      todayOrders: completedOrders.length,
      totalRevenue,
      totalOrders: allOrders.length,
      totalExpenses,
      profitLoss,
      totalPurchase: totalPurchaseCost,
    };
  }

  async getSalesByCategory(startDate: Date, endDate: Date): Promise<Array<{ category: string; revenue: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const categoryRevenue = new Map<string, number>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const category = await this.getCategory(product.categoryId);
          if (category) {
            const current = categoryRevenue.get(category.name) || 0;
            categoryRevenue.set(category.name, current + parseFloat(item.total));
          }
        }
      }
    }

    return Array.from(categoryRevenue.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getSalesByPaymentMethod(startDate: Date, endDate: Date): Promise<Array<{ paymentMethod: string; amount: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const paymentMethodTotals = new Map<string, number>();

    for (const order of completedOrders) {
      const paymentMethod = order.paymentMethod || 'Not specified';
      const current = paymentMethodTotals.get(paymentMethod) || 0;
      paymentMethodTotals.set(paymentMethod, current + parseFloat(order.total));
    }

    return Array.from(paymentMethodTotals.entries())
      .map(([paymentMethod, amount]) => ({ paymentMethod, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  async getPopularProducts(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const current = productStats.get(product.id) || { name: product.name, quantity: 0, revenue: 0 };
          productStats.set(product.id, {
            name: product.name,
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + parseFloat(item.total),
          });
        }
      }
    }

    return Array.from(productStats.values())
      .map(({ name, quantity, revenue }) => ({ product: name, quantity, revenue }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  async getSalesSummary(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const current = productStats.get(product.id) || { name: product.name, quantity: 0, revenue: 0 };
          productStats.set(product.id, {
            name: product.name,
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + parseFloat(item.total),
          });
        }
      }
    }

    return Array.from(productStats.values())
      .map(({ name, quantity, revenue }) => ({ product: name, quantity, revenue }))
      .sort((a, b) => a.product.localeCompare(b.product));
  }

  async getRecentOrders(startDate: Date, endDate: Date): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ))
      .orderBy(desc(orders.createdAt))
      .limit(10);
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories);
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    const result = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
    return result[0];
  }

  async createExpenseCategory(insertCategory: InsertExpenseCategory): Promise<ExpenseCategory> {
    const result = await db.insert(expenseCategories).values(insertCategory).returning();
    return result[0];
  }

  async updateExpenseCategory(id: string, updates: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const result = await db.update(expenseCategories).set(updates).where(eq(expenseCategories.id, id)).returning();
    return result[0];
  }

  async deleteExpenseCategory(id: string): Promise<boolean> {
    const result = await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getExpenses(branchId?: string | null): Promise<Expense[]> {
    if (branchId) {
      return await db.select().from(expenses).where(eq(expenses.branchId, branchId));
    }
    return await db.select().from(expenses);
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses).where(eq(expenses.id, id));
    return result[0];
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const result = await db.insert(expenses).values(insertExpense).returning();
    return result[0];
  }

  async updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const result = await db.update(expenses).set(updates).where(eq(expenses.id, id)).returning();
    return result[0];
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPurchases(branchId?: string | null): Promise<Purchase[]> {
    if (branchId) {
      return await db.select().from(purchases).where(eq(purchases.branchId, branchId));
    }
    return await db.select().from(purchases);
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    const result = await db.select().from(purchases).where(eq(purchases.id, id));
    return result[0];
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const result = await db.insert(purchases).values(insertPurchase).returning();
    const purchase = result[0];
    
    if (insertPurchase.productId) {
      const product = await this.getProduct(insertPurchase.productId);
      if (product) {
        const currentQty = parseFloat(product.quantity);
        const purchasedQty = parseFloat(insertPurchase.quantity);
        const newQty = currentQty + purchasedQty;
        
        await db.update(products)
          .set({ quantity: newQty.toString() })
          .where(eq(products.id, insertPurchase.productId));
        
        await db.insert(inventoryAdjustments).values({
          productId: insertPurchase.productId,
          adjustmentType: "add",
          quantity: purchasedQty.toString(),
          reason: "purchase",
          notes: `Automatic addition from purchase - ${insertPurchase.itemName}`,
          performedBy: null,
        });
      }
    }
    
    return purchase;
  }

  async updatePurchase(id: string, updates: Partial<InsertPurchase>): Promise<Purchase | undefined> {
    const purchase = await this.getPurchase(id);
    if (!purchase) return undefined;
    
    if (purchase.productId && updates.quantity !== undefined) {
      const product = await this.getProduct(purchase.productId);
      if (product) {
        const oldQty = parseFloat(purchase.quantity);
        const newQty = parseFloat(updates.quantity);
        const delta = newQty - oldQty;
        
        if (delta !== 0) {
          const currentInventory = parseFloat(product.quantity);
          const newInventory = Math.max(0, currentInventory + delta);
          
          await db.update(products)
            .set({ quantity: newInventory.toString() })
            .where(eq(products.id, purchase.productId));
          
          await db.insert(inventoryAdjustments).values({
            productId: purchase.productId,
            adjustmentType: delta > 0 ? "add" : "remove",
            quantity: Math.abs(delta).toString(),
            reason: "purchase",
            notes: `Adjustment from purchase update - ${purchase.itemName} (changed from ${oldQty} to ${newQty})`,
            performedBy: null,
          });
        }
      }
    }
    
    const result = await db.update(purchases).set(updates).where(eq(purchases.id, id)).returning();
    return result[0];
  }

  async deletePurchase(id: string): Promise<boolean> {
    const purchase = await this.getPurchase(id);
    if (!purchase) return false;
    
    if (purchase.productId) {
      const product = await this.getProduct(purchase.productId);
      if (product) {
        const purchasedQty = parseFloat(purchase.quantity);
        const currentInventory = parseFloat(product.quantity);
        const newInventory = Math.max(0, currentInventory - purchasedQty);
        
        await db.update(products)
          .set({ quantity: newInventory.toString() })
          .where(eq(products.id, purchase.productId));
        
        await db.insert(inventoryAdjustments).values({
          productId: purchase.productId,
          adjustmentType: "remove",
          quantity: purchasedQty.toString(),
          reason: "purchase",
          notes: `Reversal from purchase deletion - ${purchase.itemName}`,
          performedBy: null,
        });
      }
    }
    
    const result = await db.delete(purchases).where(eq(purchases.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getEmployees(branchId?: string | null): Promise<Employee[]> {
    if (branchId) {
      return await db.select().from(employees).where(eq(employees.branchId, branchId));
    }
    return await db.select().from(employees);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const result = await db.insert(employees).values(insertEmployee).returning();
    return result[0];
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return result[0];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAttendance(): Promise<Attendance[]> {
    return await db.select().from(attendance);
  }

  async getAttendanceByDate(date: Date): Promise<Attendance[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.select().from(attendance)
      .where(and(
        gte(attendance.date, startOfDay),
        lte(attendance.date, endOfDay)
      ));
  }

  async getAttendanceByEmployee(employeeId: string): Promise<Attendance[]> {
    return await db.select().from(attendance).where(eq(attendance.employeeId, employeeId));
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const result = await db.insert(attendance).values(insertAttendance).returning();
    return result[0];
  }

  async updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const result = await db.update(attendance).set(updates).where(eq(attendance.id, id)).returning();
    return result[0];
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const result = await db.delete(attendance).where(eq(attendance.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getLeaves(): Promise<Leave[]> {
    return await db.select().from(leaves);
  }

  async getLeave(id: string): Promise<Leave | undefined> {
    const result = await db.select().from(leaves).where(eq(leaves.id, id));
    return result[0];
  }

  async getLeavesByEmployee(employeeId: string): Promise<Leave[]> {
    return await db.select().from(leaves).where(eq(leaves.employeeId, employeeId));
  }

  async createLeave(insertLeave: InsertLeave): Promise<Leave> {
    const result = await db.insert(leaves).values(insertLeave).returning();
    return result[0];
  }

  async updateLeave(id: string, updates: Partial<InsertLeave>): Promise<Leave | undefined> {
    const result = await db.update(leaves).set(updates).where(eq(leaves.id, id)).returning();
    return result[0];
  }

  async deleteLeave(id: string): Promise<boolean> {
    const result = await db.delete(leaves).where(eq(leaves.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPayroll(): Promise<Payroll[]> {
    return await db.select().from(payroll);
  }

  async getPayrollById(id: string): Promise<Payroll | undefined> {
    const result = await db.select().from(payroll).where(eq(payroll.id, id));
    return result[0];
  }

  async getPayrollByEmployee(employeeId: string): Promise<Payroll[]> {
    return await db.select().from(payroll).where(eq(payroll.employeeId, employeeId));
  }

  async createPayroll(insertPayroll: InsertPayroll): Promise<Payroll> {
    const result = await db.insert(payroll).values(insertPayroll).returning();
    return result[0];
  }

  async updatePayroll(id: string, updates: Partial<InsertPayroll>): Promise<Payroll | undefined> {
    const result = await db.update(payroll).set(updates).where(eq(payroll.id, id)).returning();
    return result[0];
  }

  async deletePayroll(id: string): Promise<boolean> {
    const result = await db.delete(payroll).where(eq(payroll.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getStaffSalaries(): Promise<StaffSalary[]> {
    return await db.select().from(staffSalaries);
  }

  async getStaffSalary(id: string): Promise<StaffSalary | undefined> {
    const result = await db.select().from(staffSalaries).where(eq(staffSalaries.id, id));
    return result[0];
  }

  async createStaffSalary(insertSalary: InsertStaffSalary): Promise<StaffSalary> {
    const result = await db.insert(staffSalaries).values(insertSalary).returning();
    return result[0];
  }

  async updateStaffSalary(id: string, updates: Partial<InsertStaffSalary>): Promise<StaffSalary | undefined> {
    const result = await db.update(staffSalaries).set(updates).where(eq(staffSalaries.id, id)).returning();
    return result[0];
  }

  async deleteStaffSalary(id: string): Promise<boolean> {
    const result = await db.delete(staffSalaries).where(eq(staffSalaries.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getSettings(): Promise<Settings | undefined> {
    const result = await db.select().from(settings).limit(1);
    if (result.length === 0) {
      const defaultSettings = await db.insert(settings).values({}).returning();
      return defaultSettings[0];
    }
    return result[0];
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    const current = await this.getSettings();
    if (!current) {
      const result = await db.insert(settings).values(updates).returning();
      return result[0];
    }
    
    const result = await db.update(settings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(settings.id, current.id))
      .returning();
    return result[0];
  }

  async getInventoryAdjustments(): Promise<InventoryAdjustment[]> {
    return await db.select().from(inventoryAdjustments).orderBy(desc(inventoryAdjustments.createdAt));
  }

  async getInventoryAdjustment(id: string): Promise<InventoryAdjustment | undefined> {
    const result = await db.select().from(inventoryAdjustments).where(eq(inventoryAdjustments.id, id));
    return result[0];
  }

  async getInventoryAdjustmentsByProduct(productId: string): Promise<InventoryAdjustment[]> {
    return await db.select().from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.productId, productId))
      .orderBy(desc(inventoryAdjustments.createdAt));
  }

  async createInventoryAdjustment(insertAdjustment: InsertInventoryAdjustment): Promise<InventoryAdjustment> {
    const result = await db.insert(inventoryAdjustments).values(insertAdjustment).returning();
    return result[0];
  }

  async getLowStockProducts(threshold: number): Promise<Product[]> {
    return await db.select().from(products)
      .where(sql`CAST(${products.quantity} AS DECIMAL) <= ${threshold}`);
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const userWithHashedPassword = {
      ...insertUser,
      password: hashedPassword,
    };
    const result = await db.insert(users).values(userWithHashedPassword).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async validateUserCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    return user;
  }

  async validateBranchCredentials(username: string, password: string): Promise<Branch | null> {
    const branch = await this.getBranchByUsername(username);
    if (!branch) return null;
    
    const isValid = await bcrypt.compare(password, branch.password);
    if (!isValid) return null;
    
    return branch;
  }

  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.id, id));
    return result[0];
  }

  async getBranchByName(name: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.name, name));
    return result[0];
  }

  async getBranchByUsername(username: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.username, username));
    return result[0];
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
    const hashedPassword = await bcrypt.hash(insertBranch.password, 10);
    const branchWithHashedPassword = {
      ...insertBranch,
      password: hashedPassword,
    };
    const result = await db.insert(branches).values(branchWithHashedPassword).returning();
    return result[0];
  }

  async updateBranch(id: string, updates: Partial<InsertBranch>): Promise<Branch | undefined> {
    const updateData = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(branches).set(updateData).where(eq(branches.id, id)).returning();
    return result[0];
  }

  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPaymentAdjustments(branchId?: string | null): Promise<PaymentAdjustment[]> {
    if (branchId) {
      return await db.select().from(paymentAdjustments)
        .where(eq(paymentAdjustments.branchId, branchId))
        .orderBy(desc(paymentAdjustments.createdAt));
    }
    return await db.select().from(paymentAdjustments).orderBy(desc(paymentAdjustments.createdAt));
  }

  async createPaymentAdjustment(insertAdjustment: InsertPaymentAdjustment): Promise<PaymentAdjustment> {
    const result = await db.insert(paymentAdjustments).values(insertAdjustment).returning();
    return result[0];
  }

  async getCustomers(branchId?: string | null): Promise<Customer[]> {
    if (branchId) {
      // Include customers with matching branchId OR NULL branchId (unassigned customers)
      return await db.select().from(customers)
        .where(or(
          eq(customers.branchId, branchId),
          isNull(customers.branchId)
        ))
        .orderBy(desc(customers.createdAt));
    }
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id));
    return result[0];
  }

  async getCustomerByPhone(phone: string, branchId?: string | null): Promise<Customer | undefined> {
    if (branchId) {
      const result = await db.select().from(customers)
        .where(and(eq(customers.phone, phone), eq(customers.branchId, branchId)));
      return result[0];
    }
    const result = await db.select().from(customers).where(eq(customers.phone, phone));
    return result[0];
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(insertCustomer).returning();
    return result[0];
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers).set(updates).where(eq(customers.id, id)).returning();
    return result[0];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getDuePayments(customerId?: string, branchId?: string | null): Promise<DuePayment[]> {
    let query = db.select().from(duePayments);
    
    if (customerId && branchId) {
      return await query.where(and(
        eq(duePayments.customerId, customerId),
        eq(duePayments.branchId, branchId)
      )).orderBy(desc(duePayments.paymentDate));
    }
    if (customerId) {
      return await query.where(eq(duePayments.customerId, customerId))
        .orderBy(desc(duePayments.paymentDate));
    }
    if (branchId) {
      return await query.where(eq(duePayments.branchId, branchId))
        .orderBy(desc(duePayments.paymentDate));
    }
    
    return await query.orderBy(desc(duePayments.paymentDate));
  }

  async getDuePayment(id: string): Promise<DuePayment | undefined> {
    const result = await db.select().from(duePayments).where(eq(duePayments.id, id));
    return result[0];
  }

  async createDuePayment(insertPayment: InsertDuePayment): Promise<DuePayment> {
    const result = await db.insert(duePayments).values(insertPayment).returning();
    return result[0];
  }

  async updateDuePayment(id: string, updates: Partial<InsertDuePayment>): Promise<DuePayment | undefined> {
    const result = await db.update(duePayments).set(updates).where(eq(duePayments.id, id)).returning();
    return result[0];
  }

  async deleteDuePayment(id: string): Promise<boolean> {
    const result = await db.delete(duePayments).where(eq(duePayments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getDuePaymentAllocations(paymentId?: string, orderId?: string): Promise<DuePaymentAllocation[]> {
    if (paymentId && orderId) {
      return await db.select().from(duePaymentAllocations)
        .where(and(
          eq(duePaymentAllocations.paymentId, paymentId),
          eq(duePaymentAllocations.orderId, orderId)
        ));
    }
    if (paymentId) {
      return await db.select().from(duePaymentAllocations)
        .where(eq(duePaymentAllocations.paymentId, paymentId));
    }
    if (orderId) {
      return await db.select().from(duePaymentAllocations)
        .where(eq(duePaymentAllocations.orderId, orderId));
    }
    return await db.select().from(duePaymentAllocations);
  }

  async createDuePaymentAllocation(insertAllocation: InsertDuePaymentAllocation): Promise<DuePaymentAllocation> {
    const result = await db.insert(duePaymentAllocations).values(insertAllocation).returning();
    return result[0];
  }

  async recordPaymentWithAllocations(
    payment: InsertDuePayment,
    allocations: { orderId: string; amount: number }[]
  ): Promise<DuePayment> {
    return await db.transaction(async (tx) => {
      const [createdPayment] = await tx.insert(duePayments).values(payment).returning();
      
      let totalAllocated = 0;
      
      for (const allocation of allocations) {
        await tx.insert(duePaymentAllocations).values({
          paymentId: createdPayment.id,
          orderId: allocation.orderId,
          amount: allocation.amount.toString(),
        });
        
        totalAllocated += allocation.amount;
        
        const [order] = await tx.select().from(orders).where(eq(orders.id, allocation.orderId));
        
        if (order) {
          const currentPaid = parseFloat(order.paidAmount || "0");
          const newPaidAmount = currentPaid + allocation.amount;
          const dueAmount = parseFloat(order.dueAmount || order.total);
          
          let newPaymentStatus = order.paymentStatus;
          if (newPaidAmount >= dueAmount) {
            newPaymentStatus = "paid";
          } else if (newPaidAmount > 0) {
            newPaymentStatus = "partial";
          }
          
          await tx.update(orders)
            .set({
              paidAmount: newPaidAmount.toString(),
              paymentStatus: newPaymentStatus,
            })
            .where(eq(orders.id, allocation.orderId));
        }
      }
      
      const unapplied = parseFloat(payment.amount) - totalAllocated;
      
      if (unapplied !== 0) {
        await tx.update(duePayments)
          .set({ unappliedAmount: unapplied.toString() })
          .where(eq(duePayments.id, createdPayment.id));
      }
      
      const [updatedPayment] = await tx.select().from(duePayments)
        .where(eq(duePayments.id, createdPayment.id));
      
      return updatedPayment;
    });
  }

  async getCustomerDueSummary(customerId: string): Promise<{
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }> {
    const dueOrders = await db.select().from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        or(
          eq(orders.paymentStatus, "due"),
          eq(orders.paymentStatus, "partial")
        )
      ));
    
    let totalDue = 0;
    let totalPaid = 0;
    
    for (const order of dueOrders) {
      const orderDue = parseFloat(order.dueAmount || order.total);
      const orderPaid = parseFloat(order.paidAmount || "0");
      totalDue += orderDue;
      totalPaid += orderPaid;
    }
    
    const payments = await this.getDuePayments(customerId);
    const credit = payments.reduce((sum, p) => sum + parseFloat(p.unappliedAmount || "0"), 0);
    
    return {
      totalDue,
      totalPaid,
      balance: totalDue - totalPaid,
      credit,
      ordersCount: dueOrders.length,
    };
  }

  async getAllCustomersDueSummary(branchId?: string | null): Promise<Array<{
    customer: Customer;
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }>> {
    const allCustomers = await this.getCustomers(branchId);
    const summaries = [];
    
    for (const customer of allCustomers) {
      const summary = await this.getCustomerDueSummary(customer.id);
      
      if (summary.ordersCount > 0 || summary.credit > 0) {
        summaries.push({
          customer,
          ...summary,
        });
      }
    }
    
    return summaries;
  }
}

export const storage = new DatabaseStorage();
