"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

export default function ResetPasswordConfirmPage() {
  const params = useParams();
  const router = useRouter();
  
  // Get raw values from URL
  const rawUid = params.uid as string;
  const rawToken = params.token as string;
  
  // Try multiple decoding methods
  const decodeToken = (token: string) => {
    if (!token) return "";
    
    let decoded = token;
    
    // Method 1: Basic URL decode
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {}
    
    // Method 2: Handle %3D (=) specifically
    decoded = decoded.replace(/%3D/gi, '=');
    
    // Method 3: Handle multiple encodings
    while (decoded.includes('%')) {
      try {
        const previous = decoded;
        decoded = decodeURIComponent(decoded);
        if (previous === decoded) break;
      } catch (e) {
        break;
      }
    }
    
    // Method 4: Clean up any trailing issues
    decoded = decoded.trim();
    
    return decoded;
  };
  
  const uid = rawUid ? decodeURIComponent(rawUid) : "";
  const token = decodeToken(rawToken);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    console.log("=== DEEP DEBUG ===");
    console.log("Raw UID:", rawUid);
    console.log("Decoded UID:", uid);
    console.log("Raw Token:", rawToken);
    console.log("Decoded Token:", token);
    console.log("Token length:", token?.length);
    console.log("Token chars:", token?.split('').map(c => c.charCodeAt(0)));
    console.log("Full URL:", window.location.href);
    console.log("=================");
    
    if (!uid || !token) {
      setError("Invalid reset link. Missing required parameters.");
      setIsValidating(false);
    } else {
      setIsValidating(false);
    }
  }, [uid, token, rawUid, rawToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    setIsSubmitting(true);

    // Send the EXACT decoded token
    const payload = {
      uid: uid,
      token: token,  // Use the fully decoded token
      new_password: password,
      re_new_password: confirmPassword
    };

    console.log("=== SENDING PAYLOAD ===");
    console.log("UID:", payload.uid);
    console.log("Token:", payload.token);
    console.log("Token length:", payload.token.length);
    console.log("Password length:", payload.new_password.length);
    console.log("=======================");
    
    try {
      const response = await authApi.confirmPasswordReset(uid, token, password);
      console.log("SUCCESS:", response);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      console.error("ERROR:", err);
      
      if (err instanceof ApiError && err.payload) {
        console.error("Full error payload:", JSON.stringify(err.payload, null, 2));
        
        // Check if token is the issue
        if (err.payload.token) {
          setError(`Token error: ${err.payload.token.join(', ')}. The reset link may have expired.`);
        } else if (err.payload.uid) {
          setError(`User error: ${err.payload.uid.join(', ')}`);
        } else if (err.payload.new_password) {
          setError(`Password error: ${err.payload.new_password.join(', ')}`);
        } else {
          setError(err.message || "Failed to reset password");
        }
      } else {
        setError("Unable to reset password. Please request a new reset link.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return <div>Validating reset link...</div>;
  }

  if (error && !password && !success) {
    return (
      <div>
        <h1>Invalid Reset Link</h1>
        <p>{error}</p>
        <a href="/forgot-password">Request New Reset Link</a>
        <br />
        <a href="/login">Back to Login</a>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <h1>Password Reset Successful!</h1>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Reset Password</h1>
      
      <div style={{ background: '#f0f0f0', padding: '10px', marginBottom: '20px' }}>
        <h3>Debug Info:</h3>
        <p><strong>UID:</strong> {uid}</p>
        <p><strong>Token:</strong> {token}</p>
        <p><strong>Token Length:</strong> {token?.length}</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>New Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        
        <div>
          <label>Confirm Password:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        
        {error && (
          <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '10px' }}>
            {error}
          </div>
        )}
        
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}