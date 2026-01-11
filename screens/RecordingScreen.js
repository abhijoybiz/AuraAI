import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../constants/theme';

const { width } = Dimensions.get('window');

/**
 * Waveform Bar Component - Strictly following previous_app.js.txt pattern
 */
const WaveBar = ({ level, isRecording, color }) => {
  const animatedHeight = useRef(new Animated.Value(5)).current;

  useEffect(() => {
    // Increased multiplier for higher amplitude (from 60 to 140)
    const targetHeight = isRecording ? Math.max(5, level * 140) : 5;

    Animated.timing(animatedHeight, {
      toValue: targetHeight,
      duration: 120, // Slightly slower duration for more "liquid" feel
      useNativeDriver: false,
    }).start();
  }, [level, isRecording]);

  return (
    <Animated.View
      style={{
        width: 4,
        height: animatedHeight,
        backgroundColor: color || '#000000',
        marginHorizontal: 3.5,
        borderRadius: 2,
        opacity: isRecording ? 1 : 0.2,
      }}
    />
  );
};

export default function RecordingScreen({ navigation }) {
  const { colors, isDark } = useTheme();

  // Recording State (Maintained from previous logic as per scope limitation)
  const [recording, setRecording] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);

  // Audio Metering State - Strictly following previous_app.js.txt pattern
  const [audioMetering, setAudioMetering] = useState(Array(35).fill(0));

  // Pulse animation for the recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => { });
      }
    };
  }, [recording]);

  // Pulse animation effect
  useEffect(() => {
    if (recording && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recording, isPaused]);

  // Keep original recording functions but use them in the new UI
  async function handleRecordPress() {
    if (recording) return;

    setIsPreparing(true);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is required.');
        setIsPreparing(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          setDurationMillis(status.durationMillis);
          if (status.isRecording && status.metering !== undefined) {
            // Normalize dB (-160 to 0) to 0-1 range approx for visualization
            const db = status.metering;
            const normalized = Math.min(Math.max((db + 60) / 60, 0), 1);

            setAudioMetering(prev => {
              const newArr = [...prev.slice(1), normalized];
              return newArr;
            });
          }
        },
        100
      );

      setRecording(newRecording);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording.');
    } finally {
      setIsPreparing(false);
    }
  }

  async function handlePauseResume() {
    if (!recording) return;
    try {
      if (isPaused) {
        if (typeof recording.resumeAsync === 'function') {
          await recording.resumeAsync();
        } else {
          await recording.startAsync();
        }
        setIsPaused(false);
      } else {
        await recording.pauseAsync();
        setIsPaused(true);
      }
    } catch (err) {
      console.error('Failed to pause/resume recording', err);
    }
  }

  async function handleStop() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const finalDuration = durationMillis;
      setRecording(null);
      setIsPaused(false);
      setAudioMetering(Array(35).fill(0));

      // Dynamic Title Generation
      let lectureTitle = 'New Lecture';
      try {
        const storedCards = await AsyncStorage.getItem('@memry_cards');
        const cards = storedCards ? JSON.parse(storedCards) : [];
        lectureTitle = `Lecture ${cards.length + 1}`;
      } catch (e) {
        console.error('Error getting card count', e);
      }

      navigation.replace('Results', {
        uri,
        duration: formatTime(finalDuration),
        date: new Date().toISOString(),
        title: lectureTitle,
        source: 'recording'
      });
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  const formatTime = (millis) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header - Moved downward with padding */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (recording) {
              Alert.alert('Discard Recording?', 'This will permanently delete it.', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
              ]);
            } else {
              navigation.goBack();
            }
          }}
        >
          <Feather name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          {recording && !isPaused && (
            <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {!recording ? 'Record' : isPaused ? 'Paused' : 'Recording'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Simplified Body */}
      <View style={styles.body}>
        <View style={styles.infoContainer}>
          <Text style={[styles.timer, { color: colors.text }]}>
            {formatTime(durationMillis)}
          </Text>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {recording ? (isPaused ? 'RESUME TO CONTINUE' : 'TAP TO STOP') : 'TAP TO BEGIN'}
          </Text>
        </View>

        {/* Enhanced Waveform - Taller and more expressive */}
        <View style={styles.waveformWrapper}>
          <View style={styles.waveformContainer}>
            {audioMetering.map((level, i) => (
              <WaveBar key={i} level={level} isRecording={!!recording && !isPaused} color={colors.text} />
            ))}
          </View>
        </View>
      </View>

      {/* Controls Container */}
      <View style={styles.controlsContainer}>
        {recording && (
          <TouchableOpacity
            style={[styles.pauseBtn, { backgroundColor: colors.tint }]}
            onPress={handlePauseResume}
          >
            <Feather name={isPaused ? "play" : "pause"} size={22} color={colors.text} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.mainRecordButton,
            { backgroundColor: recording ? '#EF4444' : colors.primary }
          ]}
          onPress={recording ? handleStop : handleRecordPress}
          disabled={isPreparing}
        >
          <View style={[
            styles.recordIcon,
            recording && styles.stopIcon,
            { backgroundColor: colors.background }
          ]} />
        </TouchableOpacity>

        {recording && <View style={{ width: 50 }} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    height: 80, // Increased height for top clearance
    paddingTop: 20, // Move downward from ceiling
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  timer: {
    fontSize: 80,
    fontWeight: '200',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    top: -50,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: -4,
    top: -50,
  },
  waveformWrapper: {
    height: 180, // Increased height to support higher amplitude
    width: '100%', // Fixed the width: '100' bug
    justifyContent: 'center',
    alignItems: 'center',
    top: -50,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    paddingHorizontal: 20,
    width: '100%',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 30,
  },
  mainRecordButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    bottom: -20,
  },
  recordIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
  },
  stopIcon: {
    borderRadius: 4,
    width: 24,
    height: 24,
  },
  pauseBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: -20,
  }
});
