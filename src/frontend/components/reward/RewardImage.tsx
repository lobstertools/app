import { red } from '@ant-design/colors';
import { theme as antdTheme } from 'antd';

/**
 * Generates and renders the reward code as an SVG image.
 * Takes the 32-char code and maps it to a 4x8 grid of arrows.
 */
export const RewardImage = ({ code }: { code: string }) => {
    const { token } = antdTheme.useToken();
    const cellSize = 100;
    const gridCols = 8;
    const gridRows = 4;
    const stemWidth = 24;
    const padding = 15;
    const arrowColor = red[5];

    // SVG path definitions for each arrow direction
    const arrowShapes = {
        U: {
            stem: { x1: 50, y1: 80, x2: 50, y2: 30 },
            head: { points: `50,${padding} ${100 - padding},50 ${padding},50` },
        },
        D: {
            stem: { x1: 50, y1: 20, x2: 50, y2: 70 },
            head: {
                points: `50,${100 - padding} ${padding},50 ${100 - padding},50`,
            },
        },
        L: {
            stem: { x1: 80, y1: 50, x2: 30, y2: 50 },
            head: { points: `${padding},50 50,${padding} 50,${100 - padding}` },
        },
        R: {
            stem: { x1: 20, y1: 50, x2: 70, y2: 50 },
            head: {
                points: `${100 - padding},50 50,${100 - padding} 50,${padding}`,
            },
        },
    };

    // Map the code string to SVG <g> (group) elements
    const arrows = code.split('').map((char, index) => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        const x = col * cellSize;
        const y = row * cellSize;
        const shape = arrowShapes[char as keyof typeof arrowShapes];

        return (
            <g key={index} transform={`translate(${x}, ${y})`}>
                <line {...shape.stem} stroke={arrowColor} strokeWidth={stemWidth} strokeLinecap="butt" />
                <polygon {...shape.head} fill={arrowColor} />
            </g>
        );
    });

    // Render the final SVG
    return (
        <svg
            width="100%"
            viewBox={`0 0 ${gridCols * cellSize} ${gridRows * cellSize}`}
            style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8,
                background: token.colorBgContainer,
            }}
        >
            <rect width="100%" height="100%" fill={token.colorBgContainer} />

            {/* Draw grid lines */}
            {Array.from({ length: gridCols - 1 }).map((_, i) => (
                <line
                    key={`v-${i}`}
                    x1={(i + 1) * cellSize}
                    y1="0"
                    x2={(i + 1) * cellSize}
                    y2={gridRows * cellSize}
                    stroke={token.colorSplit}
                    strokeWidth="2"
                />
            ))}
            {Array.from({ length: gridRows - 1 }).map((_, i) => (
                <line
                    key={`h-${i}`}
                    x1="0"
                    y1={(i + 1) * cellSize}
                    x2={gridCols * cellSize}
                    y2={(i + 1) * cellSize}
                    stroke={token.colorSplit}
                    strokeWidth="2"
                />
            ))}

            {/* Draw arrows */}
            {arrows}
        </svg>
    );
};
