import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { indexedDBHelper } from '../utils/indexedDB';
import '../compCSS/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setErrorMsg('');
    setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isRegister) {
        if (form.password !== form.confirmPassword) {
          setErrorMsg('The two password entries do not match');
          return;
        }
        if (form.password.length < 6) {
          setErrorMsg('The password length should be at least 6 characters');
          return;
        }
        
        const exists = await indexedDBHelper.usernameExists(form.username);
        if (exists) {
          setErrorMsg('The username already exists');
          return;
        }
        
        const userInfo = {
          username: form.username,
          password: form.password,
          createTime: Date.now()
        };
        
        await indexedDBHelper.registerUser(userInfo);
        alert('Registration successful, please log in');
        toggleMode();
      } else {
        const user = await indexedDBHelper.validateUser(form.username, form.password);
        localStorage.setItem('currentUser', JSON.stringify(user));
        navigate('/TravelApp');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const guestLogin = () => {
    const guestUser = {
      username: 'guest',
      password: '',
      createTime: Date.now(),
      isGuest: true
    };
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    navigate('/TravelApp');
  };

  return (
    <div className="login-container">
      <div className="background-overlay"></div>
      <div className="login-box">
        <h2 className="title">{isRegister ? 'Registration' : 'Login'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-item">
            <label>User Name</label>
            <input 
              name="username"
              value={form.username} 
              onChange={handleInputChange}
              type="text" 
              placeholder="Please enter your username"
              required
            />
          </div>
          
          <div className="form-item">
            <label>Password</label>
            <input 
              name="password"
              value={form.password} 
              onChange={handleInputChange}
              type="password" 
              placeholder="Please enter the password"
              required
            />
          </div>
          
          {isRegister && (
            <div className="form-item">
              <label>Confirm Password</label>
              <input 
                name="confirmPassword"
                value={form.confirmPassword} 
                onChange={handleInputChange}
                type="password" 
                placeholder="Please confirm the password"
                required
              />
            </div>
          )}
          
          {errorMsg && <div className="error-msg">{errorMsg}</div>}
          
          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Processing...' : (isRegister ? 'Register' : 'Login')}
          </button>
        </form>
        
        <div className="switch-mode">
          <span onClick={toggleMode}>
            {isRegister ? 'Have an account? Login' : 'No account? Go to register'}
          </span>
        </div>
        
        <div className="guest-access">
          <button onClick={guestLogin} className="guest-btn">
            Tourist visit
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;