import { Head } from '@inertiajs/react';
import { Search as SearchIcon } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import Heading from '@/components/heading';

export default function Search() {
    return (
        <>
            <Head title="Search" />
            <Heading
                title="Search"
                description="Find shows and movies to track."
            />
            <ComingSoon
                icon={SearchIcon}
                title="Search is on the way"
                description="TMDB search with add-to-tracking lands in a later build step."
            />
        </>
    );
}
