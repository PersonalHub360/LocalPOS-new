# BondPos POS System

## Overview
BondPos is a comprehensive Point of Sale (POS) system designed for restaurants, offering robust features for product catalog management, real-time order processing, table tracking, and secure payment handling. The system aims to streamline restaurant operations with its intuitive interface and powerful backend, improving efficiency and customer service. Key capabilities include a complete POS order workflow, detailed item and purchase management, a comprehensive HRM system, and a full-featured reporting suite. The project emphasizes a modern, vibrant UI with a glassmorphic design, focusing on user experience and transactional safety.

## User Preferences
- Clean, professional UI matching modern POS systems
- Fast, efficient order processing workflow
- Touch-friendly interface for tablet use

## System Architecture

### UI/UX Decisions
The system features a vibrant, modern UI with a multi-color palette (Blue, Purple, Green) and a contemporary design aesthetic. It includes a gradient header, a dark blue-gray sidebar, and subtle gradient backgrounds throughout. Typography uses Inter for UI text and Roboto Mono for numerical displays. Shadcn UI components are heavily utilized, styled with an orange accent color to align with BondPos branding. The design is responsive, optimized for tablet and desktop use.

**Login Page**: Professional blue split-screen design. Left panel (40%) features dark blue gradient background with BondPos logo, sign-in form with white input fields (User/Lock icons), password visibility toggle, blue button, OR divider, and social login buttons (Facebook, Twitter, Google). Right panel (60%) displays feature icons grid (Analytics, Orders, Sales, POS) with title "Point of Sale Management System" and pagination dots. Responsive with slide-in animations.

### Technical Implementations
- **Frontend**: Built with React and TypeScript, leveraging React hooks and TanStack Query for state management. Styling is handled with Tailwind CSS and Shadcn UI.
- **Backend**: Developed using Express and TypeScript.
- **Authentication**: Session-based authentication is implemented using `express-session` and `bcrypt` for password hashing, securing all API routes with middleware.
- **Storage**: Currently uses an in-memory `MemStorage` implementation for all data.
- **API**: Provides RESTful APIs for managing products, categories, orders, tables, items, purchases, employees, and authentication.
- **Core Workflows**: Includes a complete POS order workflow with draft management, receipt printing, and multiple payment methods. Comprehensive CRUD operations are supported across all management modules (Items, Purchases, Tables, Employees).
- **Permissions**: Role-based permissions system with granular controls for reports, settings, refunds, and inventory.
- **Cache Invalidation Pattern**: React Query cache invalidation ensures real-time UI updates without manual refresh. 
  - **Order Creation/Completion** (POS, Tables): Invalidates `/api/orders`, `/api/products`, `/api/sales`, `/api/inventory/adjustments`, low-stock queries, and all dashboard queries (using predicate matching on `/api/dashboard` prefix)
  - **Stock Adjustments** (Inventory): Invalidates `/api/products`, `/api/inventory/adjustments`, and low-stock queries
  - **Product CRUD** (Inventory): Invalidates `/api/products` and low-stock queries
  - This pattern guarantees synchronized data across POS, Inventory, Dashboard, and Reporting modules without manual page refresh

### Feature Specifications
- **Authentication**: Secure login, session management, password hashing, and protected API routes.
- **POS Order Workflow**: Draft saving, editing, receipt generation, diverse payment methods (Cash, Card, ABA, Acleda, Due, Cash And ABA, Cash And Acleda), and transactional safety for order completion.
- **Sales Management**: Complete order history display with detailed item breakdown. Features two tabs: "Detailed Sales Report" and "Sales Summary Report". 
  - **Detailed Sales Report**: View, Edit, and Print functions show all order items (Product Name, Quantity, Price, Discount, Total) along with order summary (Subtotal, Discount, Total, Total in KHR with ៛ symbol). Fixed product name display issue. Export functionality to Excel and PDF formats.
  - **Edit Sale Feature**: When clicking "Edit" from the Sales List, opens Edit Sale dialog with editable fields:
    - Customer Name
    - Payment Status (Pending, Paid, Failed)
    - Order Status (Draft, Confirmed, Completed, Cancelled)
    - **Process Payment Section**: Payment Method selector below Order Status with options: ABA, Acleda, Cash, Due, Card, Cash And ABA, Cash And Acleda
  - **Sales Summary Report**: Aggregated product sales data showing individual item performance (Product Name, Quantity Sold, Total Revenue). Supports date filtering (All Time, Today, Yesterday, Custom Range) to analyze sales trends over specific periods. Exchange rate: 1 USD = 4,100 KHR.
- **Item Management**: CRUD for items and categories, image management, search, filtering, and bulk import/export (Excel/CSV).
- **Expense Management**: Full CRUD for expenses and expense categories with modern, colorful interface. Upload slip/invoice images (optional) for each expense with preview functionality. Images stored as base64 and displayed in View dialog and Print receipt.
  - **Summary Statistics**: Three colorful stat cards displaying Total Expenses (orange gradient), Average Expense (purple gradient), and Categories Count (blue gradient) with icons and enhanced shadows.
  - **Colorful UI**: Vibrant gradient backgrounds on headers, tabs, and stat cards. Gradient title text (orange to pink) and gradient action buttons for better visual appeal.
  - **Enhanced Design**: Border accents, shadow effects, and responsive grid layout (1-3 columns) for summary cards.
