import { useEffect, useState } from 'react';

/**
 * Height of the app bar when it is pinned to the top of the viewport. The authenticated shell
 * renders a `position: fixed` AppBar, so anything sticky underneath it has to offset itself by
 * that height or it slides out of sight; the public shell's AppBar is static and scrolls away,
 * which measures as 0.
 */
export const useFixedHeaderOffset = () => {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const measure = () => {
            const header = document.querySelector<HTMLElement>('.MuiAppBar-root');
            const isPinned = header && window.getComputedStyle(header).position === 'fixed';
            setOffset(isPinned ? header.getBoundingClientRect().height : 0);
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    return offset;
};

export default useFixedHeaderOffset;
