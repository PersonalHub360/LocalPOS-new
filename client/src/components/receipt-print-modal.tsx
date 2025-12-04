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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Receipt, Utensils, Calendar, Hash, FileText } from "lucide-react";
import type { Order, OrderItem, Product, Settings } from "@shared/schema";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReceiptTemplate } from "@/lib/receipt-templates";
import { generateReceiptHTML } from "@/lib/receipt-templates";
import { useToast } from "@/hooks/use-toast";

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
    paymentSplits?: string;
    changeDue?: number;
  };
  onPrint: () => void;
}

function formatDualCurrency(usdAmount: number, settings?: Settings) {
  const exchangeRate = settings?.exchangeRate ? parseFloat(settings.exchangeRate) : 4100;
  const secondaryCurrencySymbol = settings?.secondaryCurrencySymbol || "៛";
  const showSecondaryCurrency = settings?.secondaryCurrency && settings?.exchangeRate;
  
  const secondaryAmount = usdAmount * exchangeRate;
  return {
    usd: `$${usdAmount.toFixed(2)}`,
    secondary: showSecondaryCurrency 
      ? `${secondaryAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${secondaryCurrencySymbol}`
      : null
  };
}

export function ReceiptPrintModal({
  open,
  onClose,
  order,
  onPrint,
}: ReceiptPrintModalProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: open,
  });
  const { toast } = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate>("classic");

  const handlePrint = async () => {
    try {
      // Calculate total in KHR
      const totalUSD = order.total;
      const totalKHRNum = totalUSD * 4100;
      const totalKHR = totalKHRNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      // Parse payment splits if available
      let paymentDetails = `<p><strong>Pay by:</strong> ${order.paymentSplits ? "Split Payment" : "Cash"}</p>`;
      if (order.paymentSplits) {
        try {
          const splits: { method: string; amount: number; customerId?: string; customerName?: string; customerPhone?: string }[] = JSON.parse(order.paymentSplits);
          if (splits.length > 0) {
              const methodLabels: Record<string, string> = {
                cash: "Cash",
                card: "Card",
                aba: "ABA",
                acleda: "Acleda",
                due: "Due",
                cash_aba: "Cash And ABA",
                cash_acleda: "Cash And Acleda",
              };
            const hasCustomerSplits = splits.some(s => s.customerName || s.customerId);
            const splitType = hasCustomerSplits ? "Split by Customer" : "Split by Payment Method";
            
            if (hasCustomerSplits) {
              // Table format for customer splits
              const splitsRows = splits.map(split => {
              const methodLabel = methodLabels[split.method] || split.method;
              const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              return `
                  <tr style="border-bottom: 1px dashed #d1d5db;">
                    <td style="padding: 6px 4px; font-size: 11px; font-weight: 600; color: #111827; border-right: 1px solid #d1d5db; vertical-align: top;">
                      ${split.customerName || "Unknown Customer"}
                      ${split.customerPhone ? `<br><span style="font-size: 9px; font-weight: normal; color: #6b7280;">${split.customerPhone}</span>` : ''}
                    </td>
                    <td style="padding: 6px 4px; font-size: 11px; color: #374151; border-right: 1px solid #d1d5db; vertical-align: top;">${methodLabel}</td>
                    <td style="padding: 6px 4px; font-size: 11px; text-align: right; font-weight: 600; color: #111827; border-right: 1px solid #d1d5db; vertical-align: top;">$${split.amount.toFixed(2)}</td>
                    <td style="padding: 6px 4px; font-size: 10px; text-align: right; color: #6b7280; vertical-align: top;">៛${amountKHR}</td>
                  </tr>
                `;
              }).join('');
              
              paymentDetails = `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #d1d5db;">
                  <div style="font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${splitType}
                  </div>
                  <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; margin-top: 8px;" cellpadding="0" cellspacing="0">
                    <thead>
                      <tr style="background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;">
                        <th style="padding: 6px 4px; text-align: left; font-size: 10px; font-weight: 700; color: #374151; text-transform: uppercase; border-right: 1px solid #d1d5db;">Customer</th>
                        <th style="padding: 6px 4px; text-align: left; font-size: 10px; font-weight: 700; color: #374151; text-transform: uppercase; border-right: 1px solid #d1d5db;">Method</th>
                        <th style="padding: 6px 4px; text-align: right; font-size: 10px; font-weight: 700; color: #374151; text-transform: uppercase; border-right: 1px solid #d1d5db;">USD</th>
                        <th style="padding: 6px 4px; text-align: right; font-size: 10px; font-weight: 700; color: #374151; text-transform: uppercase;">KHR</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${splitsRows}
                    </tbody>
                  </table>
                </div>
              `;
            } else {
              // Row format for payment method splits (keep existing format)
              const splitsHtml = splits.map(split => {
                const methodLabel = methodLabels[split.method] || split.method;
                const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #d1d5db;">
                    <span style="font-size: 13px; color: #374151;">${methodLabel}:</span>
                    <div style="text-align: right;">
                      <span style="font-weight: 700; font-size: 13px; color: #111827;">$${split.amount.toFixed(2)}</span>
                      <span style="font-size: 11px; color: #6b7280; margin-left: 5px;">(៛${amountKHR})</span>
                    </div>
                </div>
              `;
            }).join('');
              
            paymentDetails = `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #d1d5db;">
                  <div style="font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${splitType}
                  </div>
                  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
                  ${splitsHtml}
                </div>
              </div>
            `;
            }
          }
        } catch (error) {
          console.error("Failed to parse payment splits:", error);
        }
      }

      // Create a mock Order object for the template generator
      const mockOrder: Order = {
        id: `temp-${Date.now()}`,
        orderNumber: order.orderNumber,
        tableId: order.tableId || null,
        customerId: null,
        branchId: null,
        diningOption: order.diningOption,
        customerName: null,
        customerPhone: null,
        orderSource: "pos",
        subtotal: order.subtotal.toString(),
        discount: order.discount.toString(),
        discountType: "amount",
        total: order.total.toString(),
        dueAmount: null,
        paidAmount: order.total.toString(),
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: order.paymentSplits ? "split" : "cash",
        paymentSplits: order.paymentSplits || null,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      // Generate receipt HTML using template
      // Ensure all items are included in the receipt
      const receiptItems = order.items.map((item, index) => ({
        id: `temp-${Date.now()}-${index}`,
        orderId: mockOrder.id,
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        productName: item.product.name,
      }));

      const receiptData = {
        sale: mockOrder,
        items: receiptItems,
        settings,
        totalKHR: totalKHRNum,
        paymentDetails,
      };

      const content = generateReceiptHTML(selectedTemplate, receiptData);

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to print receipts",
          variant: "destructive",
        });
        return;
      }

      printWindow.document.write(content);
      printWindow.document.close();
      
      // Wait for content to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 250);

      onPrint();
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to print receipt",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col" data-testid="modal-receipt-print">
        <DialogHeader className="space-y-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Receipt className="w-5 h-5 text-primary-foreground" />
            </div>
            <DialogTitle className="text-xl">Receipt Preview</DialogTitle>
          </div>
        </DialogHeader>

        {/* Template Selection */}
        <div className="space-y-2 px-2 flex-shrink-0">
          <Label htmlFor="receipt-template">Receipt Template</Label>
          <Select
            value={selectedTemplate}
            onValueChange={(value: ReceiptTemplate) => setSelectedTemplate(value)}
          >
            <SelectTrigger id="receipt-template" data-testid="select-receipt-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Classic</span>
                </div>
              </SelectItem>
              <SelectItem value="modern">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Modern</span>
                </div>
              </SelectItem>
              <SelectItem value="compact">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Compact</span>
                </div>
              </SelectItem>
              <SelectItem value="detailed">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Detailed</span>
                </div>
              </SelectItem>
              <SelectItem value="elegant">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Elegant</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select a template style for your receipt
          </p>
        </div>

        <Separator className="flex-shrink-0" />

        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 py-4 pr-4" id="receipt-content">
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
                  Order Items ({order.items.length})
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>
              <div className="max-h-[40vh] min-h-[200px] overflow-y-auto">
                <div className="space-y-3 pr-2">
                  {order.items.map((item, index) => {
                    const itemPrice = parseFloat(item.price);
                    const itemTotal = parseFloat(item.total);
                    const priceFormatted = formatDualCurrency(itemPrice, settings);
                    const totalFormatted = formatDualCurrency(itemTotal, settings);
                    
                    return (
                      <div 
                        key={`${item.product.id}-${index}`} 
                        className="bg-accent/30 rounded-lg p-3 hover-elevate transition-all" 
                        data-testid={`receipt-item-${index}`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm break-words">{item.product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs font-mono">
                                {item.quantity}x
                              </Badge>
                              {priceFormatted.secondary && (
                                <span className="text-xs text-muted-foreground">
                                  {priceFormatted.usd} / {priceFormatted.secondary}
                                </span>
                              )}
                              {!priceFormatted.secondary && (
                                <span className="text-xs text-muted-foreground">
                                  {priceFormatted.usd}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono font-bold text-primary text-sm">
                              {totalFormatted.usd}
                            </p>
                            {totalFormatted.secondary && (
                              <p className="font-mono text-xs text-muted-foreground">
                                {totalFormatted.secondary}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          <Separator className="my-4" />

          <div className="space-y-2 px-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <div className="text-right">
                <p className="font-mono font-medium">{formatDualCurrency(order.subtotal, settings).usd}</p>
                {formatDualCurrency(order.subtotal, settings).secondary && (
                  <p className="font-mono text-xs text-muted-foreground">{formatDualCurrency(order.subtotal, settings).secondary}</p>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <div className="text-right">
                <p className="font-mono font-medium text-accent">
                  {formatDualCurrency(order.discount, settings).usd}
                </p>
                {formatDualCurrency(order.discount, settings).secondary && (
                  <p className="font-mono text-xs text-muted-foreground">{formatDualCurrency(order.discount, settings).secondary}</p>
                )}
              </div>
            </div>
            
            <div className="border-t-2 border-dashed border-border pt-3 mt-3">
              <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total:</span>
                  <div className="text-right" data-testid="receipt-total">
                    <p className="font-mono font-bold text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {formatDualCurrency(order.total, settings).usd}
                    </p>
                    {formatDualCurrency(order.total, settings).secondary && (
                      <p className="font-mono font-semibold text-sm text-muted-foreground">
                        {formatDualCurrency(order.total, settings).secondary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {order.paymentSplits && (() => {
              try {
                const splits: { method: string; amount: number; customerId?: string; customerName?: string; customerPhone?: string }[] = JSON.parse(order.paymentSplits);
                if (splits.length > 0) {
                  const paymentMethods: Record<string, string> = {
                    cash: "Cash",
                    card: "Card",
                    aba: "ABA",
                    acleda: "Acleda",
                    due: "Due",
                    cash_aba: "Cash And ABA",
                    cash_acleda: "Cash And Acleda",
                  };
                  const hasCustomerSplits = splits.some(s => s.customerName || s.customerId);
                  const splitType = hasCustomerSplits ? "Split by Customer" : "Split by Payment Method";
                  return (
                    <div className="border-t border-dashed border-border pt-3 mt-3">
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                        {splitType}:
                      </h4>
                      <div className="space-y-3">
                        {splits.map((split, index) => {
                          const formatted = formatDualCurrency(split.amount, settings);
                          return (
                            <div key={index} className="border-b border-dashed border-border pb-2 last:border-0">
                              {hasCustomerSplits ? (
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-sm">
                                      {split.customerName || "Unknown Customer"}
                                    </span>
                                    {split.customerPhone && (
                                      <span className="text-xs text-muted-foreground">
                                        {split.customerPhone}
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground mt-1">
                                      Payment: {paymentMethods[split.method] || split.method}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono font-medium">{formatted.usd}</p>
                                    {formatted.secondary && (
                                      <p className="font-mono text-xs text-muted-foreground">{formatted.secondary}</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {paymentMethods[split.method] || split.method}:
                                  </span>
                              <div className="text-right">
                                <p className="font-mono font-medium">{formatted.usd}</p>
                                {formatted.secondary && (
                                  <p className="font-mono text-xs text-muted-foreground">{formatted.secondary}</p>
                                )}
                              </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              } catch (error) {
                console.error("Failed to parse payment splits:", error);
              }
              return null;
            })()}

            {order.changeDue && order.changeDue > 0 && (
              <div className="border-t-2 border-dashed border-border pt-3 mt-3">
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-green-700 dark:text-green-400">Change Due:</span>
                    <div className="text-right" data-testid="receipt-change-due">
                      <p className="font-mono font-bold text-2xl text-green-700 dark:text-green-400">
                        {formatDualCurrency(order.changeDue, settings).usd}
                      </p>
                      {formatDualCurrency(order.changeDue, settings).secondary && (
                        <p className="font-mono font-semibold text-sm text-green-600 dark:text-green-500">
                          {formatDualCurrency(order.changeDue, settings).secondary}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Return this amount to customer
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t-2 border-dashed border-border pt-4 mt-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center gap-1 text-primary">
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                <p className="text-sm font-semibold">Thank you for your business!</p>
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
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
