import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../compCSS/TravelApp.css';

const TravelApp = () => {
  const navigate = useNavigate();
  
  // State
  const [hoveredCard, setHoveredCard] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Refs for DOM manipulation
  const featuresRef = useRef(null);

  // Static Data
  const statsData = [
    { number: "500+", label: "Global Destinations" },
    { number: "10K+", label: "Satisfied Users" },
    { number: "24/7", label: "24/7 Service" },
    { number: "100%", label: "Security Guarantee" },
  ];

  const featuresData = [
    {
      number: 0,
      icon: "🗺️",
      title: "Trip Planning",
      description: "Plan your itinerary based on your preferences and time, set your route, and discover hidden gems",
    },
    {
      number: 1,
      icon: "📱",
      title: "Attraction Rating",
      description: "Rate attractions based on your experience and feelings, helping more people learn about the scenery along the way",
    },
  ];

  const footerLinks = [
    { text: "About Us" },
    { text: "Privacy Policy" },
    { text: "Terms of Service" },
    { text: "Help Center" },
    { text: "Contact Us" },
  ];

  // --- Effects ---

  useEffect(() => {
    checkDevice();
    initTheme();
    initPWA();
    
    // Add scroll animations after mount
    addScrollAnimations();

    window.addEventListener("resize", checkDevice);
    
    return () => {
      window.removeEventListener("resize", checkDevice);
    };
  }, []);

  // --- Methods ---

  const checkDevice = () => {
    setIsMobile(window.innerWidth <= 768);
  };

  const initTheme = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDarkMode(true);
    } else {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        setDarkMode(true);
      } else if (savedTheme === "light") {
        setDarkMode(false);
      }
    }
  };

  // Apply theme class to document body/html whenever darkMode changes
  useEffect(() => {
    applyTheme();
  }, [darkMode]);

  const applyTheme = () => {
    if (darkMode) {
      document.documentElement.classList.add("dark-mode");
      document.body.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
      document.body.classList.remove("dark-mode");
    }
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem("theme", !darkMode ? "dark" : "light");
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const initPWA = () => {
    let deferredPrompt;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallButton(deferredPrompt);
    });
    window.addEventListener("appinstalled", () => {
      console.log("The app has been installed!");
    });
  };

  const showInstallButton = (deferredPrompt) => {
    console.log("PWA installation prompt is available!");
  };

  const addScrollAnimations = () => {
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-in");
        }
      });
    }, observerOptions);

    // Use setTimeout to ensure DOM is ready if not using refs specifically for these items
    // Or query directly since this runs in useEffect after mount
    const elements = document.querySelectorAll(".feature-card, .stat-item");
    elements.forEach((card) => {
      card.classList.add("animate-out");
      observer.observe(card);
    });
  };

  const startExploring = () => {
    console.log("Start Exploring button clicked");
    const featuresSection = document.getElementById("features");
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const viewDestinations = () => {
    console.log("View Destinations button clicked");
  };

  const checkLoginStatus = () => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      return { isLoggedIn: false, isGuest: false };
    }
    const user = JSON.parse(currentUser);
    return {
      isLoggedIn: true,
      isGuest: user.isGuest || false,
      userInfo: user,
    };
  };

  const exploringFun = (feature) => {
    console.log("Feature list button clicked");
    if (feature.number === 0) {
      // Trip Planning
      const loginStatus = checkLoginStatus();
      if (!loginStatus.isLoggedIn || loginStatus.isGuest) {
        alert("Please login");
      } else {
        console.log("Plan itinerary");
        navigate("/TravelManager");
      }
    } else if (feature.number === 1) {
      // Attraction Rating
      navigate("/ScenicSpot").catch(err => {
        console.error("Navigation failed:", err);
        if (err.name !== 'NavigationDuplicated') {
           alert("Page navigation failed, please try again");
        }
      });
    }
  };

  return (
    <div className={`travel-app ${darkMode ? 'dark-mode' : ''}`}>
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🏔️</span>
            <span>Travel Tracker</span>
          </div>
          <nav className="nav-menu">
            <div className="theme-toggle" onClick={toggleTheme}>
              <span className={`theme-icon ${darkMode ? 'sun-icon' : 'moon-icon'}`}>
                {darkMode ? "☀️" : "🌙"}
              </span>
            </div>
            {isMobile && (
              <div className="menu-toggle" onClick={toggleMenu}>
                <span className={`hamburger ${menuOpen ? 'active' : ''}`}></span>
              </div>
            )}
            <ul className={`nav-list ${menuOpen ? 'mobile-open' : ''}`}>
              <li><a href="#home" onClick={closeMenu}>Home</a></li>
              <li><a href="#features" onClick={closeMenu}>Features</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <h1>Explore the Beauty of the World</h1>
            <p>
              A simple travel management platform that makes every trip an
              unforgettable memory. Discover beautiful scenery, plan your
              itinerary, and enjoy your journey.
            </p>
            <div className="btn-container">
              <button className="btn primary-btn" onClick={startExploring}>
                Start Exploring
              </button>
              <button className="btn outline-btn" onClick={viewDestinations}>
                View Destinations
              </button>
            </div>
          </div>
        </section>

        <div className="container">
          <div className="stats">
            {statsData.map((stat, index) => (
              <div className="stat-item" key={index}>
                <span className="stat-number">{stat.number}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          <section id="features">
            <div className="section-title">
              <h2>Core Features</h2>
            </div>
            <div className="features">
              {featuresData.map((feature, index) => (
                <div
                  className="feature-card"
                  key={index}
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(-1)}
                  onClick={() => exploringFun(feature)}
                >
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer>
        <div className="footer-content">
          <div className="footer-links">
            {footerLinks.map((link, index) => (
              <a
                href="#"
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  closeMenu();
                }}
              >
                {link.text}
              </a>
            ))}
          </div>
          <p className="copyright">
            © 2026 Travel Tracker. All rights reserved. Make every trip a
            beautiful memory
          </p>
        </div>
      </footer>
    </div>
  );
};

export default TravelApp;