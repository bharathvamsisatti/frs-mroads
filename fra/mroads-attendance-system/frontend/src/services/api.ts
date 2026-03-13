// const API_BASE_URL = 'https://dev-fra.mroads.com';
// Separate URLs for different API sources
const DEV_SERVER_URL = import.meta.env.VITE_DEV_SERVER_URL || 'https://dev-fra.mroads.com';
const LOCAL_BACKEND_URL = import.meta.env.VITE_LOCAL_BACKEND_URL || 'http://localhost:8000';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || LOCAL_BACKEND_URL;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user_id?: string;
  name?: string;
  email?: string;
  token?: string;
  role?: string;
  error?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password?: string;
  files: File[];
}

export interface RegisterResponse {
  message?: string;
  error?: string;
}

export interface EnrollRequest {
  name: string;
  email: string;
  files: File[];
}

export interface EnrollResponse {
  message?: string;
  error?: string;
}

export interface VerifyResponse {
  identity?: string;
  average_score?: number;
  per_model_scores?: Record<string, number>;
  message?: string;
  error?: string;
}

export interface RecognizeRequest {
  content: string; // base64 string
}

export interface RecognizeResponse {
  message?: string;
  user_id?: string;
  person?: {
    id: string;
    email: string;
    image_url: string;
    name: string;
  };
  code?: number;
  error?: string;
}

export interface EnrolledResponse {
  enrolled_names: string[];
}

export interface UserDetailsResponse {
  person_id: string;
  user_id?: string;
  email: string;
  name: string;
  image_url: string;
  enrolled_images: Array<{
    filename: string;
    path: string;
    url: string;
  }>;
  embedding_count: number;
  models: string[];
  image_count?: number;
  attendance_percentage?: number;
  attendance_stats?: {
    total_attempts: number;
    success_count: number;
    failure_count: number;
    attendance_percentage: number;
    days: number;
  };
  error?: string;
}

export interface FaceExtractorResponse {
  request_id: string;
  original_image_url: string;
  faces: Array<{
    face_id: number;
    confidence: number;
    bbox: number[];
    crop_url: string;
  }>;
  error?: string;
}


// Login API - Updated for JWT authentication
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const formData = new FormData();
  formData.append('email', data.email);
  formData.append('password', data.password);

  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
};

// Register API (use dev server)
export const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('email', data.email);
  if (data.password) {
    formData.append('password', data.password);
  }
  data.files.forEach((file) => {
    formData.append('files', file);
  });

  // Use local backend for registration (JWT auth)
  const response = await fetch(`${LOCAL_BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
};


// Helper function to get auth headers with JWT token
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}

// Public Enroll API (no authentication required)
export const enrollPublic = async (data: EnrollRequest): Promise<EnrollResponse> => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('email', data.email);
  data.files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${LOCAL_BACKEND_URL}/api/enroll/public`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  console.log('Public Enroll API response:', result);
  return result;
};

// Admin Enroll API (requires JWT with admin role)
export const enrollAdmin = async (data: EnrollRequest): Promise<EnrollResponse> => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('email', data.email);
  data.files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${LOCAL_BACKEND_URL}/api/enroll/admin`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  const result = await response.json();
  console.log('Admin Enroll API response:', result);
  return result;
};

// Legacy enroll function - now points to admin enroll for backward compatibility
export const enroll = enrollAdmin;


// Verify API (use dev server)
export const verify = async (file: File): Promise<VerifyResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${DEV_SERVER_URL}/verify`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  console.log('Verify API response:', result);
  return result;
};

