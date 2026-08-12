import { createTheme } from '@mui/material';
import * as tokens from './designTokens';
import { CommentStatus } from 'constants/commentStatus';
import { MET_Header_Font_Family, MET_Font_Weight, MET_Header_Font_Weight } from './constants';

/**
 * Every colour in the app resolves from B.C. Design System tokens.
 *
 * `Palette` is imported directly by ~39 files, so it stays as the public surface — but its values
 * and the MUI theme below now both read from the same tokens, so the two can no longer disagree.
 * The `button`/`hover`/`dashboard`/`icons` groups have no equivalent slot in MUI's palette type,
 * so they live here only.
 */
export const Palette = {
    primary: {
        main: tokens.surfaceColorPrimaryDefault,
        light: tokens.surfaceColorPrimaryHover,
        dark: tokens.surfaceColorPrimaryPressed,
    },
    secondary: {
        main: tokens.supportBorderColorWarning,
        dark: tokens.supportBorderColorWarning,
        light: tokens.surfaceColorBackgroundInfo,
    },
    hover: {
        light: tokens.surfaceColorPrimaryHover,
    },
    text: {
        primary: tokens.typographyColorPrimary,
        secondary: tokens.typographyColorSecondary,
        muted: tokens.typographyColorMuted,
        disabled: tokens.typographyColorDisabled,
        invert: tokens.typographyColorPrimaryInvert,
        danger: tokens.typographyColorDanger,
    },
    action: {
        active: tokens.typographyColorLink,
    },
    info: {
        main: tokens.typographyColorSecondary,
    },
    success: {
        main: tokens.supportBorderColorSuccess,
        light: tokens.supportSurfaceColorSuccess,
        emphasis: tokens.iconsColorSuccess,
    },
    error: {
        main: tokens.supportBorderColorDanger,
        light: tokens.supportSurfaceColorDanger,
    },
    border: {
        default: tokens.surfaceColorBorderDefault,
        medium: tokens.surfaceColorBorderMedium,
        dark: tokens.surfaceColorBorderDark,
        subtle: tokens.surfaceColorBorderSubtle,
    },
    background: {
        default: tokens.surfaceColorBackgroundWhite,
        light: tokens.surfaceColorBackgroundLightGray,
        lightBlue: tokens.surfaceColorBackgroundLightBlue,
        darkBlue: tokens.surfaceColorBackgroundDarkBlue,
        offWhite: tokens.surfaceColorBackgroundOffWhite,
        gray: tokens.surfaceColorBackgroundGray,
        paleBlue: tokens.surfaceColorBackgroundPaleBlue,
        skyBlue: tokens.surfaceColorBackgroundSkyBlue,
    },
    internalHeader: {
        backgroundColor: tokens.surfaceColorBackgroundWhite,
        color: tokens.typographyColorPrimary,
    },
    publicHeader: {
        backgroundColor: tokens.surfaceColorBackgroundWhite,
        color: tokens.typographyColorPrimary,
    },
    button: {
        primary: {
            backgroundColor: tokens.surfaceColorPrimaryButtonDefault,
            hoverBackgroundColor: tokens.surfaceColorPrimaryButtonHover,
            disabledBackgroundColor: tokens.surfaceColorPrimaryButtonDisabled,
            color: tokens.typographyColorPrimaryInvert,
            disabledColor: tokens.typographyColorDisabled,
        },
        secondary: {
            backgroundColor: tokens.surfaceColorSecondaryButtonDefault,
            hoverBackgroundColor: tokens.surfaceColorSecondaryButtonHover,
            disabledBackgroundColor: tokens.surfaceColorSecondaryButtonDisabled,
            color: tokens.typographyColorPrimary,
            disabledColor: tokens.typographyColorDisabled,
        },
        tertiary: {
            backgroundColor: tokens.surfaceColorTertiaryButtonDefault,
            hoverBackgroundColor: tokens.surfaceColorTertiaryButtonHover,
            disabledBackgroundColor: tokens.surfaceColorTertiaryButtonDisabled,
            color: tokens.surfaceColorPrimaryDefault,
            disabledColor: tokens.typographyColorDisabled,
        },
    },
    dashboard: {
        upcoming: {
            bg: tokens.supportSurfaceColorWarning,
            border: tokens.supportBorderColorWarning,
        },
        open: {
            bg: tokens.supportSurfaceColorSuccess,
            border: tokens.supportBorderColorSuccess,
        },
        closed: {
            bg: tokens.supportSurfaceColorDanger,
            border: tokens.supportBorderColorDanger,
        },
    },
    icons: {
        surveyReady: tokens.iconsColorSuccess,
        warning: tokens.supportIconColorWarning,
    },
    /**
     * Results-dashboard chart colours.
     *
     * Each series is an array of swatches plus a matching array of label colours, so a swatch and
     * the text drawn on top of it stay paired. Index into both with the same
     * `i % series.length` - see `DonutChart`/`RankOrderChart`/`LikertChart`.
     */
    chart: {
        // Donut and other unordered categorical series, in draw order.
        categorical: [
            tokens.dataVizBlueDark,
            tokens.dataVizBlueMedium,
            tokens.dataVizBlueLight,
            tokens.dataVizYellow,
            tokens.dataVizOrange,
            tokens.dataVizNeutral,
            tokens.dataVizGreen,
            tokens.dataVizSalmon,
            tokens.dataVizPurple,
            tokens.dataVizGreenDeep,
        ],
        categoricalLabel: [
            tokens.typographyColorPrimaryInvert,
            tokens.typographyColorPrimaryInvert,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimaryInvert,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
        ],
        // Rank-order stacked bars, indexed by rank position (0 = 1st place).
        rank: [
            tokens.dataVizBlueDark,
            tokens.dataVizBlueMedium,
            tokens.dataVizBlueLight,
            tokens.dataVizYellowLight,
            tokens.dataVizOrange,
        ],
        rankLabel: [
            tokens.typographyColorPrimaryInvert,
            tokens.typographyColorPrimaryInvert,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimaryInvert,
        ],
        // Likert scale, ordered negative -> strongly positive.
        likert: [
            tokens.dataVizRed,
            tokens.dataVizNeutral,
            tokens.dataVizAmber,
            tokens.dataVizBlueSky,
            tokens.dataVizBlueDark,
        ],
        likertLabel: [
            tokens.typographyColorPrimaryInvert,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimary,
            tokens.typographyColorPrimaryInvert,
        ],
        // Used when a data point falls outside a fixed-length scale.
        fallback: {
            swatch: tokens.dataVizNeutral,
            label: tokens.typographyColorPrimary,
        },
        // Chart chrome: the surfaces rows, bars and callouts are drawn on.
        surface: {
            rowHover: tokens.surfaceColorBackgroundOffWhite,
            rowDivider: tokens.surfaceColorBorderSubtle,
            callout: tokens.surfaceColorBackgroundPaleBlue,
            track: tokens.surfaceColorTrack,
            drawer: tokens.surfaceColorBackgroundGray,
            bar: tokens.surfaceColorBackgroundSkyBlue,
        },
        // Marker on a conditional follow-up question.
        conditionalMarker: tokens.dataVizGreen,
    },
};

