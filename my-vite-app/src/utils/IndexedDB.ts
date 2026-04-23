// 数据库配置
const DB_NAME = 'TravelAppDB';
const DB_VERSION = 3;
const STORE_NAME = 'spotReviews';
const USER_STORE_NAME = 'users'; // 用户存储对象
const ITINERARY_STORE_NAME = 'itineraries'; // 行程存储
const ATTRACTION_STORE_NAME = 'attractions'; // 景点存储
const PHOTO_STORE_NAME = 'photos'; // 照片存储
const NOTE_STORE_NAME = 'notes'; // 笔记存储

// 用户数据结构
export interface UserInfo {
  username: string;
  password: string;
  createTime: number;
  isGuest?: boolean;
}

// 评价数据结构
export interface SpotReview {
  spotId: string;
  spotName: string;
  rating: number;
  reviewText: string;
  createdAt: number;
}

// 行程数据结构
export interface Itinerary {
  id: number;
  userId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt?: number;
}

// 景点数据结构
export interface Attraction {
  id: number;
  userId: string;
  itineraryId: number;
  name: string;
  description: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  visited: boolean;
  createdAt: Date;
}

// 照片数据结构
export interface Photo {
  id: number;
  userId: string;
  attractionId: number;
  title: string;
  description: string;
  url: string;
  createdAt?: number;
}

// 笔记数据结构
export interface Note {
  id: number;
  userId: string;
  itineraryId: number;
  title: string;
  content: string;
  createdAt: Date;
}

