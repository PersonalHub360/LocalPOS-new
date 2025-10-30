import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar as CalendarIcon,
  Download,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

type DateFilter = "today" | "yesterday" | "thismonth" | "lastmonth" | "custom";

export default function BankStatement() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const { data: sales = [] } = useQuery<Order[]>({
    queryKey: ["/api/sales"],
  });

  const getFilteredSales = () => {
    const now = new Date();
    let startDate = new Date();

    switch (dateFilter) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "thismonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "lastmonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "custom":
        if (customStartDate) {
          startDate = customStartDate;
        }
        break;
    }

    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      let dateMatch = false;

      if (dateFilter === "custom" && customEndDate) {
        dateMatch = saleDate >= startDate && saleDate <= customEndDate;
      } else {
        dateMatch = saleDate >= startDate;
      }

      return dateMatch && sale.status === "completed";
    });
  };

  const filteredSales = getFilteredSales();

  const paymentTotals = filteredSales.reduce(
    (acc, sale) => {
      const method = sale.paymentMethod || "unknown";
      const total = parseFloat(sale.total);
      if (!acc[method]) {
        acc[method] = { total: 0, count: 0 };
      }
      acc[method].total += total;
      acc[method].count += 1;
      return acc;
    },
    {} as Record<string, { total: number; count: number }>
  );

  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + parseFloat(sale.total),
    0
  );
  const totalTransactions = filteredSales.length;

  const paymentMethodsData = [
    { name: "ABA", key: "aba", icon: CreditCard, color: "bg-blue-500" },
    { name: "Acleda", key: "acleda", icon: CreditCard, color: "bg-green-500" },
    { name: "Cash", key: "cash", icon: Banknote, color: "bg-yellow-500" },
    { name: "Due", key: "due", icon: DollarSign, color: "bg-orange-500" },
    { name: "Card", key: "card", icon: CreditCard, color: "bg-purple-500" },
    {
      name: "Cash And ABA",
      key: "cash and aba",
      icon: CreditCard,
      color: "bg-indigo-500",
    },
    {
      name: "Cash And Acleda",
      key: "cash and acleda",
      icon: CreditCard,
      color: "bg-teal-500",
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-bank-statement-title">
            Bank Statement
          </h1>
          <p className="text-muted-foreground">
            Payment dashboard and sales breakdown by payment method
          </p>
        </div>
        <Button variant="outline" data-testid="button-export-statement">
          <Download className="w-4 h-4 mr-2" />
          Export Statement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Date Range
              </label>
              <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
                <SelectTrigger data-testid="select-date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="thismonth">This Month</SelectItem>
                  <SelectItem value="lastmonth">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === "custom" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Start Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customStartDate
                          ? format(customStartDate, "MMM dd, yyyy")
                          : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    End Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid="button-end-date"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customEndDate
                          ? format(customEndDate, "MMM dd, yyyy")
                          : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-revenue">
              ${totalRevenue.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              ៛{(totalRevenue * 4100).toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {totalTransactions} completed transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-transactions">
              {totalTransactions}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Completed orders
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Avg: ${totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : "0.00"} per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Dashboard</CardTitle>
          <CardDescription>Sales breakdown by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paymentMethodsData.map((method) => {
              const data = paymentTotals[method.key] || { total: 0, count: 0 };
              const Icon = method.icon;
              return (
                <Card key={method.key} className="p-4" data-testid={`card-${method.key}`}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {method.name}
                      </Badge>
                      <div className={`p-2 rounded-lg ${method.color} bg-opacity-10`}>
                        <Icon className={`w-4 h-4 ${method.color.replace('bg-', 'text-')}`} />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid={`text-${method.key}-total`}>
                        ${data.total.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ៛{(data.total * 4100).toFixed(0)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.count} {data.count === 1 ? "transaction" : "transactions"}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {Object.keys(paymentTotals).length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No completed transactions found for the selected date range
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
