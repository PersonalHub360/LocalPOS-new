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

### Feature Specifications
- **Authentication**: Secure login, session management, password hashing, and protected API routes.
- **POS Order Workflow**: Draft saving, editing, receipt generation, diverse payment methods (Cash, Card, ABA, Acleda, Due), and transactional safety for order completion.
- **Sales Management**: Complete order history display with detailed item breakdown. View, Edit, and Print functions show all order items (Product Name, Quantity, Price, Discount, Total) along with order summary (Subtotal, Discount, Total, Total in KHR with ៛ symbol). Fixed product name display issue. Export functionality to Excel and PDF formats. Exchange rate: 1 USD = 4,100 KHR.
- **Item Management**: CRUD for items and categories, image management, search, filtering, and bulk import/export (Excel/CSV).
- **Purchase Management**: CRUD for purchases, category management, search, filtering, and bulk import/export.
- **Table Management**: CRUD for tables, capacity tracking, and status management. Enhanced print with order items display (Product Name, Quantity, Price, Discount, Total) and Total in KHR conversion. For occupied tables: Edit Items (navigate to POS), Add Items (dialog to add new items), Print Directly (print current order), and Complete Order (finish order and mark table available).
- **HRM**: Full employee management (CRUD, import/export, schedule upload). Schemas defined for Attendance, Leave, and Payroll modules.
- **Reporting System**: Comprehensive reports for Sales, Inventory, Payments, Discounts, Refunds, and Staff Performance with various date filters and export options.
- **System Settings**: Extensive configuration options across 10 sections including General, Payment Methods, Tax & Discount, Receipt & Invoice, User & Access, Printer & Hardware, Currency & Localization, Backup & Data, Notifications, and Customization.

## External Dependencies
- **Frontend Libraries**: React, TypeScript, TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend Libraries**: Express, TypeScript, `express-session`, `bcrypt`.
- **Payment Gateways**: Conceptual integration with ABA, Acleda (specific APIs not detailed, but mentioned as payment methods).
- **Import/Export**: Relies on functionality to process Excel (.xlsx, .xls) and CSV files for data import and export.