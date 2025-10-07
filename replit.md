# BondPos POS System

## Overview
A comprehensive Point of Sale (POS) system for restaurants featuring product catalog management, order processing, table tracking, and payment handling. Built with React, Express, and in-memory storage.

## Current State
- **Status**: In Development (Phase 7: Complete POS Order Workflow)
- **Last Updated**: October 6, 2025
- **Recent Changes**: 
  - **Complete POS Order Workflow**: Full order lifecycle with transactional safety
    - Draft List modal with Edit/Print/Delete actions for all saved drafts
    - Edit Draft functionality restores items to cart without data loss
    - Receipt/Invoice Preview dialog with print functionality
    - Payment Methods modal (ABA, Acleda, Cash, Due, Card Payment)
    - Complete order flow: payment → receipt → save to sales with metadata
    - Transactional draft deletion (only deletes after successful completion/save)
    - Completed orders persist as sales records with payment details
  - **Role Permissions System**: Fully functional permission controls in Settings → User & Access Management
    - 4 permission switches: Access to Reports, Access to Settings, Process Refunds, Manage Inventory
    - Backend persistence with schema validation
    - All permissions save and load from API with proper state management
  - **Rebranding Complete**: Changed application name from "RestroBit" to "BondPos" across all files
    - Updated UI (sidebar, page title), documentation, schema defaults, and storage

## Project Architecture

### Frontend (React + TypeScript)
- **Pages**:
  - `/` - POS (Point of Sale) interface
  - `/dashboard` - Dashboard overview
  - `/tables` - Table Management interface
  - `/sales` - Sales Management interface
  - `/expenses` - Expense Management interface
  - `/items` - Item/Inventory Management interface
  - `/purchases` - Purchase Management interface
  - `/hrm` - Human Resource Management interface
  - `/reports` - Reports and analytics interface
  - `/settings` - System settings and configuration
- **Components**:
  - `AppSidebar`: Navigation sidebar with all menu items
  - `AppHeader`: Top header with conditional POS buttons (New, QR Menu Orders, Draft List, Table Order) and theme toggle
  - `ProductCard`: Individual product display with add-to-order functionality
  - `OrderPanel`: Right-side order management panel with items, quantities, totals, action buttons
  - `PaymentModal`: Payment processing dialog with 5 payment methods (ABA, Acleda, Cash, Due, Card)
  - `DraftListModal`: Draft order management with Edit/Print/Delete actions
  - `ReceiptPrintModal`: Invoice preview and print dialog
- **State Management**: React hooks + TanStack Query for server state
- **Styling**: Tailwind CSS + Shadcn UI components with orange accent colors

### Backend (Express + TypeScript)
- **Storage**: In-memory MemStorage implementation
- **API Endpoints**: RESTful API for products, categories, orders, tables, items, purchases, employees
- **Data Models**:
  - Categories (with name and slug - full CRUD support)
  - Products (with prices, images, category, unit, quantity, description, createdAt - full CRUD support)
  - Tables (with capacity, description, status tracking - full CRUD support)
  - Orders (with items, totals, discounts, status, payment method, payment status, completed timestamp - full CRUD support)
  - OrderItems (join table for order-product relationships)
  - Purchases (with item details, quantity, price, purchase date - full CRUD support)
  - Employees (with employee ID, position, department, salary, contact info, status - full CRUD support)
  - Attendance (schema defined, ready for implementation)
  - Leave (schema defined, ready for implementation)
  - Payroll (schema defined, ready for implementation)

### Design System
- **Primary Color**: Orange (18 95% 60%)
- **Typography**: Inter for UI, Roboto Mono for numbers/prices
- **Layout**: Sidebar navigation + main content + order panel (3-column)
- **Components**: Following Shadcn UI patterns with custom styling

## Features

### Implemented (MVP)
- [x] Product catalog with category filtering
- [x] Real-time order management
- [x] Quantity adjustment with +/- controls
- [x] Order total calculations (subtotal, discounts, total)
- [x] Table selection and dining option selection
- [x] **Complete POS Order Workflow**:
  - Draft order saving with persistent storage
  - Draft List modal (view all drafts, Edit/Print/Delete actions)
  - Edit Draft (restores items to cart with transactional safety)
  - Receipt/Invoice preview with print functionality
  - Payment Methods modal (ABA, Acleda, Cash, Due, Card Payment)
  - Complete order flow: payment selection → receipt print → save to sales
  - Transactional safety: drafts only deleted after successful completion
  - Sales records: completed orders with payment metadata (method, status, timestamp)
- [x] Product search functionality
- [x] KOT (Kitchen Order Ticket) printing
- [x] **Item Management** - Comprehensive inventory management with:
  - Add/Edit items with image URL, name, category, price, unit, quantity, description
  - Category management (create, edit, delete categories)
  - Search by item name or description
  - Filter by category and date (All Time, Today, Yesterday, Custom Date)
  - Items grid view with responsive cards
  - Import items from Excel (.xlsx, .xls) or CSV files
  - Download sample Excel template with example data
  - Export items to CSV format
  - Import tracking with detailed feedback (imported/skipped counts)
  - Full CRUD operations with validation
