/**
 * Design tokens for EPIC.engage.
 *
 * Values transcribed from the B.C. Design System (`@bcgov/design-tokens` v5.0.0) and kept local so
 * they can be tuned without waiting on an upstream release. Names match the upstream token names,
 * so anything here can be diffed against the published set.
 *
 * Adding a colour? Put it here, not in a component. The grep guard in
 * `docs/bc-design-system-followups.md` assumes no hex literals live in components.
 *
 * The matching SCSS values are in `_tokens.scss` - change both together.
 */

/* -------------------------------------------------------------------------- */
/* Brand / surfaces                                                            */
/* -------------------------------------------------------------------------- */

export const surfaceColorPrimaryDefault = '#013366';
export const surfaceColorPrimaryHover = '#1e5189';
export const surfaceColorPrimaryPressed = '#01264c';
export const surfaceColorPrimaryDisabled = '#edebe9';

export const surfaceColorPrimaryButtonDefault = '#013366';
export const surfaceColorPrimaryButtonHover = '#1e5189';
export const surfaceColorPrimaryButtonDisabled = '#edebe9';

export const surfaceColorSecondaryButtonDefault = '#ffffff';
export const surfaceColorSecondaryButtonHover = '#edebe9';
export const surfaceColorSecondaryButtonDisabled = '#edebe9';

export const surfaceColorTertiaryButtonDefault = 'rgba(255, 255, 255, 0)';
export const surfaceColorTertiaryButtonHover = '#eceae8';
export const surfaceColorTertiaryButtonDisabled = '#edebe9';

export const surfaceColorBackgroundWhite = '#ffffff';
export const surfaceColorBackgroundLightGray = '#faf9f8';
export const surfaceColorBackgroundLightBlue = '#f1f8fe';
export const surfaceColorBackgroundDarkBlue = '#053662';

// Neutral surfaces the results dashboard needs on top of the above
// that sits lighter than `surfaceColorBorderDefault`.
export const surfaceColorBackgroundOffWhite = '#f7f8fa';
export const surfaceColorBackgroundGray = '#f2f2f2';
export const surfaceColorBorderSubtle = '#f0efee';

// Tinted blues for callouts, the active TOC entry and the activity bars.
export const surfaceColorBackgroundPaleBlue = '#e3eef9';
export const surfaceColorBackgroundSkyBlue = '#d8eafd';

// Unfilled portion of a progress/proportion bar.
export const surfaceColorTrack = '#eeeeee';

export const surfaceColorBorderDefault = '#d8d8d8';
export const surfaceColorBorderMedium = '#898785';
export const surfaceColorBorderDark = '#353433';
export const surfaceColorBorderActive = '#2e5dd7';

export const surfaceColorFormsDisabled = '#edebe9';

export const surfaceShadowSmall =
    '0 0.6000000238418579px 1.7999999523162842px 0 #0000001a, 0 3.200000047683716px 7.199999809265137px 0 #00000021';

/* -------------------------------------------------------------------------- */
/* Status colours                                                              */
/*                                                                             */
/* Drive comment status chips, engagement status chips, listing status icons    */
/* and the dashboard tiles. Change a value here and every one of those follows. */
/* -------------------------------------------------------------------------- */

// --- Success / approved -----------------------------------------------------
// NOTE: the greens are under design review. These are the upstream B.C. Design
// System values; swap them here and approved chips, the survey-ready icon, the
// approved listing icon and the "open" dashboard tile all update together.
export const supportBorderColorSuccess = '#839537';
export const supportSurfaceColorSuccess = '#eef5dc';
export const iconsColorSuccess = '#42814a';

// --- Warning / pending ------------------------------------------------------
export const supportBorderColorWarning = '#f8bb47';
export const supportSurfaceColorWarning = '#fef1d8';

// --- Danger / rejected ------------------------------------------------------
export const supportBorderColorDanger = '#ce3e39';
export const supportSurfaceColorDanger = '#f4e1e2';

// --- Info / needs further review --------------------------------------------
export const supportBorderColorInfo = '#f8bb47';
export const supportSurfaceColorInfo = '#fef1d8';

// Darkened amber for warning *icons and text*, where the border/surface pair above is too light
// to meet contrast against white.
export const supportIconColorWarning = '#b54708';

/* -------------------------------------------------------------------------- */
/* Data visualisation                                                          */
/*                                                                             */
/* The B.C. Design System has no categorical chart palette, so these are the    */
/* app's own series colours. They are not interchangeable with the brand and    */
/* status colours above. Changing these recolours charts only.                   */
/*                                                                             */
/* Each swatch is paired with a label colour in `Palette.chart` (Theme.ts);     */
/* if you retune a swatch, re-check that its label still passes contrast.       */
/* -------------------------------------------------------------------------- */

export const dataVizBlueDark = '#1b5e8c';
export const dataVizBlueMedium = '#4a90c4';
export const dataVizBlueLight = '#90c0de';
export const dataVizBlueSky = '#7eb8d4';

export const dataVizYellow = '#fcba19';
export const dataVizYellowLight = '#f5c97a';
export const dataVizAmber = '#e8a94a';
export const dataVizOrange = '#e07b39';

export const dataVizRed = '#c03f2c';
export const dataVizSalmon = '#e8866f';

export const dataVizGreen = '#72b09d';
export const dataVizGreenDeep = '#5c9e6a';

export const dataVizPurple = '#7b6fa0';

// Used both as a mid-scale swatch and as the fallback when a series runs past the end of a scale.
export const dataVizNeutral = '#c8c3be';

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

// Quoted deliberately: this is dropped straight into a font-family stack.
export const typographyFontFamiliesBcSans = "'BC Sans'";

export const typographyFontWeightsRegular = 400;
export const typographyFontWeightsBold = 700;

export const typographyColorPrimary = '#2d2d2d';
export const typographyColorSecondary = '#474543';
export const typographyColorPrimaryInvert = '#ffffff';
export const typographyColorDisabled = '#9f9d9c';
// Quieter than `secondary` but still legible.
// Shares its value with `surfaceColorBorderMedium`; kept separate so text and borders can diverge.
export const typographyColorMuted = '#898785';
export const typographyColorPlaceholder = '#9f9d9c';
export const typographyColorLink = '#255a90';
export const typographyColorDanger = '#ce3e39';

export const typographyFontSizeLabel = '0.75rem';
export const typographyFontSizeSmallBody = '0.875rem';
export const typographyFontSizeBody = '1rem';
export const typographyFontSizeLargeBody = '1.125rem';
export const typographyFontSizeH5 = '1.25rem';
export const typographyFontSizeH4 = '1.5rem';
export const typographyFontSizeH3 = '1.75rem';
export const typographyFontSizeH2 = '2rem';
export const typographyFontSizeH1 = '2.25rem';

// Line heights paired with the sizes above, from the upstream composite type tokens.
export const typographyLineHeightH1 = '3.375rem';
export const typographyLineHeightH2 = '3rem';
export const typographyLineHeightH3 = '3rem';
export const typographyLineHeightH4 = '2.25rem';
export const typographyLineHeightH5 = '2.125rem';
export const typographyLineHeightLargeBody = '1.913rem';
export const typographyLineHeightBody = '1.688rem';
export const typographyLineHeightSmallBody = '1.313rem';
export const typographyLineHeightLabel = '1.125rem';

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export const layoutBorderRadiusMedium = '4px';
export const layoutBorderRadiusLarge = '6px';
