import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { indexedDBHelper } from '../utils/IndexedDB';
import '../compCSS/ScenicSpot.css';

// 初始数据常量
const INITIAL_SPOTS = [
  {
    id: "spot_001",
    image: "https://pic.rmb.bdstatic.com/bjh/3ea15deaa2c/240821/b83ae2e3a69b82ca462699afc40d7b8c.jpeg",
    name: "Leshan Giant Buddha",
    description: "The Buddha is impressive. ",
    rating: 8.7,
    reviewsCount: 1025,
    review: "The Buddha is impressive. Initially was misled into the Buddhist scenic area, second visit was just a quick...",
  },
  {
    id: "spot_002",
    image: "https://pic.rmb.bdstatic.com/bjh/events/e8bb986688e29449e49710c47d1ddd608893.jpeg@h_1280",
    name: "Yangshuo Landscape",
    description: "Guilin scenery is the best under heaven, Yangshuo scenery is the best in Guilin",
    rating: 9.4,
    reviewsCount: 881,
    review: "I once crossed the Li River by raft in the wind and rain. The Nine Horse Fresco under the cloudy sky...",
  },
  {
    id: "spot_003",
    image: "https://q0.itc.cn/images01/20250828/5e25c3d2a1d4492996d902dd119df9e8.jpeg",
    name: "Xian City Wall",
    description: "Nice place. Rent a bike on the Yongning Gate tower and ride around",
    rating: 8.8,
    reviewsCount: 858,
    review: "Nice place. Rent a bike on the Yongning Gate tower and ride around",
  },
  {
    id: "spot_004",
    image: "https://qcloud.dpfile.com/pc/-i3NzFFrRUf7N-GPZa-D6pBgqMOH7cEi5TK6fMzRkmeXTyzltWS0cMQz64oljHcX.jpg",
    name: "Old Summer Palace",
    description: "Large imperial garden of Qing Dynasty China, not only gathering...",
    rating: 9.5,
    reviewsCount: 850,
    review: "Guess how many stars I had before being burned down",
  },
];

const ScenicSpot = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [spots, setSpots] = useState(INITIAL_SPOTS);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [currentSpot, setCurrentSpot] = useState(null);
  const [tempRating, setTempRating] = useState(5);
  const [tempReviewText, setTempReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check Login Status
  useEffect(() => {
    const checkUser = () => {
      const userStr = localStorage.getItem("currentUser");
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      } else {
        setCurrentUser(null);
      }
    };

    checkUser();
    window.addEventListener("storage", checkUser);
    return () => window.removeEventListener("storage", checkUser);
  }, []);

  // Load Reviews from IndexedDB
  useEffect(() => {
    const loadReviews = async () => {
      try {
        await indexedDBHelper.init();
        const allReviews = await indexedDBHelper.getAllReviews();
        
        setSpots(prevSpots => prevSpots.map(spot => {
          const review = allReviews.find(r => r.spotId === spot.id);
          if (review) {
            return {
              ...spot,
              review: review.reviewText,
              rating: review.rating * 2 // Convert back to 10-point scale if needed, or keep logic consistent
            };
          }
          return spot;
        }));
      } catch (error) {
        console.error("IndexDB initialization failed:", error);
      }
    };
    loadReviews();
  }, []);

  const isGuest = !currentUser || currentUser.isGuest;

  const filteredSpots = useMemo(() => {
    if (!searchQuery.trim()) return spots;
    return spots.filter(spot => 
      spot.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [spots, searchQuery]);

  const handleSearch = () => {
    console.log("Search keywords:", searchQuery);
  };

  const openReviewModal = (spot) => {
    if (isGuest) {
      alert("Please login to add or modify reviews");
      navigate('/');
      return;
    }
    setCurrentSpot(spot);
    setTempReviewText(spot.review || "");
    setTempRating(Math.round(spot.rating / 2) || 5);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentSpot(null);
    setTempRating(5);
    setTempReviewText("");
  };

  const submitReview = async () => {
    if (!currentSpot || isGuest) return;
    
    setIsSubmitting(true);
    try {
      const review = {
        spotId: currentSpot.id,
        spotName: currentSpot.name,
        rating: tempRating,
        reviewText: tempReviewText,
        createdAt: Date.now(),
      };

      await indexedDBHelper.saveReview(review);

      // Update local state
      setSpots(prev => prev.map(s => {
        if (s.id === currentSpot.id) {
          return {
            ...s,
            review: tempReviewText,
            rating: tempRating * 2
          };
        }
        return s;
      }));

      closeModal();
      alert("Review saved successfully!");
    } catch (error) {
      console.error("Save failed:", error);
      alert("Save failed, please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="scenic-spot-container">
      <header className="page-header">
        <h1 className="page-title">Attraction Reviews</h1>
      </header>

      <div className="search-bar">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="text"
          placeholder="search for scenic spots..."
          className="search-input"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="search-btn" onClick={handleSearch}>search</button>
      </div>

      <div className="scenic-list">
        {filteredSpots.map(spot => (
          <div key={spot.id} className="scenic-item" onClick={() => openReviewModal(spot)}>
            <div className="spot-info">
              <div className="spot-image-wrapper">
                <img src={spot.image} alt="scenic spot" className="spot-image" />
              </div>
              <div className="spot-details">
                <h3 className="spot-name">{spot.name}</h3>
                <p className="spot-description">{spot.description}</p>
              </div>
              <div className="rating-section">
                <div className="rating-score">
                  <span className="score">{spot.rating}</span>
                  <span className="reviews-count">{spot.reviewsCount} people rated</span>
                </div>
                <div className="stars">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`star ${i + 1 <= Math.round(spot.rating / 2) ? 'filled' : ''}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="user-review">
              <p className="review-text">{spot.review || "click to add a review"}</p>
            </div>
          </div>
        ))}

        {filteredSpots.length === 0 && (
          <div className="no-results">
            <p>No matching scenic spots were found.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{currentSpot?.name}</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>

            {isGuest ? (
              <div className="guest-notice">
                <p>🔒 Please login to add or modify reviews</p>
                <button onClick={() => { closeModal(); navigate('/'); }} className="login-link-btn">Go to Login</button>
              </div>
            ) : (
              <>
                <div className="modal-body">
                  <div className="rating-input">
                    <label>Your rating：</label>
                    <div className="star-rating">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`star ${i + 1 <= tempRating ? 'filled' : ''}`}
                          onClick={() => setTempRating(i + 1)}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="rating-value">{tempRating}.0</span>
                  </div>

                  <div className="review-input">
                    <label>review content：</label>
                    <textarea
                      value={tempReviewText}
                      onChange={(e) => setTempReviewText(e.target.value)}
                      placeholder="Share your travel experiences..."
                      rows="4"
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="cancel-btn" onClick={closeModal}>cancel</button>
                  <button
                    className="submit-btn"
                    onClick={submitReview}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "save the review"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenicSpot;
