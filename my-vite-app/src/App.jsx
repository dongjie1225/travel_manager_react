import React, { useEffect } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from "react-router-dom";
import { useRegisterSW } from 'virtual:pwa-register/react'
import { indexedDBHelper } from './utils/IndexedDB';
import LoginPage from "./components/LoginPage";
import TravelApp from "./components/TravelApp";
import ScenicSpot from "./components/ScenicSpot";
import TravelManager from "./components/TravelManager";

// Simple Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
	const user = localStorage.getItem("currentUser");
	if (!user) {
		return <Navigate to="/" replace />;
	}
	return children;
};

function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    },
  });

  // 使用 useEffect 初始化数据库
  useEffect(() => {
    if (needRefresh) {
      // 这里可以显示一个 UI 提示用户刷新页面
      if (confirm('New content available. Reload?')) {
        updateServiceWorker(true);
      }
    }
    const initDB = async () => {
      try {
        console.log('Initializing IndexedDB...');
        await indexedDBHelper.init();
        console.log('IndexedDB initialized successfully.');
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
      }
    };

    initDB();
  }, [needRefresh, updateServiceWorker]);

	return (
		<Router>
			<Routes>
				<Route path="/" element={<LoginPage />} />
				<Route
					path="/TravelApp"
					element={
						<ProtectedRoute>
							<TravelApp />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/ScenicSpot"
					element={
						<ProtectedRoute>
							<ScenicSpot />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/TravelManager"
					element={
						<ProtectedRoute>
							<TravelManager />
						</ProtectedRoute>
					}
				/>
			</Routes>
		</Router>
	);
}

export default App;