// IndexDB 工具类
class IndexedDBHelper {
  private db: IDBDatabase | null = null;

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // 景点评价存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'spotId' });
          store.createIndex('spotName', 'spotName', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        // 用户存储
        if (!db.objectStoreNames.contains(USER_STORE_NAME)) {
          const userStore = db.createObjectStore(USER_STORE_NAME, { keyPath: 'username' });
          userStore.createIndex('createTime', 'createTime', { unique: false });
        }
        // 行程存储 - 按用户隔离
        if (!db.objectStoreNames.contains(ITINERARY_STORE_NAME)) {
          const itineraryStore = db.createObjectStore(ITINERARY_STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          itineraryStore.createIndex('userId', 'userId', { unique: false });
          itineraryStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        // 景点存储 - 按用户隔离
        if (!db.objectStoreNames.contains(ATTRACTION_STORE_NAME)) {
          const attractionStore = db.createObjectStore(ATTRACTION_STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          attractionStore.createIndex('userId', 'userId', { unique: false });
          attractionStore.createIndex('itineraryId', 'itineraryId', { unique: false });
        }
        
        // 照片存储 - 按用户隔离
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          const photoStore = db.createObjectStore(PHOTO_STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          photoStore.createIndex('userId', 'userId', { unique: false });
          photoStore.createIndex('attractionId', 'attractionId', { unique: false });
        }
       // 笔记存储 - 按用户隔离
        if (!db.objectStoreNames.contains(NOTE_STORE_NAME)) {
          const noteStore = db.createObjectStore(NOTE_STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          noteStore.createIndex('userId', 'userId', { unique: false });
          noteStore.createIndex('itineraryId', 'itineraryId', { unique: false });
        }
      };
    });
  }

  // ==================== 用户相关操作 ====================

  // 注册用户
  async registerUser(user: UserInfo): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([USER_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(USER_STORE_NAME);
      const request = store.add(user);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('The username already exists'));
    });
  }

  // 获取用户信息
  async getUser(username: string): Promise<UserInfo | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([USER_STORE_NAME], 'readonly');
      const store = transaction.objectStore(USER_STORE_NAME);
      const request = store.get(username);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 验证用户登录
  async validateUser(username: string, password: string): Promise<UserInfo> {
    const user = await this.getUser(username);
    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.password !== password) {
      throw new Error('密码错误');
    }
    return user;
  }

  // 检查用户名是否存在
  async usernameExists(username: string): Promise<boolean> {
    const user = await this.getUser(username);
    return !!user;
  }

  // 获取当前登录用户
  getCurrentUser(): UserInfo | null {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // 获取当前用户 ID
  getCurrentUserId(): string {
    const user = this.getCurrentUser();
    return user?.username || 'guest';
  }

  // ==================== 行程相关操作 ====================

  // 创建行程
  async createItinerary(itinerary: Omit<Itinerary, 'id'>): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITINERARY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ITINERARY_STORE_NAME);
      const request = store.add({ ...itinerary, createdAt: Date.now() });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  // 更新行程
  async updateItinerary(itinerary: Itinerary): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITINERARY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ITINERARY_STORE_NAME);
      const request = store.put(itinerary);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取用户的所有行程
  async getUserItineraries(userId: string): Promise<Itinerary[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITINERARY_STORE_NAME], 'readonly');
      const store = transaction.objectStore(ITINERARY_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取单个行程
  async getItinerary(id: number): Promise<Itinerary | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITINERARY_STORE_NAME], 'readonly');
      const store = transaction.objectStore(ITINERARY_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除行程
  async deleteItinerary(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITINERARY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ITINERARY_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 景点相关操作 ====================

  // 创建景点
  async createAttraction(attraction: Omit<Attraction, 'id'>): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ATTRACTION_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ATTRACTION_STORE_NAME);
      const request = store.add(attraction);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  // 更新景点
  async updateAttraction(attraction: Attraction): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ATTRACTION_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ATTRACTION_STORE_NAME);
      const request = store.put(attraction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取用户的景点
  async getUserAttractions(userId: string): Promise<Attraction[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ATTRACTION_STORE_NAME], 'readonly');
      const store = transaction.objectStore(ATTRACTION_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取行程的景点
  async getAttractionsByItinerary(itineraryId: number): Promise<Attraction[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ATTRACTION_STORE_NAME], 'readonly');
      const store = transaction.objectStore(ATTRACTION_STORE_NAME);
      const index = store.index('itineraryId');
      const request = index.getAll(itineraryId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除景点
  async deleteAttraction(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ATTRACTION_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ATTRACTION_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 照片相关操作 ====================

  // 创建照片
  async createPhoto(photo: Omit<Photo, 'id'>): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const request = store.add({ ...photo, createdAt: Date.now() });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取用户的照片
  async getUserPhotos(userId: string): Promise<Photo[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取景点的照片
  async getPhotosByAttraction(attractionId: number): Promise<Photo[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const index = store.index('attractionId');
      const request = index.getAll(attractionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除照片
  async deletePhoto(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PHOTO_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 笔记相关操作 ====================

  // 创建笔记
  async createNote(note: Omit<Note, 'id'>): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([NOTE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const request = store.add({ ...note, createdAt: new Date() });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  // 更新笔记
  async updateNote(note: Note): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([NOTE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取用户的笔记
  async getUserNotes(userId: string): Promise<Note[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([NOTE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取行程的笔记
  async getNotesByItinerary(itineraryId: number): Promise<Note[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([NOTE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const index = store.index('itineraryId');
      const request = index.getAll(itineraryId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除笔记
  async deleteNote(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([NOTE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 删除行程及关联数据
  async deleteItineraryWithRelations(itineraryId: number): Promise<void> {
    if (!this.db) await this.init();
    
    // 先获取该行程的所有景点
    const attractions = await this.getAttractionsByItinerary(itineraryId);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [ITINERARY_STORE_NAME, ATTRACTION_STORE_NAME, PHOTO_STORE_NAME, NOTE_STORE_NAME], 
        'readwrite'
      );
      
      // 删除行程
      const itineraryStore = transaction.objectStore(ITINERARY_STORE_NAME);
      itineraryStore.delete(itineraryId);
      
      // 删除关联景点
      const attractionStore = transaction.objectStore(ATTRACTION_STORE_NAME);
      attractions.forEach(attr => attractionStore.delete(attr.id));
      
      // 删除景点关联的照片
      const photoStore = transaction.objectStore(PHOTO_STORE_NAME);
      attractions.forEach(attr => {
        const photoIndex = photoStore.index('attractionId');
        photoIndex.getAll(attr.id).onsuccess = (e) => {
          const photos = (e.target as IDBRequest<Photo[]>).result;
          photos.forEach(photo => photoStore.delete(photo.id));
        };
      });
      
      // 删除行程关联的笔记
      const noteStore = transaction.objectStore(NOTE_STORE_NAME);
      const noteIndex = noteStore.index('itineraryId');
      noteIndex.getAll(itineraryId).onsuccess = (e) => {
        const notes = (e.target as IDBRequest<Note[]>).result;
        notes.forEach(note => noteStore.delete(note.id));
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ==================== 景点评价相关操作 ====================
  // 保存评价
  async saveReview(review: SpotReview): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(review);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取评价
  async getReview(spotId: string): Promise<SpotReview | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(spotId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取所有评价
  async getAllReviews(): Promise<SpotReview[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除评价
  async deleteReview(spotId: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(spotId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBHelper = new IndexedDBHelper();