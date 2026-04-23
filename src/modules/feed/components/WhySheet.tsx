/**
 * WhySheet — bottom sheet showing expanded rationale per spec §12.2.
 *
 * - Slides up at ~40% screen height
 * - rationale_expanded text
 * - Play button stub (disabled in v1, audio_rationale_url === null)
 * - Dismissable by tap-outside or drag-down
 */
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface WhySheetProps {
  visible: boolean;
  rationaleText: string | null;
  crossModalityNote: string | null;
  onDismiss: () => void;
}

export function WhySheet({ visible, rationaleText, crossModalityNote, onDismiss }: WhySheetProps) {
  if (!visible || !rationaleText) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Close" />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Why this?</Text>

          <Text style={styles.rationaleText}>{rationaleText}</Text>

          {/* Audio button stub — v1.1 */}
          <Pressable
            style={styles.audioButton}
            disabled
            accessibilityLabel="Audio rationale — coming soon"
            accessibilityRole="button"
          >
            <Text style={styles.audioIcon}>▶</Text>
            <Text style={styles.audioLabel}>Listen (coming soon)</Text>
          </Pressable>

          {/* Cross-modality note */}
          {crossModalityNote != null && (
            <>
              <View style={styles.divider} />
              <Text style={styles.crossModalityNote}>{crossModalityNote}</Text>
            </>
          )}

          {/* Dismiss button */}
          {Platform.OS === 'web' && (
            <Pressable style={styles.dismissButton} onPress={onDismiss}>
              <Text style={styles.dismissText}>Got it</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  rationaleText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    alignSelf: 'flex-start',
    opacity: 0.4,
    marginBottom: 16,
  },
  audioIcon: {
    fontSize: 12,
    color: '#6b7280',
  },
  audioLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  crossModalityNote: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  dismissButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
