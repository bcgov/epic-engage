/**
 * React Router v7 behaviours opted into early, so v6 stops warning about them and the
 * eventual v7 upgrade is just a version bump
 *
 * - v7_startTransition: navigation state updates are wrapped in React.startTransition.
 * - v7_relativeSplatPath: relative paths inside a splat route resolve against the matched
 *   parent rather than the splat value. Every splat route here is a terminal `path="*"`
 *   rendering NotFound, so nothing resolves relative to one.
 */
export const routerFutureFlags = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
} as const;
