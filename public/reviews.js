import { onAuthStateChanged, getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { addDoc, collection, getDocs, query, where, deleteDoc, doc, getDoc, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Global variables
let currentUsername = "Guest";
let currentUserRole = null;
let currentUserId = null;
const auth = getAuth();

// Check auth & role
onAuthStateChanged(window.auth, async (user) => {
  if (user) {
    currentUsername = user.displayName || user.email || "Guest";
    currentUserId = user.uid;

    // Check from ADMIN collection
    const adminDoc = await getDoc(doc(window.db, "ADMIN", currentUserId));
    if (adminDoc.exists()) {
      currentUserRole = adminDoc.data().role || null;
      console.log("Role found in ADMIN:", currentUserRole);
    } else {
      // Check from users collection
      const userDoc = await getDoc(doc(window.db, "users", currentUserId));
      if (userDoc.exists()) {
        currentUserRole = userDoc.data().role || null;
        console.log("Role found in users:", currentUserRole);
      } else {
        currentUserRole = null;
        console.log("User not found in Firestore.");
        
        // Create user profile if doesn't exist (compatible with Flutter structure)
        await createUserProfile(currentUserId, currentUsername, user.email);
      }
    }

    // After role detection, render reviews
    const reviewForm = document.getElementById('reviewForm');
    const bookId = reviewForm?.getAttribute('book-id');
    if (bookId) {
      renderReviews(bookId);
    }

  } else {
    currentUserRole = null;
    currentUsername = "Guest";
    currentUserId = null;
    console.log("No user logged in.");
  }
});

// Create user profile (FIXED - compatible with Flutter app structure)
async function createUserProfile(userId, userName, email) {
  try {
    // Create user document with userId as document ID (same as Flutter)
    await doc(window.db, "users", userId).set({
      userName: userName, // Use userName (same as Flutter)
      email: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("User profile created for:", userId);
  } catch (error) {
    console.error("Error creating user profile:", error);
  }
}

// Function to render reviews (ENHANCED with edit feature)
export async function renderReviews(bookId) {
  const reviewList = document.getElementById('review-list');
  const noReviewMsg = document.getElementById('no-review-msg');
  reviewList.innerHTML = '';
  if (noReviewMsg) noReviewMsg.style.display = 'none';

  if (!bookId) {
    console.error("Book ID is not set");
    return;
  }

  console.log("=== RENDERING REVIEWS ===");
  console.log("Book ID:", bookId);
  console.log("Current user role:", currentUserRole);
  console.log("Firebase db:", window.db);

  if (!window.db) {
    console.error("Firebase database not initialized!");
    return;
  }

  try {
    console.log("Attempting to query reviews...");
    
    // FIXED: Handle different bookId formats between app and web
    // App uses: "/works/OL1380522W", Web uses: "OL1380522W" 
    const bookIdVariants = [
      bookId,                    // Original format
      `/works/${bookId}`,        // App format with /works/ prefix
      bookId.replace('/works/', '') // Remove /works/ prefix if present
    ];
    
    console.log("BookId variants to search:", bookIdVariants);
    
    // Try multiple queries for different book ID formats
    let allReviews = [];
    for (const variant of bookIdVariants) {
      try {
        const q = query(
          collection(window.db, "reviews"), 
          where("bookId", "==", variant),
          orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        console.log(`Query for bookId "${variant}" found ${querySnapshot.size} reviews`);
        
        querySnapshot.forEach((docSnap) => {
          // Avoid duplicates
          if (!allReviews.some(r => r.id === docSnap.id)) {
            allReviews.push({
              id: docSnap.id,
              ...docSnap.data()
            });
          }
        });
      } catch (orderError) {
        console.log(`OrderBy failed for ${variant}, trying without orderBy...`);
        // Fallback without orderBy
        try {
          const simpleQ = query(
            collection(window.db, "reviews"), 
            where("bookId", "==", variant)
          );
          const simpleSnapshot = await getDocs(simpleQ);
          
          simpleSnapshot.forEach((docSnap) => {
            if (!allReviews.some(r => r.id === docSnap.id)) {
              allReviews.push({
                id: docSnap.id,
                ...docSnap.data()
              });
            }
          });
        } catch (simpleError) {
          console.log(`Simple query also failed for ${variant}:`, simpleError);
        }
      }
    }
    
    console.log("Total unique reviews found:", allReviews.length);
    
    // Sort all reviews manually by createdAt
    allReviews.sort((a, b) => {
      const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
      const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
      return dateB - dateA; // Descending order
    });

    if (allReviews.length === 0) {
      console.log("No reviews found for any bookId variant");
      if (noReviewMsg) noReviewMsg.style.display = 'block';
    } else {
      console.log("Processing", allReviews.length, "unique reviews");
      
      allReviews.forEach((reviewData) => {
        console.log("Review data:", reviewData);
        
        const div = document.createElement('div');
        div.className = 'review-item mb-3';

        // FIXED: Handle date formatting from Flutter Timestamp
        let displayDate = 'Unknown date';
        if (reviewData.createdAt) {
          try {
            if (reviewData.createdAt.toDate) {
              // Firestore Timestamp object
              displayDate = reviewData.createdAt.toDate().toLocaleDateString();
            } else if (reviewData.createdAt.seconds) {
              // Timestamp with seconds
              displayDate = new Date(reviewData.createdAt.seconds * 1000).toLocaleDateString();
            } else if (typeof reviewData.createdAt === 'string') {
              // String date
              displayDate = new Date(reviewData.createdAt).toLocaleDateString();
            }
          } catch (e) {
            console.log("Date parsing error:", e);
            displayDate = 'Invalid date';
          }
        }

        // Show edited indicator if review was edited
        let editedIndicator = '';
        if (reviewData.updatedAt && reviewData.createdAt) {
          try {
            const createdTime = reviewData.createdAt.seconds || 0;
            const updatedTime = reviewData.updatedAt.seconds || 0;
            if (updatedTime > createdTime + 60) { // If updated more than 1 minute after creation
              editedIndicator = ' <small class="text-muted">(diedit)</small>';
            }
          } catch (e) {
            console.log("Error checking edit status:", e);
          }
        }

        // NEW: Show edit and delete buttons for admin or review owner
        let actionButtonsHTML = '';
        if (currentUserRole === 'admin' || (currentUserId && reviewData.userId === currentUserId)) {
          actionButtonsHTML = `
            <div class="review-actions mt-2">
              <button class="btn btn-sm btn-outline-primary edit-review-btn me-2" data-id="${reviewData.id}">
                Edit
              </button>
              <button class="btn btn-sm btn-danger delete-review-btn" data-id="${reviewData.id}">
                Hapus
              </button>
            </div>`;
        }

        // FIXED: Use consistent field names with Flutter app
        // Flutter uses: userName, text (could also have content), userId
        const displayName = reviewData.userName || reviewData.name || 'Anonymous';
        const reviewText = reviewData.text || reviewData.content || '';

        div.innerHTML = `
          <div class="card-review p-3 border rounded bg-light">
            <div class="review-header d-flex justify-content-between">
              <span class="review-name fw-bold">${displayName}</span>
              <span class="review-date text-muted">${displayDate}${editedIndicator}</span>
            </div>
            <div class="review-text mt-2" id="review-text-${reviewData.id}">${reviewText}</div>
            <div class="review-edit-form mt-2" id="edit-form-${reviewData.id}" style="display: none;">
              <textarea class="form-control mb-2" id="edit-text-${reviewData.id}" rows="3">${reviewText}</textarea>
              <button class="btn btn-sm btn-success save-edit-btn me-2" data-id="${reviewData.id}">Simpan</button>
              <button class="btn btn-sm btn-secondary cancel-edit-btn" data-id="${reviewData.id}">Batal</button>
            </div>
            ${actionButtonsHTML}
          </div>
        `;

        reviewList.appendChild(div);
        console.log("Added review to DOM:", displayName);
      });

      // NEW: Event handlers for edit buttons
      document.querySelectorAll('.edit-review-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const reviewId = this.getAttribute('data-id');
          showEditForm(reviewId);
        });
      });

      // NEW: Event handlers for save edit buttons
      document.querySelectorAll('.save-edit-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const reviewId = this.getAttribute('data-id');
          await saveEditedReview(reviewId, bookId);
        });
      });

      // NEW: Event handlers for cancel edit buttons
      document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const reviewId = this.getAttribute('data-id');
          cancelEdit(reviewId);
        });
      });

      // Event handler for delete buttons
      document.querySelectorAll('.delete-review-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const reviewId = this.getAttribute('data-id');
          if (confirm("Yakin ingin menghapus review ini?")) {
            await deleteReview(reviewId, bookId);
          }
        });
      });
    }
  } catch (error) {
    console.error("Error getting reviews: ", error);
    console.error("Error details:", error.message, error.code);
    
    // Show error message to user
    reviewList.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> Gagal memuat reviews. ${error.message}
        <br><small>Silakan refresh halaman atau hubungi admin.</small>
      </div>
    `;
  }
}

// NEW: Show edit form for a review
function showEditForm(reviewId) {
  const reviewText = document.getElementById(`review-text-${reviewId}`);
  const editForm = document.getElementById(`edit-form-${reviewId}`);
  
  if (reviewText && editForm) {
    reviewText.style.display = 'none';
    editForm.style.display = 'block';
    
    // Focus on textarea
    const textarea = document.getElementById(`edit-text-${reviewId}`);
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }
}

// NEW: Cancel edit and hide form
function cancelEdit(reviewId) {
  const reviewText = document.getElementById(`review-text-${reviewId}`);
  const editForm = document.getElementById(`edit-form-${reviewId}`);
  
  if (reviewText && editForm) {
    reviewText.style.display = 'block';
    editForm.style.display = 'none';
  }
}

// NEW: Save edited review
async function saveEditedReview(reviewId, bookId) {
  const textarea = document.getElementById(`edit-text-${reviewId}`);
  
  if (!textarea) {
    console.error("Textarea not found for review:", reviewId);
    return;
  }
  
  const newText = textarea.value.trim();
  
  if (!newText) {
    alert("Review tidak boleh kosong.");
    return;
  }
  
  try {
    console.log("Updating review:", reviewId);
    
    // Update the review document
    await updateDoc(doc(window.db, "reviews", reviewId), {
      text: newText,
      content: newText, // Also update content for compatibility
      updatedAt: serverTimestamp()
    });
    
    console.log("Review updated successfully");
    
    // Hide edit form and show updated text
    cancelEdit(reviewId);
    
    // Update the displayed text immediately
    const reviewTextElement = document.getElementById(`review-text-${reviewId}`);
    if (reviewTextElement) {
      reviewTextElement.textContent = newText;
    }
    
    // Refresh reviews after a short delay to show the "edited" indicator
    setTimeout(() => {
      renderReviews(bookId);
    }, 1000);
    
    alert("Review berhasil diperbarui!");
    
  } catch (error) {
    console.error("Error updating review:", error);
    alert("Gagal memperbarui review: " + error.message);
  }
}

// Delete review function
async function deleteReview(reviewId, bookId) {
  try {
    await deleteDoc(doc(window.db, "reviews", reviewId));
    console.log("Review deleted successfully");
    renderReviews(bookId); // Refresh the reviews list
  } catch (error) {
    console.error("Error deleting review:", error);
    alert("Gagal menghapus review. Silakan coba lagi.");
  }
}

// FIXED: Check if user already reviewed this book (handle different bookId formats)
async function checkExistingReview(userId, bookId) {
  try {
    console.log("Checking existing review for userId:", userId, "bookId:", bookId);
    
    if (!window.db) {
      console.error("Firebase db not available");
      return false;
    }
    
    // Check multiple bookId formats
    const bookIdVariants = [
      bookId,                    // Original format
      `/works/${bookId}`,        // App format with /works/ prefix
      bookId.replace('/works/', '') // Remove /works/ prefix if present
    ];
    
    for (const variant of bookIdVariants) {
      const q = query(
        collection(window.db, "reviews"),
        where("userId", "==", userId),
        where("bookId", "==", variant)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.log(`Existing review found with bookId: ${variant}`);
        return true;
      }
    }
    
    console.log("No existing review found for any bookId variant");
    return false;
  } catch (error) {
    console.error("Error checking existing review:", error);
    console.error("Error details:", error.message, error.code);
    return false;
  }
}

// Event listeners for form submission and toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleForm');
  const reviewFormContainer = document.getElementById('reviewFormContainer');
  const reviewForm = document.getElementById('reviewForm');
  const reviewText = document.getElementById('reviewText');

  if (toggleBtn && reviewFormContainer) {
    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      reviewFormContainer.style.display =
        reviewFormContainer.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      console.log("Form submitted!");
      console.log("Current user:", currentUsername, currentUserId);
      console.log("Firebase db:", window.db);

      if (currentUsername === "Guest" || !currentUserId) {
        console.log("User not logged in, showing modal");
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
        return;
      }

      const text = reviewText.value.trim();
      if (!text) {
        alert("Mohon isi review Anda.");
        return;
      }

      const bookId = reviewForm.getAttribute('book-id');
      console.log("Book ID:", bookId);
      
      if (!bookId) {
        console.error("bookId is empty!");
        alert("Book ID tidak ditemukan!");
        return;
      }

      // Check Firebase connection
      if (!window.db) {
        console.error("Firebase database not initialized!");
        alert("Koneksi database bermasalah!");
        return;
      }

      try {
        console.log("Checking for existing reviews...");
        // Check if user already reviewed this book
        const hasReviewed = await checkExistingReview(currentUserId, bookId);
        console.log("Has reviewed:", hasReviewed);
        
        if (hasReviewed) {
          alert("Anda sudah memberikan review untuk buku ini.");
          return;
        }

        console.log("Adding new review...");
        
        // FIXED: Create review with structure compatible with Flutter app
        // Need to handle different bookId formats between app and web
        const reviewData = {
          bookId: bookId,           // Keep original format from web
          userId: currentUserId,    // Same as Flutter  
          userName: currentUsername, // Same as Flutter
          text: text,               // Primary text field
          content: text,            // Also add content for compatibility
          createdAt: serverTimestamp(), // Same as Flutter
          updatedAt: serverTimestamp()  // Same as Flutter
        };

        console.log("Review data to be added:", reviewData);

        const docRef = await addDoc(collection(window.db, "reviews"), reviewData);
        console.log("Document written with ID: ", docRef.id);

        reviewText.value = '';
        reviewFormContainer.style.display = 'none';
        
        // Wait a bit before refreshing to allow Firestore to sync
        setTimeout(() => {
          renderReviews(bookId);
        }, 1000);
        
        alert("Review berhasil ditambahkan!");
        
      } catch (error) {
        console.error("Error adding review: ", error);
        console.error("Error details:", error.message, error.code);
        alert("Gagal menambahkan review: " + error.message);
      }
    });
  }
});

// Additional utility functions for compatibility

// Get review count for a book (FIXED - handle different bookId formats)
export async function getReviewCount(bookId) {
  try {
    const bookIdVariants = [
      bookId,
      `/works/${bookId}`,
      bookId.replace('/works/', '')
    ];
    
    let totalCount = 0;
    const foundIds = new Set(); // Avoid counting duplicates
    
    for (const variant of bookIdVariants) {
      const q = query(collection(window.db, "reviews"), where("bookId", "==", variant));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        if (!foundIds.has(doc.id)) {
          foundIds.add(doc.id);
          totalCount++;
        }
      });
    }
    
    return totalCount;
  } catch (error) {
    console.error("Error getting review count:", error);
    return 0;
  }
}

// Get user's reviews (FIXED - compatible with Flutter structure)
export async function getUserReviews(userId) {
  try {
    const q = query(
      collection(window.db, "reviews"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    const reviews = [];
    querySnapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    
    return reviews;
  } catch (error) {
    console.error("Error getting user reviews:", error);
    // Fallback without orderBy if index missing
    try {
      const simpleQuery = query(
        collection(window.db, "reviews"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(simpleQuery);
      
      const reviews = [];
      querySnapshot.forEach((doc) => {
        reviews.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort manually
      reviews.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
        const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
        return dateB - dateA;
      });
      
      return reviews;
    } catch (fallbackError) {
      console.error("Fallback getUserReviews also failed:", fallbackError);
      return [];
    }
  }
}