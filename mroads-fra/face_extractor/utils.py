import cv2
import numpy as np
from deepface import DeepFace
import os

def adjust_gamma(image, gamma):
    """
    Adjusts the gamma of an image using a non-linear LUT.
    
    Args:
        image: np.array, uint8, BGR or RGB
        gamma: float, gamma value (e.g., 0.6 for brighten, 1.5 for darken)
    
    Returns:
        Adjusted image
    """
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
    return cv2.LUT(image, table)

def iou(box1, box2):
    """
    Calculate Intersection over Union (IoU) of two bounding boxes.
    
    Args:
        box1, box2: [x, y, w, h]
    
    Returns:
        float: IoU value
    """
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2
    
    # Convert to x1,y1,x2,y2
    x1_max = x1 + w1
    y1_max = y1 + h1
    x2_max = x2 + w2
    y2_max = y2 + h2
    
    # Intersection
    inter_x1 = max(x1, x2)
    inter_y1 = max(y1, y2)
    inter_x2 = min(x1_max, x2_max)
    inter_y2 = min(y1_max, y2_max)
    
    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    
    # Union
    union_area = w1 * h1 + w2 * h2 - inter_area
    
    if union_area == 0:
        return 0.0
    
    return inter_area / union_area

def enhance_face_crop(crop_rgb):
    """
    Enhances face crop with lighting normalization.
    - Converts RGB to LAB.
    - Applies CLAHE on L channel with clipLimit=4.0, tileGridSize=(4,4).
    - Merges back to LAB and converts to RGB.
    - Applies gamma correction (gamma ≈ 0.8).
    
    Args:
        crop_rgb: np.array, uint8, RGB
    
    Returns:
        Enhanced crop_rgb
    """
    # Convert to LAB
    lab = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    
    # Apply CLAHE
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(4, 4))
    l_clahe = clahe.apply(l)
    
    # Merge
    lab_clahe = cv2.merge([l_clahe, a, b])
    rgb_clahe = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2RGB)
    
    # Gamma correction
    gamma = 0.8
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
    rgb_gamma = cv2.LUT(rgb_clahe, table)
    
    return rgb_gamma

def is_face_quality_good(crop_enhanced, detector='default'):
    """
    Checks if enhanced face crop is good quality.
    
    Args:
        crop_enhanced: np.array, uint8, RGB
        detector: str, the detector used
    
    Returns:
        bool
    """
    gray = cv2.cvtColor(crop_enhanced, cv2.COLOR_RGB2GRAY)
    
    # Laplacian variance for blur
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    blur_threshold = 20 if detector == 'mtcnn' else 60  # Relax more for MTCNN
    if lap_var < blur_threshold:
        return False
    
    # Standard deviation for contrast
    std = np.std(gray)
    contrast_threshold = 4 if detector == 'mtcnn' else 12  # Relax more for MTCNN
    if std < contrast_threshold:
        return False
    
    # Mean brightness
    mean_bright = np.mean(gray)
    if mean_bright < 20 or mean_bright > 250:  # Relax brightness
        return False
    
    return True

def calculate_quality_score(crop_enhanced):
    """
    Computes quality score [0,1] based on sharpness and contrast.
    
    Args:
        crop_enhanced: np.array, uint8, RGB
    
    Returns:
        float
    """
    gray = cv2.cvtColor(crop_enhanced, cv2.COLOR_RGB2GRAY)
    
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    std = np.std(gray)
    
    sharpness_score = min(lap_var / 200.0, 1.0)
    contrast_score = min(std / 60.0, 1.0)
    quality_score = 0.6 * sharpness_score + 0.4 * contrast_score
    
    return quality_score

