import { Head } from '@inertiajs/react';
import { Film } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import Heading from '@/components/heading';
import { MediaSubTabs } from '@/components/media-sub-tabs';
import { movies } from '@/routes';
import { upcoming } from '@/routes/movies';

export default function Movies() {
    return (
        <>
            <Head title="Movies" />
            <Heading
                title="Movies"
                description="Your movie watch list and upcoming releases."
            />
            <MediaSubTabs
                tabs={[
                    { title: 'Watch List', href: movies() },
                    { title: 'Upcoming', href: upcoming() },
                ]}
            />
            <ComingSoon
                icon={Film}
                title="Your movies live here"
                description="The Watch Next grid arrives with the next build steps — Upcoming releases are live in the tab above."
            />
        </>
    );
}
