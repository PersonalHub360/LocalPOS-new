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
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center wavy-login-bg p-4">
      <div className="w-full max-w-5xl wavy-card animate-fade-in-scale">
        {/* Wave Decorations */}
        <div className="wave-decoration wave-top" />
        <div className="wave-decoration wave-bottom" />
        
        {/* Content */}
        <div className="relative z-10 grid md:grid-cols-2 gap-8 p-8 md:p-12">
          {/* Left Side - Login Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Hello!</h1>
              <p className="text-muted-foreground">Sign in to your account</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="input-with-icon">
                          <div className="input-icon">
                            <Mail className="w-4 h-4" />
                          </div>
                          <Input
                            {...field}
                            data-testid="input-username"
                            placeholder="Username"
                            autoComplete="username"
                            disabled={loginMutation.isPending}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="input-with-icon">
                          <div className="input-icon">
                            <Lock className="w-4 h-4" />
                          </div>
                          <Input
                            {...field}
                            data-testid="input-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            autoComplete="current-password"
                            disabled={loginMutation.isPending}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  data-testid="button-login"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg shadow-purple-500/30"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "SIGNING IN..." : "SIGN IN"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Right Side - Welcome Message */}
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <h2 className="text-4xl font-bold">Welcome Back!</h2>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Access your BondPos dashboard to manage orders, track inventory, and view comprehensive reports for your business.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
