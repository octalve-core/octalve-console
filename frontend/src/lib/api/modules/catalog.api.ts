// src/lib/api/modules/catalog.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";
import type { PaginatedResponse, Plan, Product } from "../types";

type ListParams = {
  search?: string;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  product?: number | string;
  product_type?: string;
  category?: number | string;
  is_popular?: boolean;
};

export const catalogApi = {
  categories(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.catalog.categories, { params });
  },

  category(id: string | number) {
    return api.get<unknown>(byId(apiPaths.catalog.categories, id));
  },

  products(params?: ListParams) {
    return api.get<Product[] | PaginatedResponse<Product>>(apiPaths.catalog.products, { params });
  },

  product(id: string | number) {
    return api.get<Product>(byId(apiPaths.catalog.products, id));
  },

  productPlans(id: string | number) {
    return api.get<Plan[]>(`${byId(apiPaths.catalog.products, id)}plans/`);
  },

  plans(params?: ListParams) {
    return api.get<Plan[] | PaginatedResponse<Plan>>(apiPaths.catalog.plans, { params });
  },

  plan(id: string | number) {
    return api.get<Plan>(byId(apiPaths.catalog.plans, id));
  },

  providerMappings(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.catalog.providerMappings, { params });
  },
};

