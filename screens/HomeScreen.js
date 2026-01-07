import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  Image,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  Easing,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MOCK_DATA, FILTERS } from "../constants/mockData";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const [textInput1, setTextInput1] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [filters, setFilters] = useState(FILTERS);
  const [cards, setCards] = useState(MOCK_DATA);

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");

  const [selectedCard, setSelectedCard] = useState(null);
  const [isCardMenuVisible, setIsCardMenuVisible] = useState(false);
  const [cardMenuPosition, setCardMenuPosition] = useState({ x: 0, y: 0 });
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isAssignFilterVisible, setIsAssignFilterVisible] = useState(false);

  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [accountMenuPosition, setAccountMenuPosition] = useState({ x: 0, y: 0 });

  // FAB State
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Menu Animations - Separate for each menu
  const accountMenuAnim = useRef(new Animated.Value(0)).current;
  const accountBackdropAnim = useRef(new Animated.Value(0)).current;
  const cardMenuAnim = useRef(new Animated.Value(0)).current;
  const cardBackdropAnim = useRef(new Animated.Value(0)).current;

  // FAB Animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isFabExpanded ? 1 : 0,
      duration: 200,
      easing: Easing.ease,
    }).start();
  }, [isFabExpanded]);

  const animateContextMenuOpen = (menuAnim, backdropAnim) => {
    menuAnim.setValue(0);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(menuAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateContextMenuClose = (menuAnim, backdropAnim, onDone) => {
    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone?.();
    });
  };

  const filteredData = cards.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(textInput1.toLowerCase());
    if (activeFilter === "All") return matchesSearch;
    if (activeFilter === "Favorites") return matchesSearch && item.isFavorite;
    return matchesSearch && item.category === activeFilter;
  });

  const handleAddFilter = () => {
    setNewFilterName("");
    setIsFilterModalVisible(true);
  };

  const saveNewFilter = () => {
    const name = newFilterName.trim();
    if (!name) {
      Alert.alert("Filter name required");
      return;
    }
    if (filters.includes(name)) {
      Alert.alert("Filter already exists");
      return;
    }
    const updated = [...filters, name];
    setFilters(updated);
    setIsFilterModalVisible(false);
    setActiveFilter(name);
  };

  const toggleFavorite = (id) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, isFavorite: !card.isFavorite } : card
      )
    );
  };

  const openAccountMenu = (event) => {
    if (event && event.nativeEvent) {
      setAccountMenuPosition({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      });
    }
    setIsAccountModalVisible(true);
    requestAnimationFrame(() =>
      animateContextMenuOpen(accountMenuAnim, accountBackdropAnim)
    );
  };

  const closeAccountMenu = () => {
    animateContextMenuClose(accountMenuAnim, accountBackdropAnim, () =>
      setIsAccountModalVisible(false)
    );
  };

  const openCardMenu = (card, event) => {
    setSelectedCard(card);
    if (event && event.nativeEvent) {
      setCardMenuPosition({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      });
    }
    setIsCardMenuVisible(true);
    requestAnimationFrame(() =>
      animateContextMenuOpen(cardMenuAnim, cardBackdropAnim)
    );
  };

  const closeCardMenu = () => {
    animateContextMenuClose(cardMenuAnim, cardBackdropAnim, () =>
      setIsCardMenuVisible(false)
    );
  };

  const handleDeleteCard = () => {
    if (!selectedCard) return;
    setCards((prev) =>
      prev.filter((card) => card.id !== selectedCard.id)
    );
    setIsCardMenuVisible(false);
  };

  const handleRenameCard = () => {
    if (!selectedCard) return;
    setRenameValue(selectedCard.title);
    setIsCardMenuVisible(false);
    setIsRenameModalVisible(true);
  };

  const saveRename = () => {
    const name = renameValue.trim();
    if (!name) {
      Alert.alert("Title required");
      return;
    }
    setCards((prev) =>
      prev.map((card) =>
        card.id === selectedCard.id ? { ...card, title: name } : card
      )
    );
    setIsRenameModalVisible(false);
  };

  const openAssignFilter = () => {
    setIsCardMenuVisible(false);
    setIsAssignFilterVisible(true);
  };

  const assignFilterToCard = (filterName) => {
    if (!selectedCard) return;
    setCards((prev) =>
      prev.map((card) =>
        card.id === selectedCard.id ? { ...card, category: filterName } : card
      )
    );
    setIsAssignFilterVisible(false);
  };

  const renderItem = ({ item }) => (
    <View style={styles.column3}>
      <View style={styles.row5}>
        <Text style={styles.text5} numberOfLines={1}>
          {item.title}
        </Text>
        <TouchableOpacity
          style={styles.cardKebabButton}
          onPress={(e) => openCardMenu(item, e)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#6B6B70" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.cardContentArea}
        onPress={() => alert(`Opening ${item.title}`)}
        activeOpacity={0.7}
      >
        <View style={styles.row6}>
          <View style={styles.row7}>
            <Ionicons name="calendar-outline" size={14} color="#6B6B70" />
            <Text style={styles.text6}>{item.date}</Text>
          </View>
          <View style={styles.row8}>
            <Ionicons name="time-outline" size={14} color="#6B6B70" />
            <Text style={styles.text6}>{item.duration}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.row9}>
        <View style={styles.row10}>
          <TouchableOpacity
            style={styles.view2}
            onPress={() => toggleFavorite(item.id)}
          >
            <Ionicons 
              name={item.isFavorite ? "heart" : "heart-outline"} 
              size={18} 
              color={item.isFavorite ? "#e67e22" : "#555"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.view3}
            onPress={() => alert("Share clicked")}
          >
            <Ionicons 
              name="share-outline" 
              size={18} 
              color="#555"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.contentContainer}>
        {/* Fixed top brand header */}
            <View style={styles.brandBar}>
              <View style={styles.row}>
                <View style={styles.row2}>
                  <Image
                source={require("../assets/logo.png")}
                resizeMode={"stretch"}
                style={styles.image}
                  />
                  <View style={styles.view}>
                <Text style={styles.text}>{"Memry"}</Text>
                <Text style={styles.subtitle}>AI notes from lectures</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.button}
                  onPress={openAccountMenu}
                  activeOpacity={0.85}
                >
              <Text style={styles.text2}>{"S"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fixed controls (slightly lower) */}
        <View style={styles.fixedControls}>
          <View style={styles.headerColumn}>
            <View style={styles.row3}>
              <Ionicons name="search" size={16} color="#666" style={styles.searchIcon} />
              <TextInput
                placeholder={"Search"}
                value={textInput1}
                onChangeText={setTextInput1}
                style={styles.input}
                placeholderTextColor="#8E8E93"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
              contentContainerStyle={styles.filtersContent}
            >
              <View style={styles.row4}>
                {filters.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.buttonRow,
                      activeFilter === filter && styles.buttonRowActive,
                    ]}
                    onPress={() => setActiveFilter(filter)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={activeFilter === filter ? styles.text3 : styles.text4}
                      numberOfLines={1}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={handleAddFilter} activeOpacity={0.85}>
                  <View style={styles.addChip}>
                    <Ionicons name="add" size={18} color="#111" />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>

        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* FAB */}
      <View style={styles.fabWrapper}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.fabMenuContainer}>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => alert("Upload pressed")}
            >
              <Ionicons name="cloud-upload" size={16} color="#FFF" />
              <Text style={styles.fabMenuText}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => alert("Record pressed")}
            >
              <Ionicons name="mic" size={16} color="#FFF" />
              <Text style={styles.fabMenuText}>Record</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsFabExpanded(!isFabExpanded)}
        >
          <Ionicons
            name={isFabExpanded ? "close" : "add"}
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>

      {/* Account Settings Modal */}
      <Modal
        transparent
        animationType="none"
        visible={isAccountModalVisible}
        onRequestClose={closeAccountMenu}
      >
        <View style={styles.contextMenuRoot}>
          <Animated.View
            style={[styles.contextMenuBackdrop, { opacity: accountBackdropAnim }]}
          />
          <Pressable style={styles.contextMenuPressable} onPress={closeAccountMenu} />
          <Animated.View
            style={[
              styles.contextMenu,
              {
                top: accountMenuPosition.y + 5,
                right: 20,
                opacity: accountMenuAnim,
                transform: [
                  {
                    scale: accountMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.75, 1],
                    }),
                  },
                  {
                    translateY: accountMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Pressable
              style={styles.contextMenuItem}
              onPress={() => {
                Alert.alert("Profile");
                closeAccountMenu();
              }}
            >
              <Text style={styles.contextMenuItemText}>Profile</Text>
            </Pressable>
            <Pressable
              style={styles.contextMenuItem}
              onPress={() => {
                Alert.alert("Notifications");
                closeAccountMenu();
              }}
            >
              <Text style={styles.contextMenuItemText}>Notifications</Text>
            </Pressable>
            <Pressable
              style={[styles.contextMenuItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                Alert.alert("Logged out");
                closeAccountMenu();
              }}
            >
              <Text style={styles.contextMenuItemText}>Logout</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Add Filter Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsFilterModalVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>New Filter</Text>
              <TextInput
                placeholder="Filter name"
                placeholderTextColor="#888"
                value={newFilterName}
                onChangeText={setNewFilterName}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalButton}
                  onPress={() =>
                    setIsFilterModalVisible(false)
                  }
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButton}
                  onPress={saveNewFilter}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Card Menu Modal */}
      <Modal
        transparent
        animationType="none"
        visible={isCardMenuVisible}
        onRequestClose={closeCardMenu}
      >
        <View style={styles.contextMenuRoot}>
          <Animated.View
            style={[styles.contextMenuBackdrop, { opacity: cardBackdropAnim }]}
          />
          <Pressable style={styles.contextMenuPressable} onPress={closeCardMenu} />
          <Animated.View
            style={[
              styles.contextMenu,
              {
                top: cardMenuPosition.y + 5,
                right: 20,
                opacity: cardMenuAnim,
                transform: [
                  {
                    scale: cardMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.75, 1],
                    }),
                  },
                  {
                    translateY: cardMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Pressable style={styles.contextMenuItem} onPress={handleRenameCard}>
              <Text style={styles.contextMenuItemText}>Rename</Text>
            </Pressable>
            <Pressable style={styles.contextMenuItem} onPress={openAssignFilter}>
              <Text style={styles.contextMenuItemText}>Assign Filter</Text>
            </Pressable>
            <Pressable
              style={[styles.contextMenuItem, { borderBottomWidth: 0 }]}
              onPress={handleDeleteCard}
            >
              <Text style={[styles.contextMenuItemText, { color: "#D00" }]}>
                Delete
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isRenameModalVisible}
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsRenameModalVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Rename</Text>
              <TextInput
                placeholder="New title"
                placeholderTextColor="#888"
                value={renameValue}
                onChangeText={setRenameValue}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalButton}
                  onPress={() =>
                    setIsRenameModalVisible(false)
                  }
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButton}
                  onPress={saveRename}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Assign Filter Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isAssignFilterVisible}
        onRequestClose={() => setIsAssignFilterVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsAssignFilterVisible(false)}
        >
          <View style={styles.modalContent} pointerEvents="box-none">
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Assign Filter</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {filters
                  .filter((f) => f !== "All" && f !== "Favorites")
                  .map((filter) => (
                    <Pressable
                      key={filter}
                      style={styles.modalButton}
                      onPress={() =>
                        assignFilterToCard(filter)
                      }
                    >
                      <Text style={styles.modalButtonText}>
                        {filter}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
              <Pressable
                style={styles.modalButton}
                onPress={() =>
                  setIsAssignFilterVisible(false)
                }
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentContainer: {
    flex: 1,
  },
  brandBar: {
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
    paddingBottom: 2,
    paddingHorizontal: 16,
  },
  fixedControls: {
    backgroundColor: "#FFFFFF",
    paddingTop: 6,
    paddingBottom: 8,
  },
  button: {
    height: 36,
    width: 36,
    backgroundColor: "#212121",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: {
    flexDirection: "row",
    backgroundColor: "#F2F3F5",
    borderColor: "#E7E8EB",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: "center",
  },
  buttonRowActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  addChip: {
    height: 34,
    width: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E8EB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerColumn: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 6,
  },
  column3: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EAEAEA",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#D9D9D9",
    shadowOpacity: 0.3,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  image2: {
    width: 16,
    height: 16,
    marginLeft: 16,
    marginRight: 8,
    tintColor: "#666",
  },
  image3: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  image4: {
    width: 32,
    height: 32,
  },
  image5: {
    borderRadius: 10,
    width: 24,
    height: 24,
  },
  image6: {
    width: 12,
    height: 12,
    marginRight: 4,
    tintColor: "#868686",
  },
  image7: {
    width: 14,
    height: 14,
    tintColor: "#555",
  },
  image8: {
    width: 46,
    height: 32,
    resizeMode: "contain",
  },
  input: {
    color: "#000000",
    fontSize: 14,
    marginRight: 4,
    flex: 1,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 15,
    marginBottom: 6,
  },
  row2: {
    flexDirection: "row",
    alignItems: "center",
  },
  row3: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    marginBottom: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  row4: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filtersContent: {
    paddingRight: 10,
  },
  row5: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardKebabButton: {
    paddingLeft: 10,
    paddingVertical: 2,
  },
  row6: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "center",
  },
  row7: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    gap: 6,
  },
  row8: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  row9: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row10: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    color: "#000000",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "System",
  },
  subtitle: {
    marginTop: -2,
    color: "#6B6B70",
    fontSize: 11,
    fontWeight: "500",
  },
  text2: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  text3: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  text4: {
    color: "#2C2C2E",
    fontSize: 13,
    fontWeight: "700",
  },
  text5: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  text6: {
    color: "#868686",
    fontSize: 12,
    fontWeight: "500",
  },
  view: {
    justifyContent: "center",
  },
  searchIcon: {
    marginRight: 8,
  },
  view2: {
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  view3: {
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 8,
  },
  cardContentArea: {
    flex: 1,
  },
  fabWrapper: {
    position: "absolute",
    bottom: 30,
    right: 30,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 8,
  },
  fabMenuContainer: {
    position: "absolute",
    bottom: -40,
    right: -30,
    alignItems: "flex-end",
    gap: 10,
  },
  fabMenuItem: {
    backgroundColor: "#212121",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  fabMenuText: { color: "#FFF", fontWeight: "600" },
  contextMenuRoot: {
    flex: 1,
  },
  contextMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  contextMenuPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  contextMenu: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 12,
    minWidth: 150,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
  },
  contextMenuItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  contextMenuItemText: {
    color: "#1C1C1E",
    fontWeight: "500",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: { width: "100%" },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#000",
  },
  modalInput: {
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#000",
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end" },
  modalButton: { paddingVertical: 10, paddingHorizontal: 9 },
  modalButtonText: {
    color: "#1C1C1E",
    fontWeight: "600",
    fontSize: 14,
  },
  favoriteTint: { tintColor: "#e67e22" },
});
