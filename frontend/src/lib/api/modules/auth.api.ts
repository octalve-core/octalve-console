// src/lib/api/modules/auth.api.ts

import { api } from "../client";
import { apiPaths } from "../paths";
import type { LoginPayload, SignupPayload, User } from "../types";

export type AuthTokenResponse = {
  access: string;
  refresh?: string;
  user?: User;
};

export type SignupResponse = {
  id: string | number;
  email: string;
  username?: string;
  full_name?: string;
  phone_number?: string;
};

export type PasswordResetConfirmPayload = {
  uid: string;
  token: string;
  new_password: string;
  re_new_password: string;
};

export const authApiV2 = {
  checkUsername(username: string) {
    return api.post<{available: boolean}>(apiPaths.auth.usernameAvailability, {username}, {skipAuth: true});
  },
  login(payload: LoginPayload) {
    return api.post<AuthTokenResponse>(apiPaths.auth.login, payload, {
      skipAuth: true,
    });
  },

  refreshToken(refresh: string) {
    return api.post<{ access: string }>(apiPaths.auth.refresh, { refresh }, {
      skipAuth: true,
    });
  },

  verifyToken(token: string) {
    return api.post(apiPaths.auth.verify, { token }, {
      skipAuth: true,
    });
  },

  register(payload: SignupPayload) {
    const requestPayload = {
      full_name: payload.full_name,
      email: payload.email,
      username: payload.username?.trim() || undefined,
      accepted_terms_version: payload.accepted_terms_version,
      phone_number: payload.phone || "",
      referral_code: payload.referral_code || "",
      password: payload.password,
      re_password: payload.password,
    };

    return api.post<SignupResponse>(apiPaths.auth.register, requestPayload, {
      skipAuth: true,
    });
  },

  logout() {
    return api.post<{ detail?: string; message?: string }>(apiPaths.auth.logout);
  },

  me() {
    return api.get<User>(apiPaths.auth.me);
  },

  extendedMe() {
    return api.get<User>(apiPaths.auth.extendedMe);
  },

  requestPasswordReset(email: string) {
    return api.post<{ detail?: string }>(
      apiPaths.auth.resetPassword,
      { email },
      { skipAuth: true },
    );
  },

  /**
   * Schema.yml currently shows uid and token in the request body.
   * If backend changes this to path-based later, only this function should change.
   */
  confirmPasswordReset(uid: string, token: string, newPassword: string) {
    const payload: PasswordResetConfirmPayload = {
      uid: String(uid).trim(),
      token: String(token).trim(),
      new_password: String(newPassword),
      re_new_password: String(newPassword),
    };

    return api.post<{ detail?: string }>(
      apiPaths.auth.resetPasswordConfirm,
      payload,
      { skipAuth: true },
    );
  },

  changePassword(currentPassword: string, newPassword: string) {
    return api.post(apiPaths.auth.setPassword, {
      current_password: currentPassword,
      new_password: newPassword,
      re_new_password: newPassword,
    });
  },
};

