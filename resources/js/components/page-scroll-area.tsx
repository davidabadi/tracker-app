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
    scrollRef,
}: {
    children: React.ReactNode;
    className?: string;
    scrollRef?: React.Ref<HTMLDivElement>;
}) {
    return (
        <div
            ref={scrollRef}
            className={cn(
                'flex min-h-0 flex-1 flex-col overflow-y-auto pb-32 md:pb-16',
                className,
            )}
        >
            {children}
        </div>
    );
}
