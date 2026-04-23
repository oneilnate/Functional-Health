/**
 * WhyBottomSheet — expands rationale for the daily priority card.
 * Spec §12.2: bottom sheet at ~40% screen height, dismissable by tap-outside or drag-down.
 * Audio play button is stubbed (v1.1 — audio_rationale_url is always null in v1).
 */
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface WhyBottomSheetProps {
  visible: boolean;
  rationaleExpanded: string;
  crossModalityNote: string | null;
  onDismiss: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;

export function WhyBottomSheet({
  visible,
  rationaleExpanded,
  crossModalityNote,
  onDismiss,
}: WhyBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          // Prevent tap-inside from dismissing
        >
          <Pressable onPress={() => undefined}>
            {/* Drag handle */}
            <View style={styles.handle} />

            <Text style={styles.sectionLabel}>Why this today?</Text>
            <Text style={styles.rationaleText}>{rationaleExpanded}</Text>

            {/* Audio button stub — v1.1 */}
            <View style={styles.audioRow}>
              <View style={styles.audioButtonDisabled}>
                <Text style={styles.audioButtonText}>▶ Audio (coming soon)</Text>
              </View>
            </View>

            {crossModalityNote ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.crossModalityNote}>{crossModalityNote}</Text>
              </>
            ) : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SHEET_HEIGHT,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  rationaleText: {
    fontSize: 17,
    color: '#111827',
    lineHeight: 26,
    fontWeight: '400',
  },
  audioRow: {
    marginTop: 20,
  },
  audioButtonDisabled: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    opacity: 0.5,
  },
  audioButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  crossModalityNote: {
    fontSize: 15,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 22,
  },
});
