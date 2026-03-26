#!/usr/bin/env python3
"""
Test script to validate CCTV image misidentification fixes.
Tests three problematic cases from user report.
"""

import sys
import cv2
import numpy as np
import base64
from pathlib import Path

# Add parent to path
sys.path.insert(0, '/Users/Divyanand/Documents/DG-FRA/mroads-fra')

from utils import verify_user_np

def test_image(image_path, description, expected_result=None):
    """Test an image and report results."""
    print(f"\n{'='*70}")
    print(f"TEST: {description}")
    print(f"File: {image_path}")
    print(f"{'='*70}")
    
    if not Path(image_path).exists():
        print(f"ERROR: File not found: {image_path}")
        return False
    
    # Load image
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        print(f"ERROR: Could not load image")
        return False
    
    # Convert BGR to RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    print(f"Image shape: {img_rgb.shape}")
    print(f"Image stats - Mean: {np.mean(img_rgb):.2f}, Std: {np.std(img_rgb):.2f}")
    
    # Run verification
    try:
        person_id, score, per_model_scores, reason = verify_user_np(img_rgb)
        
        print(f"\nResult:")
        print(f"  Person ID: {person_id}")
        print(f"  Score: {score}")
        print(f"  Reason: {reason}")
        print(f"  Per-model scores:")
        for model, sim in per_model_scores.items():
            print(f"    {model}: {sim:.4f}")
        
        # Validate expectations
        if expected_result:
            if person_id == expected_result:
                print(f"\n✓ PASS: Got expected result '{expected_result}'")
                return True
            else:
                print(f"\n✗ FAIL: Expected '{expected_result}' but got '{person_id}'")
                return False
        else:
            # Check if this is a reasonable result
            if person_id == 'Unknown':
                print(f"\n✓ PASS: Correctly returned 'Unknown' (no high-confidence match)")
                return True
            else:
                print(f"\nℹ  Result: Matched to {person_id} with score {score}")
                return None  # Need manual verification
                
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    results = []
    
    print("\n" + "="*70)
    print("TESTING CCTV IMAGE MISIDENTIFICATION FIXES")
    print("="*70)
    
    # Test 1: Empty frame (Image 3) - should NOT match anyone
    # This is the most critical test - ghost face rejection
    print("\n[TEST 1] Empty office frame (should be rejected as no valid face)")
    result1 = test_image(
        "/Users/Divyanand/Documents/DG-FRA/mroads-fra/media/faces/camera1/Face Detection/20241205/test_empty.jpg",
        "Empty office scene - No actual face",
        expected_result="Unknown"
    )
    results.append(("Test 1 (Empty frame)", result1))
    
    # Test 2: Person in plaid shirt (Image 1) - should NOT match Niraj
    print("\n[TEST 2] CCTV full picture - plaid shirt")
    result2 = test_image(
        "/path/to/image1.jpg",  # Update with actual path
        "CCTV image - person in plaid shirt",
        expected_result="Unknown"  # Or specific person if you know who this is
    )
    results.append(("Test 2 (Plaid shirt)", result2))
    
    # Test 3: Low-res face with glasses (Image 2) - should NOT match Divyanand
    print("\n[TEST 3] Low-res face with glasses")
    result3 = test_image(
        "/path/to/image2.jpg",  # Update with actual path
        "Low-resolution face with glasses",
        expected_result="Unknown"  # Or specific person if you know who this is
    )
    results.append(("Test 3 (Glasses)", result3))
    
    # Summary
    print("\n\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)
    unknown = sum(1 for _, r in results if r is None)
    
    for name, result in results:
        if result is True:
            status = "✓ PASS"
        elif result is False:
            status = "✗ FAIL"
        else:
            status = "ℹ  MANUAL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {len(results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Require manual verification: {unknown}")
