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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getTables(): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: string, table: Partial<InsertTable>): Promise<Table | undefined>;
  updateTableStatus(id: string, status: string): Promise<Table | undefined>;
  deleteTable(id: string): Promise<boolean>;
  
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getDraftOrders(): Promise<Order[]>;
  getQROrders(): Promise<Order[]>;
  getCompletedOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithItems(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  deleteOrderItems(orderId: string): Promise<boolean>;
  getOrderItemsWithProducts(orderId: string): Promise<(OrderItem & { product: Product })[]>;
  
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
  getRecentOrders(startDate: Date, endDate: Date): Promise<Order[]>;
  
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string): Promise<boolean>;
  
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getPurchases(): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  updatePurchase(id: string, purchase: Partial<InsertPurchase>): Promise<Purchase | undefined>;
  deletePurchase(id: string): Promise<boolean>;
  
  getEmployees(): Promise<Employee[]>;
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
}

export class MemStorage implements IStorage {
  private categories: Map<string, Category>;
  private products: Map<string, Product>;
  private tables: Map<string, Table>;
  private orders: Map<string, Order>;
  private orderItems: Map<string, OrderItem>;
  private expenseCategories: Map<string, ExpenseCategory>;
  private expenses: Map<string, Expense>;
  private purchases: Map<string, Purchase>;
  private employees: Map<string, Employee>;
  private attendance: Map<string, Attendance>;
  private leaves: Map<string, Leave>;
  private payroll: Map<string, Payroll>;
  private staffSalaries: Map<string, StaffSalary>;
  private settings: Settings | null;
  private orderCounter: number = 20;

  constructor() {
    this.categories = new Map();
    this.products = new Map();
    this.tables = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.expenseCategories = new Map();
    this.expenses = new Map();
    this.purchases = new Map();
    this.employees = new Map();
    this.attendance = new Map();
    this.leaves = new Map();
    this.payroll = new Map();
    this.staffSalaries = new Map();
    this.settings = null;
    this.seedData();
  }

