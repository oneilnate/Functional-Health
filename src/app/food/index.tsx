/**
 * Food Pod home screen — /food route.
 * Assembles UAHeader, FlexibilityCard, FoodSnapCard, UnlockedCard, RewardPointsFooter.
 * All business logic delegated to src/modules/food/.
 */
import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import {
  captureMeal,
  DEMO_POD_ID,
  DEMO_TARGET,
  FlexibilityCard,
  FoodSnapCard,
  RewardPointsFooter,
  TuneInModal,
  UAHeader,
  usePod,
  useUploadImage,
} from '@/modules/food';

export default function FoodScreen(): React.JSX.Element {
  const [tuneInVisible, setTuneInVisible] = useState(false);
  const { pod } = usePod();
  const uploadMutation = useUploadImage();

  const capturedCount = pod?.capturedCount ?? 0;

  const handleCapture = async (): Promise<void> => {
    const uri = await captureMeal();
    if (uri) {
      uploadMutation.mutate({ podId: DEMO_POD_ID, uri });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <UAHeader />
        <View style={styles.cardGap} />
        <FlexibilityCard />
        <FoodSnapCard
          pod={pod}
          capturedCount={capturedCount}
          onCapture={handleCapture}
          onUnlockedPress={() => setTuneInVisible(true)}
          isUploading={uploadMutation.isPending}
          demoTarget={DEMO_TARGET}
        />
        <RewardPointsFooter />
      </ScrollView>
      <TuneInModal visible={tuneInVisible} onDismiss={() => setTuneInVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  cardGap: {
    height: 8,
  },
});