- [x] **Purchase Management** - Complete purchase order management with:
  - Add/Edit purchases with item name, category, quantity, unit, price, purchase date, optional image
  - Category management for purchases
  - Search by item name
  - Filter by category and date (All Time, Today, Yesterday, Custom Date)
  - Import purchases from Excel (.xlsx, .xls) or CSV files
  - Download sample Excel template with proper structure and example data
  - Export purchases to CSV format
  - View and print purchase receipts
  - Full CRUD operations with validation and error handling
- [x] **Table Management** - Complete table management system with:
  - Add/Edit tables with table number, capacity, description
  - View table details
  - Status tracking (available/occupied)
  - Delete tables
  - Full CRUD operations with validation
- [x] **HRM (Human Resource Management)** - Employee management foundation with:
  - **Employee Management Module** (Fully Functional):
    - Add/Edit employees with employee ID, name, position, department, email, phone, joining date, salary, photo URL, status
    - View employee details in formatted dialog
    - Delete employees with confirmation
    - Employee list table with all details and status badges
    - Form validation with Zod schemas
    - Active/Inactive status tracking
    - Import employees from Excel (.xlsx, .xls) or CSV files
    - Export employees to CSV format
    - Download employee sample template with proper structure and example data
    - Upload employee schedules via Excel file
    - Download schedule sample template with shift timings and day-off examples
    - Full CRUD operations
  - **Module Structure** (Ready for Implementation):
    - Attendance Management tab (track check-in/out, mark present/absent, export reports)
    - Leave Management tab (apply for leave, approve/reject requests, track leave balance)
    - Payroll & Salary tab (manage salary records, generate payslips, calculate bonuses/deductions)
    - Reports & Analytics tab (export HR summaries)
  - Database schemas defined for all modules (employees, attendance, leave, payroll)
  - Tab-based navigation with icons for easy module access

### Navigation Structure (Sidebar)
- Dashboard - Overview and key metrics
- POS - Point of Sale interface (fully functional)
- Table - Table management
- Sales manage - Sales activities and records
- Expense Manage - Business expense tracking
- Item Manage - Inventory and menu items
- Purchase Manage - Purchase orders and vendors
- HRM - Human resource management
- Reports - Business reports and analytics
- Settings - System configuration

- [x] **Comprehensive Reporting System** - Full-featured reports dashboard with:
  - Report type selector (Sales, Inventory, Payments, Discounts, Refunds, Staff Performance)
  - Date range filters (Today, Yesterday, Last 7 Days, Last Month, Custom Range with date pickers)
  - Summary KPI tiles (Total Revenue, Transactions, Average Sale Value, Total Discounts)
  - Payment methods breakdown with percentage distribution
  - Detailed transaction tables with sortable columns
  - Export to CSV functionality
  - Print report capability
  - Filter and view transaction details
- [x] **System Settings** - Complete settings configuration with 10 sections:
  - General Settings: Business info, logo, address, contact, date/time format, terminal ID
  - Payment Methods: Enable/disable payment options (Cash, Card, ABA, Acleda, Credit), set defaults, min/max amounts
  - Tax & Discount: VAT/service tax rates, default discounts, percentage/fixed amount options
  - Receipt & Invoice: Custom header/footer text, logo, auto-print, tax breakdown, invoice numbering
  - User & Access Management: Add/remove staff, assign roles (Manager, Cashier), set permissions
  - Printer & Hardware: Configure receipt/kitchen printers, barcode scanner, cash drawer, paper size
  - Currency & Localization: Default currency (USD, KHR, EUR, GBP), language, decimal places, rounding rules
  - Backup & Data Management: Auto-backup frequency, storage options (local/cloud), manual backup/restore
  - Notifications & Alerts: Low stock alerts, sale notifications, discount alerts, system updates
  - Customization & Themes: Color themes, layout preferences (grid/list), font size, compact mode

### Future Enhancements
- [ ] Dashboard with sales analytics (page created, needs implementation)
- [ ] Sales management features:
  - View all completed orders (sales records)
  - Filter by date range, payment method, dining option
  - Export sales data to CSV
  - Refund processing with permission controls
- [ ] Expense tracking system (page created, needs implementation)
- [ ] HRM additional modules:
  - [ ] Attendance Management - Daily attendance tracking with check-in/out times
  - [ ] Leave Management - Leave application and approval workflow
  - [ ] Payroll & Salary - Salary records and payslip generation
  - [ ] HR Reports & Analytics - Export attendance, leave, and payroll summaries

## Development Notes
- Using in-memory storage (no database persistence)
- Orange accent color (#EA580C) matches BondPos branding
- Responsive design optimized for tablet and desktop use
- All interactive elements have proper data-testid attributes for testing

## User Preferences
- Clean, professional UI matching modern POS systems
- Fast, efficient order processing workflow
- Touch-friendly interface for tablet use
