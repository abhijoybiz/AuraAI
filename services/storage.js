import AsyncStorage from '@react-native-async-storage/async-storage';

const LECTURES_KEY = 'aura_ai_lectures';
const FILTERS_KEY = 'aura_ai_filters';

export const storage = {
    async getLectures() {
        try {
            const jsonValue = await AsyncStorage.getItem(LECTURES_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Error fetching lectures', e);
            return [];
        }
    },

    async saveLectures(lectures) {
        try {
            const jsonValue = JSON.stringify(lectures);
            await AsyncStorage.setItem(LECTURES_KEY, jsonValue);
        } catch (e) {
            console.error('Error saving lectures', e);
        }
    },

    async addLecture(lecture) {
        const lectures = await this.getLectures();
        const newLectures = [lecture, ...lectures];
        await this.saveLectures(newLectures);
        return newLectures;
    },

    async updateLecture(id, updates) {
        const lectures = await this.getLectures();
        const updatedLectures = lectures.map(l => l.id === id ? { ...l, ...updates } : l);
        await this.saveLectures(updatedLectures);
        return updatedLectures;
    },

    async deleteLecture(id) {
        const lectures = await this.getLectures();
        const filteredLectures = lectures.filter(l => l.id !== id);
        await this.saveLectures(filteredLectures);
        return filteredLectures;
    },

    async getFilters() {
        try {
            const jsonValue = await AsyncStorage.getItem(FILTERS_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : ["All", "Favorites"];
        } catch (e) {
            console.error('Error fetching filters', e);
            return ["All", "Favorites"];
        }
    },

    async saveFilters(filters) {
        try {
            const jsonValue = JSON.stringify(filters);
            await AsyncStorage.setItem(FILTERS_KEY, jsonValue);
        } catch (e) {
            console.error('Error saving filters', e);
        }
    }
};
