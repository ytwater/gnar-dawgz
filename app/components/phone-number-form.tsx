import { Phone } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { PhoneNumberInput } from "~/app/components/phone-number-input";
import { Alert, AlertDescription } from "~/app/components/ui/alert";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Input } from "~/app/components/ui/input";
import { authClient } from "~/app/lib/auth-client";

interface PhoneNumberFormProps {
	initialPhoneNumber?: string | null;
	phoneNumberVerified?: boolean | null;
}

export function PhoneNumberForm({
	initialPhoneNumber,
	phoneNumberVerified,
}: PhoneNumberFormProps) {
	const [phoneNumber, setPhoneNumber] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [otpSent, setOtpSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Initialize phone number from user data if available
	useEffect(() => {
		if (initialPhoneNumber) {
			setPhoneNumber(initialPhoneNumber);
		}
	}, [initialPhoneNumber]);

	const handleSendOtp = async () => {
		if (!phoneNumber.trim()) {
			setError("Please enter a phone number");
			return;
		}

		setIsSendingOtp(true);
		setError(null);
		setSuccess(null);
		setOtpSent(false);
		setOtpCode("");

		try {
			await authClient.phoneNumber.sendOtp({
				phoneNumber: phoneNumber.trim(),
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

	const handleVerifyPhoneNumber = async () => {
		if (!phoneNumber.trim() || !otpCode.trim()) {
			setError("Please enter both phone number and OTP code");
			return;
		}

		setIsVerifying(true);
		setError(null);
		setSuccess(null);

		try {
			const result = await authClient.phoneNumber.verify({
				phoneNumber: phoneNumber.trim(),
				code: otpCode.trim(),
				updatePhoneNumber: true,
			});

			if (!result.error) {
				setSuccess("Phone number verified and updated successfully!");
				setOtpCode("");
				setOtpSent(false);
				setPhoneNumber("");
			} else {
				setError(result.error.message || "Invalid OTP code. Please try again.");
			}
		} catch (err) {
			console.error("Error verifying phone number:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to verify phone number. Please try again.",
			);
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Phone className="w-6 h-6" />
					Phone Number
				</CardTitle>
				<CardDescription>
					Add or update your phone number for account verification
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{initialPhoneNumber && (
					<div>
						<CardDescription>Current Phone Number</CardDescription>
						<p className="text-lg font-medium">{initialPhoneNumber}</p>
						{phoneNumberVerified && (
							<p className="text-sm text-green-600 dark:text-green-400 mt-1">
								✓ Verified
							</p>
						)}
					</div>
				)}

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
						<CardDescription className="mb-2">
							{initialPhoneNumber ? "New Phone Number" : "Phone Number"}
						</CardDescription>
						<PhoneNumberInput
							value={phoneNumber}
							onChange={(value) => setPhoneNumber(value)}
							disabled={isSendingOtp || isVerifying || otpSent}
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
									<div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
									Sending OTP...
								</>
							) : (
								<>
									<Phone className="w-5 h-5" />
									Send Verification Code
								</>
							)}
						</Button>
					) : (
						<>
							<div>
								<CardDescription className="mb-2">
									Verification Code
								</CardDescription>
								<Input
									type="text"
									placeholder="Enter 6-digit code"
									value={otpCode}
									onChange={(e) => setOtpCode(e.target.value)}
									disabled={isVerifying}
									maxLength={6}
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
									onClick={handleVerifyPhoneNumber}
									disabled={isVerifying || !otpCode.trim()}
									className="flex-1"
								>
									{isVerifying ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
											Verifying...
										</>
									) : (
										"Verify & Update"
									)}
								</Button>
							</div>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
