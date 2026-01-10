import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, Mic2 } from 'lucide-react-native';

// Storage keys
const STORAGE_KEYS = {
  CARDS: '@memry_cards',
  FILTERS: '@memry_filters'
};

// Default filters
const DEFAULT_FILTERS = [
  { id: 'all', name: 'All', icon: null, isDefault: true },
  { id: 'favorites', name: 'Favorites', icon: 'star', isDefault: true }
];

// Initial mock data
const INITIAL_DATA = [
  { id: '1', title: 'Atomic bombshell in call of duty', date: 'Jan 24 2025', duration: '15min', isFavorite: true, filterIds: [] },
  { id: '2', title: 'Quantum mechanics explained', date: 'Jan 23 2025', duration: '45min', isFavorite: false, filterIds: [] },
  { id: '3', title: 'React Native Performance Tips', date: 'Jan 22 2025', duration: '12min', isFavorite: false, filterIds: [] },
  { id: '4', title: 'The history of the internet', date: 'Jan 20 2025', duration: '28min', isFavorite: true, filterIds: [] },
];

// Available icons for filters (Lucide/Feather icons)
const AVAILABLE_ICONS = [
  'bookmark', 'book', 'briefcase', 'code', 'coffee', 'globe',
  'heart', 'music', 'target', 'zap', 'umbrella', 'trending-up',
  'tag', 'sun', 'shield', 'package', 'map', 'layers',
  'home', 'gift', 'flag', 'cpu', 'cloud', 'camera'
];

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();

  // State
  const [cards, setCards] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showNewFilterModal, setShowNewFilterModal] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState('bookmark');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fabRotation = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  // Load data on mount and focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Save data whenever it changes
  useEffect(() => {
    if (cards.length > 0) {
      saveCards();
    }
  }, [cards]);

  useEffect(() => {
    if (filters.length > DEFAULT_FILTERS.length) {
      saveFilters();
    }
  }, [filters]);

  // Animate modals
  useEffect(() => {
    if (showAccountMenu || showCardMenu || showRenameModal || showFilterModal || showNewFilterModal) {
      fadeAnim.setValue(0);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [showAccountMenu, showCardMenu, showRenameModal, showFilterModal, showNewFilterModal]);

  const closeWithAnimation = (setter) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setter(false));
  };

  // Animate FAB
  useEffect(() => {
    Animated.parallel([
      Animated.spring(fabRotation, {
        toValue: isFabExpanded ? 1 : 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(fabScale, {
        toValue: isFabExpanded ? 1.1 : 1,
        tension: 150,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  }, [isFabExpanded]);

  const fabRotationInterpolate = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  // Background refresh for preparing cards
  useEffect(() => {
    const hasPreparingCards = cards.some(card => card.status === 'preparing');
    if (hasPreparingCards) {
      const interval = setInterval(() => {
        loadData();
      }, 3000); // Check every 3 seconds
      return () => clearInterval(interval);
    }
  }, [cards]);

  // Data persistence functions - ASYNC STORAGE FULLY IMPLEMENTED
  const loadData = async () => {
    try {
      const storedCards = await AsyncStorage.getItem(STORAGE_KEYS.CARDS);
      const storedFilters = await AsyncStorage.getItem(STORAGE_KEYS.FILTERS);

      if (storedCards) {
        setCards(JSON.parse(storedCards));
      } else {
        setCards(INITIAL_DATA);
        await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(INITIAL_DATA));
      }

      if (storedFilters) {
        const customFilters = JSON.parse(storedFilters);
        setFilters([...DEFAULT_FILTERS, ...customFilters]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setCards(INITIAL_DATA);
    }
  };

  const saveCards = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    } catch (error) {
      console.error('Error saving cards:', error);
    }
  };

  const saveFilters = async () => {
    try {
      const customFilters = filters.filter(f => !f.isDefault);
      await AsyncStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(customFilters));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  // Filter logic
  const getFilteredCards = () => {
    let filtered = cards;

    if (activeFilter === 'favorites') {
      filtered = filtered.filter(card => card.isFavorite);
    } else if (activeFilter !== 'all') {
      filtered = filtered.filter(card => card.filterIds?.includes(activeFilter));
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(card =>
        card.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  // Check if filter name is duplicate
  const isDuplicateFilterName = (name) => {
    const trimmedName = name.trim().toLowerCase();
    return filters.some(f => f.name.toLowerCase() === trimmedName);
  };

  // Card actions
  const toggleFavorite = (cardId) => {
    setCards(cards.map(card =>
      card.id === cardId ? { ...card, isFavorite: !card.isFavorite } : card
    ));
  };

  const deleteCard = (cardId) => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCards(cards.filter(card => card.id !== cardId));
            setShowCardMenu(false);
          }
        }
      ]
    );
  };

  const renameCard = () => {
    if (renameText.trim()) {
      setCards(cards.map(card =>
        card.id === selectedCard.id ? { ...card, title: renameText.trim() } : card
      ));
      setShowRenameModal(false);
      setShowCardMenu(false);
      setRenameText('');
    }
  };

  const assignCardToFilter = (filterId) => {
    setCards(cards.map(card => {
      if (card.id === selectedCard.id) {
        const filterIds = card.filterIds || [];
        const hasFilter = filterIds.includes(filterId);
        return {
          ...card,
          filterIds: hasFilter
            ? filterIds.filter(id => id !== filterId)
            : [...filterIds, filterId]
        };
      }
      return card;
    }));
  };

  // Filter management
  const createNewFilter = () => {
    const trimmedName = newFilterName.trim();

    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a filter name');
      return;
    }

    if (isDuplicateFilterName(trimmedName)) {
      Alert.alert('Duplicate Filter', 'A filter with this name already exists');
      return;
    }

    const newFilter = {
      id: `filter_${Date.now()}`,
      name: trimmedName,
      icon: newFilterIcon,
      isDefault: false
    };

    setFilters([...filters, newFilter]);
    setNewFilterName('');
    setNewFilterIcon('bookmark');
    closeWithAnimation(setShowNewFilterModal);
  };

  const deleteFilter = (filterId) => {
    Alert.alert(
      'Delete Filter',
      'Are you sure you want to delete this filter?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFilters(filters.filter(f => f.id !== filterId));
            if (activeFilter === filterId) {
              setActiveFilter('all');
            }
            setCards(cards.map(card => ({
              ...card,
              filterIds: card.filterIds?.filter(id => id !== filterId) || []
            })));
          }
        }
      ]
    );
  };

  // FAB actions
  const toggleFab = () => {
    setIsFabExpanded(!isFabExpanded);
  };

  const handleRecord = () => {
    setIsFabExpanded(false);
    navigation.navigate('Recording');
  };

  const handleUpload = async () => {
    try {
      setIsFabExpanded(false);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Get duration using expo-av
        const { sound } = await Audio.Sound.createAsync({ uri: asset.uri });
        const status = await sound.getStatusAsync();
        const durationMillis = status.durationMillis || 0;
        await sound.unloadAsync();

        const formatTime = (millis) => {
          const totalSeconds = millis / 1000;
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = Math.floor(totalSeconds % 60);
          return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

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
          uri: asset.uri,
          duration: formatTime(durationMillis),
          date: new Date().toLocaleDateString(),
          title: lectureTitle,
          source: 'upload'
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to upload audio file.');
    }
  };

  // Render card item
  const renderItem = ({ item }) => {
    const isPreparing = item.status === 'preparing';
    const progress = item.progress || 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('Results', {
            id: item.id,
            uri: item.uri,
            duration: item.duration,
            date: item.date,
            title: item.title,
            source: item.source,
            initialProgress: item.progress || 0.1,
            initialStatus: item.status || 'ready'
          });
        }}
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          isPreparing && { opacity: 0.8 }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {isPreparing && (
              <View style={[styles.statusBadge, { backgroundColor: colors.tint }]}>
                <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>PREPARING</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            disabled={isPreparing}
            onPress={() => {
              setSelectedCard(item);
              setShowCardMenu(true);
            }}
          >
            <Feather name="more-horizontal" size={20} color={isPreparing ? colors.border : colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="activity" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.duration}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <View style={styles.actionIcons}>
            <View style={[styles.actionIcon, { backgroundColor: colors.tint }]}>
              {item.source === 'upload' ? (
                <Feather name="file" size={16} color={colors.textSecondary} />
              ) : (
                <Mic size={16} color={colors.textSecondary} />
              )}
            </View>
          </View>
          <TouchableOpacity
            disabled={isPreparing}
            onPress={() => toggleFavorite(item.id)}
          >
            {item.isFavorite ? (
              <Feather name="star" size={18} color={isDark ? "#FFF" : "#000"} fill={isDark ? "#FFF" : "#000"} />
            ) : (
              <Feather name="star" size={18} color={isPreparing ? colors.border : colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {isPreparing && (
          <View style={[styles.progressBarContainer, { backgroundColor: isDark ? colors.border : '#E4E4E7' }]}>
            <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Reinvented Polished Header */}
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <View style={[styles.logoPulse, { backgroundColor: colors.tint }]}>
            <Image
              source={isDark ? require('../assets/logo_white.png') : require('../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.logoText, { color: colors.text }]}>Memry</Text>
            <Text style={[styles.logoSubtext, { color: colors.textSecondary }]}>LECTURES SIMPLIFIED</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.accountPill, { backgroundColor: colors.tint, borderColor: colors.border }]}
          onPress={() => setShowAccountMenu(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, { backgroundColor: isDark ? colors.primary : '#1a1a1a' }]}>
            <Text style={[styles.avatarText, { color: isDark ? colors.background : '#fff' }]}>O</Text>
          </View>
          <Feather name="chevron-down" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Feather name="search" size={20} color={colors.textSecondary} />
          <TextInput
            placeholder="Search"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters with Progressive Blur */}
      <View style={[styles.filterContainer, { position: 'relative' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={{ flex: 1 }}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === filter.id ? colors.primary : colors.tint,
                  borderColor: activeFilter === filter.id ? colors.primary : colors.border,
                  shadowColor: colors.shadow
                }
              ]}
              onPress={() => setActiveFilter(filter.id)}
              onLongPress={() => !filter.isDefault && deleteFilter(filter.id)}
            >
              {filter.icon && (
                <Feather
                  name={filter.icon}
                  size={14}
                  color={activeFilter === filter.id ? colors.card : colors.text}
                />
              )}
              <Text style={[
                styles.filterText,
                { color: activeFilter === filter.id ? colors.card : colors.text }
              ]}>
                {filter.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: colors.tint, width: 40, justifyContent: 'center', paddingHorizontal: 0, borderColor: colors.border }]}
            onPress={() => setShowNewFilterModal(true)}
          >
            <Feather name="plus" size={16} color={colors.text} />
          </TouchableOpacity>
        </ScrollView>

        {/* Left Blur */}
        <LinearGradient
          colors={[colors.background, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.leftBlur}
          pointerEvents="none"
        />

        {/* Right Blur */}
        <LinearGradient
          colors={['transparent', colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rightBlur}
          pointerEvents="none"
        />
      </View>

      {/* Cards List with Progressive Blur */}
      <View style={{ flex: 1, position: 'relative' }}>
        <FlatList
          data={getFilteredCards()}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {searchQuery ? 'No cards found' : 'No cards yet'}
              </Text>
            </View>
          }
        />

        {/* Top Blur */}
        <LinearGradient
          colors={[colors.background, 'transparent']}
          style={styles.topBlur}
          pointerEvents="none"
        />

        {/* Bottom Blur */}
        <LinearGradient
          colors={['transparent', colors.background]}
          style={styles.bottomBlur}
          pointerEvents="none"
        />
      </View>

      {/* FAB Menu */}
      {isFabExpanded && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={[styles.fabMenuItem, { backgroundColor: colors.primary }]} onPress={handleUpload}>
            <Text style={{ color: colors.card, fontWeight: '600' }}>Files</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fabMenuItem, { backgroundColor: colors.primary }]} onPress={handleRecord}>
            <Text style={{ color: colors.card, fontWeight: '600' }}>Record</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB - Animated */}
      <Animated.View
        style={[
          styles.fab,
          {
            backgroundColor: isFabExpanded ? colors.card : colors.primary,
            borderWidth: isFabExpanded ? 1 : 0,
            borderColor: colors.border,
            transform: [
              { rotate: fabRotationInterpolate },
              { scale: fabScale }
            ]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.fabButton}
          onPress={toggleFab}
        >
          <Feather name="plus" size={24} color={isFabExpanded ? colors.text : colors.card} />
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={showCardMenu}
        transparent
        animationType="none"
        onRequestClose={() => closeWithAnimation(setShowCardMenu)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => closeWithAnimation(setShowCardMenu)}>
          <Animated.View
            style={[
              styles.contextMenu,
              {
                backgroundColor: colors.card,
                opacity: fadeAnim,
                transform: [{
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1]
                  })
                }]
              }
            ]}
          >
            <View style={styles.contextMenuHeader}>
              <Text style={[styles.contextMenuTitle, { color: colors.text }]}>Card Actions</Text>
            </View>

            <View style={styles.contextMenuSection}>
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  setRenameText(selectedCard?.title || '');
                  setShowRenameModal(true);
                }}
              >
                <View style={[styles.contextMenuIconBox, { backgroundColor: colors.tint }]}>
                  <Feather name="edit-2" size={18} color={colors.text} />
                </View>
                <View style={styles.contextMenuTextContainer}>
                  <Text style={[styles.contextMenuItemText, { color: colors.text }]}>Rename</Text>
                  <Text style={[styles.contextMenuItemDesc, { color: colors.textSecondary }]}>
                    Change card title
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => setShowFilterModal(true)}
              >
                <View style={[styles.contextMenuIconBox, { backgroundColor: colors.tint }]}>
                  <Feather name="tag" size={18} color={colors.text} />
                </View>
                <View style={styles.contextMenuTextContainer}>
                  <Text style={[styles.contextMenuItemText, { color: colors.text }]}>Assign Filter</Text>
                  <Text style={[styles.contextMenuItemDesc, { color: colors.textSecondary }]}>
                    Organize with filters
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  toggleFavorite(selectedCard.id);
                  closeWithAnimation(setShowCardMenu);
                }
                }
              >
                <View style={[styles.contextMenuIconBox, { backgroundColor: colors.tint, }]}>
                  {selectedCard?.isFavorite ? (
                    <Feather name="star" size={16} color={isDark ? "#FFF" : "#000"} fill={isDark ? "#FFF" : "#000"} />
                  ) : (
                    <Feather name="star" size={16} color={colors.text} />
                  )}
                </View>
                <View style={styles.contextMenuTextContainer}>
                  <Text style={[styles.contextMenuItemText, { color: colors.text }]}>
                    {selectedCard?.isFavorite ? 'Unfavorite' : 'Favorite'}
                  </Text>
                  <Text style={[styles.contextMenuItemDesc, { color: colors.textSecondary }]}>
                    {selectedCard?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.contextMenuDivider, { backgroundColor: colors.border }]} />

            <View style={styles.contextMenuSection}>
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => selectedCard && deleteCard(selectedCard.id)}
              >
                <View style={[styles.contextMenuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </View>
                <View style={styles.contextMenuTextContainer}>
                  <Text style={[styles.contextMenuItemText, { color: '#ef4444' }]}>Delete Card</Text>
                  <Text style={[styles.contextMenuItemDesc, { color: colors.textSecondary }]}>
                    Permanently remove
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Rename Modal - PRODUCTION GRADE */}
      {/* Rename Modal - PRODUCTION GRADE */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="none"
        onRequestClose={() => closeWithAnimation(setShowRenameModal)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => closeWithAnimation(setShowRenameModal)} />
          <Pressable style={[styles.modernDialog, { backgroundColor: colors.card }]} pointerEvents="auto">
            <View style={styles.modernDialogHeader}>
              <View style={[styles.modernDialogIcon, { backgroundColor: colors.tint }]}>
                <Feather name="edit-2" size={20} color={colors.text} />
              </View>
              <Text style={[styles.modernDialogTitle, { color: colors.text }]}>Rename Card</Text>
              <Text style={[styles.modernDialogSubtitle, { color: colors.textSecondary }]}>
                Enter a new name for this card
              </Text>
            </View>

            <View style={styles.modernDialogContent}>
              <TextInput
                style={[
                  styles.modernInput,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Enter new name"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
            </View>

            <View style={styles.modernDialogActions}>
              <TouchableOpacity
                style={[styles.modernButton, styles.modernButtonSecondary, { backgroundColor: colors.tint }]}
                onPress={() => closeWithAnimation(setShowRenameModal)}
              >
                <Text style={[styles.modernButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modernButton, styles.modernButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={renameCard}
              >
                <Text style={[styles.modernButtonText, { color: colors.card, fontWeight: '600' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter Assignment Modal - PRODUCTION GRADE */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="none"
        onRequestClose={() => closeWithAnimation(setShowFilterModal)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => closeWithAnimation(setShowFilterModal)}>
          <Pressable style={[styles.modernDialog, { backgroundColor: colors.card }]} pointerEvents="auto">
            <View style={styles.modernDialogHeader}>
              <View style={[styles.modernDialogIcon, { backgroundColor: colors.tint }]}>
                <Feather name="tag" size={20} color={colors.text} />
              </View>
              <Text style={[styles.modernDialogTitle, { color: colors.text }]}>Assign to Filters</Text>
              <Text style={[styles.modernDialogSubtitle, { color: colors.textSecondary }]}>
                Select which filters this card belongs to
              </Text>
            </View>

            <ScrollView style={styles.filterAssignList}>
              {filters.filter(f => !f.isDefault).map(filter => {
                const isAssigned = selectedCard?.filterIds?.includes(filter.id);
                return (
                  <TouchableOpacity
                    key={filter.id}
                    style={[
                      styles.filterAssignItem,
                      {
                        backgroundColor: isAssigned ? colors.tint : 'transparent',
                        borderColor: isAssigned ? colors.primary : 'transparent',
                        borderWidth: 1
                      }
                    ]}
                    onPress={() => assignCardToFilter(filter.id)}
                  >
                    <View style={styles.filterAssignLeft}>
                      {/* Selection Marker */}
                      {isAssigned && (
                        <View style={[styles.selectionMarker, { backgroundColor: colors.primary }]} />
                      )}
                      <View style={[styles.filterAssignIconBox, { backgroundColor: colors.tint }]}>
                        <Feather name={filter.icon} size={16} color={colors.text} />
                      </View>
                      <Text style={[styles.filterAssignText, { color: colors.text }]}>
                        {filter.name}
                      </Text>
                    </View>
                    <View style={[
                      styles.modernCheckbox,
                      {
                        backgroundColor: isAssigned ? colors.primary : 'transparent',
                        borderColor: isAssigned ? colors.primary : colors.border
                      }
                    ]}>
                      {isAssigned && <Feather name="check" size={14} color={colors.card} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modernButton, styles.modernButtonPrimary, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => {
                closeWithAnimation(setShowFilterModal);
                closeWithAnimation(setShowCardMenu);
              }}
            >
              <Text style={[styles.modernButtonText, { color: colors.card, fontWeight: '600' }]}>Apply Changes</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New Filter Modal - PRODUCTION GRADE WITH FIXED LAYOUT */}
      <Modal
        visible={showNewFilterModal}
        transparent
        animationType="none"
        onRequestClose={() => closeWithAnimation(setShowNewFilterModal)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => closeWithAnimation(setShowNewFilterModal)} />
          <Pressable style={[styles.modernDialog, styles.createFilterDialog, { backgroundColor: colors.card }]} pointerEvents="auto">
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.modernDialogHeader}>
                <View style={[styles.modernDialogIcon, { backgroundColor: colors.tint }]}>
                  <Feather name="plus-circle" size={20} color={colors.text} />
                </View>
                <Text style={[styles.modernDialogTitle, { color: colors.text }]}>Create Filter</Text>
                <Text style={[styles.modernDialogSubtitle, { color: colors.textSecondary }]}>
                  Choose an icon and name for your new filter
                </Text>
              </View>

              <View style={styles.modernDialogContent}>
                {/* Icon Selector and Input Row */}
                <View style={styles.filterCreateRow}>
                  <TouchableOpacity
                    style={[
                      styles.selectedIconBox,
                      { backgroundColor: colors.tint, borderColor: colors.border }
                    ]}
                  >
                    <Feather name={newFilterIcon} size={24} color={colors.text} />
                  </TouchableOpacity>

                  <TextInput
                    style={[
                      styles.modernInput,
                      styles.filterNameField,
                      {
                        backgroundColor: colors.inputBackground,
                        color: colors.text,
                        borderColor: isDuplicateFilterName(newFilterName) && newFilterName.trim() ? '#ef4444' : colors.border
                      }
                    ]}
                    value={newFilterName}
                    onChangeText={setNewFilterName}
                    placeholder="Filter name"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                  />
                </View>

                {/* Duplicate Warning */}
                {isDuplicateFilterName(newFilterName) && newFilterName.trim() && (
                  <View style={styles.validationWarning}>
                    <Feather name="alert-circle" size={14} color="#ef4444" />
                    <Text style={styles.validationText}>A filter with this name already exists</Text>
                  </View>
                )}

                {/* Icon Grid - Fixed Layout */}
                <View style={styles.iconGridSection}>
                  <Text style={[styles.iconGridLabel, { color: colors.textSecondary }]}>
                    Select Icon
                  </Text>
                  <View style={styles.iconGridContainer}>
                    {AVAILABLE_ICONS.map(icon => (
                      <TouchableOpacity
                        key={icon}
                        style={[
                          styles.iconGridItem,
                          {
                            backgroundColor: newFilterIcon === icon ? colors.primary : colors.tint,
                            borderColor: newFilterIcon === icon ? colors.primary : colors.border
                          }
                        ]}
                        onPress={() => setNewFilterIcon(icon)}
                      >
                        <Feather
                          name={icon}
                          size={20}
                          color={newFilterIcon === icon ? colors.card : colors.text}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.modernDialogActions}>
                <TouchableOpacity
                  style={[styles.modernButton, styles.modernButtonSecondary, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    closeWithAnimation(setShowNewFilterModal);
                    setNewFilterName('');
                    setNewFilterIcon('bookmark');
                  }}
                >
                  <Text style={[styles.modernButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modernButton,
                    styles.modernButtonPrimary,
                    {
                      backgroundColor: (!newFilterName.trim() || isDuplicateFilterName(newFilterName))
                        ? colors.textSecondary
                        : colors.primary,
                      opacity: (!newFilterName.trim() || isDuplicateFilterName(newFilterName)) ? 0.5 : 1
                    }
                  ]}
                  onPress={createNewFilter}
                  disabled={!newFilterName.trim() || isDuplicateFilterName(newFilterName)}
                >
                  <Text style={[styles.modernButtonText, { color: colors.card, fontWeight: '600' }]}>Create</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Account Menu Modal - PRODUCTION GRADE */}
      <Modal
        visible={showAccountMenu}
        transparent
        animationType="none"
        onRequestClose={() => closeWithAnimation(setShowAccountMenu)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => closeWithAnimation(setShowAccountMenu)}>
          <Animated.View
            style={[
              styles.accountMenu,
              {
                backgroundColor: colors.card,
                opacity: fadeAnim,
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.accountMenuHeader}>
              <View style={[styles.avatarLarge, { backgroundColor: isDark ? colors.primary : '#18181B' }]}>
                <Text style={{ color: isDark ? colors.background : '#fff', fontSize: 20, fontWeight: '600' }}>O</Text>
              </View>
              <Text style={[styles.accountName, { color: colors.text }]}>User</Text>
              <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>user@example.com</Text>
            </View>

            <View style={[styles.accountMenuDivider, { backgroundColor: colors.border }]} />

            <View style={styles.accountMenuSection}>
              <TouchableOpacity
                style={styles.accountMenuItem}
                onPress={() => {
                  closeWithAnimation(setShowAccountMenu);
                  navigation.navigate('Settings');
                }}
              >
                <View style={[styles.accountMenuIconBox, { backgroundColor: colors.tint }]}>
                  <Feather name="user" size={16} color={colors.text} />
                </View>
                <Text style={[styles.accountMenuText, { color: colors.text }]}>Profile</Text>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountMenuItem}
                onPress={() => {
                  closeWithAnimation(setShowAccountMenu);
                  navigation.navigate('Settings');
                }}
              >
                <View style={[styles.accountMenuIconBox, { backgroundColor: colors.tint }]}>
                  <Feather name="settings" size={16} color={colors.text} />
                </View>
                <Text style={[styles.accountMenuText, { color: colors.text }]}>Settings</Text>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountMenuItem}
                onPress={() => {
                  closeWithAnimation(setShowAccountMenu);
                  navigation.navigate('Settings');
                }}
              >
                <View style={[styles.accountMenuIconBox, { backgroundColor: colors.tint }]}>
                  <Feather name="help-circle" size={16} color={colors.text} />
                </View>
                <Text style={[styles.accountMenuText, { color: colors.text }]}>Help & Support</Text>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>

            <View style={[styles.accountMenuDivider, { backgroundColor: colors.border }]} />

            <View style={styles.accountMenuSection}>
              <TouchableOpacity
                style={styles.accountMenuItem}
                onPress={() => {
                  closeWithAnimation(setShowAccountMenu);
                  Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign Out", style: "destructive" }
                  ]);
                }}
              >
                <View style={[styles.accountMenuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Feather name="log-out" size={16} color="#ef4444" />
                </View>
                <Text style={[styles.accountMenuText, { color: '#ef4444' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingTop: Platform.OS === 'ios' ? 12 : 48,
    paddingBottom: 20,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoPulse: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  logoText: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  searchContainer: {
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m + 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    height: 48,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: SPACING.m - 22,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  filterContainer: {
    marginBottom: SPACING.m - 6,
    height: 39,
  },
  filterScroll: {
    paddingHorizontal: SPACING.m,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: SPACING.m - 22,
  },
  filterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: SPACING.m,
    paddingBottom: 80,
    marginTop: SPACING.m - 10,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    // Modern subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 6,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 70,
    height: 70,
    borderRadius: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  fabButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenu: {
    position: 'absolute',
    bottom: 120,
    right: 24,
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 10,
    width: 100,
    height: 100,
  },
  fabMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  // Production-grade context menu
  contextMenu: {
    width: 280, // Fixed, compact width
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  contextMenuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  contextMenuTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  contextMenuSection: {
    padding: 6,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
    borderRadius: 10,
    marginVertical: 1,
  },
  contextMenuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextMenuTextContainer: {
    flex: 1,
    gap: 2,
  },
  contextMenuItemText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  contextMenuItemDesc: {
    fontSize: 11,
    opacity: 0.5,
    lineHeight: 14,
  },
  contextMenuDivider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  // Production-grade modern dialogs
  modernDialog: {
    width: 320, // Compact fixed width
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  createFilterDialog: {
    width: 340,
    maxHeight: '80%',
  },
  modernDialogHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modernDialogIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modernDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modernDialogSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    opacity: 0.7,
  },
  modernDialogContent: {
    marginBottom: 20,
  },
  modernInput: {
    borderRadius: 14,
    padding: 12, // More compact
    fontSize: 15,
    borderWidth: 1.5,
  },
  filterCreateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  selectedIconBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  filterNameField: {
    flex: 1,
  },
  validationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  validationText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  iconGridSection: {
    marginTop: 8,
  },
  iconGridLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  iconGridItem: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  modernDialogActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modernButton: {
    flex: 1,
    paddingVertical: 12, // Compact
    borderRadius: 12,
    alignItems: 'center',
  },
  modernButtonPrimary: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  modernButtonSecondary: {},
  modernButtonText: {
    fontSize: 16,
  },
  filterAssignList: {
    maxHeight: 280,
    marginBottom: 8,
  },
  filterAssignItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  filterAssignLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  filterAssignIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionMarker: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  filterAssignText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  modernCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    borderRadius: 40,
  },
  progressBar: {
    height: '100%',
  },
  // Production-grade account menu
  accountMenu: {
    position: 'absolute',
    top: 64,
    right: 16,
    width: 260, // Compact
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  accountMenuHeader: {
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  accountEmail: {
    fontSize: 13,
    opacity: 0.6,
  },
  accountMenuSection: {
    padding: 6,
  },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
    borderRadius: 8,
    marginVertical: 1,
  },
  accountMenuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMenuText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  accountMenuDivider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  topBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 1,
  },
  bottomBlur: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  leftBlur: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 1,
  },
  rightBlur: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 1,
  },
});