- **Purchase Management**: CRUD for purchases, category management, search, filtering, and bulk import/export.
- **Table Management**: CRUD for tables, capacity tracking, and status management. Enhanced print with order items display (Product Name, Quantity, Price, Discount, Total) and Total in KHR conversion. For occupied tables: Edit Items (navigate to POS), Add Items (dialog to add new items), Print Directly (print current order), and Complete Order (finish order and mark table available).
- **HRM**: Full employee management (CRUD, import/export, schedule upload). Schemas defined for Attendance, Leave, and Payroll modules.
- **Inventory Management**: Comprehensive inventory control system with four main tabs:
  - **All Products**: Full CRUD operations for product catalog (View detailed information, Edit product details, Add new products, Delete products). Features bulk selection with checkboxes for individual products and "Select All" option in table header. "Delete Selected" button appears when products are selected, allowing efficient bulk deletion of multiple products at once. Displays product name, category, price, quantity, unit, and stock status.
  - **Stock Overview**: Real-time view of all products with current stock levels and quick stock adjustment actions.
  - **Low Stock Alerts**: Automatic alerts for products below configurable threshold (default: 10 units). One-click restock functionality.
  - **Adjustment History**: Complete audit trail of all stock movements with automatic and manual adjustments. Tracks date/time, product, adjustment type (add/remove/set), quantity, reason, and notes.
  - **Export Inventory**: Export complete inventory data to Excel (.xlsx) or CSV format for reporting and backup purposes.
  - **Import Inventory**: Bulk import inventory data from Excel/CSV files with downloadable sample template for proper formatting.
  - **Automatic Stock Deduction**: System automatically deducts sold product quantities from inventory when orders are completed, creating adjustment records for full traceability.
  - **Manual Adjustments**: Support for manual stock adjustments with reasons (New Purchase, Sale/Usage, Damage/Spoilage, Return, Stock Correction, Other) and optional notes.
  - **Stock Status Indicators**: Visual badges for stock status (Out of Stock, Low Stock, In Stock) with color coding.
- **Reporting System**: Comprehensive reports for Sales, Inventory, Discounts, Refunds, and Staff Performance with streamlined filtering and export options.
  - **Report Filters Layout**: Clean horizontal filter bar with four main dropdowns:
    - **Date Range**: Today, Yesterday, This Month, Last Month, Custom Date
    - **Report Type**: Sales, Inventory, Discounts, Refunds, Staff Performance
    - **Payment Status**: All Statuses, Completed, Pending, Due, Failed
    - **Payment Gateway**: All Gateways, Cash, Card, ABA, Acleda, Due, Cash And ABA, Cash And Acleda
  - **Account History**: Dedicated section displaying total sales amount breakdown by payment method (ABA, Acleda, Cash, Due, Card, Cash And ABA, Cash And Acleda). Shows transaction count and total amount in both USD and KHR for each payment method in a responsive grid layout, respecting all active filters (date range, payment status, payment gateway).
  - **Sales Report**: Displays detailed transaction list with checkboxes for bulk selection and deletion. Includes Date/Time, Order ID, Customer, Total Amount, Payment Method, Payment Status, Status, and action buttons (View, Edit, Print). Export to CSV and PDF formats available.
  - **Other Reports**: Display transaction information in table format with columns for Date/Time, Order ID, Customer, Total Amount, Payment Method, Payment Status, Status, and Actions. All reports respect selected date range and payment status filters.
  - **Export Functionality**: All reports support CSV and PDF export with comprehensive transaction details including dual currency display (USD/KHR at 1:4,100 exchange rate).
- **Bank Statement**: Dedicated payment dashboard module for tracking sales by payment method.
  - **Payment Dashboard**: Grid view displaying sales breakdown for all payment methods (ABA, Acleda, Cash, Due, Card, Cash And ABA, Cash And Acleda). Each card shows total sales in USD/KHR, transaction count, and method-specific color-coded icons.
  - **Date Filtering**: Flexible date range selection (Today, Yesterday, This Month, Last Month, Custom Date Range) to analyze payment trends over specific periods.
  - **Summary Statistics**: Overview cards showing total revenue (USD/KHR), total completed transactions, and average transaction value.
  - **Export Capability**: Export bank statement data for accounting and reconciliation purposes.
  - **Real-time Updates**: Automatically reflects completed transactions and respects selected date filters.
- **System Settings**: Extensive configuration options across 10 sections including General, Payment Methods, Tax & Discount, Receipt & Invoice, User & Access, Printer & Hardware, Currency & Localization, Backup & Data, Notifications, and Customization. Includes configurable stock threshold for low stock alerts.

## External Dependencies
- **Frontend Libraries**: React, TypeScript, TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend Libraries**: Express, TypeScript, `express-session`, `bcrypt`.
- **Payment Gateways**: Conceptual integration with ABA, Acleda (specific APIs not detailed, but mentioned as payment methods).
- **Import/Export**: Relies on functionality to process Excel (.xlsx, .xls) and CSV files for data import and export.