import { Link, router } from '@inertiajs/react';
import {
    Ellipsis,
    LogOut,
    Palette,
    ShieldCheck,
    UserRoundCog,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/routes';
import { edit as appearanceSettings } from '@/routes/appearance';
import { edit as accountSettings } from '@/routes/profile';
import { edit as securitySettings } from '@/routes/security';

const profileDestinations = [
    {
        label: 'Account settings',
        href: accountSettings(),
        icon: UserRoundCog,
    },
    { label: 'Security', href: securitySettings(), icon: ShieldCheck },
    {
        label: 'Appearance',
        href: appearanceSettings(),
        icon: Palette,
    },
];

export function ProfileMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Open profile menu"
                    className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <Ellipsis className="size-5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    {profileDestinations.map((destination) => (
                        <DropdownMenuItem key={destination.label} asChild>
                            <Link href={destination.href} prefetch>
                                <destination.icon />
                                {destination.label}
                            </Link>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link
                        href={logout()}
                        as="button"
                        className="w-full"
                        onClick={() => router.flushAll()}
                    >
                        <LogOut />
                        Log out
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
