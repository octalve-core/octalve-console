// src/lib/api/modules/orders.api.ts

import { api } from "../client";
import { apiPaths, byId } from "../paths";
import type { Order, PaginatedResponse } from "../types";

type ListParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export const ordersApi = {
  cart() {
    return api.get(apiPaths.orders.cart, { skipAuth: true });
  },

  addCartItem(payload: unknown) {
    return api.post(apiPaths.orders.cartAddItem, payload, { skipAuth: true });
  },

  removeCartItem(payload: unknown) {
    return api.post(apiPaths.orders.cartRemoveItem, payload, { skipAuth: true });
  },

  updateCartQuantity(payload: unknown) {
    return api.post(apiPaths.orders.cartUpdateQuantity, payload, { skipAuth: true });
  },

  applyCoupon(payload: unknown) {
    return api.post(apiPaths.orders.cartApplyCoupon, payload, { skipAuth: true });
  },

  clearCart(payload?: unknown) {
    return api.post(apiPaths.orders.cartClear, payload || {}, { skipAuth: true });
  },

  coupons(params?: ListParams) {
    return api.get<unknown[]>(apiPaths.orders.coupons, { params });
  },

  validateCoupon(payload: unknown) {
    return api.post(`${apiPaths.orders.couponValidate}`, payload);
  },

  orders(params?: ListParams) {
    return api.get<Order[] | PaginatedResponse<Order>>(apiPaths.orders.orders, { params });
  },

  order(id: string | number) {
    return api.get<Order>(byId(apiPaths.orders.orders, id));
  },

  createOrder(payload: unknown) {
    return api.post<Order>(apiPaths.orders.orders, payload);
  },

  updateOrder(id: string | number, payload: unknown) {
    return api.patch<Order>(byId(apiPaths.orders.orders, id), payload);
  },

  cancelOrder(id: string | number, payload?: unknown) {
    return api.post(`${byId(apiPaths.orders.orders, id)}cancel/`, payload || {});
  },

  orderInvoice(id: string | number) {
    return api.get(`${byId(apiPaths.orders.orders, id)}invoice/`);
  },
};

