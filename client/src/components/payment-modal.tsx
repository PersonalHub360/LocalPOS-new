import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Banknote, Wallet, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PaymentSplit {
  method: string;
  amount: number;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: string, amountPaid: number, paymentSplits?: PaymentSplit[]) => void;
  total: number;
  orderNumber: string;
}

export function PaymentModal({
  open,
  onClose,
  onConfirm,
  total,
  orderNumber,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(total.toString());
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState("aba");
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const { toast } = useToast();

  const handleConfirm = () => {
    if (paymentSplits.length > 0) {
      const totalPaid = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
      onConfirm(paymentSplits[0].method, totalPaid, paymentSplits);
    } else {
      onConfirm(paymentMethod, parseFloat(amountPaid) || 0);
    }
    setAmountPaid(total.toString());
    setPaymentMethod("cash");
    setPaymentSplits([]);
    setNewPaymentAmount("");
  };

  const change = Math.max(0, parseFloat(amountPaid || "0") - total);

  const paymentMethods = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "aba", label: "ABA", icon: Smartphone },
    { value: "acleda", label: "Acleda", icon: Wallet },
    { value: "due", label: "Due", icon: CreditCard },
    { value: "cash_aba", label: "Cash And ABA", icon: Banknote },
    { value: "cash_acleda", label: "Cash And Acleda", icon: Banknote },
  ];

  const handleAddPaymentSplit = () => {
    const amount = parseFloat(newPaymentAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setPaymentSplits([...paymentSplits, { method: newPaymentMethod, amount }]);
    setNewPaymentAmount("");
  };

  const handleRemovePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  const totalPaid = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
  const remaining = total - totalPaid;
  const changeDue = totalPaid > total ? totalPaid - total : 0;

  const getPaymentMethodLabel = (method: string) => {
    const found = paymentMethods.find(m => m.value === method);
    return found ? found.label : method;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-payment">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Order #{orderNumber} - Complete the payment transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="total">Total Amount</Label>
            <div className="text-2xl font-bold font-mono" data-testid="text-payment-total">
              ${total.toFixed(2)}
            </div>
          </div>

          {paymentSplits.length === 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method" data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className="w-4 h-4" />
                          <span>{method.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount-paid">Amount Paid</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="font-mono"
                  data-testid="input-amount-paid"
                />
              </div>

              {change > 0 && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Change:</span>
                    <span className="text-lg font-semibold font-mono text-primary" data-testid="text-change">
                      ${change.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Split Payment</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-2">
                <Label htmlFor="new-payment-method">Payment Method</Label>
                <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                  <SelectTrigger id="new-payment-method" data-testid="select-new-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.filter(m => m.value !== 'cash_aba' && m.value !== 'cash_acleda').map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className="w-4 h-4" />
                          <span>{method.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-payment-amount">Amount</Label>
                <Input
                  id="new-payment-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  className="font-mono"
                  data-testid="input-new-payment-amount"
                />
              </div>
            </div>

            <Button 
              type="button" 
              onClick={handleAddPaymentSplit} 
              className="w-full"
              variant="outline"
              data-testid="button-add-payment-split"
            >
              Add Payment
            </Button>

            {paymentSplits.length > 0 && (
              <div className="mt-4 space-y-3">
                <Label>Current Payments</Label>
                <div className="space-y-2">
                  {paymentSplits.map((split, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-muted rounded-md"
                      data-testid={`payment-split-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        <span className="font-medium">{getPaymentMethodLabel(split.method)}</span>
                        <span className="font-mono">${split.amount.toFixed(2)}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePaymentSplit(index)}
                        data-testid={`button-remove-split-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-primary/5 rounded-md space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Total:</span>
                    <span className="font-mono">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Paid:</span>
                    <span className="font-mono">${totalPaid.toFixed(2)}</span>
                  </div>
                  {changeDue > 0 ? (
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-green-600">Change Due:</span>
                        <span className="font-mono text-green-600" data-testid="text-change-due">
                          ${changeDue.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        (Return ${changeDue.toFixed(2)} to customer)
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Remaining:</span>
                      <span className={`font-mono ${remaining === 0 ? 'text-green-600' : 'text-primary'}`}>
                        ${remaining.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-payment">
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-confirm-payment">
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
