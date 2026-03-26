import os
import requests
import time

# Configuration
TEST_IMAGES_DIR = r"C:/Users/br335/Documents/frs testing"
API_URL = "http://127.0.0.1:9090/verify"
MAX_IMAGES = 50

def test_images():
    if not os.path.exists(TEST_IMAGES_DIR):
        print(f"Error: Directory '{TEST_IMAGES_DIR}' not found.")
        return

    valid_extensions = ('.png', '.jpg', '.jpeg', '.webp')
    all_files = os.listdir(TEST_IMAGES_DIR)
    
    image_files = [f for f in all_files if f.lower().endswith(valid_extensions)]
    image_files.sort()
    image_files = image_files[:MAX_IMAGES]

    if not image_files:
        print(f"No valid image files found in '{TEST_IMAGES_DIR}'.")
        return

    print(f"Starting False-Positive Verification Test")
    print(f"Targeting Endpoint: {API_URL}")
    print(f"Testing {len(image_files)} unregistered masked images...")
    print("=" * 80)

    # Detailed report storage
    detailed_report = []

    for idx, img_name in enumerate(image_files):
        img_path = os.path.join(TEST_IMAGES_DIR, img_name)
        print(f"[{idx+1}/{len(image_files)}] Processing image: {img_name}...")
        
        img_data = {
            "filename": img_name,
            "status": "Error",
            "faces": []
        }
        
        try:
            with open(img_path, "rb") as f:
                files = {"file": (img_name, f, "image/jpeg")}
                response = requests.post(API_URL, files=files)
                
            if response.status_code == 200:
                result = response.json()
                message = result.get("message", "")
                
                if "No face detected" in message:
                    img_data["status"] = "No face detected"
                else:
                    img_data["status"] = "Faces detected"
                    # Capture every face found in the image
                    matches = result.get("matches", [])
                    
                    if not matches:
                        # Fallback if the endpoint returned an overall identity but didn't populate 'matches'
                        overall_identity = result.get("identity", "Unknown")
                        img_data["faces"].append({"face_idx": 1, "identity": overall_identity})
                    else:
                        for match in matches:
                            img_data["faces"].append({
                                "face_idx": match.get("face_idx", "Unknown_Idx"),
                                "identity": match.get("identity", "Unknown")
                            })
            else:
                img_data["status"] = f"Server Error: {response.status_code}"
                
        except Exception as e:
            img_data["status"] = f"Script Error: {str(e)}"

        detailed_report.append(img_data)

    print("\n" + "=" * 80)
    print("DETAILED FINAL REPORT:")
    print("=" * 80)
    
    total_images = len(image_files)
    total_faces_found = 0
    total_false_positives = 0
    total_missed_detections = 0 

    for item in detailed_report:
        print(f"File: {item['filename']}")
        print(f"  Status: {item['status']}")
        
        if item['status'] == "No face detected":
            total_missed_detections += 1
            print()
            continue
            
        if item['faces']:
            for face in item['faces']:
                identity = face['identity']
                face_idx = face['face_idx']
                
                total_faces_found += 1
                if identity != "Unknown":
                    total_false_positives += 1
                    print(f"    -> Face ID {face_idx}: ❌ {identity} (FALSE POSITIVE!)")
                else:
                    print(f"    -> Face ID {face_idx}: ✅ Unknown")
        print() 

    # Overall summary
    print("=" * 80)
    print("TEST SUMMARY (Unregistered Masked Faces):")
    print(f"Total Images Processed: {total_images}")
    print(f"Images with NO Face Detected: {total_missed_detections}")
    print(f"Total Individual Faces Found: {total_faces_found}")
    print(f"False Positives (Incorrectly Identified Faces): {total_false_positives}")
    print(f"True Negatives (Faces correctly labeled 'Unknown'): {total_faces_found - total_false_positives}")

if __name__ == "__main__":
    test_images()