export const BaseTheme = createTheme({
    palette: {
        primary: {
            main: Palette.primary.main,
            light: Palette.primary.light,
            dark: Palette.primary.dark,
        },
        secondary: {
            main: Palette.secondary.main,
            dark: Palette.secondary.dark,
            light: Palette.secondary.light,
        },
        text: {
            primary: Palette.text.primary,
            secondary: Palette.text.secondary,
            disabled: Palette.text.disabled,
        },
        action: {
            active: Palette.action.active,
            disabled: tokens.typographyColorDisabled,
            disabledBackground: tokens.surfaceColorPrimaryDisabled,
        },
        info: {
            main: Palette.info.main,
        },
        // Previously undefined, so every validation and error state fell through to MUI's defaults.
        error: {
            main: tokens.supportBorderColorDanger,
            light: tokens.supportSurfaceColorDanger,
        },
        warning: {
            main: tokens.supportBorderColorWarning,
            light: tokens.supportSurfaceColorWarning,
        },
        success: {
            main: tokens.supportBorderColorSuccess,
            light: tokens.supportSurfaceColorSuccess,
        },
        background: {
            default: Palette.background.default,
            paper: Palette.background.default,
        },
        divider: Palette.border.default,
    },
    shape: {
        borderRadius: parseInt(tokens.layoutBorderRadiusMedium, 10),
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    height: '40px',
                    '&.Mui-disabled': {
                        backgroundColor: tokens.surfaceColorPrimaryDisabled,
                        color: tokens.typographyColorDisabled,
                    },
                    '&.Mui-focusVisible': {
                        outline: `2px solid ${tokens.surfaceColorBorderActive}`,
                        outlineOffset: '2px',
                    },
                },
            },
            defaultProps: {
                disableRipple: true,
            },
        },
        MuiTextField: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.surfaceColorBorderDefault,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.surfaceColorBorderMedium,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.surfaceColorBorderActive,
                    },
                    '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.supportBorderColorDanger,
                    },
                    '&.Mui-disabled': {
                        backgroundColor: tokens.surfaceColorFormsDisabled,
                    },
                },
                input: {
                    '&::placeholder': {
                        color: tokens.typographyColorPlaceholder,
                        opacity: 1,
                    },
                },
            },
        },
        MuiFormHelperText: {
            styleOverrides: {
                root: {
                    '&.Mui-error': {
                        color: tokens.typographyColorDanger,
                    },
                },
            },
        },
        MuiCheckbox: {
            styleOverrides: {
                root: {
                    color: tokens.surfaceColorBorderMedium,
                    '&.Mui-checked': { color: tokens.surfaceColorPrimaryDefault },
                    '&.Mui-disabled': { color: tokens.typographyColorDisabled },
                },
            },
        },
        MuiRadio: {
            styleOverrides: {
                root: {
                    color: tokens.surfaceColorBorderMedium,
                    '&.Mui-checked': { color: tokens.surfaceColorPrimaryDefault },
                    '&.Mui-disabled': { color: tokens.typographyColorDisabled },
                },
            },
        },
        MuiLink: {
            defaultProps: {
                color: Palette.action.active,
            },
        },
        MuiFormLabel: {
            defaultProps: {
                focused: false,
            },
            styleOverrides: {
                root: {
                    '&.Mui-error': { color: tokens.typographyColorDanger },
                    '&.Mui-disabled': { color: tokens.typographyColorDisabled },
                },
            },
        },
        MuiStepLabel: {
            styleOverrides: {
                label: {
                    color: `${tokens.typographyColorPrimary} !important`,
                    opacity: '100% !important',
                },
                labelContainer: {
                    color: `${tokens.typographyColorPrimary} !important`,
                    opacity: '100% !important',
                },
            },
        },
    },
    typography: {
        fontFamily: MET_Header_Font_Family,
        fontSize: 16,
        // Sizes and line heights come from the BC DS typography tokens; headings are bold, body regular.
        h1: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeH1,
            lineHeight: tokens.typographyLineHeightH1,
        },
        h2: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeH2,
            lineHeight: tokens.typographyLineHeightH2,
        },
        h3: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeH3,
            lineHeight: tokens.typographyLineHeightH3,
        },
        h4: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeH4,
            lineHeight: tokens.typographyLineHeightH4,
        },
        h5: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeH5,
            lineHeight: tokens.typographyLineHeightH5,
        },
        h6: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeLargeBody,
            lineHeight: tokens.typographyLineHeightLargeBody,
        },
        subtitle1: {
            fontWeight: MET_Font_Weight,
            fontSize: tokens.typographyFontSizeLargeBody,
            lineHeight: tokens.typographyLineHeightLargeBody,
        },
        subtitle2: {
            fontWeight: MET_Font_Weight,
            fontSize: tokens.typographyFontSizeLargeBody,
            lineHeight: tokens.typographyLineHeightLargeBody,
        },
        body1: {
            fontWeight: MET_Font_Weight,
            fontSize: tokens.typographyFontSizeBody,
            lineHeight: tokens.typographyLineHeightBody,
        },
        body2: {
            fontWeight: MET_Font_Weight,
            fontSize: tokens.typographyFontSizeSmallBody,
            lineHeight: tokens.typographyLineHeightSmallBody,
        },
        caption: {
            fontWeight: MET_Font_Weight,
            fontSize: tokens.typographyFontSizeLabel,
            lineHeight: tokens.typographyLineHeightLabel,
        },
        button: {
            fontWeight: MET_Header_Font_Weight,
            fontSize: tokens.typographyFontSizeLargeBody,
            textTransform: 'none',
        },
    },
});

export const ZIndex = {
    footer: BaseTheme.zIndex.drawer + 1,
};

export const statusStyles: Record<number | string, { borderColor: string; background: string }> = {
    [CommentStatus.Pending]: {
        borderColor: tokens.supportBorderColorWarning,
        background: tokens.supportSurfaceColorWarning,
    },
    [CommentStatus.Approved]: {
        borderColor: tokens.supportBorderColorSuccess,
        background: tokens.supportSurfaceColorSuccess,
    },
    [CommentStatus.Rejected]: {
        borderColor: tokens.supportBorderColorDanger,
        background: tokens.supportSurfaceColorDanger,
    },
    [CommentStatus.NeedsFurtherReview]: {
        borderColor: tokens.supportBorderColorInfo,
        background: tokens.supportSurfaceColorInfo,
    },
    resubmitted: {
        borderColor: tokens.surfaceColorBorderMedium,
        background: tokens.surfaceColorBackgroundLightGray,
    },
};