def detect_and_crop_faces(image_path):
    """
    Detects faces with lighting loop for harsh conditions.
    Uses OpenCV cascade (since RetinaFace has dependency issues), adjusts gamma if needed.
    Returns sorted list of high-quality 160x160 RGB face crops.
    
    Returns: List[dict] with 'confidence', 'quality_score', 'bbox', 'crop'
    """
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load image: {image_path}")
        return []
    print(f"Strict detection image shape: {img.shape}")
    img_height, img_width = img.shape[:2]
    gray_stats = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    print(f"Image stats - Mean: {np.mean(gray_stats):.2f}, Std: {np.std(gray_stats):.2f}")
    
    # OpenCV cascade classifier
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
    )
    
    from typing import List, Dict, Any
    all_faces: List[Dict[str, Any]] = []
    
    # Gamma values: original, shadows, highlights
    gammas = [1.0, 0.7, 1.4]
    
    for gamma in gammas:
        if gamma != 1.0:
            adjusted_img = adjust_gamma(img, gamma)
        else:
            adjusted_img = img
        
        gray = cv2.cvtColor(adjusted_img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces with cascade
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=5,   # Lowered from 8 to detect more faces in group photos
            minSize=(40, 40),
            maxSize=(600, 600)
        )
        
        print(f"Cascade detected {len(faces)} face(s) for gamma={gamma}")
        
        for (x, y, w, h) in faces:
            # Fully visible check
            if x < 0 or y < 0 or x + w > img_width or y + h > img_height:
                continue
            
            # Aspect ratio
            aspect_ratio = w / h
            if aspect_ratio < 0.5 or aspect_ratio > 2.0:
                continue
            
            # Get crop from original image
            crop_rgb = img[y:y+h, x:x+w]
            if crop_rgb.size == 0:
                continue
            crop_rgb = cv2.cvtColor(crop_rgb, cv2.COLOR_BGR2RGB)
            
            # CRITICAL: Reject ghost faces before enhancement
            if is_ghost_face(crop_rgb):
                print(f"Rejecting ghost face at [{x}, {y}, {w}, {h}]")
                continue
            
            # Enhance
            crop_enhanced = enhance_face_crop(crop_rgb)
            
            # Resize to 160x160
            crop_160 = cv2.resize(crop_enhanced, (160, 160), interpolation=cv2.INTER_LANCZOS4)
            
            # Quality score
            quality_score = calculate_quality_score(crop_160)
            
            all_faces.append({
                'confidence': 0.9,  # OpenCV cascade doesn't provide confidence
                'quality_score': quality_score,
                'bbox': [x, y, w, h],
                'crop': crop_160
            })
    
    # Sort by quality first so the highest quality crop survives!
    all_faces.sort(key=lambda x: x['quality_score'], reverse=True)
    
    unique_faces = []
    
    # Track the largest face size so we can filter out tiny background anomalies
    max_face_width = 0
    if all_faces:
        max_face_width = max(face['bbox'][2] for face in all_faces)

    for face in all_faces:
        duplicate = False
        fx, fy, fw, fh = face['bbox']
        fcx = fx + (fw / 2.0)
        fcy = fy + (fh / 2.0)
        
        # Relative size check: more relaxed for group photos (10% instead of 20%)
        if max_face_width > 120 and fw < max_face_width * 0.10:
            print(f"Rejecting face at {face['bbox']} because it is significantly smaller than the primary face ({fw} vs {max_face_width})")
            continue
            
        for uf in unique_faces:
            ux, uy, uw, uh = uf['bbox']
            ucx = ux + (uw / 2.0)
            ucy = uy + (uh / 2.0)
            
            # IoU check (increased threshold to 0.4 to prevent discarding people in tight groups)
            curr_iou = iou(face['bbox'], uf['bbox'])
            
            # Distance between centers vs face width
            dist = np.sqrt((fcx - ucx)**2 + (fcy - ucy)**2)
            
            # If the boxes heavily overlap or their centers are very close, it is the exact same person
            if curr_iou > 0.40 or dist < max(fw, uw) * 0.4:
                duplicate = True
                break
                
        if not duplicate:
            unique_faces.append(face)
    
    print(f"Returning {len(unique_faces)} unique high-quality faces from cascade")
    return unique_faces

def is_ghost_face(crop_rgb, min_variance=40, min_edge_gradient=15):
    """
    Detects if a detected 'face' is actually a ghost/artifact.
    
    A ghost face typically has:
    - Very uniform color (low variance)
    - Blurry edges (low gradient)
    - Very small or extreme aspect ratio
    
    Args:
        crop_rgb: np.array, uint8, RGB face crop
        min_variance: Minimum Laplacian variance to be considered a real face (lowered for CCTV)
        min_edge_gradient: Minimum edge gradient magnitude
    
    Returns:
        bool: True if likely a ghost face, False if likely real face
    """
    if crop_rgb is None or not isinstance(crop_rgb, np.ndarray):
        return True
    
    h, w = crop_rgb.shape[:2]
    
    # Check size
    if w < 30 or h < 30:
        return True
    
    # Extreme aspect ratio
    aspect_ratio = w / h
    if aspect_ratio < 0.5 or aspect_ratio > 2.0:
        return True
    
    # Convert to grayscale
    gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY) if len(crop_rgb.shape) == 3 else crop_rgb
    
    # Check variance (uniform color = ghost) - Lowered for CCTV and group photos
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = laplacian.var()
    if variance < 15:  # More tolerant than 40
        print(f"Ghost face detected: Low variance ({variance:.2f} < {min_variance})")
        return True
    
    # Check edge sharpness (blurry = ghost)
    edges = cv2.Canny(gray, 50, 150)
    edge_count = np.count_nonzero(edges)
    edge_ratio = edge_count / (h * w)
    if edge_ratio < 0.01:  # Less than 1% edge pixels
        print(f"Ghost face detected: Very blurry edges (ratio={edge_ratio:.4f})")
        return True
    
    return False

