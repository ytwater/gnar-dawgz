import { forwardRef, useEffect, useState } from "react";
import { Input } from "~/app/components/ui/input";
import { cn } from "~/app/lib/utils";

export interface PhoneNumberInputProps
	extends Omit<
		React.InputHTMLAttributes<HTMLInputElement>,
		"value" | "onChange"
	> {
	value?: string;
	onChange?: (value: string) => void;
}

/**
 * Formats a phone number string to display format: +1-555-555-5555
 * Input should be digits only (after +1)
 */
function formatPhoneDisplay(value: string): string {
	// Remove all non-digits
	const digits = value.replace(/\D/g, "");

	// Limit to 10 digits (US phone number)
	const limited = digits.slice(0, 10);

	// Format: 555-555-5555
	if (limited.length <= 3) {
		return limited;
	}
	if (limited.length <= 6) {
		return `${limited.slice(0, 3)}-${limited.slice(3)}`;
	}
	return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Converts a formatted display value to the output format: +15555555555
 */
function formatPhoneOutput(displayValue: string): string {
	const digits = displayValue.replace(/\D/g, "");
	if (digits.length === 0) {
		return "";
	}
	return `+1${digits}`;
}

/**
 * Converts an input value (like "+15555555555" or "+1-555-555-5555") to display format
 */
function parsePhoneInput(value: string | undefined): string {
	if (!value) return "";

	// Remove +1 prefix if present
	const withoutPrefix = value.replace(/^\+1/, "").replace(/\D/g, "");
	return formatPhoneDisplay(withoutPrefix);
}

export const PhoneNumberInput = forwardRef<
	HTMLInputElement,
	PhoneNumberInputProps
>(({ value, onChange, className, disabled, ...props }, ref) => {
	const [displayValue, setDisplayValue] = useState(() =>
		parsePhoneInput(value),
	);

	// Sync with external value changes
	useEffect(() => {
		setDisplayValue(parsePhoneInput(value));
	}, [value]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const input = e.target.value;

		// Remove any +1 prefix if user tries to type it
		const cleaned = input.replace(/^\+1/, "").replace(/\D/g, "");

		// Limit to 10 digits
		const limited = cleaned.slice(0, 10);

		// Format for display
		const formatted = formatPhoneDisplay(limited);
		setDisplayValue(formatted);

		// Call onChange with the output format
		if (onChange) {
			const output = formatPhoneOutput(formatted);
			onChange(output);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		// Prevent deleting the +1 prefix
		const input = e.currentTarget;
		if (
			(e.key === "Backspace" || e.key === "Delete") &&
			input.selectionStart === 0 &&
			displayValue.length > 0
		) {
			// Allow normal deletion, but we'll handle it in onChange
		}
	};

	return (
		<div className="relative flex items-center">
			<span className="absolute left-3 text-muted-foreground pointer-events-none select-none z-10">
				+1
			</span>
			<Input
				ref={ref}
				type="tel"
				value={displayValue}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				className={cn("pl-10", className)}
				placeholder="555-555-5555"
				maxLength={12} // 3-3-4 format: 555-555-5555
				{...props}
			/>
		</div>
	);
});

PhoneNumberInput.displayName = "PhoneNumberInput";
