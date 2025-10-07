import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  purchaseCost: decimal("purchase_cost", { precision: 10, scale: 2 }),
  categoryId: varchar("category_id").notNull(),
  imageUrl: text("image_url"),
  unit: text("unit").notNull().default("piece"),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableNumber: text("table_number").notNull().unique(),
  capacity: text("capacity"),
  description: text("description"),
  status: text("status").notNull().default("available"),
});

export const insertTableSchema = createInsertSchema(tables).omit({
  id: true,
});

export type InsertTable = z.infer<typeof insertTableSchema>;
export type Table = typeof tables.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  tableId: varchar("table_id"),
  diningOption: text("dining_option").notNull().default("dine-in"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  orderSource: text("order_source").notNull().default("pos"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type").notNull().default("amount"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
});

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseDate: timestamp("expense_date").notNull(),
  categoryId: varchar("category_id").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
}).extend({
  expenseDate: z.coerce.date(),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url"),
  categoryId: varchar("category_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
}).extend({
  purchaseDate: z.coerce.date(),
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  department: text("department").notNull(),
  email: text("email"),
  phone: text("phone"),
  joiningDate: timestamp("joining_date").notNull(),
  salary: decimal("salary", { precision: 10, scale: 2 }).notNull(),
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
}).extend({
  joiningDate: z.coerce.date(),
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  date: timestamp("date").notNull(),
  checkIn: text("check_in"),
  checkOut: text("check_out"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.coerce.date(),
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export const leaves = pgTable("leaves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveType: text("leave_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertLeaveSchema = createInsertSchema(leaves).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leaves.$inferSelect;

export const payroll = pgTable("payroll", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  month: text("month").notNull(),
  year: text("year").notNull(),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 10, scale: 2 }).notNull().default("0"),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).notNull().default("0"),
  netSalary: decimal("net_salary", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPayrollSchema = createInsertSchema(payroll).omit({
  id: true,
  createdAt: true,
});

export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type Payroll = typeof payroll.$inferSelect;

export const staffSalaries = pgTable("staff_salaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  salaryDate: timestamp("salary_date").notNull(),
  salaryAmount: decimal("salary_amount", { precision: 10, scale: 2 }).notNull(),
  deductSalary: decimal("deduct_salary", { precision: 10, scale: 2 }).notNull().default("0"),
  totalSalary: decimal("total_salary", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffSalarySchema = createInsertSchema(staffSalaries).omit({
  id: true,
  createdAt: true,
}).extend({
  salaryDate: z.coerce.date(),
});

export type InsertStaffSalary = z.infer<typeof insertStaffSalarySchema>;
export type StaffSalary = typeof staffSalaries.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: text("business_name").notNull().default("BondPos POS"),
  businessLogo: text("business_logo"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  dateFormat: text("date_format").notNull().default("dd-mm-yyyy"),
  timeFormat: text("time_format").notNull().default("12h"),
  terminalId: text("terminal_id"),
  
  paymentCash: text("payment_cash").notNull().default("true"),
  paymentCard: text("payment_card").notNull().default("true"),
  paymentAba: text("payment_aba").notNull().default("true"),
  paymentAcleda: text("payment_acleda").notNull().default("true"),
  paymentCredit: text("payment_credit").notNull().default("true"),
  defaultPaymentMethod: text("default_payment_method").notNull().default("cash"),
  minTransactionAmount: decimal("min_transaction_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  maxTransactionAmount: decimal("max_transaction_amount", { precision: 10, scale: 2 }),
  
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  serviceTaxRate: decimal("service_tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  defaultDiscount: decimal("default_discount", { precision: 5, scale: 2 }).notNull().default("0"),
  enablePercentageDiscount: text("enable_percentage_discount").notNull().default("true"),
  enableFixedDiscount: text("enable_fixed_discount").notNull().default("true"),
  maxDiscount: decimal("max_discount", { precision: 5, scale: 2 }).notNull().default("50"),
  
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  receiptHeader: text("receipt_header"),
  receiptFooter: text("receipt_footer"),
  receiptLogo: text("receipt_logo"),
  autoPrintReceipt: text("auto_print_receipt").notNull().default("false"),
  showLogoOnReceipt: text("show_logo_on_receipt").notNull().default("true"),
  includeTaxBreakdown: text("include_tax_breakdown").notNull().default("true"),
  
  receiptPrinter: text("receipt_printer").notNull().default("default"),
  kitchenPrinter: text("kitchen_printer").notNull().default("none"),
  paperSize: text("paper_size").notNull().default("80mm"),
  enableBarcodeScanner: text("enable_barcode_scanner").notNull().default("false"),
  enableCashDrawer: text("enable_cash_drawer").notNull().default("true"),
  
  currency: text("currency").notNull().default("usd"),
  language: text("language").notNull().default("en"),
  decimalPlaces: text("decimal_places").notNull().default("2"),
  roundingRule: text("rounding_rule").notNull().default("nearest"),
  currencySymbolPosition: text("currency_symbol_position").notNull().default("before"),
  
  autoBackup: text("auto_backup").notNull().default("true"),
  backupFrequency: text("backup_frequency").notNull().default("daily"),
  backupStorage: text("backup_storage").notNull().default("cloud"),
  
  lowStockAlerts: text("low_stock_alerts").notNull().default("true"),
  stockThreshold: integer("stock_threshold").notNull().default(10),
  saleNotifications: text("sale_notifications").notNull().default("false"),
  discountAlerts: text("discount_alerts").notNull().default("false"),
  systemUpdateNotifications: text("system_update_notifications").notNull().default("true"),
  notificationEmail: text("notification_email"),
  
  colorTheme: text("color_theme").notNull().default("orange"),
  layoutPreference: text("layout_preference").notNull().default("grid"),
  fontSize: text("font_size").notNull().default("medium"),
  compactMode: text("compact_mode").notNull().default("false"),
  showAnimations: text("show_animations").notNull().default("true"),
  
  permAccessReports: text("perm_access_reports").notNull().default("true"),
  permAccessSettings: text("perm_access_settings").notNull().default("false"),
  permProcessRefunds: text("perm_process_refunds").notNull().default("false"),
  permManageInventory: text("perm_manage_inventory").notNull().default("true"),
  
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
