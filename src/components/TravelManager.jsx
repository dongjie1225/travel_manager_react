import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { indexedDBHelper } from '../utils/indexedDB';
import '../compCSS/TravelManager.css';

const TravelManager = () => {
  const navigate = useNavigate();
  
  // States
  const [currentUser, setCurrentUser] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  
  // UI States
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showAttractionModal, setShowAttractionModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPhotoGalleryModal, setShowPhotoGalleryModal] = useState(false);
  
  // Form States
  const [newItinerary, setNewItinerary] = useState({ title: "", destination: "", startDate: "", endDate: "", notes: "" });
  const [editingItinerary, setEditingItinerary] = useState(null);
  
  const [newAttraction, setNewAttraction] = useState({ name: "", description: "", location: "" });
  const [editingAttraction, setEditingAttraction] = useState(null);
  
  const [newNote, setNewNote] = useState({ title: "", content: "" });
  const [editingNote, setEditingNote] = useState(null);
  
  const [newPhoto, setNewPhoto] = useState({ title: "", description: "", url: "" });
  const [photoInputType, setPhotoInputType] = useState("upload");
  const [currentAttractionId, setCurrentAttractionId] = useState(null);
  
  // Pagination & Filter
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const itemsPerPage = 5;

  // Camera Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentStream, setCurrentStream] = useState(null);
  
  // Gallery State
  const [currentAttractionPhotos, setCurrentAttractionPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Location
  const [currentPosition, setCurrentPosition] = useState({ lat: 0, lng: 0 });
  const [storageInfo, setStorageInfo] = useState({ usedMB: "0.00", remainingMB: "5.00" });

  // --- Effects ---

  useEffect(() => {
    const init = async () => {
      await indexedDBHelper.init();
      checkUserLogin();
    };
    init();
    
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Reload data when user changes or component mounts
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Watch photo input type for camera
  useEffect(() => {
    if (photoInputType === 'camera' && showPhotoModal) {
      initCamera();
    } else {
      // 如果切换回 upload，暂停/清理摄像头以节省资源
      if (photoInputType !== 'camera') {
         cleanupCamera();
      }
    }
    // 依赖项包含 showPhotoModal 以确保只在模态框打开且选中 camera 时初始化
  }, [photoInputType, showPhotoModal]);

   useEffect(() => {
    if (!showPhotoModal) {
      cleanupCamera();
      setCapturedImage(null);
      setNewPhoto({ title: "", description: "", url: "" });
    }
  }, [showPhotoModal]);

  // --- Helpers ---

  const checkUserLogin = () => {
    const user = indexedDBHelper.getCurrentUser(); // Assuming helper has this sync method or use localStorage
    // Fallback to localStorage if helper doesn't have sync getter
    const storedUser = localStorage.getItem('currentUser');
    const finalUser = user || (storedUser ? JSON.parse(storedUser) : null);

    if (!finalUser) {
      alert("Please login first");
      navigate("/");
      return false;
    }
    setCurrentUser(finalUser);
    return true;
  };

  const loadData = async () => {
    if (!currentUser) return;
    try {
      const userId = currentUser.username;
      const [itins, attrs, pics, nts] = await Promise.all([
        indexedDBHelper.getUserItineraries(userId),
        indexedDBHelper.getUserAttractions(userId),
        indexedDBHelper.getUserPhotos(userId),
        indexedDBHelper.getUserNotes(userId)
      ]);
      setItineraries(itins);
      setAttractions(attrs);
      setPhotos(pics);
      setNotes(nts);
    } catch (err) {
      console.error("Load failed", err);
    }
  };

  const updateLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentPosition(coords);
        // 只要模态框是打开的，就更新位置信息，不管 name 是否有值
        if (showAttractionModal) {
           setNewAttraction(prev => ({
             ...prev,
             location: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
           }));
        }
      },
      (err) => {
        console.error("Loc error", err);
        let message = "Unable to retrieve your location";
        if (err.code === 1) {
          message = "Location permission denied. Please enable it in your browser settings.";
        } else if (err.code === 2) {
          message = "Location information is unavailable.";
        } else if (err.code === 3) {
          message = "The request to get user location timed out.";
        }
        alert(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  const checkLocalStorageSpace = () => {
    // Simplified check
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) total += localStorage[key].length * 2;
    }
    const used = (total / 1024 / 1024).toFixed(2);
    return { usedMB: used, remainingMB: (5 - parseFloat(used)).toFixed(2) };
  };

  const compressPhoto = (dataUrl, maxWidth = 1280, maxHeight = 960, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 计算缩放比例
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
             reject(new Error("Canvas context failed"));
             return;
          }
          
          // 白色背景填充（防止透明 PNG 转 JPEG 变黑）
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        reject(new Error("Image load failed"));
      };
    });
  };

  // --- Camera Logic ---

  const initCamera = async () => {
    // 如果已经有流在运行，不要重复初始化，除非强制重置
    if (currentStream && isVideoReady) {
      return;
    }

    try {
      setIsVideoReady(false);
      setCapturedImage(null); // 清除旧照片，准备新拍摄
      
      // 清理旧流
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        setCurrentStream(null);
      }

      // 请求媒体权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", // 优先使用后置摄像头
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      setCurrentStream(stream);
      
      // 等待 DOM 更新并将流绑定到 video 元素
      // 使用 setTimeout 确保 videoRef 已经挂载且可用
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // 监听元数据加载完成
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              setIsVideoReady(true);
            })
            .catch(err => {
              console.error("Video play failed", err);
              alert("Failed to start video preview.");
            });
        };
      } else {
        // 如果 ref 还没准备好，稍微延迟再试（React 严格模式下常见）
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().then(() => setIsVideoReady(true));
            };
          }
        }, 100);
      }

    } catch (err) {
      console.error("Camera error", err);
      let msg = "Camera access denied or not available.";
      if (err.name === 'NotAllowedError') {
        msg = "Permission denied. Please allow camera access.";
      } else if (err.name === 'NotFoundError') {
        msg = "No camera found on this device.";
      }
      alert(msg);
      setIsVideoReady(false);
      cleanupCamera(); // 确保状态干净
  }
};

  const cleanupCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      setCurrentStream(null);
    }
    setIsVideoReady(false);
  };

  const capturePhoto = async () => {
    if (!isVideoReady || !videoRef.current) {
      alert("Camera is not ready. Please wait or check permissions.");
      return;
    }

    const video = videoRef.current;
    
    // 再次检查视频尺寸
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Video stream not fully initialized.");
      return;
    }

    setIsCapturing(true);
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas ref missing");
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could get canvas context");
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // 绘制白色背景防止透明问题
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const originalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const compressed = await compressPhoto(originalDataUrl);
      
      setCapturedImage(compressed);
      setNewPhoto(prev => ({ ...prev, url: compressed }));
      
      // 拍照成功后停止视频流以节省电量，但保留图片预览
      cleanupCamera(); 
      
    } catch (err) {
      console.error("Capture failed", err);
      alert("Failed to capture photo.");
    } finally {
      setIsCapturing(false);
    }
  };

  // --- Handlers ---

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressPhoto(ev.target.result);
      setNewPhoto(prev => ({ ...prev, url: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const saveItinerary = async () => {
    if (!newItinerary.title || !newItinerary.destination) return;
    try {
      if (editingItinerary) {
        await indexedDBHelper.updateItinerary({ ...newItinerary, id: editingItinerary.id, userId: currentUser.username });
        setItineraries(prev => prev.map(i => i.id === editingItinerary.id ? { ...newItinerary, id: editingItinerary.id, userId: currentUser.username } : i));
      } else {
        const id = await indexedDBHelper.createItinerary({ ...newItinerary, userId: currentUser.username });
        setItineraries(prev => [...prev, { id, ...newItinerary, userId: currentUser.username }]);
      }
      closeItineraryModal();
    } catch (err) {
      alert("Save failed");
    }
  };

  const deleteItinerary = async (id) => {
    if (!window.confirm("Delete this itinerary?")) return;
    try {
      await indexedDBHelper.deleteItineraryWithRelations(id);
      setItineraries(prev => prev.filter(i => i.id !== id));
      setAttractions(prev => prev.filter(a => a.itineraryId !== id));
      // Also filter photos and notes related to this itinerary's attractions
    } catch (err) {
      alert("Delete failed");
    }
  };

  const saveAttraction = async () => {
    if (!newAttraction.name || !showDetailModal) return; 
  };
  
  const [currentItinerary, setCurrentItinerary] = useState(null);

  const viewItineraryDetails = (itinerary) => {
    setCurrentItinerary(itinerary);
    setShowDetailModal(true);
  };

  const saveAttractionComplete = async () => {
     if (!newAttraction.name || !currentItinerary) return;
     try {
       if (editingAttraction) {
          await indexedDBHelper.updateAttraction({ ...editingAttraction, ...newAttraction });
          setAttractions(prev => prev.map(a => a.id === editingAttraction.id ? { ...a, ...newAttraction } : a));
       } else {
          const id = await indexedDBHelper.createAttraction({
            ...newAttraction,
            itineraryId: currentItinerary.id,
            userId: currentUser.username,
            coordinates: currentPosition,
            visited: false,
            createdAt: new Date()
          });
          setAttractions(prev => [...prev, { id, ...newAttraction, itineraryId: currentItinerary.id, userId: currentUser.username, coordinates: currentPosition, visited: false, createdAt: new Date() }]);
       }
       setShowAttractionModal(false);
       setEditingAttraction(null);
       setNewAttraction({ name: "", description: "", location: "" });
     } catch (e) { alert("Save failed"); }
  };

    const toggleAttractionVisited = async (attraction) => {
    try {
      // 1. 优化乐观更新 UI (Optimistic UI Update)
      const newVisitedStatus = !attraction.visited;
      
      // 更新本地 State，让用户立即看到变化
      setAttractions(prev => prev.map(a => 
        a.id === attraction.id ? { ...a, visited: newVisitedStatus } : a
      ));

      // 2. 同步更新数据库
      await indexedDBHelper.updateAttraction({
        ...attraction,
        visited: newVisitedStatus
      });
      
    } catch (err) {
      console.error("Failed to update attraction status", err);
      alert("更新状态失败，请重试");
      // 如果失败，可以重新加载数据以恢复一致状态
      loadData(); 
    }
  };

  const saveNoteComplete = async () => {
    if (!newNote.title || !currentItinerary) {
      alert("Please enter a title and ensure an itinerary is selected.");
      return;
    }
    
    try {
      let savedNote;
      
      if (editingNote) {
        // 更新现有笔记
        const updatedNote = { ...editingNote, ...newNote };
        await indexedDBHelper.updateNote(updatedNote);
        
        // 乐观更新 UI
        setNotes(prev => prev.map(n => n.id === editingNote.id ? updatedNote : n));
      } else {
        // 创建新笔记
        const noteData = {
          ...newNote,
          itineraryId: currentItinerary.id,
          userId: currentUser.username,
          createdAt: new Date()
        };
        
        // 假设 createNote 返回新创建的 ID
        const id = await indexedDBHelper.createNote(noteData);
        
        savedNote = { 
          id, 
          ...noteData 
        };
        
        // 乐观更新 UI
        setNotes(prev => [...prev, savedNote]);
      }
      
      // 关闭模态框并重置表单
      setShowNoteModal(false);
      setEditingNote(null);
      setNewNote({ title: "", content: "" });
      
    } catch (e) {
      console.error("Save note error:", e);
      alert("Save failed: " + (e.message || "Unknown error"));
    }
  };

  const addPhotoComplete = async () => {
    if (!currentAttractionId) {
      alert("Error: No attraction selected.");
      return;
    }
    
    if (!newPhoto.url) {
      alert("Please take a photo or upload an image first.");
      return;
    }

    try {
      const id = await indexedDBHelper.createPhoto({
        ...newPhoto,
        attractionId: currentAttractionId,
        userId: currentUser.username,
        createdAt: new Date()
      });
      
      const newPhotoObj = { id, ...newPhoto, attractionId: currentAttractionId, userId: currentUser.username, createdAt: new Date() };
      
      setPhotos(prev => [...prev, newPhotoObj]);
      
      // 如果画廊正开着，实时更新画廊列表
      if (showPhotoGalleryModal && currentAttractionId) {
         setCurrentAttractionPhotos(prev => [...prev, newPhotoObj]);
      }

      setShowPhotoModal(false);
      setNewPhoto({ title: "", description: "", url: "" });
      setCapturedImage(null);
      cleanupCamera();
      
      // alert("Photo added successfully!"); 
    } catch (e) {
      console.error("Add photo error", e);
      alert("Add photo failed: " + (e.message || "Unknown error"));
    }
  };

  const deletePhoto = async (photoId, attractionId) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;

    try {
      // 1. 从 IndexedDB 删除
      await indexedDBHelper.deletePhoto(photoId);

      // 2. 更新全局 Photos State
      setPhotos(prev => prev.filter(p => p.id !== photoId));

      // 3. 更新画廊显示的列表 State
      setCurrentAttractionPhotos(prev => {
        const newList = prev.filter(p => p.id !== photoId);
        
        // 如果删完了，关闭画廊
        if (newList.length === 0) {
          setShowPhotoGalleryModal(false);
          alert("All photos for this attraction have been deleted.");
          return [];
        }

        // 调整当前索引，防止越界
        // 如果删除的是当前看的这张，且不是最后一张，索引不变（下一张顶上来）
        // 如果是最后一张，索引减 1
        if (currentPhotoIndex >= newList.length) {
           setCurrentPhotoIndex(newList.length - 1);
        }
        
        return newList;
      });

    } catch (err) {
      console.error("Delete photo failed", err);
      alert("Failed to delete photo.");
    }
  };

  const currentAttractionPhotosList = useMemo(() => {
    if (!currentAttractionId) return [];
    return photos.filter(p => p.attractionId === currentAttractionId);
  }, [photos, currentAttractionId]);

  // --- 新增：打开照片画廊 ---
  const openPhotoGallery = (attractionId) => {
    setCurrentAttractionId(attractionId);
    // 重新计算该景点的照片
    const pics = photos.filter(p => p.attractionId === attractionId);
    if (pics.length === 0) {
      alert("No photos for this attraction yet.");
      return;
    }
    setCurrentAttractionPhotos(pics);
    setCurrentPhotoIndex(0);
    setShowPhotoGalleryModal(true);
  };

  // --- Computed Data ---

  const filteredItineraries = useMemo(() => {
    let res = itineraries;
    if (searchTerm) {
      res = res.filter(i => i.destination.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (statusFilter) {
      const today = new Date();
      if (statusFilter === 'upcoming') res = res.filter(i => new Date(i.startDate) > today);
      else if (statusFilter === 'ongoing') res = res.filter(i => new Date(i.startDate) <= today && new Date(i.endDate) >= today);
      else if (statusFilter === 'completed') res = res.filter(i => new Date(i.endDate) < today);
    }
    return res;
  }, [itineraries, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredItineraries.length / itemsPerPage) || 1;
  const paginatedItineraries = filteredItineraries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const attractionsByCurrentItinerary = useMemo(() => {
    if (!currentItinerary) return [];
    return attractions.filter(a => a.itineraryId === currentItinerary.id);
  }, [attractions, currentItinerary]);

  const notesByCurrentItinerary = useMemo(() => {
    if (!currentItinerary) return [];
    return notes.filter(n => n.itineraryId === currentItinerary.id);
  }, [notes, currentItinerary]);

  const currentPhoto = currentAttractionPhotos[currentPhotoIndex];

  // --- Render Helpers ---
  
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString();
  };

  const handleKeydown = (e) => {
    if (!showPhotoGalleryModal) return;
    if (e.key === 'ArrowLeft') setCurrentPhotoIndex(prev => Math.max(0, prev - 1));
    if (e.key === 'ArrowRight') setCurrentPhotoIndex(prev => Math.min(currentAttractionPhotos.length - 1, prev + 1));
    if (e.key === 'Escape') setShowPhotoGalleryModal(false);
  };

  const logout = () => {
    if (window.confirm("Logout?")) {
      localStorage.removeItem('currentUser');
      navigate('/');
    }
  };

  return (
    <div className="tour-management">
      <header className="main-header">
        <div>
          <h1>Travel Planner</h1>
          <p>Record every beautiful moment</p>
        </div>
        {currentUser && (
          <div className="user-info">
            <span className="username">👤 {currentUser.username}</span>
            <button onClick={logout} className="btn btn-logout">Log out</button>
          </div>
        )}
      </header>

      {/* Stats */}
      <div className="floating-stats">
        <div className="stats-container">
          <div className="stat-card"><div className="stat-number">{itineraries.length}</div><div className="stat-label">Total Itineraries</div></div>
          <div className="stat-card"><div className="stat-number">{attractions.length}</div><div className="stat-label">Attractions</div></div>
          <div className="stat-card"><div className="stat-number">{photos.length}</div><div className="stat-label">Photos</div></div>
          <div className="stat-card"><div className="stat-number">{notes.length}</div><div className="stat-label">Travel Notes</div></div>
        </div>
      </div>

      <main className="main-content">
        <div className="search-filters">
          <div className="filter-section">
            <input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Search destinations..." 
              className="input-field search-input" 
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field filter-select">
              <option value="">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="controls">
            <button onClick={() => { setEditingItinerary(null); setNewItinerary({title:"", destination:"", startDate:"", endDate:"", notes:""}); setShowItineraryModal(true); }} className="btn btn-primary">
              + Create New Itinerary
            </button>
          </div>
        </div>

        <div className="itinerary-list">
          {paginatedItineraries.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No matching itineraries found</p></div>
          ) : (
            paginatedItineraries.map(itinerary => (
              <div key={itinerary.id} className="itinerary-row" onClick={() => viewItineraryDetails(itinerary)}>
                <div className="row-content">
                  <div className="itinerary-title">{itinerary.title}</div>
                  <div className="itinerary-date">{formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}</div>
                  <div className="itinerary-location">{itinerary.destination}</div>
                  <div className={`itinerary-status ${new Date() < new Date(itinerary.startDate) ? 'upcoming' : new Date() > new Date(itinerary.endDate) ? 'completed' : 'ongoing'}`}>
                    {new Date() < new Date(itinerary.startDate) ? 'Not yet departed' : new Date() > new Date(itinerary.endDate) ? 'Completed' : 'In progress'}
                  </div>
                  <div className="itinerary-actions" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingItinerary(itinerary); setNewItinerary(itinerary); setShowItineraryModal(true); }} className="btn btn-icon">✏️</button>
                    <button onClick={() => deleteItinerary(itinerary.id)} className="btn btn-icon">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pagination">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-pagination">‹ Previous</button>
          <span className="page-info">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-pagination">Next ›</button>
        </div>
      </main>

      {/* Modals (Simplified for brevity, structure matches Vue) */}
      
      {/* Itinerary Modal */}
      {showItineraryModal && (
        <div className="modal-overlay" onClick={() => setShowItineraryModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingItinerary ? "Edit" : "Create"} Itinerary</h3><button className="close-btn" onClick={() => setShowItineraryModal(false)}>×</button></div>
            <div className="form-section">
              <input className="input-field" placeholder="Title" value={newItinerary.title} onChange={e => setNewItinerary({...newItinerary, title: e.target.value})} />
              <input className="input-field" placeholder="Destination" value={newItinerary.destination} onChange={e => setNewItinerary({...newItinerary, destination: e.target.value})} />
              <div className="date-group">
                <input type="date" className="input-field" value={newItinerary.startDate} onChange={e => setNewItinerary({...newItinerary, startDate: e.target.value})} />
                <input type="date" className="input-field" value={newItinerary.endDate} onChange={e => setNewItinerary({...newItinerary, endDate: e.target.value})} />
              </div>
              <textarea className="input-field" placeholder="Notes" value={newItinerary.notes} onChange={e => setNewItinerary({...newItinerary, notes: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button onClick={saveItinerary} className="btn btn-primary">Save</button>
              <button onClick={() => setShowItineraryModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && currentItinerary && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <h3>{currentItinerary.title}</h3>
                <p>{currentItinerary.destination}</p>
              </div>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>
            
            <div className="sub-form">
              <button onClick={() => { setEditingAttraction(null); setNewAttraction({name:"", description:"", location:""}); setShowAttractionModal(true); }} className="btn btn-secondary">📍 Add Attraction</button>
              <button onClick={() => { setEditingNote(null); setNewNote({title:"", content:""}); setShowNoteModal(true); }} className="btn btn-secondary">📝 Add Note</button>
            </div>

            <div className="attractions-list">
              <h4>Attractions</h4>
              <table className="attraction-table">
                <thead><tr><th>Name</th><th>Location</th><th>Status</th><th>Photos</th><th>Actions</th></tr></thead>
                <tbody>
                  {attractionsByCurrentItinerary.map(attr => (
                    <tr key={attr.id}>
                      <td>{attr.name}</td>
                      <td>{attr.location}</td>
                      <td><span className={`status-tag ${attr.visited ? 'visited' : 'not-visited'}`} onClick={() => toggleAttractionVisited(attr)} style={{ cursor: 'pointer' }}>{attr.visited ? "Visited" : "Not visited"}</span></td>
                      <td>
                        {/* 使用 flex 布局使按钮横向排列 */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {/* 修改这里：点击相机图标打开画廊，而不是添加照片 */}
                          <button onClick={() => openPhotoGallery(attr.id)} className="btn btn-icon" title="View Photos">📷</button>
                          {/* 保留一个添加照片的入口，或者在画廊里添加 */}
                          <button onClick={() => { setCurrentAttractionId(attr.id); setShowPhotoModal(true); }} className="btn btn-icon" title="Add Photo">➕</button>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => { setEditingAttraction(attr); setNewAttraction({name: attr.name, description: attr.description, location: attr.location}); setShowAttractionModal(true); }} className="btn btn-icon">✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Notes List similar to above */}
            <div className="notes-list">
              <h4>Travel Notes</h4>
              {notesByCurrentItinerary.length === 0 ? (
                <p className="empty-note-msg">No notes yet.</p>
              ) : (
                <table className="attraction-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Content Preview</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notesByCurrentItinerary.map(note => (
                      <tr key={note.id}>
                        <td style={{ fontWeight: 'bold' }}>{note.title}</td>
                        <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {note.content}
                        </td>
                        <td>{new Date(note.createdAt).toLocaleDateString()}</td>
                        <td>
                          {/* 新增容器 div，使用 flex 布局使按钮横向排列 */}
                          <div className="note-actions">
                            <button 
                              onClick={() => { 
                                setEditingNote(note); 
                                setNewNote({ title: note.title, content: note.content }); 
                                setShowNoteModal(true); 
                              }} 
                              className="btn btn-icon"
                              title="Edit Note"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={async () => {
                                if (window.confirm("Delete this note?")) {
                                  try {
                                    await indexedDBHelper.deleteNote(note.id);
                                    setNotes(prev => prev.filter(n => n.id !== note.id));
                                  } catch (err) {
                                    alert("Failed to delete note");
                                  }
                                }
                              }} 
                              className="btn btn-icon"
                              title="Delete Note"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Photo</h3><button className="close-btn" onClick={() => setShowPhotoModal(false)}>×</button></div>
            <div className="form-section">
              <input className="input-field" placeholder="Title" value={newPhoto.title} onChange={e => setNewPhoto({...newPhoto, title: e.target.value})} />
              
              <div className="photo-input-options">
                <label><input type="radio" checked={photoInputType === 'upload'} onChange={() => setPhotoInputType('upload')} /> Upload</label>
                <label><input type="radio" checked={photoInputType === 'camera'} onChange={() => setPhotoInputType('camera')} /> Camera</label>
              </div>

              {photoInputType === 'upload' && <input type="file" accept="image/*" onChange={handleFileUpload} />}
              
              {photoInputType === 'camera' && (
                <div className="camera-container">
                  {/* 始终渲染 video 标签，通过 CSS 或条件类控制显示，避免 DOM 频繁挂载卸载导致的问题 */}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted // 添加 muted 属性有助于自动播放
                    className={`camera-preview ${!isVideoReady || capturedImage ? 'hidden' : ''}`} 
                    style={{ display: (!isVideoReady || capturedImage) ? 'none' : 'block' }}
                  />
                  
                  {/* 加载状态提示 */}
                  {!isVideoReady && !capturedImage && (
                    <div className="camera-loading">Loading camera...</div>
                  )}

                  {/* 如果拍了照，显示图片预览 */}
                  {capturedImage && (
                    <img src={capturedImage} alt="Captured Preview" className="captured-preview" style={{ maxWidth: '100%', height: 'auto' }} />
                  )}

                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  <div className="camera-controls">
                    {/* 拍照按钮 */}
                    {!capturedImage && (
                      <button 
                        onClick={capturePhoto} 
                        disabled={!isVideoReady || isCapturing} 
                        className="btn btn-primary"
                      >
                        {isCapturing ? "Processing..." : "Take Photo"}
                      </button>
                    )}

                    {/* 重拍按钮 */}
                    {capturedImage && (
                      <button 
                        onClick={() => { 
                          setCapturedImage(null); 
                          setNewPhoto(p => ({...p, url: ""})); 
                          initCamera(); // 重新启动相机
                        }} 
                        className="btn btn-secondary"
                      >
                        Retake Photo
                      </button>
                    )}
                  </div>
                  
                  {/* 错误提示或权限引导 */}
                  {!isVideoReady && !capturedImage && photoInputType === 'camera' && (
                     <p style={{fontSize: '12px', color: 'red'}}>If camera doesn't load, check browser permissions.</p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              {/* 只有当有图片 URL 时才允许确认 */}
              <button 
                onClick={addPhotoComplete} 
                className="btn btn-primary" 
                disabled={!newPhoto.url}
              >
                Confirm
              </button>
              <button onClick={() => setShowPhotoModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {showAttractionModal && (
        <div className="modal-overlay" onClick={() => setShowAttractionModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAttraction ? "Edit" : "Add"} Attraction</h3>
              <button className="close-btn" onClick={() => setShowAttractionModal(false)}>×</button>
            </div>
            <div className="form-section">
              <input 
                className="input-field" 
                placeholder="Attraction Name" 
                value={newAttraction.name} 
                onChange={e => setNewAttraction({...newAttraction, name: e.target.value})} 
              />
              <textarea 
                className="input-field" 
                placeholder="Description" 
                value={newAttraction.description} 
                onChange={e => setNewAttraction({...newAttraction, description: e.target.value})} 
              />
              <div className="location-group">
                <input 
                  className="input-field" 
                  placeholder="Location" 
                  value={newAttraction.location} 
                  onChange={e => setNewAttraction({...newAttraction, location: e.target.value})} 
                />
                <button type="button" onClick={updateLocation} className="btn btn-secondary">📍 Get Current Location</button>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={saveAttractionComplete} className="btn btn-primary">Save</button>
              <button onClick={() => setShowAttractionModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingNote ? "Edit" : "Add"} Note</h3>
              <button className="close-btn" onClick={() => setShowNoteModal(false)}>×</button>
            </div>
            <div className="form-section">
              <input 
                className="input-field" 
                placeholder="Note Title" 
                value={newNote.title} 
                onChange={e => setNewNote({...newNote, title: e.target.value})} 
              />
              <textarea 
                className="input-field" 
                placeholder="Note Content" 
                rows="5"
                value={newNote.content} 
                onChange={e => setNewNote({...newNote, content: e.target.value})} 
              />
            </div>
            <div className="modal-actions">
              <button onClick={saveNoteComplete} className="btn btn-primary">Save</button>
              <button onClick={() => setShowNoteModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
{showPhotoGalleryModal && currentAttractionPhotos.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowPhotoGalleryModal(false)}>
          <div 
            className="modal-content gallery-modal" 
            onClick={e => e.stopPropagation()}
          >
            <div className="gallery-container">
              
              {/* 顶部栏：标题和关闭按钮 */}
              <div className="gallery-header">
                {/* 照片标题 */}
                <h3 className="gallery-title">
                  {currentAttractionPhotos[currentPhotoIndex]?.title || "Untitled Photo"}
                </h3>

                {/* 关闭按钮 */}
                <button 
                  onClick={() => setShowPhotoGalleryModal(false)}
                  className="gallery-close-btn"
                >
                  ×
                </button>
              </div>

              {/* 左侧导航：上一张 */}
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => Math.max(0, prev - 1)); }}
                disabled={currentPhotoIndex === 0}
                className="gallery-nav-btn prev-btn"
              >
                ‹
              </button>

              {/* 图片显示区域 */}
              <img 
                src={currentAttractionPhotos[currentPhotoIndex]?.url} 
                alt={currentAttractionPhotos[currentPhotoIndex]?.title || "Gallery Preview"} 
                className="gallery-image"
              />

              {/* 右侧导航：下一张 */}
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => Math.min(currentAttractionPhotos.length - 1, prev + 1)); }}
                disabled={currentPhotoIndex === currentAttractionPhotos.length - 1}
                className="gallery-nav-btn next-btn"
              >
                ›
              </button>

              {/* 底部栏：角标和操作按钮 */}
              <div className="gallery-footer">
                {/* 角标：当前页/总页数 */}
                <div className="gallery-counter">
                  {currentPhotoIndex + 1} / {currentAttractionPhotos.length}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentPhoto = currentAttractionPhotos[currentPhotoIndex];
                    if (currentPhoto) {
                      deletePhoto(currentPhoto.id, currentPhoto.attractionId);
                    }
                  }}
                  className="gallery-delete-btn"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelManager;