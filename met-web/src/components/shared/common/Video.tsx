import { styled } from '@mui/system';
import ReactPlayer from 'react-player';

export const AspectRatioContainer = styled('div')({
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%' /* 16:9 aspect ratio (height / width * 100) */,
});

export const ReactPlayerWrapper = styled(ReactPlayer)({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
});