  private seedData() {
    const categories: Category[] = [
      { id: "1", name: "Rice", slug: "rice" },
      { id: "2", name: "Beverages", slug: "beverages" },
      { id: "3", name: "Salads", slug: "salads" },
      { id: "4", name: "Soup", slug: "soup" },
      { id: "5", name: "Pizza", slug: "pizza" },
    ];

    categories.forEach((cat) => this.categories.set(cat.id, cat));

    const products: Product[] = [
      { id: "1", name: "Shrimp Basil Salad", price: "10.60", purchaseCost: null, categoryId: "3", imageUrl: null, unit: "plate", description: "Fresh shrimp with basil and greens", quantity: "50", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "2", name: "Onion Rings", price: "8.50", purchaseCost: null, categoryId: "2", imageUrl: null, unit: "serving", description: "Crispy fried onion rings", quantity: "100", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "3", name: "Smoked Bacon", price: "12.00", purchaseCost: null, categoryId: "3", imageUrl: null, unit: "serving", description: "Premium smoked bacon strips", quantity: "75", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "4", name: "Fresh Tomatoes", price: "9.50", purchaseCost: null, categoryId: "3", imageUrl: null, unit: "kg", description: "Organic fresh tomatoes", quantity: "25", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "5", name: "Chicken Burger", price: "10.50", purchaseCost: null, categoryId: "4", imageUrl: null, unit: "piece", description: "Juicy grilled chicken burger", quantity: "60", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "6", name: "Red Onion Rings", price: "8.50", purchaseCost: null, categoryId: "2", imageUrl: null, unit: "serving", description: "Red onion rings with special sauce", quantity: "80", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "7", name: "Beef Burger", price: "10.50", purchaseCost: null, categoryId: "4", imageUrl: null, unit: "piece", description: "Classic beef burger with cheese", quantity: "55", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "8", name: "Grilled Burger", price: "10.50", purchaseCost: null, categoryId: "4", imageUrl: null, unit: "piece", description: "Premium grilled burger", quantity: "45", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "9", name: "Fresh Basil Salad", price: "8.50", purchaseCost: null, categoryId: "3", imageUrl: null, unit: "plate", description: "Garden fresh basil salad", quantity: "70", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "10", name: "Vegetable Pizza", price: "15.00", purchaseCost: null, categoryId: "5", imageUrl: null, unit: "piece", description: "Mixed vegetable pizza", quantity: "40", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "11", name: "Fish & Chips", price: "12.50", purchaseCost: null, categoryId: "4", imageUrl: null, unit: "serving", description: "Crispy fish with fries", quantity: "35", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "12", name: "Fried Rice", price: "9.00", purchaseCost: null, categoryId: "1", imageUrl: null, unit: "plate", description: "Classic fried rice", quantity: "90", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "13", name: "Biryani Rice", price: "11.00", purchaseCost: null, categoryId: "1", imageUrl: null, unit: "plate", description: "Aromatic biryani rice", quantity: "65", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "14", name: "Chicken Rice", price: "10.00", purchaseCost: null, categoryId: "1", imageUrl: null, unit: "plate", description: "Tender chicken with rice", quantity: "85", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "15", name: "Caesar Salad", price: "9.50", purchaseCost: null, categoryId: "3", imageUrl: null, unit: "plate", description: "Classic caesar salad", quantity: "55", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "16", name: "Greek Salad", price: "10.00", purchaseCost: null, categoryId: "3", imageUrl: null, unit: "plate", description: "Traditional greek salad", quantity: "50", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "17", name: "Tomato Soup", price: "6.50", purchaseCost: null, categoryId: "4", imageUrl: null, unit: "bowl", description: "Creamy tomato soup", quantity: "100", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "18", name: "Mushroom Soup", price: "7.00", purchaseCost: null, categoryId: "4", imageUrl: null, unit: "bowl", description: "Rich mushroom soup", quantity: "95", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "19", name: "Margherita Pizza", price: "14.00", purchaseCost: null, categoryId: "5", imageUrl: null, unit: "piece", description: "Classic margherita pizza", quantity: "42", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "20", name: "Pepperoni Pizza", price: "16.00", purchaseCost: null, categoryId: "5", imageUrl: null, unit: "piece", description: "Spicy pepperoni pizza", quantity: "38", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "21", name: "Orange Juice", price: "4.50", purchaseCost: null, categoryId: "2", imageUrl: null, unit: "glass", description: "Fresh orange juice", quantity: "120", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "22", name: "Mango Juice", price: "4.50", purchaseCost: null, categoryId: "2", imageUrl: null, unit: "glass", description: "Sweet mango juice", quantity: "110", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "23", name: "Coffee", price: "3.50", purchaseCost: null, categoryId: "2", imageUrl: null, unit: "cup", description: "Fresh brewed coffee", quantity: "200", createdAt: new Date("2025-10-01T10:00:00") },
      { id: "24", name: "Green Tea", price: "3.00", purchaseCost: null, categoryId: "2", imageUrl: null, unit: "cup", description: "Organic green tea", quantity: "150", createdAt: new Date("2025-10-01T10:00:00") },
    ];

    products.forEach((prod) => this.products.set(prod.id, prod));

    const tables: Table[] = [
      { id: "1", tableNumber: "1", capacity: "4", description: "Window seat table", status: "available" },
      { id: "2", tableNumber: "2", capacity: "2", description: "Small corner table", status: "available" },
      { id: "3", tableNumber: "3", capacity: "6", description: "Large family table", status: "available" },
      { id: "4", tableNumber: "4", capacity: "4", description: "Center table", status: "available" },
      { id: "5", tableNumber: "5", capacity: "2", description: "Quiet corner", status: "available" },
      { id: "6", tableNumber: "6", capacity: "8", description: "Party table", status: "available" },
      { id: "7", tableNumber: "7", capacity: "4", description: "Near entrance", status: "available" },
      { id: "8", tableNumber: "8", capacity: "4", description: "Outdoor patio", status: "available" },
    ];

    tables.forEach((table) => this.tables.set(table.id, table));

    const employees: Employee[] = [
      { id: "1", employeeId: "EMP001", name: "John Smith", position: "Manager", department: "Admin", email: "john.smith@restrobit.com", phone: "+1234567890", joiningDate: new Date("2024-01-15"), salary: "5000.00", photoUrl: null, status: "active", createdAt: new Date("2024-01-15") },
      { id: "2", employeeId: "EMP002", name: "Sarah Johnson", position: "Head Chef", department: "Kitchen", email: "sarah.johnson@restrobit.com", phone: "+1234567891", joiningDate: new Date("2024-02-01"), salary: "4500.00", photoUrl: null, status: "active", createdAt: new Date("2024-02-01") },
      { id: "3", employeeId: "EMP003", name: "Michael Chen", position: "Sous Chef", department: "Kitchen", email: "michael.chen@restrobit.com", phone: "+1234567892", joiningDate: new Date("2024-03-10"), salary: "3500.00", photoUrl: null, status: "active", createdAt: new Date("2024-03-10") },
      { id: "4", employeeId: "EMP004", name: "Emma Wilson", position: "Waitress", department: "Service", email: "emma.wilson@restrobit.com", phone: "+1234567893", joiningDate: new Date("2024-04-05"), salary: "2500.00", photoUrl: null, status: "active", createdAt: new Date("2024-04-05") },
      { id: "5", employeeId: "EMP005", name: "David Martinez", position: "Waiter", department: "Service", email: "david.martinez@restrobit.com", phone: "+1234567894", joiningDate: new Date("2024-04-20"), salary: "2500.00", photoUrl: null, status: "active", createdAt: new Date("2024-04-20") },
      { id: "6", employeeId: "EMP006", name: "Lisa Anderson", position: "Receptionist", department: "Reception", email: "lisa.anderson@restrobit.com", phone: "+1234567895", joiningDate: new Date("2024-05-01"), salary: "2800.00", photoUrl: null, status: "active", createdAt: new Date("2024-05-01") },
      { id: "7", employeeId: "EMP007", name: "Robert Taylor", position: "Accountant", department: "Finance", email: "robert.taylor@restrobit.com", phone: "+1234567896", joiningDate: new Date("2024-06-15"), salary: "4000.00", photoUrl: null, status: "active", createdAt: new Date("2024-06-15") },
      { id: "8", employeeId: "EMP008", name: "Jennifer Lee", position: "HR Manager", department: "HR", email: "jennifer.lee@restrobit.com", phone: "+1234567897", joiningDate: new Date("2024-07-01"), salary: "4200.00", photoUrl: null, status: "active", createdAt: new Date("2024-07-01") },
    ];

    employees.forEach((emp) => this.employees.set(emp.id, emp));

    const sampleOrders: Order[] = [
      {
        id: "sale-1",
        orderNumber: "1",
        tableId: "1",
        diningOption: "dine-in",
        customerName: "John Smith",
        customerPhone: null,
        orderSource: "pos",
        subtotal: "45.50",
        discount: "5.00",
        discountType: "amount",
        total: "40.50",
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: "cash",
        createdAt: new Date("2025-10-06T10:30:00"),
        completedAt: new Date("2025-10-06T10:45:00"),
      },
      {
        id: "sale-2",
        orderNumber: "2",
        tableId: null,
        diningOption: "takeaway",
        customerName: "Sarah Johnson",
        customerPhone: null,
        orderSource: "pos",
        subtotal: "32.00",
        discount: "0.00",
        discountType: "amount",
        total: "32.00",
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: "card",
        createdAt: new Date("2025-10-06T11:15:00"),
        completedAt: new Date("2025-10-06T11:30:00"),
      },
      {
        id: "sale-3",
        orderNumber: "3",
        tableId: "3",
        diningOption: "dine-in",
        customerName: "Michael Brown",
        customerPhone: null,
        orderSource: "pos",
        subtotal: "68.75",
        discount: "10.00",
        discountType: "amount",
        total: "58.75",
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: "aba",
        createdAt: new Date("2025-10-06T12:00:00"),
        completedAt: new Date("2025-10-06T12:20:00"),
      },
      {
        id: "sale-4",
        orderNumber: "4",
        tableId: null,
        diningOption: "delivery",
        customerName: "Emily Davis",
        customerPhone: null,
        orderSource: "pos",
        subtotal: "55.20",
        discount: "0.00",
        discountType: "amount",
        total: "55.20",
        status: "confirmed",
        paymentStatus: "pending",
        paymentMethod: null,
        createdAt: new Date("2025-10-06T13:45:00"),
        completedAt: null,
      },
      {
        id: "sale-5",
        orderNumber: "5",
        tableId: "5",
        diningOption: "dine-in",
        customerName: null,
        customerPhone: null,
        orderSource: "pos",
        subtotal: "28.50",
        discount: "2.00",
        discountType: "amount",
        total: "26.50",
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: "cash",
        createdAt: new Date("2025-10-06T14:20:00"),
        completedAt: new Date("2025-10-06T14:35:00"),
      },
      {
        id: "qr-order-1",
        orderNumber: "6",
        tableId: "2",
        diningOption: "dine-in",
        customerName: "James Wilson",
        customerPhone: "+1234567890",
        orderSource: "qr",
        subtotal: "42.00",
        discount: "0.00",
        discountType: "amount",
        total: "42.00",
        status: "qr-pending",
        paymentStatus: "pending",
        paymentMethod: null,
        createdAt: new Date(),
        completedAt: null,
      },
      {
        id: "qr-order-2",
        orderNumber: "7",
        tableId: "4",
        diningOption: "dine-in",
        customerName: "Linda Martinez",
        customerPhone: "+1234567891",
        orderSource: "qr",
        subtotal: "67.50",
        discount: "0.00",
        discountType: "amount",
        total: "67.50",
        status: "qr-pending",
        paymentStatus: "pending",
        paymentMethod: null,
        createdAt: new Date(),
        completedAt: null,
      },
      {
        id: "qr-order-3",
        orderNumber: "8",
        tableId: null,
        diningOption: "takeaway",
        customerName: "Robert Chen",
        customerPhone: "+1234567892",
        orderSource: "qr",
        subtotal: "28.00",
        discount: "0.00",
        discountType: "amount",
        total: "28.00",
        status: "qr-pending",
        paymentStatus: "pending",
        paymentMethod: null,
        createdAt: new Date(),
        completedAt: null,
      },
    ];

    sampleOrders.forEach((order) => this.orders.set(order.id, order));
    this.orderCounter = 9;

    const qrOrderItems: OrderItem[] = [
      { id: randomUUID(), orderId: "qr-order-1", productId: "5", quantity: 2, price: "10.50", total: "21.00" },
      { id: randomUUID(), orderId: "qr-order-1", productId: "10", quantity: 1, price: "15.00", total: "15.00" },
      { id: randomUUID(), orderId: "qr-order-1", productId: "21", quantity: 2, price: "4.50", total: "9.00" },
      
      { id: randomUUID(), orderId: "qr-order-2", productId: "1", quantity: 2, price: "10.60", total: "21.20" },
      { id: randomUUID(), orderId: "qr-order-2", productId: "7", quantity: 3, price: "10.50", total: "31.50" },
      { id: randomUUID(), orderId: "qr-order-2", productId: "23", quantity: 2, price: "3.50", total: "7.00" },
      { id: randomUUID(), orderId: "qr-order-2", productId: "24", quantity: 1, price: "3.00", total: "3.00" },
      
      { id: randomUUID(), orderId: "qr-order-3", productId: "12", quantity: 2, price: "9.00", total: "18.00" },
      { id: randomUUID(), orderId: "qr-order-3", productId: "22", quantity: 2, price: "4.50", total: "9.00" },
    ];

    qrOrderItems.forEach((item) => this.orderItems.set(item.id, item));

    const expenseCategories: ExpenseCategory[] = [
      { id: "exp-cat-1", name: "Office Supplies", description: "Stationery, printing, and office materials" },
      { id: "exp-cat-2", name: "Travel", description: "Transportation and travel expenses" },
      { id: "exp-cat-3", name: "Utilities", description: "Electricity, water, and internet" },
      { id: "exp-cat-4", name: "Food & Ingredients", description: "Raw materials and ingredients for kitchen" },
      { id: "exp-cat-5", name: "Maintenance", description: "Repairs and maintenance" },
    ];

    expenseCategories.forEach((cat) => this.expenseCategories.set(cat.id, cat));

    const sampleExpenses: Expense[] = [
      {
        id: "exp-1",
        expenseDate: new Date("2025-10-06T09:00:00"),
        categoryId: "exp-cat-4",
        description: "Fresh vegetables and meat",
        amount: "250.00",
        unit: "Kg",
        quantity: "15.5",
        total: "250.00",
        createdAt: new Date("2025-10-06T09:00:00"),
      },
      {
        id: "exp-2",
        expenseDate: new Date("2025-10-05T14:30:00"),
        categoryId: "exp-cat-3",
        description: "Monthly electricity bill",
        amount: "450.00",
        unit: "Unit",
        quantity: "1",
        total: "450.00",
        createdAt: new Date("2025-10-05T14:30:00"),
      },
      {
        id: "exp-3",
        expenseDate: new Date("2025-10-04T11:15:00"),
        categoryId: "exp-cat-1",
        description: "Printer paper and ink",
        amount: "85.50",
        unit: "Box",
        quantity: "3",
        total: "85.50",
        createdAt: new Date("2025-10-04T11:15:00"),
      },
    ];

    sampleExpenses.forEach((expense) => this.expenses.set(expense.id, expense));

    // Sample purchases
    const samplePurchases: Purchase[] = [
      {
        id: "purchase-1",
        imageUrl: null,
        categoryId: "4",
        itemName: "Fresh Vegetables",
        quantity: "50",
        unit: "Kg",
        price: "5.00",
        purchaseDate: new Date("2025-10-06T08:00:00"),
        createdAt: new Date("2025-10-06T08:00:00"),
      },
      {
        id: "purchase-2",
        imageUrl: null,
        categoryId: "4",
        itemName: "Chicken Meat",
        quantity: "30",
        unit: "Kg",
        price: "8.50",
        purchaseDate: new Date("2025-10-05T09:30:00"),
        createdAt: new Date("2025-10-05T09:30:00"),
      },
      {
        id: "purchase-3",
        imageUrl: null,
        categoryId: "1",
        itemName: "Rice",
        quantity: "100",
        unit: "Kg",
        price: "2.50",
        purchaseDate: new Date("2025-10-04T10:00:00"),
        createdAt: new Date("2025-10-04T10:00:00"),
      },
    ];

    samplePurchases.forEach((purchase) => this.purchases.set(purchase.id, purchase));
  }

  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const category: Category = { ...insertCategory, id };
    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;
    const updated = { ...category, ...updates };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const exists = this.categories.has(id);
    if (!exists) return false;
    this.categories.delete(id);
    return true;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.categoryId === categoryId
    );
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = { 
      ...insertProduct, 
      id, 
      purchaseCost: insertProduct.purchaseCost ?? null,
      imageUrl: insertProduct.imageUrl ?? null,
      description: insertProduct.description ?? null,
      unit: insertProduct.unit ?? "piece",
      quantity: insertProduct.quantity ?? "0",
      createdAt: new Date(),
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    const updated = { ...product, ...updates };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const exists = this.products.has(id);
    if (!exists) return false;
    this.products.delete(id);
    return true;
  }

  async getTables(): Promise<Table[]> {
    return Array.from(this.tables.values());
  }

  async getTable(id: string): Promise<Table | undefined> {
    return this.tables.get(id);
  }

  async createTable(insertTable: InsertTable): Promise<Table> {
    const id = randomUUID();
    const table: Table = { 
      ...insertTable, 
      id, 
      capacity: insertTable.capacity ?? null,
      description: insertTable.description ?? null,
      status: insertTable.status ?? "available" 
    };
    this.tables.set(id, table);
    return table;
  }

  async updateTable(id: string, updates: Partial<InsertTable>): Promise<Table | undefined> {
    const table = this.tables.get(id);
    if (!table) return undefined;
    const updated = { ...table, ...updates };
    this.tables.set(id, updated);
    return updated;
  }

  async updateTableStatus(id: string, status: string): Promise<Table | undefined> {
    const table = this.tables.get(id);
    if (!table) return undefined;
    const updated = { ...table, status };
    this.tables.set(id, updated);
    return updated;
  }

  async deleteTable(id: string): Promise<boolean> {
    const exists = this.tables.has(id);
    if (!exists) return false;
    this.tables.delete(id);
    return true;
  }

  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getDraftOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === "draft");
  }

  async getQROrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.orderSource === "qr" && order.status === "qr-pending");
  }

  async getCompletedOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === "completed");
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const orderNumber = `${this.orderCounter++}`;
    const order: Order = {
      ...insertOrder,
      id,
      orderNumber,
      discountType: insertOrder.discountType ?? "amount",
      createdAt: new Date(),
      completedAt: null,
      status: insertOrder.status ?? "draft",
      diningOption: insertOrder.diningOption ?? "dine-in",
      discount: insertOrder.discount ?? "0",
      tableId: insertOrder.tableId ?? null,
      customerName: insertOrder.customerName ?? null,
      customerPhone: insertOrder.customerPhone ?? null,
      orderSource: insertOrder.orderSource ?? "pos",
      paymentStatus: insertOrder.paymentStatus ?? "pending",
      paymentMethod: insertOrder.paymentMethod ?? null,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated = { ...order, ...updates };
    this.orders.set(id, updated);
    return updated;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated = { ...order, status };
    this.orders.set(id, updated);
    return updated;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const exists = this.orders.has(id);
    if (!exists) return false;
    this.orders.delete(id);
    const orderItems = Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === id
    );
    orderItems.forEach((item) => this.orderItems.delete(item.id));
    return true;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === orderId
    );
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = randomUUID();
    const orderItem: OrderItem = { ...insertOrderItem, id };
    this.orderItems.set(id, orderItem);
    return orderItem;
  }

  async createOrderWithItems(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const order = await this.createOrder(insertOrder);
    for (const item of items) {
      await this.createOrderItem({ ...item, orderId: order.id });
    }
    return order;
  }

  async deleteOrderItems(orderId: string): Promise<boolean> {
    const items = await this.getOrderItems(orderId);
    items.forEach((item) => this.orderItems.delete(item.id));
    return true;
  }

  async getOrderItemsWithProducts(
    orderId: string
  ): Promise<(OrderItem & { product: Product })[]> {
    const items = await this.getOrderItems(orderId);
    return items
      .map((item) => {
        const product = this.products.get(item.productId);
        if (!product) return null;
        return { ...item, product };
      })
      .filter((item): item is OrderItem & { product: Product } => item !== null);
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
    const orders = Array.from(this.orders.values());
    const completedOrders = orders.filter(order => order.status === 'completed');
    
    const filteredOrders = completedOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const todaySales = filteredOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    
    // Calculate total sales from date-filtered completed orders
    const totalSales = filteredOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);

    // Calculate total discount from date-filtered completed orders
    const totalDiscount = filteredOrders.reduce((sum, order) => sum + parseFloat(order.discount), 0);

    // Calculate total purchase cost from Purchase Management for the date range
    const purchases = Array.from(this.purchases.values()).filter(purchase => {
      const purchaseDate = new Date(purchase.purchaseDate);
      return purchaseDate >= startDate && purchaseDate <= endDate;
    });
    const totalPurchaseCost = purchases.reduce((sum, purchase) => {
      return sum + (parseFloat(purchase.price) * parseFloat(purchase.quantity));
    }, 0);

    // Calculate Total Revenue = Total Sales - (Purchase Cost + Discount)
    const totalRevenue = totalSales - (totalPurchaseCost + totalDiscount);

    // Calculate total expenses for the date range (Expense Management only)
    const expenses = Array.from(this.expenses.values()).filter(expense => {
      const expenseDate = new Date(expense.expenseDate);
      return expenseDate >= startDate && expenseDate <= endDate;
    });
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.total), 0);

    // Calculate Profit/Loss = Total Revenue - Total Expenses
    const profitLoss = totalRevenue - totalExpenses;

    return {
      todaySales,
      todayOrders: filteredOrders.length,
      totalRevenue,
      totalOrders: completedOrders.length,
      totalExpenses,
      profitLoss,
      totalPurchase: totalPurchaseCost, // Same as purchase cost from Purchase Management
    };
  }

  async getSalesByCategory(startDate: Date, endDate: Date): Promise<Array<{ category: string; revenue: number }>> {
    const orders = Array.from(this.orders.values()).filter(order => {
      if (order.status !== 'completed') return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    const categoryRevenue = new Map<string, number>();

    for (const order of orders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = this.products.get(item.productId);
        if (product) {
          const category = this.categories.get(product.categoryId);
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
    const filteredOrders = Array.from(this.orders.values()).filter(order => {
      if (order.status !== 'completed') return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const paymentMethodTotals = new Map<string, number>();

    for (const order of filteredOrders) {
      const paymentMethod = order.paymentMethod || 'Not specified';
      const current = paymentMethodTotals.get(paymentMethod) || 0;
      paymentMethodTotals.set(paymentMethod, current + parseFloat(order.total));
    }

    return Array.from(paymentMethodTotals.entries())
      .map(([paymentMethod, amount]) => ({ paymentMethod, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  async getPopularProducts(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>> {
    const orders = Array.from(this.orders.values()).filter(order => {
      if (order.status !== 'completed') return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of orders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = this.products.get(item.productId);
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

  async getRecentOrders(startDate: Date, endDate: Date): Promise<Order[]> {
    const orders = Array.from(this.orders.values())
      .filter(order => {
        if (order.status !== 'completed') return false;
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    return orders;
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return Array.from(this.expenseCategories.values());
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    return this.expenseCategories.get(id);
  }

  async createExpenseCategory(insertCategory: InsertExpenseCategory): Promise<ExpenseCategory> {
    const id = randomUUID();
    const category: ExpenseCategory = { ...insertCategory, id, description: insertCategory.description ?? null };
    this.expenseCategories.set(id, category);
    return category;
  }

  async updateExpenseCategory(id: string, updates: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const category = this.expenseCategories.get(id);
    if (!category) return undefined;
    const updated = { ...category, ...updates };
    this.expenseCategories.set(id, updated);
    return updated;
  }

  async deleteExpenseCategory(id: string): Promise<boolean> {
    const exists = this.expenseCategories.has(id);
    if (!exists) return false;
    this.expenseCategories.delete(id);
    return true;
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values());
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = { ...insertExpense, id, createdAt: new Date() };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const expense = this.expenses.get(id);
    if (!expense) return undefined;
    const updated = { ...expense, ...updates };
    this.expenses.set(id, updated);
    return updated;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const exists = this.expenses.has(id);
    if (!exists) return false;
    this.expenses.delete(id);
    return true;
  }

  async getPurchases(): Promise<Purchase[]> {
    return Array.from(this.purchases.values());
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    return this.purchases.get(id);
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const id = randomUUID();
    const purchase: Purchase = {
      ...insertPurchase,
      id,
      imageUrl: insertPurchase.imageUrl ?? null,
      createdAt: new Date(),
    };
    this.purchases.set(id, purchase);
    return purchase;
  }

  async updatePurchase(id: string, updates: Partial<InsertPurchase>): Promise<Purchase | undefined> {
    const purchase = this.purchases.get(id);
    if (!purchase) return undefined;
    const updated = { ...purchase, ...updates };
    this.purchases.set(id, updated);
    return updated;
  }

  async deletePurchase(id: string): Promise<boolean> {
    const exists = this.purchases.has(id);
    if (!exists) return false;
    this.purchases.delete(id);
    return true;
  }

  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employee: Employee = {
      ...insertEmployee,
      id,
      photoUrl: insertEmployee.photoUrl ?? null,
      email: insertEmployee.email ?? null,
      phone: insertEmployee.phone ?? null,
      status: insertEmployee.status ?? "active",
      createdAt: new Date(),
    };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    const updated = { ...employee, ...updates };
    this.employees.set(id, updated);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const exists = this.employees.has(id);
    if (!exists) return false;
    this.employees.delete(id);
    return true;
  }

  async getAttendance(): Promise<Attendance[]> {
    return Array.from(this.attendance.values());
  }

  async getAttendanceByDate(date: Date): Promise<Attendance[]> {
    const targetDate = new Date(date).toDateString();
    return Array.from(this.attendance.values()).filter((att) => {
      return new Date(att.date).toDateString() === targetDate;
    });
  }

  async getAttendanceByEmployee(employeeId: string): Promise<Attendance[]> {
    return Array.from(this.attendance.values()).filter((att) => att.employeeId === employeeId);
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const id = randomUUID();
    const attendance: Attendance = {
      ...insertAttendance,
      id,
      checkIn: insertAttendance.checkIn ?? null,
      checkOut: insertAttendance.checkOut ?? null,
      createdAt: new Date(),
    };
    this.attendance.set(id, attendance);
    return attendance;
  }

  async updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const attendance = this.attendance.get(id);
    if (!attendance) return undefined;
    const updated = { ...attendance, ...updates };
    this.attendance.set(id, updated);
    return updated;
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const exists = this.attendance.has(id);
    if (!exists) return false;
    this.attendance.delete(id);
    return true;
  }

  async getLeaves(): Promise<Leave[]> {
    return Array.from(this.leaves.values());
  }

  async getLeave(id: string): Promise<Leave | undefined> {
    return this.leaves.get(id);
  }

  async getLeavesByEmployee(employeeId: string): Promise<Leave[]> {
    return Array.from(this.leaves.values()).filter((leave) => leave.employeeId === employeeId);
  }

  async createLeave(insertLeave: InsertLeave): Promise<Leave> {
    const id = randomUUID();
    const leave: Leave = {
      ...insertLeave,
      id,
      reason: insertLeave.reason ?? null,
      status: insertLeave.status ?? "pending",
      createdAt: new Date(),
    };
    this.leaves.set(id, leave);
    return leave;
  }

  async updateLeave(id: string, updates: Partial<InsertLeave>): Promise<Leave | undefined> {
    const leave = this.leaves.get(id);
    if (!leave) return undefined;
    const updated = { ...leave, ...updates };
    this.leaves.set(id, updated);
    return updated;
  }

  async deleteLeave(id: string): Promise<boolean> {
    const exists = this.leaves.has(id);
    if (!exists) return false;
    this.leaves.delete(id);
    return true;
  }

  async getPayroll(): Promise<Payroll[]> {
    return Array.from(this.payroll.values());
  }

  async getPayrollById(id: string): Promise<Payroll | undefined> {
    return this.payroll.get(id);
  }

  async getPayrollByEmployee(employeeId: string): Promise<Payroll[]> {
    return Array.from(this.payroll.values()).filter((pay) => pay.employeeId === employeeId);
  }

  async createPayroll(insertPayroll: InsertPayroll): Promise<Payroll> {
    const id = randomUUID();
    const payroll: Payroll = {
      ...insertPayroll,
      id,
      bonus: insertPayroll.bonus ?? "0",
      deductions: insertPayroll.deductions ?? "0",
      status: insertPayroll.status ?? "pending",
      createdAt: new Date(),
    };
    this.payroll.set(id, payroll);
    return payroll;
  }

  async updatePayroll(id: string, updates: Partial<InsertPayroll>): Promise<Payroll | undefined> {
    const payroll = this.payroll.get(id);
    if (!payroll) return undefined;
    const updated = { ...payroll, ...updates };
    this.payroll.set(id, updated);
    return updated;
  }

  async deletePayroll(id: string): Promise<boolean> {
    const exists = this.payroll.has(id);
    if (!exists) return false;
    this.payroll.delete(id);
    return true;
  }

  async getStaffSalaries(): Promise<StaffSalary[]> {
    return Array.from(this.staffSalaries.values());
  }

  async getStaffSalary(id: string): Promise<StaffSalary | undefined> {
    return this.staffSalaries.get(id);
  }

  async createStaffSalary(insertSalary: InsertStaffSalary): Promise<StaffSalary> {
    const id = randomUUID();
    const salary: StaffSalary = {
      ...insertSalary,
      id,
      deductSalary: insertSalary.deductSalary ?? "0",
      createdAt: new Date(),
    };
    this.staffSalaries.set(id, salary);
    return salary;
  }

  async updateStaffSalary(id: string, updates: Partial<InsertStaffSalary>): Promise<StaffSalary | undefined> {
    const salary = this.staffSalaries.get(id);
    if (!salary) return undefined;
    const updated = { ...salary, ...updates };
    this.staffSalaries.set(id, updated);
    return updated;
  }

  async deleteStaffSalary(id: string): Promise<boolean> {
    const exists = this.staffSalaries.has(id);
    if (!exists) return false;
    this.staffSalaries.delete(id);
    return true;
  }

  async getSettings(): Promise<Settings | undefined> {
    if (this.settings === null) {
      const defaultSettings: Settings = {
        id: randomUUID(),
        businessName: "BondPos POS",
        businessLogo: null,
        address: null,
        phone: null,
        email: null,
        dateFormat: "dd-mm-yyyy",
        timeFormat: "12h",
        terminalId: null,
        paymentCash: "true",
        paymentCard: "true",
        paymentAba: "true",
        paymentAcleda: "true",
        paymentCredit: "true",
        defaultPaymentMethod: "cash",
        minTransactionAmount: "0",
        maxTransactionAmount: null,
        vatRate: "0",
        serviceTaxRate: "0",
        defaultDiscount: "0",
        enablePercentageDiscount: "true",
        enableFixedDiscount: "true",
        maxDiscount: "50",
        invoicePrefix: "INV-",
        receiptHeader: null,
        receiptFooter: null,
        receiptLogo: null,
        autoPrintReceipt: "false",
        showLogoOnReceipt: "true",
        includeTaxBreakdown: "true",
        receiptPrinter: "default",
        kitchenPrinter: "none",
        paperSize: "80mm",
        enableBarcodeScanner: "false",
        enableCashDrawer: "true",
        currency: "usd",
        language: "en",
        decimalPlaces: "2",
        roundingRule: "nearest",
        currencySymbolPosition: "before",
        autoBackup: "true",
        backupFrequency: "daily",
        backupStorage: "cloud",
        lowStockAlerts: "true",
        stockThreshold: 10,
        saleNotifications: "false",
        discountAlerts: "false",
        systemUpdateNotifications: "true",
        notificationEmail: null,
        colorTheme: "orange",
        layoutPreference: "grid",
        fontSize: "medium",
        compactMode: "false",
        showAnimations: "true",
        permAccessReports: "true",
        permAccessSettings: "false",
        permProcessRefunds: "false",
        permManageInventory: "true",
        updatedAt: new Date(),
      };
      this.settings = defaultSettings;
    }
    return this.settings;
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    if (this.settings === null) {
      await this.getSettings();
    }
    this.settings = {
      ...this.settings!,
      ...updates,
      updatedAt: new Date(),
    };
    return this.settings;
  }
}

export const storage = new MemStorage();
