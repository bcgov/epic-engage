import React, { useContext } from 'react';
import { Grid, Skeleton } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { CommentViewContext } from './CommentViewContext';
import { MetPaper, MetHeader4 } from 'components/shared/common';
import CommentTable from './CommentTable';
import { Palette } from 'styles/Theme';

export const CommentsBlock: React.FC = () => {
    const { slug } = useParams();
    const { engagement, isEngagementLoading } = useContext(CommentViewContext);
    const basePath = slug ? `/${slug}` : `/engagements/${engagement?.id}`;

    if (isEngagementLoading || !engagement) {
        return <Skeleton width="100%" height="40em" />;
    }

    return (
        <>
            <Grid item xs={12} container direction="row" justifyContent="flex-end">
                <Link
                    to={slug ? basePath : `/engagements/${engagement.id}/view`}
                    style={{ color: Palette.action.active }}
                >
                    {'<<Return to ' + engagement.name + ' Engagement'}
                </Link>
            </Grid>
            <Grid item xs={12}>
                <MetPaper elevation={1} sx={{ padding: '2em 2em 0 2em' }}>
                    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start" rowSpacing={2}>
                        <Grid item xs={12}>
                            <MetHeader4>Comments</MetHeader4>
                        </Grid>
                        <Grid item xs={12}>
                            <CommentTable />
                        </Grid>
                    </Grid>
                </MetPaper>
            </Grid>
        </>
    );
};

export default CommentsBlock;
