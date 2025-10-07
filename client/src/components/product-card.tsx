import { Card } from "@/components/ui/card";
import { Plus, Utensils } from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product & { categoryName?: string };
  onAddToOrder: (product: Product) => void;
}

export function ProductCard({ product, onAddToOrder }: ProductCardProps) {
  return (
    <Card
      className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={() => onAddToOrder(product)}
      data-testid={`card-product-${product.id}`}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent">
            <Utensils className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute bottom-2 right-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Plus className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm mb-1 truncate" data-testid={`text-product-name-${product.id}`}>
          {product.name}
        </h3>
        <p className="text-base font-semibold text-primary font-mono" data-testid={`text-product-price-${product.id}`}>
          ${parseFloat(product.price).toFixed(2)}
        </p>
      </div>
    </Card>
  );
}
