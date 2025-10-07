# BondPos POS System - Design Guidelines

## Design Approach
**Design System Approach**: Utility-focused dashboard application inspired by modern POS systems (Square, Toast, Lightspeed) with Material Design principles. This is an operational tool requiring efficiency, clarity, and consistency over visual flair.

---

## Core Design Principles
1. **Speed & Efficiency**: Every interaction optimized for fast order processing
2. **Information Clarity**: Dense data presented hierarchically and scannable
3. **Touch-Friendly**: Large tap targets (minimum 44px) for tablet use
4. **Operational Reliability**: Consistent patterns, minimal cognitive load

---

## Color Palette

**Light Mode (Primary)**
- **Primary Brand**: 18 95% 60% (vibrant orange - CTA buttons, active states)
- **Primary Dark**: 18 85% 45% (hover states, emphasis)
- **Neutral Background**: 0 0% 98% (main app background)
- **Card Background**: 0 0% 100% (product cards, panels)
- **Border**: 0 0% 90% (dividers, card edges)
- **Text Primary**: 0 0% 15%
- **Text Secondary**: 0 0% 45%
- **Success**: 142 71% 45% (completed orders)
- **Warning**: 45 93% 57% (pending items)
- **Error**: 0 84% 60% (cancellations)

**Dark Mode** (for extended evening shifts)
- Background: 0 0% 10%
- Card: 0 0% 15%
- Border: 0 0% 25%

---

## Typography

**Font Families**
- **Primary**: Inter (Google Fonts) - UI elements, body text
- **Numeric**: Roboto Mono - prices, quantities, totals

**Scale & Hierarchy**
- **Page Headers**: text-2xl font-semibold (orders, products)
- **Section Titles**: text-lg font-medium (categories, table names)
- **Product Names**: text-base font-medium
- **Body Text**: text-sm (descriptions, metadata)
- **Prices**: text-lg font-semibold (cart totals), text-base (product prices)
- **Small Labels**: text-xs (category tags, status badges)

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-4 to p-6
- Section gaps: gap-4 to gap-6
- Page margins: px-6 py-4

**Grid Structure**
- **Sidebar Navigation**: Fixed 240px width (w-60)
- **Main Content**: flex-1 with max-width constraints
- **Product Grid**: grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4
- **Order Panel**: Fixed 320px width (w-80) on desktop, full-width drawer on mobile

**Containers**
- Dashboard sections: max-w-7xl mx-auto
- Modal dialogs: max-w-2xl

---

## Component Library

### Navigation
- **Sidebar**: Vertical navigation with icons + labels, active state with orange left border and background tint
- **Top Bar**: Logo left, search center, user profile/settings right
- **Tab Navigation**: For sections (Dine In/Take Away/Delivery)

### Product Display
- **Product Cards**: White background, rounded-lg, product image top (aspect-square), name + price below, hover shadow-md transition
- **Category Pills**: Horizontal scrollable list, active state with orange background, inactive with border-2

### Order Management
- **Order List Items**: Each item shows thumbnail, name, quantity controls (+/-), price, remove button
- **Quantity Controls**: Outlined buttons with - and + flanking numeric display
- **Order Summary**: Subtotal, discount row, divider, total in larger bold text

### Tables & Lists
- **Table Cards**: Grid layout showing table number, order count, time elapsed, status color indicator
- **Data Tables**: Striped rows, sortable headers, hover states

### Forms & Inputs
- **Input Fields**: border rounded-md, focus:ring-2 ring-orange-500
- **Select Dropdowns**: Consistent height (h-10), chevron icon
- **Search Bar**: With magnifying glass icon, rounded-full design

### Buttons
- **Primary**: bg-orange-600 text-white, rounded-md, px-6 py-2.5
- **Secondary**: border-2 border-orange-600 text-orange-600
- **Ghost**: text-gray-600 hover:bg-gray-100
- **Sizes**: Small (px-3 py-1.5 text-sm), Default (px-6 py-2.5), Large (px-8 py-3)

### Status Badges
- **Pending**: bg-yellow-100 text-yellow-800
- **Completed**: bg-green-100 text-green-800
- **Cancelled**: bg-red-100 text-red-800
- Rounded-full, px-3 py-1, text-xs font-medium

### Modals & Overlays
- **Payment Modal**: Centered, max-w-lg, payment method selection with icons
- **Confirmation Dialogs**: Simple, action buttons right-aligned

---

## Interaction Patterns

**Order Flow**
1. Select category → Browse products → Tap to add
2. Adjust quantities in cart
3. Add customer/table assignment
4. Process payment → Print receipt

**Touch Targets**
- Minimum 44x44px for all interactive elements
- Adequate spacing between buttons (gap-2 minimum)

**Loading States**
- Skeleton screens for product grids
- Spinner for payment processing

**Feedback**
- Toast notifications (top-right) for confirmations
- Inline validation for forms
- Haptic-style subtle animations on successful actions

---

## Images

**Product Images**
- Square aspect ratio (1:1), consistent across all products
- Placeholder: Neutral gray background with food icon for missing images
- Optimized thumbnails in cart (64x64px)
- High-quality images in product grid (200x200px)

**No Hero Images**: This is an operational dashboard, not a marketing site

---

## Accessibility
- WCAG AA contrast ratios maintained
- Keyboard navigation for all functions
- Screen reader labels on icon-only buttons
- Focus indicators visible (ring-2 ring-orange-500)

---

## Responsive Behavior

**Desktop (1024px+)**: Three-column layout (sidebar + main + order panel)
**Tablet (768px-1023px)**: Two-column (collapsible sidebar + main), order panel as slide-out
**Mobile (<768px)**: Single column, bottom navigation bar, full-screen views