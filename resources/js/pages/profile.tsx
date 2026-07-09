import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChartNoAxesColumn, LogOut, Settings } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { UserInfo } from '@/components/user-info';
import { logout } from '@/routes';
import { edit } from '@/routes/profile';
import type { Auth } from '@/types';

export default function Profile() {
    const { auth } = usePage<{ auth: Auth }>().props;

    return (
        <>
            <Head title="Profile" />
            <Heading
                title="Profile"
                description="Your account and watch stats."
            />
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
                <UserInfo user={auth.user} showEmail />
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={edit()} prefetch>
                            <Settings />
                            Settings
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link
                            href={logout()}
                            as="button"
                            onClick={() => router.flushAll()}
                        >
                            <LogOut />
                            Log out
                        </Link>
                    </Button>
                </div>
            </div>
            <ComingSoon
                icon={ChartNoAxesColumn}
                title="Your stats live here"
                description="Total watch time and episodes watched arrive with the Profile stats build step."
            />
        </>
    );
}
