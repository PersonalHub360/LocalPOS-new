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
import { CreditCard, Banknote, Wallet, Smartphone } from "lucide-react";
import { useState } from "react";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: string, amountPaid: number) => void;
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

  const handleConfirm = () => {
    onConfirm(paymentMethod, parseFloat(amountPaid) || 0);
    setAmountPaid(total.toString());
    setPaymentMethod("cash");
  };

  const change = Math.max(0, parseFloat(amountPaid || "0") - total);

  const paymentMethods = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card Payment", icon: CreditCard },
    { value: "aba", label: "ABA", icon: Smartphone },
    { value: "acleda", label: "Acleda", icon: Wallet },
    { value: "due", label: "Due (Pay Later)", icon: CreditCard },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-payment">
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
