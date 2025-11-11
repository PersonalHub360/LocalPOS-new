import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { User, Lock, Eye, EyeOff, Utensils, BarChart3, ShoppingCart, TrendingUp } from "lucide-react";
import { useState } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Blue Login Panel */}
      <div className="w-full lg:w-5/12 blue-split-login flex items-center justify-center p-4 sm:p-6 md:p-8 animate-slide-in-left min-h-screen lg:min-h-0">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 text-white">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">BondPos</h1>
          </div>

          {/* Sign In Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Sign In</h2>
          </div>

          {/* Login Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <User className="login-input-icon w-4 h-4 sm:w-5 sm:h-5" />
                        <Input
                          {...field}
                          data-testid="input-username"
                          placeholder="Username"
                          autoComplete="username"
                          disabled={loginMutation.isPending}
                          className="login-input-field text-sm sm:text-base"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-200 text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock className="login-input-icon w-4 h-4 sm:w-5 sm:h-5" />
                        <Input
                          {...field}
                          data-testid="input-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          autoComplete="current-password"
                          disabled={loginMutation.isPending}
                          className="login-input-field text-sm sm:text-base pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-200 text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                data-testid="button-login"
                className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </Form>

          {/* Divider */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/60 text-xs sm:text-sm">OR</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Social Login */}
          <div>
            <p className="text-white/80 text-center mb-3 sm:mb-4 text-xs sm:text-sm">Sign in with</p>
            <div className="flex justify-center gap-3 sm:gap-4">
              <button className="social-login-btn w-10 h-10 sm:w-12 sm:h-12" data-testid="button-facebook-login">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              <button className="social-login-btn w-10 h-10 sm:w-12 sm:h-12" data-testid="button-twitter-login">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </button>
              <button className="social-login-btn w-10 h-10 sm:w-12 sm:h-12" data-testid="button-google-login">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/>
                  <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"/>
                  <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5818182 23.1818182,9.90909091 L12,9.90909091 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"/>
                  <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Illustration Panel */}
      <div className="hidden lg:flex lg:w-7/12 login-illustration-side animate-slide-in-right">
        <div className="max-w-2xl text-center space-y-4 lg:space-y-6 px-4 lg:px-0">
          {/* Illustration Placeholder */}
          <div className="flex items-center justify-center mb-6 lg:mb-8">
            <div className="relative">
              <div className="w-64 h-64 lg:w-96 lg:h-96 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 opacity-10 absolute -top-10 -left-10" />
              <div className="relative grid grid-cols-2 gap-4 lg:gap-6 p-4 lg:p-8">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 lg:p-6 rounded-2xl flex flex-col items-center justify-center space-y-2 lg:space-y-3">
                  <BarChart3 className="w-12 h-12 lg:w-16 lg:h-16 text-blue-600" />
                  <p className="text-xs lg:text-sm font-medium text-blue-900 dark:text-blue-100">Analytics</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 lg:p-6 rounded-2xl flex flex-col items-center justify-center space-y-2 lg:space-y-3">
                  <ShoppingCart className="w-12 h-12 lg:w-16 lg:h-16 text-blue-600" />
                  <p className="text-xs lg:text-sm font-medium text-blue-900 dark:text-blue-100">Orders</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 lg:p-6 rounded-2xl flex flex-col items-center justify-center space-y-2 lg:space-y-3">
                  <TrendingUp className="w-12 h-12 lg:w-16 lg:h-16 text-blue-600" />
                  <p className="text-xs lg:text-sm font-medium text-blue-900 dark:text-blue-100">Sales</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 lg:p-6 rounded-2xl flex flex-col items-center justify-center space-y-2 lg:space-y-3">
                  <Utensils className="w-12 h-12 lg:w-16 lg:h-16 text-blue-600" />
                  <p className="text-xs lg:text-sm font-medium text-blue-900 dark:text-blue-100">POS</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground px-4">
            Point of Sale Management System
          </h2>
          <p className="text-sm lg:text-base text-muted-foreground leading-relaxed px-4">
            Streamline your restaurant operations with BondPos. Manage orders, track inventory, analyze sales, and generate comprehensive reports - all in one powerful platform.
          </p>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 pt-2 lg:pt-4">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
