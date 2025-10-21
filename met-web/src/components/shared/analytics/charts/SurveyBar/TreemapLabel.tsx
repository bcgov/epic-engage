import React, { Component } from 'react';
import { DASHBOARD } from '../../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class TreemapLabel extends Component<any> {
    static displayName = 'TreemapLabel';

    static defaultProps = {};

    render() {
        const { depth, x, y, width, height, name, count } = this.props;
        const fontSize = 16;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={DASHBOARD.BAR_CHART.FILL_COLOR}
                    stroke="#fff"
                    strokeWidth={2 / (depth + 1e-10)}
                    strokeOpacity={1 / (depth + 1e-10)}
                />
                {depth === 1 ? (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 9}
                        textAnchor="middle"
                        fill="#fff"
                        stroke="none"
                        fontSize={fontSize}
                    >
                        {name.length > Math.floor(width / fontSize)
                            ? name
                                  .slice(0, Math.floor(width / fontSize))
                                  .trimEnd()
                                  .concat('...')
                            : name}{' '}
                        ({count})
                    </text>
                ) : null}
            </g>
        );
    }
}
