import { typographyFontFamiliesBcSans, typographyFontWeightsBold, typographyFontWeightsRegular } from './designTokens';

// Single source for the font stack. The token supplies its own quotes: "'BC Sans'".
export const MET_Header_Font_Family = `${typographyFontFamiliesBcSans}, 'Noto Sans', Verdana, Arial, sans-serif`;
export const MET_Header_Font_Weight = typographyFontWeightsBold;
// BC Sans ships 300/400/700 only, so the previous 500 already resolved to 400 at render time.
export const MET_Font_Weight = typographyFontWeightsRegular;
