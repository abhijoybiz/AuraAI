import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, Animated, StyleSheet } from 'react-native';

export default function App() {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      {/* Satisfying button - can be easily deleted */}
      <TouchableOpacity onPress={handlePress} style={styles.button}>
        <Animated.View style={[styles.buttonInner, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.buttonText}>Press Me!</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  button: {
    padding: 20,
  },
  buttonInner: {
    backgroundColor: 'blue',
    padding: 20,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
});