import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";
import { 
  Save, 
  Building2, 
  CreditCard, 
  Receipt, 
  Users, 
  Printer, 
  DollarSign, 
  Database, 
  Bell,
  Palette,
  Percent
} from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState<Partial<Settings>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const updateField = (field: keyof Settings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">Configure system settings and preferences</p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-5 lg:grid-cols-10 gap-2 h-auto p-1">
            <TabsTrigger value="general" className="flex items-center gap-2" data-testid="tab-general">
              <Building2 className="w-4 h-4" />
              <span className="hidden lg:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2" data-testid="tab-payment">
              <CreditCard className="w-4 h-4" />
              <span className="hidden lg:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="tax" className="flex items-center gap-2" data-testid="tab-tax">
              <Percent className="w-4 h-4" />
              <span className="hidden lg:inline">Tax</span>
            </TabsTrigger>
            <TabsTrigger value="receipt" className="flex items-center gap-2" data-testid="tab-receipt">
              <Receipt className="w-4 h-4" />
              <span className="hidden lg:inline">Receipt</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="printer" className="flex items-center gap-2" data-testid="tab-printer">
              <Printer className="w-4 h-4" />
              <span className="hidden lg:inline">Printer</span>
            </TabsTrigger>
            <TabsTrigger value="currency" className="flex items-center gap-2" data-testid="tab-currency">
              <DollarSign className="w-4 h-4" />
              <span className="hidden lg:inline">Currency</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2" data-testid="tab-backup">
              <Database className="w-4 h-4" />
              <span className="hidden lg:inline">Backup</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications">
              <Bell className="w-4 h-4" />
              <span className="hidden lg:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-2" data-testid="tab-theme">
              <Palette className="w-4 h-4" />
              <span className="hidden lg:inline">Theme</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure business information and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input 
                      id="business-name" 
                      value={formData.businessName || ""} 
                      onChange={(e) => updateField("businessName", e.target.value)}
                      data-testid="input-business-name" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="business-logo">Business Logo</Label>
                    <Input 
                      id="business-logo" 
                      type="file" 
                      accept="image/*"
                      data-testid="input-business-logo" 
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload your business logo (PNG, JPG, or SVG)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="address">Business Address</Label>
                    <Textarea 
                      id="address" 
                      value={formData.address || ""} 
                      onChange={(e) => updateField("address", e.target.value)}
                      rows={3} 
                      data-testid="input-address" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Contact Phone</Label>
                      <Input 
                        id="phone" 
                        value={formData.phone || ""} 
                        onChange={(e) => updateField("phone", e.target.value)}
                        data-testid="input-phone" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Contact Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={formData.email || ""} 
                        onChange={(e) => updateField("email", e.target.value)}
                        data-testid="input-email" 
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date-format">Date Format</Label>
                      <Select 
                        value={formData.dateFormat || "dd-mm-yyyy"} 
                        onValueChange={(value) => updateField("dateFormat", value)}
                      >
                        <SelectTrigger id="date-format" data-testid="select-date-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="time-format">Time Format</Label>
                      <Select 
                        value={formData.timeFormat || "12h"} 
                        onValueChange={(value) => updateField("timeFormat", value)}
                      >
                        <SelectTrigger id="time-format" data-testid="select-time-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                          <SelectItem value="24h">24-hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="terminal-id">Terminal/Register ID</Label>
                    <Input 
                      id="terminal-id" 
                      value={formData.terminalId || ""} 
                      onChange={(e) => updateField("terminalId", e.target.value)}
                      data-testid="input-terminal-id" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods Configuration</CardTitle>
                <CardDescription>Enable or disable payment options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cash Payment</Label>
                      <p className="text-sm text-muted-foreground">Accept cash payments</p>
                    </div>
                    <Switch 
                      checked={formData.paymentCash === "true"}
                      onCheckedChange={(checked) => updateField("paymentCash", checked ? "true" : "false")}
                      data-testid="switch-payment-cash"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Card Payment</Label>
                      <p className="text-sm text-muted-foreground">Accept credit/debit card payments</p>
                    </div>
                    <Switch 
                      checked={formData.paymentCard === "true"}
                      onCheckedChange={(checked) => updateField("paymentCard", checked ? "true" : "false")}
                      data-testid="switch-payment-card"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>ABA Bank Transfer</Label>
                      <p className="text-sm text-muted-foreground">Accept ABA bank transfers</p>
                    </div>
                    <Switch 
                      checked={formData.paymentAba === "true"}
                      onCheckedChange={(checked) => updateField("paymentAba", checked ? "true" : "false")}
                      data-testid="switch-payment-aba"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Acleda Bank Transfer</Label>
                      <p className="text-sm text-muted-foreground">Accept Acleda bank transfers</p>
                    </div>
                    <Switch 
                      checked={formData.paymentAcleda === "true"}
                      onCheckedChange={(checked) => updateField("paymentAcleda", checked ? "true" : "false")}
                      data-testid="switch-payment-acleda"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Credit/Due Payment</Label>
                      <p className="text-sm text-muted-foreground">Allow customers to pay later</p>
                    </div>
                    <Switch 
                      checked={formData.paymentCredit === "true"}
                      onCheckedChange={(checked) => updateField("paymentCredit", checked ? "true" : "false")}
                      data-testid="switch-payment-credit"
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="default-payment">Default Payment Method</Label>
                    <Select 
                      value={formData.defaultPaymentMethod || "cash"} 
                      onValueChange={(value) => updateField("defaultPaymentMethod", value)}
                    >
                      <SelectTrigger id="default-payment" data-testid="select-default-payment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="aba">ABA</SelectItem>
                        <SelectItem value="acleda">Acleda</SelectItem>
                        <SelectItem value="credit">Credit/Due</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min-amount">Minimum Transaction Amount</Label>
                      <Input 
                        id="min-amount" 
                        type="number" 
                        value={formData.minTransactionAmount || "0"} 
                        onChange={(e) => updateField("minTransactionAmount", e.target.value)}
                        data-testid="input-min-amount" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-amount">Maximum Transaction Amount</Label>
                      <Input 
                        id="max-amount" 
                        type="number" 
                        value={formData.maxTransactionAmount || ""} 
                        onChange={(e) => updateField("maxTransactionAmount", e.target.value)}
                        data-testid="input-max-amount" 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax & Discount Settings</CardTitle>
                <CardDescription>Configure tax rates and discount options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vat-rate">VAT/Sales Tax Rate (%)</Label>
                    <Input 
                      id="vat-rate" 
                      type="number" 
                      value={formData.vatRate || "0"} 
                      onChange={(e) => updateField("vatRate", e.target.value)}
                      data-testid="input-vat-rate" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="service-tax">Service Tax Rate (%)</Label>
                    <Input 
                      id="service-tax" 
                      type="number" 
                      value={formData.serviceTaxRate || "0"} 
                      onChange={(e) => updateField("serviceTaxRate", e.target.value)}
                      data-testid="input-service-tax" 
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="default-discount">Default Discount (%)</Label>
                    <Input 
                      id="default-discount" 
                      type="number" 
                      value={formData.defaultDiscount || "0"} 
                      onChange={(e) => updateField("defaultDiscount", e.target.value)}
                      data-testid="input-default-discount" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Percentage Discount</Label>
                      <p className="text-sm text-muted-foreground">Allow percentage-based discounts</p>
                    </div>
                    <Switch 
                      checked={formData.enablePercentageDiscount === "true"}
                      onCheckedChange={(checked) => updateField("enablePercentageDiscount", checked ? "true" : "false")}
                      data-testid="switch-percentage-discount" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Fixed Amount Discount</Label>
                      <p className="text-sm text-muted-foreground">Allow fixed dollar discounts</p>
                    </div>
                    <Switch 
                      checked={formData.enableFixedDiscount === "true"}
                      onCheckedChange={(checked) => updateField("enableFixedDiscount", checked ? "true" : "false")}
                      data-testid="switch-fixed-discount" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-discount">Maximum Discount (%)</Label>
                    <Input 
                      id="max-discount" 
                      type="number" 
                      value={formData.maxDiscount || "50"} 
                      onChange={(e) => updateField("maxDiscount", e.target.value)}
                      data-testid="input-max-discount" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipt" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Receipt & Invoice Settings</CardTitle>
                <CardDescription>Customize receipt appearance and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="invoice-prefix">Invoice Number Prefix</Label>
                    <Input 
                      id="invoice-prefix" 
                      value={formData.invoicePrefix || "INV-"} 
                      onChange={(e) => updateField("invoicePrefix", e.target.value)}
                      data-testid="input-invoice-prefix" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="receipt-header">Receipt Header Text</Label>
                    <Textarea 
                      id="receipt-header" 
                      value={formData.receiptHeader || ""} 
                      onChange={(e) => updateField("receiptHeader", e.target.value)}
                      rows={2} 
                      data-testid="input-receipt-header" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="receipt-footer">Receipt Footer Text</Label>
                    <Textarea 
                      id="receipt-footer" 
                      value={formData.receiptFooter || ""} 
                      onChange={(e) => updateField("receiptFooter", e.target.value)}
                      rows={3} 
                      data-testid="input-receipt-footer" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="receipt-logo">Receipt Logo</Label>
                    <Input 
                      id="receipt-logo" 
                      type="file" 
                      accept="image/*"
                      data-testid="input-receipt-logo" 
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload your business logo for receipts (PNG, JPG, or SVG)
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Print Receipt</Label>
                      <p className="text-sm text-muted-foreground">Automatically print after payment</p>
                    </div>
                    <Switch 
                      checked={formData.autoPrintReceipt === "true"}
                      onCheckedChange={(checked) => updateField("autoPrintReceipt", checked ? "true" : "false")}
                      data-testid="switch-auto-print" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show Logo on Receipt</Label>
                      <p className="text-sm text-muted-foreground">Display business logo on printed receipts</p>
                    </div>
                    <Switch 
                      checked={formData.showLogoOnReceipt === "true"}
                      onCheckedChange={(checked) => updateField("showLogoOnReceipt", checked ? "true" : "false")}
                      data-testid="switch-show-logo" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Include Tax Breakdown</Label>
                      <p className="text-sm text-muted-foreground">Show detailed tax information</p>
                    </div>
                    <Switch 
                      checked={formData.includeTaxBreakdown === "true"}
                      onCheckedChange={(checked) => updateField("includeTaxBreakdown", checked ? "true" : "false")}
                      data-testid="switch-tax-breakdown" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User & Access Management</CardTitle>
                <CardDescription>Manage staff users and permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">Staff Users</h3>
                      <p className="text-sm text-muted-foreground">Add and manage staff access</p>
                    </div>
                    <Button data-testid="button-add-user">Add User</Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-md">
                      <div>
                        <p className="font-medium">Admin User</p>
                        <p className="text-sm text-muted-foreground">Full system access</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Manager</span>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-1">Edit</Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-md">
                      <div>
                        <p className="font-medium">Cashier 01</p>
                        <p className="text-sm text-muted-foreground">POS and sales access</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Cashier</span>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-2">Edit</Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Role Permissions</h4>
                    <p className="text-sm text-muted-foreground mb-4">Configure default permissions for cashier role</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Access to Reports</Label>
                          <p className="text-xs text-muted-foreground">View sales and analytics reports</p>
                        </div>
                        <Switch 
                          checked={formData.permAccessReports === "true"}
                          onCheckedChange={(checked) => updateField("permAccessReports", checked ? "true" : "false")}
                          data-testid="switch-perm-reports" 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Access to Settings</Label>
                          <p className="text-xs text-muted-foreground">Modify system configuration</p>
                        </div>
                        <Switch 
                          checked={formData.permAccessSettings === "true"}
                          onCheckedChange={(checked) => updateField("permAccessSettings", checked ? "true" : "false")}
                          data-testid="switch-perm-settings" 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Process Refunds</Label>
                          <p className="text-xs text-muted-foreground">Issue refunds and reversals</p>
                        </div>
                        <Switch 
                          checked={formData.permProcessRefunds === "true"}
                          onCheckedChange={(checked) => updateField("permProcessRefunds", checked ? "true" : "false")}
                          data-testid="switch-perm-refunds" 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Manage Inventory</Label>
                          <p className="text-xs text-muted-foreground">Add and edit inventory items</p>
                        </div>
                        <Switch 
                          checked={formData.permManageInventory === "true"}
                          onCheckedChange={(checked) => updateField("permManageInventory", checked ? "true" : "false")}
                          data-testid="switch-perm-inventory" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="printer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Printer & Hardware Setup</CardTitle>
                <CardDescription>Configure POS hardware devices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="receipt-printer">Receipt Printer</Label>
                    <Select 
                      value={formData.receiptPrinter || "default"} 
                      onValueChange={(value) => updateField("receiptPrinter", value)}
                    >
                      <SelectTrigger id="receipt-printer" data-testid="select-receipt-printer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default Printer</SelectItem>
                        <SelectItem value="epson-tm">Epson TM-T88</SelectItem>
                        <SelectItem value="star-tsp">Star TSP143</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="kitchen-printer">Kitchen Printer (KOT)</Label>
                    <Select 
                      value={formData.kitchenPrinter || "none"} 
                      onValueChange={(value) => updateField("kitchenPrinter", value)}
                    >
                      <SelectTrigger id="kitchen-printer" data-testid="select-kitchen-printer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="epson-tm">Epson TM-T88</SelectItem>
                        <SelectItem value="star-tsp">Star TSP143</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="paper-size">Paper Size</Label>
                    <Select 
                      value={formData.paperSize || "80mm"} 
                      onValueChange={(value) => updateField("paperSize", value)}
                    >
                      <SelectTrigger id="paper-size" data-testid="select-paper-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">58mm</SelectItem>
                        <SelectItem value="80mm">80mm</SelectItem>
                        <SelectItem value="a4">A4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Barcode Scanner</Label>
                      <p className="text-sm text-muted-foreground">Connect barcode scanner device</p>
                    </div>
                    <Switch 
                      checked={formData.enableBarcodeScanner === "true"}
                      onCheckedChange={(checked) => updateField("enableBarcodeScanner", checked ? "true" : "false")}
                      data-testid="switch-barcode-scanner" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Cash Drawer</Label>
                      <p className="text-sm text-muted-foreground">Auto-open cash drawer on payment</p>
                    </div>
                    <Switch 
                      checked={formData.enableCashDrawer === "true"}
                      onCheckedChange={(checked) => updateField("enableCashDrawer", checked ? "true" : "false")}
                      data-testid="switch-cash-drawer" 
                    />
                  </div>

                  <div>
                    <Button variant="outline" className="w-full" data-testid="button-test-printer">
                      <Printer className="w-4 h-4 mr-2" />
                      Test Print
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="currency" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Currency & Localization</CardTitle>
                <CardDescription>Set currency and regional preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select 
                      value={formData.currency || "usd"} 
                      onValueChange={(value) => updateField("currency", value)}
                    >
                      <SelectTrigger id="currency" data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="khr">KHR (៛)</SelectItem>
                        <SelectItem value="eur">EUR (€)</SelectItem>
                        <SelectItem value="gbp">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      value={formData.language || "en"} 
                      onValueChange={(value) => updateField("language", value)}
                    >
                      <SelectTrigger id="language" data-testid="select-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="km">Khmer</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="th">Thai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="decimal-places">Decimal Places</Label>
                    <Select 
                      value={formData.decimalPlaces || "2"} 
                      onValueChange={(value) => updateField("decimalPlaces", value)}
                    >
                      <SelectTrigger id="decimal-places" data-testid="select-decimal-places">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 (No decimals)</SelectItem>
                        <SelectItem value="2">2 (0.00)</SelectItem>
                        <SelectItem value="3">3 (0.000)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="rounding">Rounding Rule</Label>
                    <Select 
                      value={formData.roundingRule || "nearest"} 
                      onValueChange={(value) => updateField("roundingRule", value)}
                    >
                      <SelectTrigger id="rounding" data-testid="select-rounding">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nearest">Round to Nearest</SelectItem>
                        <SelectItem value="up">Round Up</SelectItem>
                        <SelectItem value="down">Round Down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="currency-symbol">Currency Symbol Position</Label>
                    <Select 
                      value={formData.currencySymbolPosition || "before"} 
                      onValueChange={(value) => updateField("currencySymbolPosition", value)}
                    >
                      <SelectTrigger id="currency-symbol" data-testid="select-symbol-position">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before Amount ($100)</SelectItem>
                        <SelectItem value="after">After Amount (100$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Backup & Data Management</CardTitle>
                <CardDescription>Configure data backup and recovery options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Automatic Backups</Label>
                      <p className="text-sm text-muted-foreground">Backup data automatically</p>
                    </div>
                    <Switch 
                      checked={formData.autoBackup === "true"}
                      onCheckedChange={(checked) => updateField("autoBackup", checked ? "true" : "false")}
                      data-testid="switch-auto-backup" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="backup-frequency">Backup Frequency</Label>
                    <Select 
                      value={formData.backupFrequency || "daily"} 
                      onValueChange={(value) => updateField("backupFrequency", value)}
                    >
                      <SelectTrigger id="backup-frequency" data-testid="select-backup-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="backup-storage">Backup Storage</Label>
                    <Select 
                      value={formData.backupStorage || "cloud"} 
                      onValueChange={(value) => updateField("backupStorage", value)}
                    >
                      <SelectTrigger id="backup-storage" data-testid="select-backup-storage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Storage</SelectItem>
                        <SelectItem value="cloud">Cloud Storage</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Manual Backup & Recovery</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" data-testid="button-backup-now">
                        <Database className="w-4 h-4 mr-2" />
                        Backup Now
                      </Button>
                      <Button variant="outline" className="flex-1" data-testid="button-restore">
                        <Database className="w-4 h-4 mr-2" />
                        Restore Data
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Last backup: Never
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notifications & Alerts</CardTitle>
                <CardDescription>Configure system notifications and alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Low Stock Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notify when inventory is low</p>
                    </div>
                    <Switch 
                      checked={formData.lowStockAlerts === "true"}
                      onCheckedChange={(checked) => updateField("lowStockAlerts", checked ? "true" : "false")}
                      data-testid="switch-low-stock-alerts" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="stock-threshold">Low Stock Threshold</Label>
                    <Input 
                      id="stock-threshold" 
                      type="number" 
                      value={formData.stockThreshold || 10} 
                      onChange={(e) => updateField("stockThreshold", parseInt(e.target.value))}
                      data-testid="input-stock-threshold" 
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sale Notifications</Label>
                      <p className="text-sm text-muted-foreground">Alert on new sales</p>
                    </div>
                    <Switch 
                      checked={formData.saleNotifications === "true"}
                      onCheckedChange={(checked) => updateField("saleNotifications", checked ? "true" : "false")}
                      data-testid="switch-sale-notifications" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Discount Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notify when discounts are applied</p>
                    </div>
                    <Switch 
                      checked={formData.discountAlerts === "true"}
                      onCheckedChange={(checked) => updateField("discountAlerts", checked ? "true" : "false")}
                      data-testid="switch-discount-alerts" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Update Notifications</Label>
                      <p className="text-sm text-muted-foreground">Alert on system updates</p>
                    </div>
                    <Switch 
                      checked={formData.systemUpdateNotifications === "true"}
                      onCheckedChange={(checked) => updateField("systemUpdateNotifications", checked ? "true" : "false")}
                      data-testid="switch-system-updates" 
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="notification-email">Notification Email</Label>
                    <Input 
                      id="notification-email" 
                      type="email" 
                      value={formData.notificationEmail || ""} 
                      onChange={(e) => updateField("notificationEmail", e.target.value)}
                      data-testid="input-notification-email" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="theme" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customization & Themes</CardTitle>
                <CardDescription>Customize the appearance of your POS system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="color-theme">Color Theme</Label>
                    <Select 
                      value={formData.colorTheme || "orange"} 
                      onValueChange={(value) => updateField("colorTheme", value)}
                    >
                      <SelectTrigger id="color-theme" data-testid="select-color-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="orange">Orange (Default)</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="layout">Layout Preference</Label>
                    <Select 
                      value={formData.layoutPreference || "grid"} 
                      onValueChange={(value) => updateField("layoutPreference", value)}
                    >
                      <SelectTrigger id="layout" data-testid="select-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid View</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="font-size">Font Size</Label>
                    <Select 
                      value={formData.fontSize || "medium"} 
                      onValueChange={(value) => updateField("fontSize", value)}
                    >
                      <SelectTrigger id="font-size" data-testid="select-font-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
                    </div>
                    <Switch 
                      checked={formData.compactMode === "true"}
                      onCheckedChange={(checked) => updateField("compactMode", checked ? "true" : "false")}
                      data-testid="switch-compact-mode" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show Animations</Label>
                      <p className="text-sm text-muted-foreground">Enable UI animations</p>
                    </div>
                    <Switch 
                      checked={formData.showAnimations === "true"}
                      onCheckedChange={(checked) => updateField("showAnimations", checked ? "true" : "false")}
                      data-testid="switch-animations" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
