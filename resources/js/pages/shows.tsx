import { Head } from '@inertiajs/react';
import { Tv } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import Heading from '@/components/heading';

export default function Shows() {
    return (
        <>
            <Head title="Shows" />
            <Heading
                title="Shows"
                description="What you're watching and what's next."
            />
            <ComingSoon
                icon={Tv}
                title="Your watch list lives here"
                description="Watch Next, Watched History and Upcoming episodes arrive with the next build steps."
            />
        </>
    );
}