def detect_and_crop_faces_fallback(image_path):
    """
    More tolerant face detection fallback.
    Uses RetinaFace then MTCNN with very relaxed filters.
    Returns list of dicts: {'confidence', 'bbox', 'crop'} where crop is 160x160 RGB.
    """
    # Read the image
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        print(f"Failed to load image in fallback: {image_path}")
        return []
    print(f"Fallback image shape: {img_bgr.shape}")
    img_h, img_w = img_bgr.shape[:2]
    
    # Try RetinaFace first
    faces_data = None
    try:
        faces_data = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend="retinaface",
            enforce_detection=False,
            align=True
        )
    except Exception as e:
        print(f"RetinaFace fallback failed: {e}")
    
    # If no faces, try MTCNN
    if not faces_data:
        print("Trying MTCNN")
        try:
            faces_data = DeepFace.extract_faces(
                img_path=image_path,
                detector_backend="mtcnn",
                enforce_detection=False,
                align=True
            )
        except Exception as e:
            print(f"MTCNN fallback failed: {e}")
    
    # If still no faces, try Dlib
    if not faces_data:
        print("Trying Dlib")
        try:
            faces_data = DeepFace.extract_faces(
                img_path=image_path,
                detector_backend="dlib",
                enforce_detection=False,
                align=True
            )
            print(f"Dlib found {len(faces_data) if faces_data else 0} faces")
        except Exception as e:
            print(f"Dlib fallback failed: {e}")
            return []
    
    cropped_faces = []
    for face in faces_data:
        facial_area = face['facial_area']
        x, y, w, h = facial_area['x'], facial_area['y'], facial_area['w'], facial_area['h']
        confidence = face.get("confidence", 1.0)
        
        # Very relaxed filters
        if w < 20 or h < 20:
            print(f"Skipping face too small: w={w}, h={h}")
            continue
        # Removed bounds check to allow partial faces
        # if x < 0 or y < 0 or x + w > img_w or y + h > img_h:
        #     print(f"Skipping face out of bounds: x={x}, y={y}, w={w}, h={h}")
        #     continue
        
        # Get crop
        crop_rgb = face["face"]
        if crop_rgb.dtype != np.uint8:
            crop_rgb = (crop_rgb * 255).astype(np.uint8)
        
        # CRITICAL: Reject ghost faces (artifacts/no actual face) - Relaxed for group photos
        if is_ghost_face(crop_rgb, min_variance=40, min_edge_gradient=15):
            print(f"Rejecting ghost face at [{x}, {y}, {w}, {h}]")
            continue
        
        # Enhance for better quality
        crop_rgb = enhance_face_crop(crop_rgb)
        
        # Resize to 160x160
        crop_160 = cv2.resize(crop_rgb, (160, 160), interpolation=cv2.INTER_LANCZOS4)
        
        cropped_faces.append({
            "confidence": confidence,
            "bbox": [x, y, w, h],
            "crop": crop_160
        })
    
    unique_faces = []

    # Track the largest face size so we can filter out tiny ones
    max_face_width = 0
    if cropped_faces:
        max_face_width = max(face['bbox'][2] for face in cropped_faces)

    for face in cropped_faces:
        duplicate = False
        fx, fy, fw, fh = face['bbox']
        fcx = fx + (fw / 2.0)
        fcy = fy + (fh / 2.0)

        if max_face_width > 120 and fw < max_face_width * 0.10:
            print(f"Fallback rejecting face {face['bbox']} because it is significantly smaller than primary face ({fw} vs {max_face_width})")
            continue

        for uf in unique_faces:
            ux, uy, uw, uh = uf['bbox']
            ucx = ux + (uw / 2.0)
            ucy = uy + (uh / 2.0)
            
            curr_iou = iou(face['bbox'], uf['bbox'])
            dist = np.sqrt((fcx - ucx)**2 + (fcy - ucy)**2)
            
            if curr_iou > 0.40 or dist < max(fw, uw) * 0.4:
                duplicate = True
                break
                
        if not duplicate:
            unique_faces.append(face)

    return unique_faces

def detect_and_crop_faces_with_fallback(image_path):
    """
    Wrapper that uses RetinaFace (via fallback function) first, and intelligently 
    combines with Haarcascade detection if few faces are found.
    """
    # 1. Try high-quality RetinaFace detection first
    print(f"Running primary detection (RetinaFace)...")
    faces = detect_and_crop_faces_fallback(image_path)
    
    # 2. Only run fallback if ABSOLUTELY NO faces were detected
    if not faces:
        print(f"No faces found with RetinaFace. Running Haarcascade fallback...")
        fallback_faces = detect_and_crop_faces(image_path)
        
        # Merge results and deduplicate
        existing_bboxes = [f['bbox'] for f in faces]
        for f_new in fallback_faces:
            duplicate = False
            for b_old in existing_bboxes:
                if iou(f_new['bbox'], b_old) > 0.40:
                    duplicate = True
                    break
            if not duplicate:
                faces.append(f_new)
    
    return faces
