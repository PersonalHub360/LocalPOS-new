import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Minus, Plus, X, Search, Printer, CreditCard, FileText, Utensils } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { cn } from "@/lib/utils";
import type { Product, Table } from "@shared/schema";

export interface OrderItemData {
  product: Product;
  quantity: number;
}

interface OrderPanelProps {
  orderItems: OrderItemData[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearOrder: () => void;
  onSaveDraft: () => void;
  onProcessPayment: (type: "kot" | "bill" | "print") => void;
  orderNumber: string;
  selectedTable: string | null;
  onSelectTable: (tableId: string) => void;
  tables: Table[];
  diningOption: string;
  onChangeDiningOption: (option: string) => void;
  searchInPacking: string;
  onSearchInPacking: (value: string) => void;
  manualDiscount: number;
  onManualDiscountChange: (discount: number) => void;
  discountType: 'amount' | 'percentage';
  onDiscountTypeChange: (type: 'amount' | 'percentage') => void;
  onDiscountChange?: (value: number, type: 'amount' | 'percentage') => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PRESET_PERCENTAGES = [5, 10, 15, 20];

export function OrderPanel({
  orderItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearOrder,
  onSaveDraft,
  onProcessPayment,
  orderNumber,
  selectedTable,
  onSelectTable,
  tables,
  diningOption,
  onChangeDiningOption,
  searchInPacking,
  onSearchInPacking,
  manualDiscount,
  onManualDiscountChange,
  discountType,
  onDiscountTypeChange,
  onDiscountChange,
  open,
  onOpenChange,
}: OrderPanelProps) {
  const isDesktop = useIsDesktop();
  const isOpen = open ?? true; // Default to open if not controlled
  const subtotal = orderItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );
  
  // Calculate actual discount amount based on type
  const discountAmount = discountType === 'percentage' 
    ? (subtotal * manualDiscount) / 100 
    : manualDiscount;
  
  const total = subtotal - discountAmount;
  
  // Derive active preset from current discount value
  const activePreset = discountType === 'percentage' && PRESET_PERCENTAGES.includes(manualDiscount) 
    ? manualDiscount 
    : null;
  
  const handlePresetClick = (percentage: number) => {
    // Use combined handler if available to avoid race conditions
    if (onDiscountChange) {
      onDiscountChange(percentage, 'percentage');
    } else {
      onDiscountTypeChange('percentage');
      onManualDiscountChange(percentage);
    }
  };
  
  const handleDiscountTypeChange = (type: 'amount' | 'percentage') => {
    if (onDiscountChange) {
      onDiscountChange(0, type);
    } else {
      onDiscountTypeChange(type);
      onManualDiscountChange(0);
    }
  };

  const orderPanelContent = (
    <div className={cn(
      "border-t md:border-t-0 md:border-l border-border bg-card flex flex-col h-full min-w-0 overflow-hidden",
      isDesktop ? "w-full md:w-96 lg:w-[28rem] xl:w-[32rem]" : "w-full"
    )}>
      <div className="p-3 sm:p-4 border-b border-border space-y-3 sm:space-y-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold truncate min-w-0">Order Summary</h2>
          {orderItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearOrder}
              data-testid="button-clear-order"
              className="shrink-0 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Clear All</span>
              <span className="sm:hidden">Clear</span>
            </Button>
          )}
        </div>
        
