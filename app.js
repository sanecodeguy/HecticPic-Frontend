
const firebaseConfig = {
  apiKey: "AIzaSyB-mfXhYU_Zy3yudF4M1cnS0fouf2x_jLo",
  authDomain: "hecticpic-7e9cb.firebaseapp.com",
  projectId: "hecticpic-7e9cb",
  storageBucket: "hecticpic-7e9cb.appspot.com",
  messagingSenderId: "334616980885",
  appId: "1:334616980885:web:56446e12947489e0479a9c"
};


const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


const BACKEND_URL = 'https://hecticpic-production.up.railway.app';


function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}


function displayImages(images) {
  const imageGrid = document.getElementById('image-grid');
  if (!imageGrid) return;
  
  imageGrid.innerHTML = '';
  
  images.forEach((url, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
      <img src="${url}" alt="Uploaded image ${index + 1}" loading="lazy">
      <div class="image-actions">
        <span>#${index + 1}</span>
        <button class="view-btn" data-url="${encodeURIComponent(url)}">View</button>
      </div>
    `;
    
    const viewBtn = card.querySelector('.view-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        window.open(decodeURIComponent(viewBtn.dataset.url), '_blank');
      });
    }
    
    imageGrid.appendChild(card);
  });
}


async function loadImages() {
  const imageGrid = document.getElementById('image-grid');
  if (!imageGrid || !auth.currentUser) {
    console.error("Cannot load images - no user or grid element");
    return;
  }
  
  imageGrid.innerHTML = '<p class="loading">Loading your images...</p>';
  
  try {
    const userRef = db.collection('users').doc(auth.currentUser.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists && Array.isArray(userDoc.data()?.images)) {
      const images = userDoc.data().images;
      updateImageCount(images.length);
      
      if (images.length > 0) {
        displayImages(images);
        return;
      }
    }
    
    updateImageCount(0);
    imageGrid.innerHTML = '<p class="no-images">No images yet. Upload your first image!</p>';
    
  } catch (error) {
    console.error("Image load error:", error);
    showToast('Failed to load images. Please try again.', 'error');
    imageGrid.innerHTML = '<p class="error">Error loading images</p>';
  }
}


function updateImageCount(count) {
  const counter = document.getElementById('image-count');
  if (counter) counter.textContent = count;
}


function setupAuth() {
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
      }
      
      try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!');
        setTimeout(() => window.location.href = 'dashboard.html', 1000);
      } catch (error) {
        console.error("Login error:", error);
        showToast(getFirebaseError(error), 'error');
      }
    });
  }
  
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
      }
      
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
          email: email,
          images: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        showToast('Account created! Redirecting...');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
      } catch (error) {
        console.error("Signup error:", error);
        showToast(getFirebaseError(error), 'error');
      }
    });
  }
}


function getFirebaseError(error) {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Email already in use';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/user-not-found':
      return 'User not found';
    case 'auth/wrong-password':
      return 'Incorrect password';
    default:
      return error.message || 'Authentication failed';
  }
}


async function uploadImage() {
  const fileInput = document.getElementById('image-upload');
  const file = fileInput?.files[0];
  
  if (!file) {
    showToast('Please select an image first', 'error');
    return;
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    showToast('Only JPG, PNG, or GIF images are allowed', 'error');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToast('Image too large (max 8MB)', 'error');
    return;
  }

  const uploadBtn = document.getElementById('upload-btn');
  if (!uploadBtn) return;


  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  const progressBar = document.querySelector('.progress');
  if (progressBar) progressBar.style.width = '0%';

  try {
    const formData = new FormData();
    formData.append('image', file);

   
    const progressInterval = setInterval(() => {
      if (progressBar) {
        const progress = parseInt(progressBar.style.width) || 0;
        if (progress < 90) {
          progressBar.style.width = `${progress + 10}%`;
        }
      }
    }, 300);

 
    const response = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    clearInterval(progressInterval);
    if (progressBar) progressBar.style.width = '100%';

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result?.url) {
      throw new Error('No URL returned from server');
    }

   
    await db.collection('users').doc(auth.currentUser.uid).set({
      images: firebase.firestore.FieldValue.arrayUnion(result.url),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast('Image uploaded successfully!');
    loadImages();
    fileInput.value = ''; 

  } catch (error) {
    console.error("Upload error:", error);
    let errorMessage = 'Upload failed';
    if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Connection to server failed';
    } else if (error.message.includes('status')) {
      errorMessage = `Server error: ${error.message}`;
    }
    showToast(errorMessage, 'error');
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload to Discord';
    }
    setTimeout(() => {
      if (progressBar) progressBar.style.width = '0%';
    }, 1000);
  }
}


function setupDashboard() {
  if (!auth.currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const userEmail = document.getElementById('user-email');
  if (userEmail && auth.currentUser.email) {
    userEmail.textContent = auth.currentUser.email;
  }

  const uploadBtn = document.getElementById('upload-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const imageUpload = document.getElementById('image-upload');

  
  if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const preview = document.getElementById('image-preview');
        const previewContainer = document.getElementById('preview-container');
        if (preview && previewContainer) {
          preview.src = URL.createObjectURL(file);
          previewContainer.style.display = 'block';
          if (uploadBtn) uploadBtn.disabled = false;
        }
      }
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', uploadImage);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.signOut()
        .then(() => {
          showToast('Logged out successfully');
          setTimeout(() => window.location.href = 'index.html', 1000);
        })
        .catch(error => {
          console.error("Logout error:", error);
          showToast(error.message, 'error');
        });
    });
  }

 
  loadImages();
}


function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      if (window.location.pathname.endsWith('index.html')) {
        window.location.href = 'dashboard.html';
      } else {
        setupDashboard();
      }
    } else {
      if (!window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
      } else {
        setupAuth();
      }
    }
  });
}


document.addEventListener('DOMContentLoaded', initApp);
