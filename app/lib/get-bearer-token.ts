/**
 * Helper functions to get bearer token after authentication
 */

import { authClient } from "./auth-client";

/**
 * Get bearer token from current session
 * Returns the token if user is authenticated, null otherwise
 */
export async function getBearerToken(): Promise<string | null> {
	const session = await authClient.getSession();
	// The bearerClient plugin stores the token in the session
	return session?.data?.session?.token || null;
}

/**
 * Extract bearer token from a fetch Response header
 * Use this when making raw fetch requests to login endpoints
 */
export function getBearerTokenFromResponse(response: Response): string | null {
	return response.headers.get("set-auth-token");
}

/**
 * Sign in with email/password and get bearer token
 *
 * Example:
 * ```ts
 * const { token, error } = await signInAndGetToken('user@example.com', 'password');
 * if (token) {
 *   console.log('Token:', token);
 *   // Use token: Authorization: Bearer ${token}
 * }
 * ```
 */
export async function signInAndGetToken(
	email: string,
	password: string,
): Promise<{ token: string | null; error: Error | null }> {
	try {
		const result = await authClient.signIn.email({ email, password });

		if (result.error) {
			return { token: null, error: result.error };
		}

		// Get token from session after successful sign-in
		const token = await getBearerToken();
		return { token, error: null };
	} catch (error) {
		return {
			token: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Sign in with phone number OTP and get bearer token
 */
export async function signInWithPhoneAndGetToken(
	phoneNumber: string,
	code: string,
): Promise<{ token: string | null; error: Error | null }> {
	try {
		const result = await authClient.phoneNumber.verify({
			phoneNumber,
			code,
			disableSession: false,
		});

		if (result.error) {
			return { token: null, error: result.error };
		}

		const token = await getBearerToken();
		return { token, error: null };
	} catch (error) {
		return {
			token: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}
