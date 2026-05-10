export type ClientOrderPlan = {
  id: string;
  name: string;
  product: string;
  description: string;
  price: number;
  cycle: string;
  features: string[];
  popular?: boolean;
};

export const clientOrderPlans: ClientOrderPlan[] = [];