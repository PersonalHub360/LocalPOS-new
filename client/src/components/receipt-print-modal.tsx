import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Printer, Receipt, Utensils, Calendar, Hash } from "lucide-react";
import type { Order, OrderItem, Product } from "@shared/schema";
import { format } from "date-fns";

interface ReceiptPrintModalProps {
  open: boolean;
  onClose: () => void;
  order: {
    orderNumber: string;
    items: Array<{
      product: Product;
      quantity: number;
      price: string;
      total: string;
    }>;
    subtotal: number;
    discount: number;
    total: number;
    tableId?: string | null;
    diningOption: string;
  };
  onPrint: () => void;
}

// Exchange rate: 1 USD = 4100 KHR (Cambodian Riel)
const USD_TO_KHR = 4100;

function formatDualCurrency(usdAmount: number) {
  const khrAmount = usdAmount * USD_TO_KHR;
  return {
    usd: `$${usdAmount.toFixed(2)}`,
    khr: `${khrAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}៛`
  };
}

export function ReceiptPrintModal({
  open,
  onClose,
  order,
  onPrint,
}: ReceiptPrintModalProps) {
  const handlePrint = () => {
    window.print();
    onPrint();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-receipt-print">
        <DialogHeader className="space-y-3 pb-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Receipt className="w-5 h-5 text-primary-foreground" />
            </div>
            <DialogTitle className="text-xl">Receipt Preview</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4" id="receipt-content">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg -z-10" />
            <div className="text-center space-y-2 py-6 px-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  BondPos
                </h2>
              </div>
              <p className="text-sm text-muted-foreground font-medium">Point of Sale System</p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(), "MMM dd, yyyy HH:mm")}</span>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-border py-3 space-y-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Order #:</span>
              </div>
              <Badge variant="secondary" className="font-mono font-semibold">
                {order.orderNumber}
              </Badge>
            </div>
            {order.tableId && (
              <div className="flex items-center justify-between px-2">
                <span className="text-sm text-muted-foreground">Table:</span>
                <Badge variant="outline" className="font-semibold">
                  {order.tableId}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-muted-foreground">Dining Option:</span>
              <Badge className="capitalize bg-primary/10 text-primary hover:bg-primary/20">
                {order.diningOption}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 px-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Order Items
              </h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
            <div className="space-y-3">
              {order.items.map((item, index) => {
                const itemPrice = parseFloat(item.price);
                const itemTotal = parseFloat(item.total);
                const priceFormatted = formatDualCurrency(itemPrice);
                const totalFormatted = formatDualCurrency(itemTotal);
                
                return (
                  <div 
                    key={index} 
                    className="bg-accent/30 rounded-lg p-3 hover-elevate transition-all" 
                    data-testid={`receipt-item-${index}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs font-mono">
                            {item.quantity}x
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {priceFormatted.usd} / {priceFormatted.khr}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-bold text-primary text-sm">
                          {totalFormatted.usd}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {totalFormatted.khr}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2 px-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <div className="text-right">
                <p className="font-mono font-medium">{formatDualCurrency(order.subtotal).usd}</p>
                <p className="font-mono text-xs text-muted-foreground">{formatDualCurrency(order.subtotal).khr}</p>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <div className="text-right">
                <p className="font-mono font-medium text-accent">
                  {formatDualCurrency(order.discount).usd}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{formatDualCurrency(order.discount).khr}</p>
              </div>
            </div>
            
            <div className="border-t-2 border-dashed border-border pt-3 mt-3">
              <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total:</span>
                  <div className="text-right" data-testid="receipt-total">
                    <p className="font-mono font-bold text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {formatDualCurrency(order.total).usd}
                    </p>
                    <p className="font-mono font-semibold text-sm text-muted-foreground">
                      {formatDualCurrency(order.total).khr}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-border pt-4 mt-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center gap-1 text-primary">
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                <p className="text-sm font-semibold">Thank you for your business!</p>
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-primary">BondPos</span> POS System
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            data-testid="button-close-receipt"
            className="gap-2"
          >
            Close
          </Button>
          <Button 
            onClick={handlePrint} 
            className="gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90" 
            data-testid="button-print-receipt"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
