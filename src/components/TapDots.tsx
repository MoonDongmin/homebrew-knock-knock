interface TapDotsProps {
	count: number;
	size?: "sm" | "md";
	animated?: boolean;
}

export function TapDots({
	count,
	size = "md",
	animated = false,
}: TapDotsProps) {
	const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
	const gap = size === "sm" ? "gap-1" : "gap-1.5";

	return (
		<div
			className={`flex items-center justify-center ${gap}`}
			role="img"
			aria-label={`${count} taps`}
		>
			{Array.from({ length: count }, (_, i) => {
				const dotKey = `dot-${count}-${i}`;
				return (
					<span
						key={dotKey}
						className={`${dotSize} rounded-full bg-current ${animated ? "animate-pulse" : ""}`}
						style={animated ? { animationDelay: `${i * 100}ms` } : undefined}
					/>
				);
			})}
		</div>
	);
}