        <Select value={selectedTable || ""} onValueChange={onSelectTable}>
          <SelectTrigger data-testid="select-table" className="w-full">
            <SelectValue placeholder="Select Table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                Table {table.tableNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 sm:p-4 space-y-3">
          {orderItems.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground px-2 sm:px-3 min-w-0">
              <p className="text-xs sm:text-sm break-words leading-relaxed whitespace-normal">No items in order</p>
              <p className="text-xs mt-2 break-words leading-relaxed whitespace-normal">Add products to get started</p>
            </div>
          ) : (
            orderItems.map((item) => (
              <Card key={item.product.id} className="p-3" data-testid={`card-order-item-${item.product.id}`}>
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent">
                        <Utensils className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm truncate">
                        {item.product.name}
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => onRemoveItem(item.product.id)}
                        data-testid={`button-remove-item-${item.product.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          data-testid={`button-decrease-${item.product.id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium font-mono" data-testid={`text-quantity-${item.product.id}`}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          data-testid={`button-increase-${item.product.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <span className="font-semibold text-sm font-mono" data-testid={`text-item-total-${item.product.id}`}>
                        ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground mt-1"
                      data-testid={`button-add-notes-${item.product.id}`}
                    >
                      + Add Notes
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-3 sm:p-4 border-t border-border space-y-3 sm:space-y-4 flex-shrink-0 bg-card">
        <div className="space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between items-center gap-2 min-w-0">
            <span className="text-muted-foreground whitespace-nowrap shrink-0">Sub total :</span>
            <span className="font-mono shrink-0" data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-1 sm:gap-2 min-w-0">
              <span className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm shrink-0">Discount :</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant={discountType === 'amount' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs shrink-0"
                  onClick={() => handleDiscountTypeChange('amount')}
                  data-testid="button-discount-amount"
                >
                  $
                </Button>
                <Button
                  variant={discountType === 'percentage' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs shrink-0"
                  onClick={() => handleDiscountTypeChange('percentage')}
                  data-testid="button-discount-percentage"
                >
                  %
                </Button>
                <div className="relative shrink-0">
                  <Input
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : subtotal}
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    value={manualDiscount || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const maxValue = discountType === 'percentage' ? 100 : subtotal;
                      onManualDiscountChange(Math.min(Math.max(0, value), maxValue));
                    }}
                    className="w-16 sm:w-20 h-6 sm:h-7 text-right font-mono pr-4 sm:pr-6 text-xs"
                    placeholder={discountType === 'percentage' ? '0' : '0.00'}
                    data-testid="input-discount-value"
                  />
                  {discountType === 'percentage' && (
                    <span className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground pointer-events-none">
                      %
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {discountType === 'percentage' && (
              <div className="flex justify-end gap-1 flex-wrap">
                {PRESET_PERCENTAGES.map((percentage) => (
                  <Button
                    key={percentage}
                    variant={activePreset === percentage ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-xs shrink-0"
                    onClick={() => handlePresetClick(percentage)}
                    data-testid={`button-preset-${percentage}`}
                  >
                    {percentage}%
                  </Button>
                ))}
              </div>
            )}
            
            {discountType === 'percentage' && manualDiscount > 0 && (
              <div className="flex justify-end text-xs text-muted-foreground">
                Discount: ${discountAmount.toFixed(2)}
              </div>
            )}
          </div>
          
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between items-center gap-2 font-semibold text-sm sm:text-base min-w-0">
            <span className="whitespace-nowrap shrink-0">Total :</span>
            <span className="font-mono shrink-0" data-testid="text-total">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => onProcessPayment("kot")}
            disabled={orderItems.length === 0}
            className="gap-1 sm:gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm h-9 sm:h-10 whitespace-nowrap shrink-0"
            data-testid="button-receipt-print"
          >
            <Printer className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Receipt Print</span>
            <span className="sm:hidden">Print</span>
          </Button>
          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={orderItems.length === 0}
            className="gap-1 sm:gap-2 bg-sky-500 hover:bg-sky-600 text-white border-sky-500 text-xs sm:text-sm h-9 sm:h-10 whitespace-nowrap shrink-0"
            data-testid="button-draft"
          >
            Draft
          </Button>
        </div>
        
        <Button
          variant="secondary"
          onClick={() => onProcessPayment("print")}
          disabled={orderItems.length === 0}
          className="w-full gap-1 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 whitespace-nowrap shrink-0"
          data-testid="button-complete-order"
        >
          <FileText className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">Complete Order</span>
          <span className="sm:hidden">Complete</span>
        </Button>
      </div>
    </div>
  );

  // On desktop (>= 1280px), render normally
  if (isDesktop) {
    return orderPanelContent;
  }

  // On smaller screens (< 1280px), render as Sheet (absolute overlay)
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[50vw] max-w-none sm:max-w-none md:max-w-none p-0 [&>button]:hidden"
      >
        {orderPanelContent}
      </SheetContent>
    </Sheet>
  );
}
