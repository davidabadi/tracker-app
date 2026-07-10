import { Head } from '@inertiajs/react';
import { Tv } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import Heading from '@/components/heading';
import { MediaSubTabs } from '@/components/media-sub-tabs';
import { shows } from '@/routes';
import { upcoming } from '@/routes/shows';

export default function Shows() {
    return (
        <>
            <Head title="Shows" />
            <Heading
                title="Shows"
                description="What you're watching and what's next."
            />
            <MediaSubTabs
                tabs={[
                    { title: 'Watch List', href: shows() },
                    { title: 'Upcoming', href: upcoming() },
                ]}
            />
            <ComingSoon
                icon={Tv}
                title="Your watch list lives here"
                description="Watch Next and Watched History arrive with the next build steps — Upcoming is live in the tab above."
            />
        </>
    );
}
