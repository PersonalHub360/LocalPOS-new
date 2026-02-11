import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Eye, Edit, Trash2, Search, Users, DollarSign, Upload, Download, User, Briefcase, Building2, ImagePlus } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import type { Employee, StaffSalary, Position, Department } from "@shared/schema";

const EMPTY_EMPLOYEES: Employee[] = [];
const EMPTY_POSITIONS: Position[] = [];
const EMPTY_DEPARTMENTS: Department[] = [];

export default function StaffSalaryPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("staff");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [salaryDate, setSalaryDate] = useState<Date>(new Date());
  const [showBulkReleaseConfirm, setShowBulkReleaseConfirm] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [exportingSalaries, setExportingSalaries] = useState(false);
  const [showAddPositionDialog, setShowAddPositionDialog] = useState(false);
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [deletePositionId, setDeletePositionId] = useState<string | null>(null);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const [positionFormData, setPositionFormData] = useState({ name: "", description: "" });
  const [departmentFormData, setDepartmentFormData] = useState({ name: "", description: "" });
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const editPhotoFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    employeeId: "",
    name: "",
    position: "",
    department: "",
    email: "",
    phone: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    salary: "",
    photoUrl: "",
    status: "active",
  });

  const { data: employees = EMPTY_EMPLOYEES, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // When months selected, use exact date-time range in local time (fixes timezone)
  const salaryListParams = () => {
    const params = new URLSearchParams();
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort();
      const [y1, m1] = sorted[0].split("-").map(Number);
      const [y2, m2] = sorted[sorted.length - 1].split("-").map(Number);
      params.append("startDate", new Date(y1, m1 - 1, 1, 0, 0, 0, 0).toISOString());
      params.append("endDate", new Date(y2, m2, 0, 23, 59, 59, 999).toISOString());
    }
    return params.toString();
  };

  const salaryParamsString = salaryListParams();

  const { data: salariesWithEmployees = [], isLoading: salariesLoading } = useQuery<(StaffSalary & { employee: Employee | null })[]>({
    queryKey: ["/api/staff-salaries/with-employees", salaryParamsString],
    queryFn: async () => {
      const res = await fetch(`/api/staff-salaries/with-employees${salaryParamsString ? `?${salaryParamsString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salaries");
      return res.json();
    },
  });

  const { data: salarySummary } = useQuery<{ totalSalaries: number; totalAmount: number; netTotal: number; employeeCount: number }>({
    queryKey: ["/api/staff-salaries/summary", salaryParamsString],
    queryFn: async () => {
      const res = await fetch(`/api/staff-salaries/summary${salaryParamsString ? `?${salaryParamsString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary summary");
      return res.json();
    },
  });

  const { data: positions = EMPTY_POSITIONS } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: departments = EMPTY_DEPARTMENTS } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      return apiRequest("POST", "/api/employees", {
        ...data,
        joiningDate: new Date(data.joiningDate!).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Success", description: "Staff added successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to add staff", variant: "destructive" });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
      return apiRequest("PATCH", `/api/employees/${id}`, {
        ...data,
        joiningDate: data.joiningDate ? new Date(data.joiningDate).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditEmployee(null);
      toast({ title: "Success", description: "Staff updated successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to update staff", variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setDeleteEmployeeId(null);
      toast({ title: "Success", description: "Staff deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete staff", variant: "destructive" });
    },
  });

  const createPositionMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => apiRequest("POST", "/api/positions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setShowAddPositionDialog(false);
      setPositionFormData({ name: "", description: "" });
      toast({ title: "Success", description: "Position added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add position", variant: "destructive" }),
  });

  const updatePositionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Position> }) => apiRequest("PATCH", `/api/positions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setEditPosition(null);
      toast({ title: "Success", description: "Position updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update position", variant: "destructive" }),
  });

  const deletePositionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setDeletePositionId(null);
      toast({ title: "Success", description: "Position deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete position", variant: "destructive" }),
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowAddDepartmentDialog(false);
      setDepartmentFormData({ name: "", description: "" });
      toast({ title: "Success", description: "Department added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add department", variant: "destructive" }),
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => apiRequest("PATCH", `/api/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditDepartment(null);
      toast({ title: "Success", description: "Department updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update department", variant: "destructive" }),
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeleteDepartmentId(null);
      toast({ title: "Success", description: "Department deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete department", variant: "destructive" }),
  });

  const bulkReleaseMutation = useMutation({
    mutationFn: async (payload: { employeeIds: string[]; salaryDate: string }) => {
      const salaries = payload.employeeIds.map((employeeId) => {
        const emp = employees.find((e) => e.id === employeeId);
        const amount = emp ? parseFloat(emp.salary) : 0;
        return {
          employeeId,
          salaryDate: payload.salaryDate,
          salaryAmount: amount.toString(),
          deductSalary: "0",
          totalSalary: amount.toString(),
        };
      });
      const res = await apiRequest("POST", "/api/staff-salaries/bulk-release", { salaries });
      return (await res.json()) as { success: number; failed: number };
    },
    onSuccess: (data: { success: number; failed: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-salaries/with-employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setSelectedIds(new Set());
      setShowBulkReleaseConfirm(false);
      toast({ title: "Success", description: `Salary released for ${data.success} staff` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to release salaries", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      employeeId: "",
      name: "",
      position: "",
      department: "",
      email: "",
      phone: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      salary: "",
      photoUrl: "",
      status: "active",
    });
  };

  const filteredStaff = employees.filter((e) => {
    const term = searchTerm.toLowerCase();
    return (
      e.name.toLowerCase().includes(term) ||
      e.employeeId.toLowerCase().includes(term) ||
      (e.position && e.position.toLowerCase().includes(term)) ||
      (e.department && e.department.toLowerCase().includes(term)) ||
      (e.email && e.email.toLowerCase().includes(term))
    );
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStaff.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStaff.map((e) => e.id)));
    }
  };

  const handleAddStaff = () => {
    if (!formData.employeeId || !formData.name || !formData.position || !formData.department || !formData.salary) {
      toast({ title: "Error", description: "Fill required fields: Employee ID, Name, Position, Department, Salary", variant: "destructive" });
      return;
    }
    createEmployeeMutation.mutate({
      employeeId: formData.employeeId,
      name: formData.name,
      position: formData.position,
      department: formData.department,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      joiningDate: new Date(formData.joiningDate),
      salary: formData.salary,
      photoUrl: formData.photoUrl || undefined,
      status: formData.status as "active" | "inactive",
    });
  };

  const handleEditSave = () => {
    if (!editEmployee) return;
    updateEmployeeMutation.mutate({
      id: editEmployee.id,
      data: {
        employeeId: editEmployee.employeeId,
        name: editEmployee.name,
        position: editEmployee.position,
        department: editEmployee.department,
        email: editEmployee.email ?? undefined,
        phone: editEmployee.phone ?? undefined,
        joiningDate: editEmployee.joiningDate ? new Date(editEmployee.joiningDate) : undefined,
        salary: editEmployee.salary,
        photoUrl: editEmployee.photoUrl ?? undefined,
        status: editEmployee.status,
      },
    });
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      const list = Array.isArray(parsed) ? parsed : parsed.employees || parsed.data || [];
      if (list.length === 0) {
        toast({ title: "Error", description: "No valid employee data", variant: "destructive" });
        return;
      }
      apiRequest("POST", "/api/employees/import", { employees: list })
        .then((res: any) => res.json?.() ?? res)
        .then((result: { success: number; failed: number }) => {
          queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
          setImportJson("");
          toast({ title: "Import done", description: `Imported ${result.success}, failed ${result.failed}` });
        })
        .catch(() => toast({ title: "Error", description: "Import failed", variant: "destructive" }));
    } catch {
      toast({ title: "Error", description: "Invalid JSON", variant: "destructive" });
    }
  };

  const handleExport = () => {
    fetch("/api/employees/export", { credentials: "include" })
      .then((res) => res.json())
      .then((data: Employee[]) => {
        const headers = ["employeeId", "name", "position", "department", "email", "phone", "joiningDate", "salary", "status"];
        const csv = [headers.join(","), ...data.map((e) => headers.map((h) => JSON.stringify((e as any)[h] ?? "")).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `staff-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Exported", description: `${data.length} staff exported` });
      })
      .catch(() => toast({ title: "Error", description: "Export failed", variant: "destructive" }));
  };

  const handleExportSalaries = async () => {
    setExportingSalaries(true);
    try {
      const q = salaryListParams();
      const res = await fetch(`/api/staff-salaries/export${q ? `?${q}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export");
      const { salaries: list } = await res.json();
      const exportData = (list || []).map((s: StaffSalary & { employee: Employee | null }) => ({
        "Employee": s.employee?.name ?? "",
        "Salary Date": format(new Date(s.salaryDate), "yyyy-MM-dd"),
        "Salary Amount": s.salaryAmount,
        "Deductions": s.deductSalary,
        "Total": s.totalSalary,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Salaries");
      XLSX.writeFile(wb, `staff-salaries-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Success", description: `Exported ${exportData.length} salary records` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExportingSalaries(false);
    }
  };

  const handleBulkRelease = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Error", description: "Select at least one staff", variant: "destructive" });
      return;
    }
    setShowBulkReleaseConfirm(true);
  };

  const confirmBulkRelease = () => {
    bulkReleaseMutation.mutate({
      employeeIds: Array.from(selectedIds),
      salaryDate: salaryDate.toISOString(),
    });
  };

  const formatCurrency = (v: string | number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image", variant: "destructive" });
      return;
    }
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formDataUpload, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.url ? `${window.location.origin}${data.url}` : data.url;
      if (isEdit && editEmployee) {
        setEditEmployee({ ...editEmployee, photoUrl: url });
      } else {
        setFormData((f) => ({ ...f, photoUrl: url }));
      }
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleAddPosition = () => {
    if (!positionFormData.name.trim()) {
      toast({ title: "Error", description: "Position name required", variant: "destructive" });
      return;
    }
    createPositionMutation.mutate(positionFormData);
  };

  const handleAddDepartment = () => {
    if (!departmentFormData.name.trim()) {
      toast({ title: "Error", description: "Department name required", variant: "destructive" });
      return;
    }
    createDepartmentMutation.mutate(departmentFormData);
  };

  const STAFF_IMPORT_HEADERS = ["employeeId", "name", "position", "department", "email", "phone", "joiningDate", "salary", "status"];
  const sampleStaffRow: Record<string, string> = {
    employeeId: "E001",
    name: "John Doe",
    position: "Waiter",
    department: "F&B",
    email: "john@example.com",
    phone: "+1234567890",
    joiningDate: "2024-01-15",
    salary: "1200",
    status: "active",
  };

  const handleDownloadSampleExcel = () => {
    const headerLine = STAFF_IMPORT_HEADERS.join(",");
    const exampleLine = STAFF_IMPORT_HEADERS.map((h) => {
      const v = sampleStaffRow[h] ?? "";
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",");
    const csv = [headerLine, exampleLine].join("\r\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-import-sample-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Sample CSV. Fill and import via CSV or Excel." });
  };

  const handleDownloadSampleExcelXlsx = () => {
    const wsData = [
      STAFF_IMPORT_HEADERS,
      STAFF_IMPORT_HEADERS.map((h) => sampleStaffRow[h] ?? ""),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-import-sample-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Sample Excel (.xlsx). Fill and use Import from CSV or Excel." });
  };

  const parseCsvToStaffList = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const parseCsvLine = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += c;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ""));
      return values;
    };
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });
      if (Object.values(row).some((v) => v.trim())) rows.push(row);
    }
    return rows;
  };

  const mapRowToEmployee = (row: Record<string, string | number | undefined>): Record<string, string> => {
    const get = (...keys: string[]) => {
      const val = keys.map((k) => row[k] ?? row[k.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")]).find((v) => v != null && String(v).trim() !== "");
      return val != null ? String(val).trim() : "";
    };
    const joining = get("joiningDate", "joining_date") || new Date().toISOString().slice(0, 10);
    const emp: Record<string, string> = {
      employeeId: get("employeeId", "employee_id") || "E0",
      name: get("name") || "Unknown",
      position: get("position") || "Staff",
      department: get("department") || "General",
      joiningDate: joining,
      salary: get("salary") || "0",
      status: (get("status") as "active" | "inactive") || "active",
    };
    const email = get("email");
    if (email) emp.email = email;
    const phone = get("phone");
    if (phone) emp.phone = phone;
    return emp;
  };

  const submitImport = (employeesData: Record<string, string>[]) => {
    if (employeesData.length === 0) return;
    fetch("/api/employees/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees: employeesData }),
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Import failed"))))
      .then((result: { success: number; failed: number }) => {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        setImportJson("");
        toast({ title: "Import done", description: `Imported ${result.success}, failed ${result.failed}` });
      })
      .catch(() => toast({ title: "Error", description: "Import failed", variant: "destructive" }));
  };

  const handleCsvFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const list = parseCsvToStaffList(text);
        if (list.length === 0) {
          toast({ title: "Error", description: "No valid rows in file", variant: "destructive" });
          e.target.value = "";
          return;
        }
        const employeesData = list.map((row) => mapRowToEmployee(row));
        submitImport(employeesData);
      } catch {
        toast({ title: "Error", description: "Invalid CSV", variant: "destructive" });
      }
      e.target.value = "";
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleExcelFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array((event.target?.result as ArrayBuffer) ?? []);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast({ title: "Error", description: "No sheet in Excel file", variant: "destructive" });
          e.target.value = "";
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "", raw: false });
        if (rows.length === 0) {
          toast({ title: "Error", description: "No data rows in Excel", variant: "destructive" });
          e.target.value = "";
          return;
        }
        const employeesData = rows.map((row) => mapRowToEmployee(row as Record<string, string | number | undefined>));
        submitImport(employeesData);
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Invalid Excel file", variant: "destructive" });
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCsvOrExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      handleCsvFileImport(e);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      handleExcelFileImport(e);
    } else {
      toast({ title: "Error", description: "Use a .csv or .xlsx file", variant: "destructive" });
      e.target.value = "";
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Staff Salary</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Manage staff and release salaries</p>
          </div>
          {activeTab === "staff" && hasPermission("hrm.create") && (
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground">Active staff</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Salary Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salarySummary?.totalSalaries ?? salariesWithEmployees.length}</div>
              <p className="text-xs text-muted-foreground">Released payments</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Paid (period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(salarySummary?.netTotal ?? salariesWithEmployees.reduce((s, r) => s + parseFloat(r.totalSalary || "0"), 0))}
              </div>
              <p className="text-xs text-muted-foreground">From salary history</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="staff">
              <Users className="w-4 h-4 mr-2" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="salary">
              <DollarSign className="w-4 h-4 mr-2" />
              Salary Management
            </TabsTrigger>
            <TabsTrigger value="positions">
              <Briefcase className="w-4 h-4 mr-2" />
              Position Management
            </TabsTrigger>
            <TabsTrigger value="departments">
              <Building2 className="w-4 h-4 mr-2" />
              Department Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff List</CardTitle>
                <CardDescription>Add, edit, import/export staff. Click view for profile.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by name, ID, position, department..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  {hasPermission("hrm.create") && (
                    <>
                      <Button variant="outline" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                      <Button variant="outline" onClick={handleDownloadSampleExcel} title="Download sample CSV (opens in Excel)">
                        <Download className="w-4 h-4 mr-2" />
                        Download sample (CSV)
                      </Button>
                      <Button variant="outline" onClick={handleDownloadSampleExcelXlsx} title="Download sample Excel (.xlsx)">
                        <Download className="w-4 h-4 mr-2" />
                        Download sample (Excel)
                      </Button>
                      <Button variant="outline" onClick={() => setImportJson("[]")}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import (paste JSON)
                      </Button>
                      <label className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import from CSV or Excel
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvOrExcelImport} />
                      </label>
                    </>
                  )}
                </div>
                {importJson !== "" && (
                  <div className="space-y-2">
                    <Label>Paste JSON, or download sample CSV/Excel, fill in Excel, then use &quot;Import from CSV or Excel&quot; to upload .csv or .xlsx.</Label>
                    <textarea className="w-full min-h-[120px] rounded border bg-background px-3 py-2 text-sm" value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder='[{"employeeId":"E01","name":"...","position":"...","department":"...","joiningDate":"2024-01-01","salary":"1000"}]' />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleImport}>Import</Button>
                      <Button size="sm" variant="outline" onClick={() => setImportJson("")}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeesLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                      ) : filteredStaff.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No staff found</TableCell></TableRow>
                      ) : (
                        filteredStaff.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-mono text-xs">{emp.employeeId}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                  {emp.photoUrl ? (
                                    <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span>{emp.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell>{emp.department}</TableCell>
                            <TableCell>{formatCurrency(emp.salary)}</TableCell>
                            <TableCell>{emp.status}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => setViewEmployee(emp)} title="View profile">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission("hrm.edit") && (
                                <Button variant="ghost" size="icon" onClick={() => setEditEmployee(emp)} title="Edit">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission("hrm.delete") && (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteEmployeeId(emp.id)} title="Delete">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Release Salary</CardTitle>
                <CardDescription>Select staff and release salary for the chosen date. Amounts use staff base salary.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        Salary date: {format(salaryDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Calendar mode="single" selected={salaryDate} onSelect={(d) => d && setSalaryDate(d)} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[180px] justify-start">
                        {selectedMonths.length === 0 ? "All months" : selectedMonths.length <= 2 ? selectedMonths.map((m) => { const [y, mo] = m.split("-").map(Number); return format(new Date(y, mo - 1, 1), "MMM yyyy"); }).join(", ") : `${selectedMonths.length} months`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="max-h-[300px] overflow-y-auto p-2">
                        {Array.from({ length: 24 }, (_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - (23 - i));
                          const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                          const label = format(d, "MMMM yyyy");
                          const checked = selectedMonths.includes(value);
                          return (
                            <div key={value} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer" onClick={() => setSelectedMonths((prev) => (checked ? prev.filter((x) => x !== value) : [...prev, value].sort()))}>
                              <Checkbox checked={checked} onCheckedChange={() => {}} />
                              <span className="text-sm">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {hasPermission("reports.export") && (
                    <Button variant="outline" disabled={exportingSalaries} onClick={handleExportSalaries}>
                      <Download className="w-4 h-4 mr-2" />
                      {exportingSalaries ? "Exporting…" : "Export Salaries"}
                    </Button>
                  )}
                  {hasPermission("hrm.create") && (
                    <Button onClick={handleBulkRelease} disabled={selectedIds.size === 0}>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Release salary ({selectedIds.size} selected)
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={filteredStaff.length > 0 && selectedIds.size === filteredStaff.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Base Salary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeesLoading ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                      ) : filteredStaff.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No staff</TableCell></TableRow>
                      ) : (
                        filteredStaff.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <Checkbox checked={selectedIds.has(emp.id)} onCheckedChange={() => toggleSelect(emp.id)} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                  {emp.photoUrl ? (
                                    <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span>{emp.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell>{formatCurrency(emp.salary)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">Recent salary releases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-auto max-h-[280px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Staff</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salariesLoading ? (
                            <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
                          ) : salariesWithEmployees.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-muted-foreground">No releases yet</TableCell></TableRow>
                          ) : (
                            salariesWithEmployees.slice(0, 20).map((s) => (
                              <TableRow key={s.id}>
                                <TableCell>{format(new Date(s.salaryDate), "PP")}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                      {s.employee?.photoUrl ? (
                                        <img src={s.employee.photoUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <span>{s.employee?.name ?? s.employeeId}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{formatCurrency(s.totalSalary)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Positions</CardTitle>
                <CardDescription>Manage job positions for staff</CardDescription>
              </CardHeader>
              <CardContent>
                {hasPermission("hrm.create") && (
                  <Button className="mb-4" onClick={() => { setPositionFormData({ name: "", description: "" }); setShowAddPositionDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Position
                  </Button>
                )}
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No positions. Add one to use in staff.</TableCell></TableRow>
                      ) : (
                        positions.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.description ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {hasPermission("hrm.edit") && (
                                <Button variant="ghost" size="icon" onClick={() => setEditPosition(p)}><Edit className="h-4 w-4" /></Button>
                              )}
                              {hasPermission("hrm.delete") && (
                                <Button variant="ghost" size="icon" onClick={() => setDeletePositionId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Manage departments for staff</CardDescription>
              </CardHeader>
              <CardContent>
                {hasPermission("hrm.create") && (
                  <Button className="mb-4" onClick={() => { setDepartmentFormData({ name: "", description: "" }); setShowAddDepartmentDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Department
                  </Button>
                )}
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No departments. Add one to use in staff.</TableCell></TableRow>
                      ) : (
                        departments.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.name}</TableCell>
                            <TableCell>{d.description ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {hasPermission("hrm.edit") && (
                                <Button variant="ghost" size="icon" onClick={() => setEditDepartment(d)}><Edit className="h-4 w-4" /></Button>
                              )}
                              {hasPermission("hrm.delete") && (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteDepartmentId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile view modal */}
      <Dialog open={!!viewEmployee} onOpenChange={(open) => !open && setViewEmployee(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Profile</DialogTitle>
            <DialogDescription>View staff details</DialogDescription>
          </DialogHeader>
          {viewEmployee && (
            <div className="space-y-4">
              <div className="flex justify-center">
                {viewEmployee.photoUrl ? (
                  <img src={viewEmployee.photoUrl} alt={viewEmployee.name} className="w-24 h-24 rounded-full object-cover border-2" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="grid gap-2 text-sm">
                <p><span className="font-medium">Name:</span> {viewEmployee.name}</p>
                <p><span className="font-medium">Employee ID:</span> {viewEmployee.employeeId}</p>
                <p><span className="font-medium">Position:</span> {viewEmployee.position}</p>
                <p><span className="font-medium">Department:</span> {viewEmployee.department}</p>
                {viewEmployee.email && <p><span className="font-medium">Email:</span> {viewEmployee.email}</p>}
                {viewEmployee.phone && <p><span className="font-medium">Phone:</span> {viewEmployee.phone}</p>}
                <p><span className="font-medium">Joining date:</span> {viewEmployee.joiningDate ? format(new Date(viewEmployee.joiningDate), "PPP") : "—"}</p>
                <p><span className="font-medium">Salary:</span> {formatCurrency(viewEmployee.salary)}</p>
                <p><span className="font-medium">Status:</span> {viewEmployee.status}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add staff dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) setShowAddDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff</DialogTitle>
            <DialogDescription>Enter staff details</DialogDescription>
          </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee ID *</Label>
                <Input value={formData.employeeId} onChange={(e) => setFormData((f) => ({ ...f, employeeId: e.target.value }))} placeholder="e.g. E001" />
              </div>
              <div>
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Position *</Label>
                <div className="flex gap-1">
                  <Select value={formData.position} onValueChange={(v) => setFormData((f) => ({ ...f, position: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      {formData.position && !positions.some((p) => p.name === formData.position) && (
                        <SelectItem value={formData.position}>{formData.position}</SelectItem>
                      )}
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasPermission("hrm.create") && (
                    <Button type="button" variant="outline" size="icon" onClick={() => { setPositionFormData({ name: "", description: "" }); setShowAddPositionDialog(true); }} title="Add position">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>Department *</Label>
                <div className="flex gap-1">
                  <Select value={formData.department} onValueChange={(v) => setFormData((f) => ({ ...f, department: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {formData.department && !departments.some((d) => d.name === formData.department) && (
                        <SelectItem value={formData.department}>{formData.department}</SelectItem>
                      )}
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasPermission("hrm.create") && (
                    <Button type="button" variant="outline" size="icon" onClick={() => { setDepartmentFormData({ name: "", description: "" }); setShowAddDepartmentDialog(true); }} title="Add department">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Joining date *</Label>
                <Input type="date" value={formData.joiningDate} onChange={(e) => setFormData((f) => ({ ...f, joiningDate: e.target.value }))} />
              </div>
              <div>
                <Label>Salary *</Label>
                <Input type="number" step="0.01" value={formData.salary} onChange={(e) => setFormData((f) => ({ ...f, salary: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Photo (optional)</Label>
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden border-2 bg-muted flex items-center justify-center relative">
                  {formData.photoUrl && (
                    <img
                      src={formData.photoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover absolute inset-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  )}
                  <div className={`w-full h-full flex items-center justify-center ${formData.photoUrl ? "hidden" : ""}`}>
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex gap-2 items-center">
                    <Input value={formData.photoUrl} onChange={(e) => setFormData((f) => ({ ...f, photoUrl: e.target.value }))} placeholder="Enter image URL" className="flex-1 min-w-0" />
                    <input type="file" accept="image/*" className="hidden" ref={photoFileInputRef} onChange={(e) => handlePhotoUpload(e, false)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => photoFileInputRef.current?.click()} title="Upload photo">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Paste a URL or click Upload to choose an image</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddStaff}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit staff dialog */}
      <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Employee ID</Label>
                    <Input value={editEmployee.employeeId} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, employeeId: e.target.value } : null)} />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={editEmployee.name} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, name: e.target.value } : null)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Position</Label>
                    <div className="flex gap-1">
                      <Select value={editEmployee.position} onValueChange={(v) => setEditEmployee((prev) => prev ? { ...prev, position: v } : null)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select position" /></SelectTrigger>
                        <SelectContent>
                          {positions.map((p) => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasPermission("hrm.create") && (
                        <Button type="button" variant="outline" size="icon" onClick={() => { setPositionFormData({ name: "", description: "" }); setShowAddPositionDialog(true); }}><Plus className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <div className="flex gap-1">
                      <Select value={editEmployee.department} onValueChange={(v) => setEditEmployee((prev) => prev ? { ...prev, department: v } : null)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasPermission("hrm.create") && (
                        <Button type="button" variant="outline" size="icon" onClick={() => { setDepartmentFormData({ name: "", description: "" }); setShowAddDepartmentDialog(true); }}><Plus className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <Input value={editEmployee.email ?? ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, email: e.target.value } : null)} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={editEmployee.phone ?? ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, phone: e.target.value } : null)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Joining date</Label>
                    <Input type="date" value={editEmployee.joiningDate ? format(new Date(editEmployee.joiningDate), "yyyy-MM-dd") : ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, joiningDate: e.target.value } as any : null)} />
                  </div>
                  <div>
                    <Label>Salary</Label>
                    <Input type="number" step="0.01" value={editEmployee.salary} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, salary: e.target.value } : null)} />
                  </div>
                </div>
                <div>
                  <Label>Photo</Label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden border-2 bg-muted flex items-center justify-center relative">
                      {editEmployee.photoUrl && (
                        <img
                          src={editEmployee.photoUrl}
                          alt="Preview"
                          className="w-full h-full object-cover absolute inset-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      )}
                      <div className={`w-full h-full flex items-center justify-center ${editEmployee.photoUrl ? "hidden" : ""}`}>
                        <User className="h-10 w-10 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex gap-2 items-center">
                        <Input value={editEmployee.photoUrl ?? ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, photoUrl: e.target.value } : null)} placeholder="Enter image URL" className="flex-1 min-w-0" />
                        <input type="file" accept="image/*" className="hidden" ref={editPhotoFileInputRef} onChange={(e) => handlePhotoUpload(e, true)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => editPhotoFileInputRef.current?.click()} title="Upload photo">
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Paste a URL or click Upload to choose an image</p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editEmployee.status} onValueChange={(v) => setEditEmployee((prev) => prev ? { ...prev, status: v } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditEmployee(null)}>Cancel</Button>
                <Button onClick={handleEditSave}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Position dialog */}
      <Dialog open={showAddPositionDialog} onOpenChange={(open) => { if (!open) setShowAddPositionDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Position</DialogTitle>
            <DialogDescription>Add a new job position for staff</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={positionFormData.name} onChange={(e) => setPositionFormData((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Waiter" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={positionFormData.description} onChange={(e) => setPositionFormData((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPositionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPosition}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Department dialog */}
      <Dialog open={showAddDepartmentDialog} onOpenChange={(open) => { if (!open) setShowAddDepartmentDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>Add a new department for staff</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={departmentFormData.name} onChange={(e) => setDepartmentFormData((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. F&B" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={departmentFormData.description} onChange={(e) => setDepartmentFormData((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDepartmentDialog(false)}>Cancel</Button>
            <Button onClick={handleAddDepartment}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Position dialog */}
      <Dialog open={!!editPosition} onOpenChange={(open) => !open && setEditPosition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editPosition && (
            <>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={editPosition.name} onChange={(e) => setEditPosition((p) => p ? { ...p, name: e.target.value } : null)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={editPosition.description ?? ""} onChange={(e) => setEditPosition((p) => p ? { ...p, description: e.target.value } : null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditPosition(null)}>Cancel</Button>
                <Button onClick={() => editPosition && updatePositionMutation.mutate({ id: editPosition.id, data: { name: editPosition.name, description: editPosition.description ?? undefined } })}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Department dialog */}
      <Dialog open={!!editDepartment} onOpenChange={(open) => !open && setEditDepartment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          {editDepartment && (
            <>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={editDepartment.name} onChange={(e) => setEditDepartment((d) => d ? { ...d, name: e.target.value } : null)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={editDepartment.description ?? ""} onChange={(e) => setEditDepartment((d) => d ? { ...d, description: e.target.value } : null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDepartment(null)}>Cancel</Button>
                <Button onClick={() => editDepartment && updateDepartmentMutation.mutate({ id: editDepartment.id, data: { name: editDepartment.name, description: editDepartment.description ?? undefined } })}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Position confirm */}
      <AlertDialog open={!!deletePositionId} onOpenChange={(open) => !open && setDeletePositionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete position?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Staff using this position will keep the position name.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deletePositionId && deletePositionMutation.mutate(deletePositionId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Department confirm */}
      <AlertDialog open={!!deleteDepartmentId} onOpenChange={(open) => !open && setDeleteDepartmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Staff using this department will keep the department name.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteDepartmentId && deleteDepartmentMutation.mutate(deleteDepartmentId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteEmployeeId} onOpenChange={(open) => !open && setDeleteEmployeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteEmployeeId && deleteEmployeeMutation.mutate(deleteEmployeeId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk release confirm */}
      <AlertDialog open={showBulkReleaseConfirm} onOpenChange={setShowBulkReleaseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release salary</AlertDialogTitle>
            <AlertDialogDescription>
              Release salary for {selectedIds.size} staff on {format(salaryDate, "PPP")}? Amounts will use each staff&apos;s base salary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkRelease}>Release</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
