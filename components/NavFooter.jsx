import { LogOut, Unplug } from "lucide-react";
import { disconnect, logout } from "@/app/(app)/actions";
import ButtonThemeToggle from "@/components/ButtonThemeToggle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isSendingEnabled } from "@/lib/config";
import { cn } from "@/lib/utils";

// The connected Migma account, and the local kill switch: SENDING_ENABLED stops every send and test.
export default function NavFooter({ accountName, keyHint }) {
	const isOn = isSendingEnabled();

	return (
		<div className="flex flex-col gap-2 pt-4">
			<div className="flex items-center justify-between gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted"
						>
							<span className={cn("size-1.5 shrink-0 rounded-full", isOn ? "bg-emerald-500" : "bg-muted-foreground/50")} />
							<span className="min-w-0">
								<span className="block truncate font-medium">{accountName || "Migma"}</span>
								<span className="block truncate text-xs text-muted-foreground">
									{isOn ? "Sending through Migma" : "Sending off"}
								</span>
							</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="top" className="min-w-56">
						<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
							Migma key ending in {keyHint || "····"}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<form action={logout}>
							<DropdownMenuItem asChild>
								<button type="submit" className="w-full">
									<LogOut />
									Sign out
								</button>
							</DropdownMenuItem>
						</form>
						<form action={disconnect}>
							<DropdownMenuItem asChild variant="destructive">
								<button type="submit" className="w-full">
									<Unplug />
									Disconnect Migma
								</button>
							</DropdownMenuItem>
						</form>
					</DropdownMenuContent>
				</DropdownMenu>
				<ButtonThemeToggle />
			</div>
			{!isOn && (
				<Tooltip>
					<TooltipTrigger asChild>
						<p tabIndex={0} className="px-2.5 text-xs text-muted-foreground outline-none">
							Set SENDING_ENABLED=true to send
						</p>
					</TooltipTrigger>
					<TooltipContent side="top">Nothing is sent or tested while it&apos;s off</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
