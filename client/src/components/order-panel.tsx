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
import { Minus, Plus, X, Search, Printer, CreditCard, FileText, Utensils } from "lucide-react";
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
}: OrderPanelProps) {
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

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Order Summary</h2>
          {orderItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearOrder}
              data-testid="button-clear-order"
            >
              Clear All
            </Button>
          )}
        </div>
        
        <Select value={selectedTable || ""} onValueChange={onSelectTable}>
          <SelectTrigger data-testid="select-table">
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {orderItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No items in order</p>
              <p className="text-xs mt-1">Add products to get started</p>
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

      <div className="p-4 border-t border-border space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sub total :</span>
            <span className="font-mono" data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">Discount :</span>
              <div className="flex items-center gap-1">
                <Button
                  variant={discountType === 'amount' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleDiscountTypeChange('amount')}
                  data-testid="button-discount-amount"
                >
                  $
                </Button>
                <Button
                  variant={discountType === 'percentage' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleDiscountTypeChange('percentage')}
                  data-testid="button-discount-percentage"
                >
                  %
                </Button>
                <div className="relative">
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
                    className="w-20 h-7 text-right font-mono pr-6"
                    placeholder={discountType === 'percentage' ? '0' : '0.00'}
                    data-testid="input-discount-value"
                  />
                  {discountType === 'percentage' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
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
                    className="h-6 px-2 text-xs"
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
          <div className="flex justify-between font-semibold text-base">
            <span>Total :</span>
            <span className="font-mono" data-testid="text-total">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => onProcessPayment("kot")}
            disabled={orderItems.length === 0}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-receipt-print"
          >
            <Printer className="w-4 h-4" />
            Receipt Print
          </Button>
          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={orderItems.length === 0}
            className="gap-2 bg-sky-500 hover:bg-sky-600 text-white border-sky-500"
            data-testid="button-draft"
          >
            Draft
          </Button>
        </div>
        
        <Button
          variant="secondary"
          onClick={() => onProcessPayment("print")}
          disabled={orderItems.length === 0}
          className="w-full gap-2"
          data-testid="button-complete-order"
        >
          <FileText className="w-4 h-4" />
          Complete Order
        </Button>
      </div>
    </div>
  );
}
