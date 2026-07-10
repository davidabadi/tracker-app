import { cn } from '@/lib/utils';

/**
 * The scrollable body of a tracker screen. The layout's <main> is a fixed
 * viewport-height column, so headings, search bars, and sub-tabs stay pinned
 * while only this region scrolls. Carries the bottom padding that keeps
 * content clear of the mobile tab bar (the layout itself has none).
 */
export function PageScrollArea({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex min-h-0 flex-1 flex-col overflow-y-auto pb-24 md:pb-8',
                className,
            )}
        >
            {children}
        </div>
    );
}
