import { Phone } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate, useSearchParams } from "react-router";
import { PhoneNumberInput } from "~/app/components/phone-number-input";
import { Alert, AlertDescription } from "~/app/components/ui/alert";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { authClient } from "~/app/lib/auth-client";
import { getSession } from "~/app/lib/auth";
import type { Route } from "./+types/_app_.login";

export async function loader({ request, context }: Route.LoaderArgs) {
	const session = await getSession(request, context.cloudflare.env);
	if (session) {
		const url = new URL(request.url);
		const redirectTo = url.searchParams.get("redirectTo") || "/";
		throw redirect(redirectTo);
	}
	return null;
}

export default function Login() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [phoneNumber, setPhoneNumber] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [otpSent, setOtpSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [linkExpired, setLinkExpired] = useState(false);
	const otpInputRef = useRef<HTMLInputElement>(null);
	const hasAutoSubmitted = useRef(false);

	// Pre-populate from URL query parameters
	useEffect(() => {
		const phoneParam = searchParams.get("phone");
		const codeParam = searchParams.get("code");

		console.log("🚀 ~ _app_.login.tsx:26 ~ Login ~ phoneParam:", phoneParam);
		if (phoneParam) {
			// Remove +1 prefix if present
			setPhoneNumber(phoneParam.replace(/^\+1/, ""));
		}

		if (codeParam) {
			setOtpCode(codeParam);
			setOtpSent(true);
		}
	}, [searchParams]);

	useEffect(() => {
		if (otpSent) {
			otpInputRef.current?.focus();
		}
	}, [otpSent]);

	// Auto-submit when both phone and code are provided via URL
	useEffect(() => {
		if (
			!hasAutoSubmitted.current &&
			phoneNumber &&
			otpCode &&
			searchParams.get("phone") &&
			searchParams.get("code")
		) {
			hasAutoSubmitted.current = true;
			handleVerifyOtp();
		}
	}, [phoneNumber, otpCode, searchParams]);

	const handleSendOtp = async () => {
		if (!phoneNumber.trim()) {
			setError("Please enter a phone number");
			return;
		}
		console.log(
			"🚀 ~ _app_.login.tsx:40 ~ handleSendOtp ~ phoneNumber:",
			phoneNumber,
		);

		setIsSendingOtp(true);
		setError(null);
		setSuccess(null);
		setOtpSent(false);
		setOtpCode("");

		try {
			const fullPhone = phoneNumber.startsWith("+1")
				? phoneNumber
				: `+1${phoneNumber}`;
			await authClient.phoneNumber.sendOtp({
				phoneNumber: fullPhone,
			});
			setOtpSent(true);
			setSuccess("OTP code sent to your phone number!");
		} catch (err) {
			console.error("Error sending OTP:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to send OTP. Please try again.",
			);
		} finally {
			setIsSendingOtp(false);
		}
	};

	const isFromLink = !!(searchParams.get("phone") && searchParams.get("code"));

	const handleVerifyOtp = async () => {
		if (!phoneNumber.trim() || !otpCode.trim()) {
			setError("Please enter both phone number and OTP code");
			return;
		}

		setIsVerifying(true);
		setError(null);
		setSuccess(null);
		setLinkExpired(false);

		try {
			const fullPhone = phoneNumber.startsWith("+1")
				? phoneNumber
				: `+1${phoneNumber}`;
			const result = await authClient.phoneNumber.verify({
				phoneNumber: fullPhone,
				code: otpCode.trim(),
				disableSession: false,
			});

			if (!result.error) {
				setSuccess("Signed in successfully!");
				// Redirect to where they came from, or home on success
				const redirectTo = searchParams.get("redirectTo") || "/";
				navigate(redirectTo);
			} else {
				// If this was an auto-submit from a link, show the expired state
				if (isFromLink && hasAutoSubmitted.current) {
					setLinkExpired(true);
					setOtpCode("");
					setError(null);
				} else {
					setError(
						result.error.message || "Invalid OTP code. Please try again.",
					);
				}
			}
		} catch (err) {
			console.error("Error verifying OTP:", err);
			if (isFromLink && hasAutoSubmitted.current) {
				setLinkExpired(true);
				setOtpCode("");
				setError(null);
			} else {
				setError(
					err instanceof Error
						? err.message
						: "Failed to verify OTP. Please try again.",
				);
			}
		} finally {
			setIsVerifying(false);
		}
	};

	const handleResendCode = async () => {
		setIsSendingOtp(true);
		setError(null);
		setLinkExpired(false);

		try {
			const fullPhone = phoneNumber.startsWith("+1")
				? phoneNumber
				: `+1${phoneNumber}`;
			await authClient.phoneNumber.sendOtp({
				phoneNumber: fullPhone,
			});
			setOtpSent(true);
			setSuccess("A new code has been sent to your WhatsApp!");
		} catch (err) {
			console.error("Error resending OTP:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to send code. Please try again.",
			);
		} finally {
			setIsSendingOtp(false);
		}
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
			<div className="w-full max-w-md space-y-8 rounded-lg bg-card p-8 shadow-md border border-border">
				<div className="text-center">
					<h2 className="text-3xl font-bold tracking-tight text-card-foreground">
						Sign in to Gnar Dawgs
					</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Enter your phone number to receive a verification code via Whatsapp
					</p>
				</div>

				<div className="mt-8 space-y-6">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{success && (
						<Alert variant="default">
							<AlertDescription>{success}</AlertDescription>
						</Alert>
					)}

					{linkExpired ? (
						<div className="space-y-4">
							<Alert variant="destructive">
								<AlertDescription>
									This link has expired. Tap below to get a new code via
									WhatsApp.
								</AlertDescription>
							</Alert>
							<div>
								<label
									htmlFor="phone"
									className="block text-sm font-medium text-foreground mb-2"
								>
									Phone Number
								</label>
								<PhoneNumberInput
									id="phone"
									value={phoneNumber}
									onChange={(value) => setPhoneNumber(value)}
									disabled
									className="w-full"
								/>
							</div>
							<Button
								type="button"
								onClick={handleResendCode}
								disabled={isSendingOtp}
								className="w-full"
							>
								{isSendingOtp ? (
									<>
										<div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-2" />
										Sending...
									</>
								) : (
									<>
										<Phone className="w-5 h-5 mr-2" />
										Send New Code
									</>
								)}
							</Button>
						</div>
					) : isVerifying && isFromLink ? (
						<div className="flex flex-col items-center gap-3 py-4">
							<div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
							<p className="text-sm text-muted-foreground">Signing you in...</p>
						</div>
					) : (
						<div className="space-y-4">
							<div>
								<label
									htmlFor="phone"
									className="block text-sm font-medium text-foreground mb-2"
								>
									Phone Number
								</label>
								<PhoneNumberInput
									id="phone"
									value={phoneNumber}
									onChange={(value) => setPhoneNumber(value)}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" &&
											phoneNumber.trim() &&
											!isSendingOtp &&
											!otpSent
										) {
											handleSendOtp();
										}
									}}
									disabled={isSendingOtp || isVerifying || otpSent}
									className="w-full"
								/>
							</div>

							{!otpSent ? (
								<Button
									type="button"
									onClick={handleSendOtp}
									disabled={isSendingOtp || !phoneNumber.trim()}
									className="w-full"
								>
									{isSendingOtp ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-2" />
											Sending OTP...
										</>
									) : (
										<>
											<Phone className="w-5 h-5 mr-2" />
											Send Verification Code
										</>
									)}
								</Button>
							) : (
								<>
									<div>
										<label
											htmlFor="otp"
											className="block text-sm font-medium text-foreground mb-2"
										>
											Verification Code
										</label>
										<Input
											id="otp"
											ref={otpInputRef}
											type="text"
											placeholder="Enter 6-digit code"
											value={otpCode}
											onChange={(e) => setOtpCode(e.target.value)}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" &&
													otpCode.trim() &&
													!isVerifying
												) {
													handleVerifyOtp();
												}
											}}
											disabled={isVerifying}
											maxLength={6}
											className="w-full"
										/>
									</div>
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												setOtpSent(false);
												setOtpCode("");
												setError(null);
												setSuccess(null);
											}}
											disabled={isVerifying}
											className="flex-1"
										>
											Cancel
										</Button>
										<Button
											type="button"
											onClick={handleVerifyOtp}
											disabled={isVerifying || !otpCode.trim()}
											className="flex-1"
										>
											{isVerifying ? (
												<>
													<div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent mr-2" />
													Verifying...
												</>
											) : (
												"Sign In"
											)}
										</Button>
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
