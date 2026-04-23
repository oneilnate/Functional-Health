/**
 * DotGrid — 30-dot progress grid (5 rows × 6 cols).
 * Green #22C55E = captured, #D9D9D9 = empty.
 */
import { StyleSheet, View } from 'react-native';
import { GRID_SIZE } from '../constants';

interface DotGridProps {
  capturedCount: number;
}

const DOT_SIZE = 20;
const DOT_GAP = 10;
const COLS = 6;
const CAPTURED_COLOR = '#22C55E';
const EMPTY_COLOR = '#D9D9D9';

// Static dot indices — never reorder, keys are stable
const DOT_INDICES = Array.from({ length: GRID_SIZE }, (_, i) => i);

// Row starts: 0, 6, 12, 18, 24
const ROW_STARTS = Array.from({ length: Math.ceil(GRID_SIZE / COLS) }, (_, r) => r * COLS);

export function DotGrid({ capturedCount }: DotGridProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {ROW_STARTS.map((rowStart) => (
        <View key={rowStart} style={styles.row}>
          {DOT_INDICES.slice(rowStart, rowStart + COLS).map((dotIdx) => (
            <View
              key={dotIdx}
              style={[
                styles.dot,
                { backgroundColor: dotIdx < capturedCount ? CAPTURED_COLOR : EMPTY_COLOR },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: DOT_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