// Recognize API (use dev server)
export const recognize = async (data: RecognizeRequest): Promise<RecognizeResponse> => {
  try {
    const response = await fetch(`${DEV_SERVER_URL}/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Recognize API response:', result);
    return result;
  } catch (error: any) {
    console.error('Error in recognize API:', error);
    throw error;
  }
};

// Get User Details API
export const getUserDetails = async (userId: string): Promise<UserDetailsResponse> => {
  try {
    // Fetch user details by user_id (UUID)
    const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('User details fetched:', data);
    return data;
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError') || error?.name === 'TypeError') {
      console.error('⚠️ Backend server appears to be down.');
    }
    throw error;
  }
};

// Get Enrolled Users API (from local backend proxy to dev server)
export const getEnrolled = async (): Promise<EnrolledResponse> => {
  try {
    const response = await fetch(`${LOCAL_BACKEND_URL}/enrolled`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: any = await response.json();

    // Normalize different possible backend shapes into { enrolled_names: string[] }
    console.log('[/enrolled] raw response:', data);

    let enrolled_names: string[] = [];

    if (Array.isArray(data)) {
      // Backend returns plain array: ["user1", "user2"] or array of objects
      if (data.length > 0 && typeof data[0] === 'string') {
        enrolled_names = data as string[];
      } else {
        enrolled_names = (data as any[])
          .map((item) => item?.name || item?.user_name || item?.id || '')
          .filter((v: string) => v && typeof v === 'string');
      }
    } else if (Array.isArray(data.enrolled_names)) {
      // Expected shape from earlier implementation
      enrolled_names = data.enrolled_names;
    } else if (Array.isArray((data as any).enrolled)) {
      // Alternative common naming: { enrolled: [...] }
      enrolled_names = (data as any).enrolled;
    } else if (Array.isArray((data as any).users)) {
      // Another possible shape: { users: [...] }
      enrolled_names = (data as any).users
        .map((item: any) => item?.name || item?.user_name || item?.id || '')
        .filter((v: string) => v && typeof v === 'string');
    }

    return { enrolled_names };
  } catch (error: any) {
    console.error('Error fetching enrolled users:', error);
    // Check if it's a network error (backend not running)
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.code === 'ERR_NETWORK' || error.name === 'TypeError') {
      console.error('⚠️ Backend server appears to be down. Make sure the FastAPI server is running on http://localhost:8000');
      console.error('   Start the backend with: uvicorn main:app --reload');
    }
    return { enrolled_names: [] };
  }
};

// Face Extractor API
export const faceExtractor = async (file: File): Promise<FaceExtractorResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/face-extractor/upload`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  console.log('Face Extractor API response:', result);
  return result;
};

// Migrate API
export const migrate = async (): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/migrate`, {
    method: 'POST',
  });
  const result = await response.json();
  console.log('Migrate API response:', result);
  return result;
};

// Profile Update API
export interface UpdateProfileRequest {
  name: string;
  email: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const updateProfile = async (
  data: UpdateProfileRequest
): Promise<UpdateProfileResponse> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  console.log('Update Profile API response:', result);
  return result;
};

// Change Password API
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const changePassword = async (
  data: ChangePasswordRequest
): Promise<ChangePasswordResponse> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  console.log('Change Password API response:', result);
  return result;
};

// Update Profile Image API
export interface UpdateProfileImageResponse {
  success: boolean;
  image_url?: string;
  error?: string;
}

export const updateProfileImage = async (
  file: File
): Promise<UpdateProfileImageResponse> => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/profile/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const result = await response.json();
  console.log('Update Profile Image API response:', result);
  return result;
};

// Transactions API
export interface Transaction {
  id: string;
  person_id?: string;
  userName?: string;
  email?: string;
  user_id?: string;
  image_url?: string;
  captured_image_url?: string;
  cameraId?: string;
  cameraName?: string;
  timestamp: string;
  status: 'success' | 'failure' | 'in-progress' | 'warning';
  confidence: number;
  matchingMode: '1:1' | '1:N';
  capturedPhotoUrl?: string;
  registeredPhotoUrl?: string;
  processingTime?: number;
}

export interface CreateTransactionRequest {
  transaction_id: string;
  person_id?: string;
  user_name?: string;
  camera_id?: string;
  camera_name?: string;
  timestamp: string;
  status: string;
  confidence: number;
  matching_mode: string;
  captured_photo_url?: string;
  registered_photo_url?: string;
  processing_time?: number;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  count: number;
  error?: string;
}

export const createTransaction = async (data: CreateTransactionRequest): Promise<{ message: string; transaction_id: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  console.log('Create Transaction API response:', result);
  return result;
};

export const getTransactions = async (limit: number = 100, offset: number = 0): Promise<TransactionsResponse> => {
  try {
    // Fetch attendance transactions from local backend (attendance.db)
    let response;
    let apiUrl = `${LOCAL_BACKEND_URL}/api/transactions?limit=${limit}&offset=${offset}`;

    try {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      // If api/transactions fails, try other possible endpoints
      console.log('Trying alternative endpoints...');
      const alternatives = [
        `${LOCAL_BACKEND_URL}/transactions?limit=${limit}&offset=${offset}`,
        `${LOCAL_BACKEND_URL}/recognize/results?limit=${limit}&offset=${offset}`,
        `${LOCAL_BACKEND_URL}/api/recognize/history?limit=${limit}&offset=${offset}`
      ];

      for (const altUrl of alternatives) {
        try {
          console.log(`Trying: ${altUrl}`);
          response = await fetch(altUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) break;
        } catch (altError) {
          console.log(`Failed: ${altUrl}`);
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error('All transaction endpoints failed');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      return { transactions: [], count: 0, error: `HTTP error! status: ${response.status}` };
    }

    const data: any = await response.json();
    console.log('[getTransactions] Response:', data);
    return data;
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError') || error?.name === 'TypeError') {
      console.error('⚠️ Backend server appears to be down.');
    }
    return { transactions: [], count: 0, error: error?.message || 'Unknown error' };
  }
};

