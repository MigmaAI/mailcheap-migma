import SkeletonCampaigns from "@/components/SkeletonCampaigns";
import { Skeleton } from "@/components/ui/skeleton";
import { PERIOD_DAYS } from "@/lib/overview-series";
import { cn } from "@/lib/utils";

// The overview while it loads (loading.js): the same sections, each section's skeleton the size of
// what replaces it.
export default function SkeletonOverview() {
	return (
		<>
			<header className="mb-6 flex items-center justify-between gap-3">
				<div className="flex items-center gap-1">
					<div className="flex items-center gap-1 rounded-xl bg-muted/70 p-1">
						<Skeleton className="h-8 w-36 rounded-lg bg-background shadow-border dark:bg-muted" />
						<Skeleton className="h-8 w-28 rounded-lg bg-transparent" />
					</div>
					<span className="size-9" />
				</div>
				<Skeleton className="h-9 w-32 rounded-lg" />
			</header>
			<div className="flex flex-col gap-8">
				<SectionSkeleton title={`Last ${PERIOD_DAYS} days`}>
					<div className="overflow-hidden rounded-2xl bg-card shadow-border">
						<SkeletonStats />
						<div className="flex items-center justify-between border-t border-border/60 px-5 py-4 sm:px-6">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-6 w-16" />
						</div>
					</div>
				</SectionSkeleton>
				<SectionSkeleton title="Campaigns">
					<SkeletonCampaigns rows={5} />
				</SectionSkeleton>
				<SectionSkeleton title="Domains">
					<SkeletonDomainList />
				</SectionSkeleton>
				<SectionSkeleton title="Sending">
					<SkeletonUsage />
				</SectionSkeleton>
			</div>
		</>
	);
}

export function SkeletonStats() {
	return (
		<div aria-hidden="true" className="grid grid-cols-3 gap-px bg-border/60 lg:grid-cols-6">
			{[12, 16, 14, 13, 15, 18].map((width, index) => (
				<div key={index} className="flex flex-col gap-1 bg-card px-4 py-3.5 sm:px-5">
					<Line height="h-4" className="h-2.5" style={{ width: `${width * 4}px` }} />
					<Line height="h-7" className="h-5 w-14" />
					<Line height="h-4" className="h-2.5 w-9" />
				</div>
			))}
		</div>
	);
}

export function SkeletonDomainList({ rows = 3 }) {
	return (
		<ul aria-hidden="true" className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-border">
			{Array.from({ length: rows }, (_, index) => (
				<li key={index} className="flex min-h-16 items-center gap-3 px-4 py-3 lg:min-h-14">
					<Skeleton className="size-5 shrink-0 rounded-md" />
					<div className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-6">
						<Line height="h-5" className="h-3.5 w-36" />
						<Line height="h-4 lg:hidden" className="h-3 w-48" />
					</div>
					<div className="hidden items-center gap-6 lg:flex">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-3 w-32" />
					</div>
				</li>
			))}
		</ul>
	);
}

export function SkeletonUsage() {
	return (
		<div aria-hidden="true" className="overflow-hidden rounded-xl bg-card shadow-border">
			<div className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
				{[20, 14, 22, 16].map((width, index) => (
					<div key={index} className="flex min-h-[66px] flex-col justify-center gap-1.5 bg-card px-4 py-3">
						<Line height="h-4" className="h-2.5 w-16" />
						<div className="flex flex-col gap-1.5">
							<Line height={index < 2 ? "h-6" : "h-5"} className="h-3.5" style={{ width: `${width * 4}px` }} />
							{index === 2 && <Skeleton className="h-1 w-full max-w-32 rounded-full" />}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function SectionSkeleton({ title, children }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
			{children}
		</section>
	);
}

// A skeleton bar centered in a box as tall as the line of text it stands for.
function Line({ height, className, style }) {
	return (
		<span className={cn("flex items-center", height)}>
			<Skeleton className={className} style={style} />
		</span>
	);
}
