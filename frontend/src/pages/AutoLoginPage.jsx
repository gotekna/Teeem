import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AutoLoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Set the JWT token (valid for staging environment)
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjozNCwiZXhwIjoxNzY0MTMwMzAyfQ.V6yD2vtQm_Ew2rhUbbI4AnCFe1XW_7zFhjU3wmObQ2k';
    localStorage.setItem('token', token);

    console.log('✅ Token saved to localStorage!');
    console.log('🔐 Logged in as: Robert Harder (Admin)');
    console.log('📅 Token expires: November 25, 2027');

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigate('/', { replace: true });
      window.location.reload(); // Force reload to pick up the token
    }, 500);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md">
        <div className="text-6xl mb-6">🔐</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Logging you in...</h1>
        <p className="text-gray-600 mb-6">Setting up your session as Robert Harder (Admin)</p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    </div>
  );
}
