import { Head } from '@inertiajs/react';
import { Film } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import Heading from '@/components/heading';

export default function Movies() {
    return (
        <>
            <Head title="Movies" />
            <Heading
                title="Movies"
                description="Your movie watch list and upcoming releases."
            />
            <ComingSoon
                icon={Film}
                title="Your movies live here"
                description="The Watch Next grid and Upcoming releases arrive with the next build steps."
            />
        </>
    );
}
