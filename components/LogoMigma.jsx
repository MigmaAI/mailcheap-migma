import { cn } from "@/lib/utils";

// Migma's official logo files (public/brand/migma, from the brand kit), never redrawn or recolored.
// surface "auto" follows the theme's page; "inverse" sits on a primary button, which is dark on a light
// page and light on a dark one; "light" and "dark" name a fixed background.
const FILES = {
	lockup: { light: "/brand/migma/lockup-on-light.svg", dark: "/brand/migma/lockup-on-dark.svg", ratio: 1445 / 360 },
	mark: { light: "/brand/migma/mark-on-light.svg", dark: "/brand/migma/mark-on-dark.svg", ratio: 1 },
};

export default function LogoMigma({ variant = "lockup", height = 16, surface = "auto", className }) {
	const { light, dark, ratio } = FILES[variant];
	const alt = variant === "lockup" ? "Migma" : "";
	const size = { width: Math.round(height * ratio), height };
	/* eslint-disable @next/next/no-img-element -- small SVG logos */
	if (surface === "inverse") {
		return (
			<>
				<img src={dark} alt={alt} {...size} className={cn("shrink-0 dark:hidden", className)} />
				<img src={light} alt="" {...size} className={cn("hidden shrink-0 dark:block", className)} />
			</>
		);
	}
	if (surface !== "auto") {
		return <img src={surface === "dark" ? dark : light} alt={alt} {...size} className={cn("shrink-0", className)} />;
	}
	return (
		<>
			<img src={light} alt={alt} {...size} className={cn("shrink-0 dark:hidden", className)} />
			<img src={dark} alt="" {...size} className={cn("hidden shrink-0 dark:block", className)} />
		</>
	);
	/* eslint-enable @next/next/no-img-element */
}
