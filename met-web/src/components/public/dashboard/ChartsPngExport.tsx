import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography } from '@mui/material';
import * as htmlToImage from 'html-to-image';
import dayjs from 'dayjs';
import { MetHeader4 } from 'components/shared/common';
import { TypedSurveyData } from 'models/analytics/surveyResult';
import { DashboardType } from 'constants/dashboardType';
import { Palette } from 'styles/Theme';
import { COMPONENT_TYPE, QuestionChart } from './SurveyResultsCharts';
import { QuestionDescription } from './charts/QuestionDescription';
import { chartFileNames, chartZipName } from './exportCharts';

// Every image is laid out at one width so the set matches whatever window it was exported from,
// then captured at 2x so it stays sharp when printed or placed in a document.
const EXPORT_WIDTH = 900;
const PIXEL_RATIO = 2;
const DRAW_TIMEOUT_MS = 10000;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const saveUrl = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
};

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    saveUrl(url, filename);
    URL.revokeObjectURL(url);
};

const capturePng = (card: HTMLElement) =>
    htmlToImage.toPng(card, { pixelRatio: PIXEL_RATIO, backgroundColor: Palette.background.default });

interface ChartsPngExportProps {
    engagementName: string;
    charts: TypedSurveyData[];
    descriptions: Record<string, string>;
    // Set to save the first chart as a lone PNG under this name instead of zipping the set.
    fileName?: string;
    // Called once the zip has been saved, or with the error that stopped it.
    onDone: (error?: unknown) => void;
}

/**
 * Renders each chart off-screen as its own image card (title, description, chart and
 * an export footer), captures each card as a PNG and downloads them together as a zip,
 * or as a single PNG when given a `fileName`.
 */
export const ChartsPngExport = ({ engagementName, charts, descriptions, fileName, onDone }: ChartsPngExportProps) => {
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const exportedOn = dayjs();

    useEffect(() => {
        // Set on unmount, so an export cut short (or StrictMode's dev-only remount) never saves a second copy.
        let cancelled = false;
        const exportCharts = async () => {
            try {
                // Capturing before the web fonts or first paint land would bake fallback text into the image.
                await document.fonts.ready;
                // A Likert chart draws its SVG only after measuring its width, a render or two after mount.
                const isDrawn = () =>
                    charts.every(
                        (chart, index) =>
                            chart.type !== COMPONENT_TYPE.SURVEY || cardRefs.current[index]?.querySelector('svg'),
                    );
                const deadline = Date.now() + DRAW_TIMEOUT_MS;
                do {
                    if (Date.now() > deadline) {
                        throw new Error('Charts did not finish drawing before export.');
                    }
                    await nextFrame();
                } while (!isDrawn());
                // One more frame so the newly drawn SVGs are painted, not just committed.
                await nextFrame();
                if (fileName) {
                    const [card] = cardRefs.current;
                    if (!card) {
                        throw new Error('Chart was not rendered for export.');
                    }
                    const dataUrl = await capturePng(card);
                    if (!cancelled) {
                        saveUrl(dataUrl, fileName);
                        onDone();
                    }
                    return;
                }
                const fileNames = chartFileNames(engagementName, charts);
                // Loaded only when someone exports, keeping it out of the dashboard bundle.
                const { BlobWriter, Data64URIReader, ZipWriter } = await import('@zip.js/zip.js');
                // PNGs are already compressed, so they're stored rather than deflated again.
                const zip = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false, level: 0 });
                for (const [index, card] of cardRefs.current.entries()) {
                    if (!card) {
                        continue;
                    }
                    await zip.add(fileNames[index], new Data64URIReader(await capturePng(card)));
                }
                const blob = await zip.close();
                if (!cancelled) {
                    saveBlob(blob, chartZipName(engagementName, exportedOn.format('YYYY-MM-DD')));
                    onDone();
                }
            } catch (error) {
                if (!cancelled) {
                    onDone(error);
                }
            }
        };
        exportCharts();
        return () => {
            cancelled = true;
        };
        // Runs once per export; the parent unmounts this when it finishes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return createPortal(
        <Box aria-hidden sx={{ position: 'fixed', left: -10000, top: 0, width: EXPORT_WIDTH, pointerEvents: 'none' }}>
            {charts.map((chart, index) => (
                <Box
                    key={chart.key}
                    ref={(node: HTMLDivElement | null) => (cardRefs.current[index] = node)}
                    sx={{ width: EXPORT_WIDTH, backgroundColor: Palette.background.default }}
                >
                    <Box sx={{ p: 4 }}>
                        <MetHeader4 sx={{ lineHeight: 1.4 }}>{chart.label}</MetHeader4>
                        <QuestionDescription description={descriptions[chart.key]} />
                        <QuestionChart
                            question={chart}
                            commentsByKey={new Map()}
                            followUps={[]}
                            dashboardType={DashboardType.PUBLIC}
                            bare
                        />
                    </Box>
                    <Box
                        sx={{
                            px: 4,
                            py: 1.5,
                            backgroundColor: Palette.background.light,
                            borderTop: `1px solid ${Palette.border.default}`,
                        }}
                    >
                        <Typography sx={{ fontSize: 12, color: Palette.text.secondary }}>
                            {engagementName} · Exported from EPIC.engage · {exportedOn.format('MMMM D, YYYY')}
                        </Typography>
                    </Box>
                </Box>
            ))}
        </Box>,
        document.body,
    );
};

export default ChartsPngExport;
