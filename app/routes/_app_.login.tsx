import { Phone } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PhoneNumberInput } from "~/app/components/phone-number-input";
import { Alert, AlertDescription } from "~/app/components/ui/alert";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { authClient } from "~/app/lib/auth-client";

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

	const handleVerifyOtp = async () => {
		if (!phoneNumber.trim() || !otpCode.trim()) {
			setError("Please enter both phone number and OTP code");
			return;
		}

		setIsVerifying(true);
		setError(null);
		setSuccess(null);

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
				// Redirect to home on success
				navigate("/");
			} else {
				setError(result.error.message || "Invalid OTP code. Please try again.");
			}
		} catch (err) {
			console.error("Error verifying OTP:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to verify OTP. Please try again.",
			);
		} finally {
			setIsVerifying(false);
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
										type="text"
										placeholder="Enter 6-digit code"
										value={otpCode}
										onChange={(e) => setOtpCode(e.target.value)}
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
				</div>
			</div>
		</div>
	);
}
