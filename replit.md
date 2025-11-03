# BondPos POS System

## Overview
BondPos is a comprehensive Point of Sale (POS) system designed for restaurants to streamline operations, enhance efficiency, and improve customer service. It offers robust features for product catalog management, real-time order processing, table tracking, secure payment handling, and human resource management. The system includes a complete POS order workflow, detailed item and purchase management, and a full-featured reporting suite. Its modern, vibrant UI with a glassmorphic design prioritizes user experience and transactional safety, aiming to provide a powerful and intuitive solution for restaurant management.

## User Preferences
- Clean, professional UI matching modern POS systems
- Fast, efficient order processing workflow
- Touch-friendly interface for tablet use

## System Architecture

### UI/UX Decisions
The system features a vibrant, modern UI with a multi-color palette (Blue, Purple, Green) and a contemporary glassmorphic design. It incorporates a gradient header, a dark blue-gray sidebar, and subtle gradient backgrounds. Typography uses Inter for UI text and Roboto Mono for numerical displays. Shadcn UI components, styled with an orange accent, are utilized for a responsive design optimized for tablet and desktop use. The Login page features a professional blue split-screen design with a sign-in form and feature icons grid.

### Technical Implementations
- **Frontend**: Built with React, TypeScript, React hooks, and TanStack Query for state management. Styling uses Tailwind CSS and Shadcn UI.
- **Backend**: Developed with Express and TypeScript.
- **Authentication**: Session-based authentication using `express-session` with PostgreSQL session store (`connect-pg-simple`) and `bcrypt` for password hashing. Sessions persist across restarts and republishing. All API routes are secured.
- **Database**: PostgreSQL database with Drizzle ORM for persistent storage. All data persists across application restarts and republishing.
- **Order Counter**: Race-condition-free implementation using dedicated `orderCounters` table with row-level locking (`SELECT ... FOR UPDATE`), well-known singleton ID ('order-counter'), and atomic `ON CONFLICT DO NOTHING` upsert to guarantee unique, monotonically increasing order numbers even under concurrent load.
- **API**: Provides RESTful APIs for managing products, categories, orders, tables, items, purchases, employees, and authentication. Backend returns JSON error responses with `{error: "message"}` format for consistent frontend error handling.
- **Core Workflows**: Includes a complete POS order workflow with draft management, receipt printing, and multiple payment methods. Comprehensive CRUD operations are supported across all management modules.
- **Permissions**: Role-based permissions system with granular controls.
- **Cache Invalidation**: React Query cache invalidation ensures real-time UI updates across POS, Purchase, Inventory, Dashboard, and Reporting modules upon relevant data changes.
- **Error Handling**: Frontend `apiRequest` function parses backend JSON error responses and extracts user-friendly messages for toast notifications. Toast system uses Shadcn UI with fixed React hook implementation for proper state management.

### Feature Specifications
- **Authentication**: Secure login, session management, and protected API routes.
- **POS Order Workflow**: Supports draft saving, editing, diverse payment methods (Cash, Card, ABA, Acleda, Due, Cash And ABA, Cash And Acleda), split payments, and receipt generation. Payment modal includes optional customer name field for better order tracking in Due Management. When "Cash And ABA" or "Cash And Acleda" is selected, the payment modal automatically triggers split payment mode, allowing users to specify the exact amounts for each payment method. Both payment methods are then displayed separately in the Sales List.
- **Sales Management**: Displays complete order history with detailed item breakdowns, comprehensive reports (Detailed Sales Report, Sales Summary Report) with filtering, editing, printing, and export capabilities (Excel, PDF).
- **Item Management**: CRUD for items and categories, image management, search, filtering, and bulk import/export (Excel/CSV). Comprehensive duplicate name validation with specific error messages ("Already uploaded" for creating duplicates, "Duplicate name" for updating to an existing name, "Already updated" for no-change updates). Bulk import includes per-row duplicate detection and error reporting. Features bulk delete functionality with individual item checkboxes, Select All option displaying selection count, and concurrent deletion using Promise.all for efficient multi-item removal.
- **Expense Management**: Full CRUD for expenses and categories, optional slip/invoice image uploads, summary statistics, and a colorful, enhanced UI.
- **Purchase Management**: CRUD for purchases and categories, search, filtering, and bulk import/export. Integrates with inventory to automatically update stock levels and create adjustment records upon purchase creation.
- **Table Management**: CRUD for tables, capacity tracking, status management, direct printing, and options to edit/add items or complete orders for occupied tables.
- **HRM**: Full employee management (CRUD, import/export, schedule upload) with schemas for Attendance, Leave, and Payroll.
- **Inventory Management**: Comprehensive control with tabs for All Products (CRUD, bulk actions), Stock Overview, Low Stock Alerts (with one-click restock), and Adjustment History. Features automatic stock deduction on sales, manual adjustments, and import/export capabilities.
- **Reporting System**: Comprehensive reports for Sales, Inventory, Discounts, Refunds, and Staff Performance with flexible filtering (date range, payment status, payment gateway) and export options (CSV, PDF). Includes an Account History breakdown by payment method.
- **Bank Statement**: Dedicated payment dashboard displaying sales breakdown by payment method, summary statistics, date filtering, and export capability. Payment method cards are clickable to show detailed transaction history for each method, including proper handling of split payments where only the amount paid with the selected method is displayed.
- **Due Management**: Customer-level partial payment tracking system with dedicated database schema (customers, due_payments, due_payment_allocations tables). Features include customer summary grid showing total due, total paid, balance, credit (unapplied payments), and order count per customer. Interactive Record Payment modal with payment allocation UI allows distributing payments across multiple orders with auto-allocation to oldest orders first. Payment recording wrapped in database transactions ensures atomic updates of order status (due → partial → paid) based on allocated amounts. Frontend provides flexible search by customer name/phone and displays summary statistics (Total Due, Total Customers, Total Credit). Each customer row includes "Record Payment" and "View Orders" actions. Credit column tracks advance payments or overpayments for future orders. All payment allocations tracked in due_payment_allocations table linking payments to specific orders with granular amount tracking. Comprehensive date filtering (Today, This Month, Custom Range, All Time) filters customers based on their order creation dates with real-time summary statistics updates. Full import/export capabilities include CSV, Excel (XLSX), and PDF export of customer summary data, downloadable sample template for bulk import, and file upload with automatic customer creation and error reporting.
- **Branch Management**: Multi-location system with CRUD for branches, secure branch-level authentication with login capability, data isolation, and API endpoints for management. Branch users can log in using their branch username and password through the main login page. The system validates credentials against both users and branches tables, creating appropriate session data (branchId, username, role="branch", userType="branch" for branch logins). Passwords are hashed with bcrypt (10 salt rounds) and never exposed in API responses.
- **System Settings**: Extensive configuration options including General, Payment Methods, Tax & Discount, Receipt & Invoice, User & Access, Printer & Hardware, Currency & Localization, Backup & Data, Notifications, and Customization. Includes configurable stock thresholds and secondary currency options with custom exchange rates for dual-currency printing.

## External Dependencies
- **Frontend Libraries**: React, TypeScript, TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend Libraries**: Express, TypeScript, `express-session`, `bcrypt`.
- **Payment Gateways**: ABA, Acleda (conceptual integration as payment methods).
- **Import/Export**: Functionality for processing Excel (.xlsx, .xls) and CSV files.